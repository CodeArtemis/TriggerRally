_ = require('underscore')
bb = require('./public/scripts/models')
Backbone = bb.Backbone

# Disable all caching on the server.
bb.Model::useCache = no

# Attach backbone models to MongoDB via Mongoose.
require('./backbone-mongoose') bb

jsonClone = (obj) -> JSON.parse JSON.stringify obj

findModel = (Model, pub_id, done) ->
  model = Model.findOrCreate pub_id
  result = model.fetch
    success: -> done model
    error:   -> done null
  done null if result is false

findCar         = -> findModel(bb.Car,        arguments...)
findCommentSet  = -> findModel(bb.CommentSet, arguments...)
findEnv         = -> findModel(bb.Env,        arguments...)
findRun         = -> findModel(bb.Run,        arguments...)
findTrack       = -> findModel(bb.Track,      arguments...)
findTrackRuns   = -> findModel(bb.TrackRuns,  arguments...)
findTrackSet    = -> findModel(bb.TrackSet,   arguments...)
findUser        = -> findModel(bb.User,       arguments...)

# This public-facing API is responsible for validating requests and data.

module.exports =
  findUser: findUser
  setup: (app) ->
    base = '/v1'

    jsonError = (code, res, msg) ->
      text =
        400: "Bad Request - client bug"
        401: "Unauthorized - log in required"
        403: "Forbidden"
        404: "Not Found"
        409: "Conflict"
      result = { error: text[code] }
      result.extended = msg if msg
      res.json code, result

    boolean = (val) -> val? and val in ['1', 't', 'y', 'true', 'yes']

    loadUrl = (finder, param, attrib, req, res, next) ->
      finder req.params[param], (obj) ->
        return jsonError 404, res unless obj?
        req.fromUrl or= {}
        req.fromUrl[attrib] = obj
        next()

    loadUrlCommentSet = (req, res, next) ->
      loadUrl findCommentSet, 'commentset_id', 'commentSet', req, res, next
    loadUrlRun = (req, res, next) ->
      loadUrl findRun, 'run_id', 'run', req, res, next
    loadUrlTrack = (req, res, next) ->
      loadUrl findTrack, 'track_id', 'track', req, res, next
    loadUrlTrackRuns = (req, res, next) ->
      loadUrl findTrackRuns, 'track_id', 'trackRuns', req, res, next
    loadUrlTrackSet = (req, res, next) ->
      loadUrl findTrackSet, 'trackset_id', 'trackSet', req, res, next
    loadUrlUser = (req, res, next) ->
      loadUrl findUser, 'user_id', 'user', req, res, next

    editUrlTrack = (req, res, next) ->
      loadUrlTrack req, res, ->
        track = req.fromUrl.track
        # Real security check.
        return jsonError 401, res unless req.user?
        return jsonError 403, res unless track.user.id is req.user.user.pub_id
        # Opt-in sanity checks to help protect against client bugs.
        return jsonError 400, res, 'id mismatch' if req.body.id and req.body.id isnt track.id
        modifiedExpected = track.modified.toISOString()
        modifiedActual = req.body.modified
        if modifiedActual and modifiedActual isnt modifiedExpected
          return jsonError 409, res, "expired: expected #{modifiedExpected} but got #{modifiedActual}"
        next()

    editUrlUser = (req, res, next) ->
      loadUrlUser req, res, ->
        user = req.fromUrl.user
        return jsonError 401, res unless req.user?
        return jsonError 403, res unless user.id is req.user.user.pub_id
        next()

    filterAndSaveIfModified = (model, allowedKeys, req, res) ->
      attribs = _.pick req.body, allowedKeys
      prev = jsonClone _.pick model, allowedKeys
      if _.isEqual prev, attribs
        console.log "#{model.constructor.name} #{model.id}: no changes to save"
        return res.json {}
      if 'config' of attribs and not _.isEqual prev.config, attribs.config
        attribs.modified = new Date
      console.log "#{model.constructor.name} #{model.id}: saving changes"
      model.save attribs,
        success: -> res.json { modified: attribs.modified }
        error:   -> jsonError 500, res

    app.get "#{base}/cars/:car_id", (req, res) ->
      findCar req.params['car_id'], (car) ->
        return jsonError 404, res unless car?
        products = req.user?.user.products
        res.json car.toJSON { products }

    app.post "#{base}/comments", (req, res) ->
      return jsonError 401, res unless req.user?
      findUser req.user.user.pub_id, (reqUser) ->
        return jsonError 500, res unless reqUser
        # TODO: Check that the comment parent/target actually exists.
        comment = new bb.Comment
          parent: req.body.parent
          text: req.body.text
        result = comment.save null,
          user: req.user.user
          success: (comment) ->
            res.json comment
          error: (model, err) ->
            console.log "Error creating comment: #{err}"
            jsonError 500, res
        if result is false
          console.log "Error creating comment: save failed"
          jsonError 500, res

    app.get "#{base}/commentsets/:commentset_id", loadUrlCommentSet, (req, res) ->
      res.json req.fromUrl.commentSet

    app.get "#{base}/envs/:env_id", (req, res) ->
      findEnv req.params['env_id'], (env) ->
        return jsonError 404, res unless env?
        # allowedEnvs = [ 'alp' ]
        # if req.user?
        #   allowedEnvs = allowedEnvs.concat req.user.user.packs
        # restricted = env.id not in allowedEnvs
        res.json env #.toJSON { restricted }

    app.get "#{base}/runs/:run_id", (req, res) ->
      findRun req.params['run_id'], (run) ->
        return jsonError 404, res unless run?
        if run.record_p
          res.json run
        else
          run.fetch
            force: yes
            success: -> res.json run
            error: -> jsonError 500, res

    app.post "#{base}/tracks", (req, res) ->
      return jsonError 401, res unless req.user?
      findUser req.user.user.pub_id, (reqUser) ->
        return jsonError 500, res unless reqUser
        parentTrackId = req.body.parent
        findTrack parentTrackId, (parentTrack) ->
          return jsonError 404, res unless parentTrack?
          return jsonError 400, res unless parentTrack.env?
          return jsonError 403, res unless parentTrack.env.id is 'alp'
          return jsonError 403, res if parentTrack.prevent_copy
          # TODO: Check this user is allowed to copy tracks from this env.
          track = new bb.Track
          newName = parentTrack.name
          maxLength = bb.Track::maxNameLength - 5
          if newName.length > maxLength then newName = newName.slice(0, maxLength - 3) + '...'
          newName += ' copy'
          track.set track.parse
            config: jsonClone parentTrack.config
            env: parentTrack.env.id
            name: newName
            parent: parentTrack.id
            prevent_copy: parentTrack.prevent_copy
            user: reqUser.id
          result = track.save null,
            user: req.user.user
            success: (track) ->
              res.json track
              reqUser.tracks.add track
              parentTrack.count_copy += 1
              parentTrack.save()
            error: (model, err) ->
              console.log "Error creating track: #{err}"
              jsonError 500, res
          if result is false
            console.log "Error creating track: save failed"
            jsonError 500, res

    # TODO: Add a multi-ID track GET.
    app.get "#{base}/tracks/:track_id", loadUrlTrack, (req, res) ->
      res.json req.fromUrl.track

    # app.get "#{base}/tracks/:track_id/runs", loadUrlTrack, (req, res) ->
    #   trackRuns = new bb.TrackRuns null, track: req.fromUrl.track
    #   trackRuns.fetch
    #     success: (collection) ->
    #       res.json collection
    #     error: (collection, err) ->
    #       console.log "Error creating track: #{err}"
    #       jsonError 500, res

    app.get "#{base}/tracks/:track_id/runs", loadUrlTrackRuns, (req, res) ->
      res.json req.fromUrl.trackRuns

    # app.get "#{base}/tracks/:track_id/bestrun", loadUrlTrack, (req, res) ->
    #   req.fromUrl.track.getBestRun (run) ->
    #     return jsonError 404, res unless run?
    #     res.json { run }

    # app.get "#{base}/tracks/:track_id/personalbestrun", loadUrlTrackRuns, (req, res) ->
    #   res.json req.fromUrl.trackRuns

    app.put "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
      track = req.fromUrl.track
      allowedKeys = [ 'name', 'prevent_copying' ]
      unless track.published
        allowedKeys = allowedKeys.concat [ 'config', 'published' ]
      filterAndSaveIfModified track, allowedKeys, req, res

    app.post "#{base}/tracks/:track_id/drive", loadUrlTrack, (req, res) ->
      res.send 200
      # Now handled by drive socket.
      # track = req.fromUrl.track
      # track.save { count_drive: track.count_drive + 1 }

    app.delete "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
      jsonError 403, res if req.fromUrl.track.id is 'v3-base-1'
      req.fromUrl.track.destroy
        success: -> res.json {}
        error:   -> jsonError 500, res

    app.get "#{base}/tracksets/:trackset_id", loadUrlTrackSet, (req, res) ->
      res.json req.fromUrl.trackSet

    app.get "#{base}/users/:user_id", loadUrlUser, (req, res) ->
      user = req.fromUrl.user
      authenticated = user.id is req.user?.user.pub_id
      res.json user.toJSON { authenticated }

    app.put "#{base}/users/:user_id", editUrlUser, (req, res) ->
      products = req.fromUrl.user.products ? []
      maySetPicture = 'ignition' in products or 'mayhem' in products or 'packa' in products
      return jsonError 403, res if 'picture' of req.body and not maySetPicture
      allowedKeys = [
        'favorite_tracks'
        'name'
        'picture'
      ]
      filterAndSaveIfModified req.fromUrl.user, allowedKeys, req, res

    app.get "#{base}/auth/me", (req, res) ->
      if req.user?.user
        findUser req.user.user.pub_id, (user) ->
          return jsonError 404, res unless user?
          res.json user: user.toJSON { authenticated: yes }
      else
        res.json user: null
      return

    # Give a JSON 404 response for any unknown path under /v1/.
    app.get "#{base}/*", (req, res) -> jsonError 404, res

    return
