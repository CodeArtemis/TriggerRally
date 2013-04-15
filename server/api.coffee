_ = require('underscore')
bb = require('./public/scripts/models')
Backbone = bb.Backbone

# Attach backbone models to MongoDB via Mongoose.
require('./backbone-mongoose') bb

jsonClone = (obj) -> JSON.parse JSON.stringify obj

findModel = (Model, pub_id, done) ->
  model = Model.findOrCreate pub_id
  model.fetch
    success: -> done model
    error:   -> done null

findCar   = -> findModel(bb.Car,   arguments...)
findEnv   = -> findModel(bb.Env,   arguments...)
findTrack = -> findModel(bb.Track, arguments...)
findUser  = -> findModel(bb.User,  arguments...)

# This public-facing API is responsible for validating requests and data.

module.exports = (app) ->
  base = '/v1'

  jsonError = (code, res, msg) ->
    text =
      400: "Bad Request - might be a bug"
      401: "Unauthorized - log in required"
      403: "Forbidden"
      404: "Not Found"
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

  loadUrlTrack = (req, res, next) -> loadUrl findTrack, 'track_id', 'track', req, res, next
  loadUrlUser  = (req, res, next) -> loadUrl findUser, 'user_id', 'user', req, res, next

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
        return jsonError 400, res, "expired: expected #{modifiedExpected} but got #{modifiedActual}"
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
      res.json car

  app.get "#{base}/envs/:env_id", (req, res) ->
    findEnv req.params['env_id'], (env) ->
      return jsonError 404, res unless env?
      # allowedEnvs = [ 'alp' ]
      # if req.user?
      #   allowedEnvs = allowedEnvs.concat req.user.user.packs
      # restricted = env.id not in allowedEnvs
      res.json env #.toJSON { restricted }

  app.post "#{base}/tracks", (req, res) ->
    return jsonError 401, res unless req.user?
    findUser req.user.user.pub_id, (reqUser) ->
      return jsonError 500, res unless reqUser
      parentTrackId = req.body.parent
      findTrack parentTrackId, (parentTrack) ->
        return jsonError 400, res unless parentTrack?.env?
        # TODO: Check this user is allowed to copy tracks from this env.
        track = new bb.Track
        track.set track.parse
          parent: parentTrack.id
          user: reqUser.id
          name: parentTrack.name + ' copy'
          env: parentTrack.env.id
          config: jsonClone parentTrack.config
        track.save null,
          user: req.user.user
          success: (track) ->
            res.json track
            reqUser.tracks.add track
            parentTrack.count_copy += 1
            parentTrack.save()
          error: (model, err) ->
            console.log "Error creating track: #{err}"
            jsonError 500, res

  app.get "#{base}/tracks/:track_id", loadUrlTrack, (req, res) ->
    res.json req.fromUrl.track

  # TODO: Restore this more efficient multi-track GET.
  # app.get "#{base}/tracks/:track_id", (req, res) ->
  #   trackIds = req.params['track_id'].split('+')
  #   tracks = []
  #   done = _.after trackIds.length, ->
  #     for track in tracks
  #       return jsonError 404, res unless track?
  #     data = if tracks.length > 1 then tracks else tracks[0]
  #     res.json data
  #   trackIds.forEach (trackId, i) ->
  #     findTrack trackId, (track) ->
  #       tracks[i] = track
  #       done()

  app.put "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
    # Keys that the user has full control over.
    allowedKeys = [ 'config', 'name', 'published' ]
    filterAndSaveIfModified req.fromUrl.track, allowedKeys, req, res

  app.delete "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
    req.fromUrl.track.destroy
      success: -> res.json {}
      error:   -> jsonError 500, res

  app.get "#{base}/users/:user_id", loadUrlUser, (req, res) ->
    user = req.fromUrl.user
    authenticated = user.id is req.user?.user.pub_id
    res.json user.toJSON { authenticated }

  app.put "#{base}/users/:user_id", editUrlUser, (req, res) ->
    # Keys that the user has full control over.
    allowedKeys = [ 'name', 'picture' ]
    filterAndSaveIfModified req.fromUrl.user, allowedKeys, req, res

  app.get "#{base}/auth/me", (req, res) ->
    if req.user?.user
      findUser req.user.user.pub_id, (user) ->
        return jsonError 404, res unless user?
        res.json user: user
    else
      res.json user: null
    return

  app.get "#{base}/*", (req, res) -> jsonError 404, res

  return
