_ = require('underscore')
bb = require('./public/scripts/models')
Backbone = bb.Backbone

jsonClone = (obj) -> JSON.parse JSON.stringify obj

# BACKBONE TO MONGOOSE LAYER

# This layer provides no real security. It just syncs Backbone models to the DB.

# TODO: Move this layer to a separate module.

mongoose = require('mongoose')
mo = do ->
  Car:   mongoose.model('Car')
  Env:   mongoose.model('Environment')
  Run:   mongoose.model('Run')
  Track: mongoose.model('Track')
  User:  mongoose.model('User')

parseMongoose = (doc) ->
  #if doc?.prefs then console.log doc.prefs
  if doc instanceof mongoose.Document
    parseMongoose doc.toObject getters: yes
  else if doc instanceof mongoose.Types.ObjectId
    "[ObjectId]"
  else if _.isArray doc
    (parseMongoose el for el in doc)
  else if doc instanceof Date
    doc
  else if _.isObject doc
    result = {}
    for key, value of doc
      result[key] = parseMongoose value
    result.id = doc.pub_id if doc.pub_id
    delete result.pub_id
    delete result._id
    delete result["__v"]
    result
  else
    doc

makeSync = (handlers) ->
  (method, model, options) ->
    success = options?.success or ->
    error = options?.error or ->
    if handlers[method]
      handlers[method] model, success, error, options
    else
      err = "Method '#{method}' not implemented for #{model.constructor.name}."
      console.log err
      error model, err, options
    # TODO: return a Promise object of some sort.
    null

bb.Car::sync = makeSync
  read: (model, success, error, options) ->
    mo.Car
      .findOne(pub_id: model.id)
      .populate('user', 'pub_id')
      .exec (err, car) ->
        return error model, err, options if err
        return error model, "Couldn't find env #{model.id}", options unless car
        parsed = parseMongoose car
        parsed.user = parsed.user.id if parsed.user
        success model, parsed, options

bb.Env::sync = makeSync
  read: (model, success, error, options) ->
    mo.Env
      .findOne(pub_id: model.id)
      .exec (err, env) ->
        return error model, err, options if err
        return error model, "Couldn't find env #{model.id}", options unless env
        mo.Car
          .find(_id: { $in: env.cars })
          .select('pub_id')
          .exec (err, cars) ->
            return error model, err, options if err
            parsed = parseMongoose env
            parsed.cars = (car.pub_id for car in cars)
            success model, parsed, options

bb.Track::sync = do ->
  parseTrack = (track) ->
    parsed = parseMongoose track
    parsed.env = parsed.env.id if parsed.env
    parsed.parent = parsed.parent.id if parsed.parent
    parsed.user = parsed.user.id if parsed.user
    parsed

  makeSync
    create: (model, success, error, options) ->
      mo.Track
        .findOne(pub_id: model.parent.id)
        .exec (err, parentTrack) ->
          return error model, err, options if err
          return error model, "Couldn't find track #{model.parent.id}", options unless parentTrack
          track = new mo.Track
            parent: parentTrack.id
            user: options.user.id
            name: parentTrack.name + ' copy'
            env: parentTrack.env
            config: parentTrack.config
          track.save (err) ->
            if err
              console.log "Error creating track: #{err}"
              return error model, null, options
            success model, parseTrack(track), options
    read: (model, success, error, options) ->
      mo.Track
        .findOne(pub_id: model.id)
        .populate('env', 'pub_id')
        .populate('parent', 'pub_id')
        .populate('user', 'pub_id')
        .exec (err, track) ->
          return error model, err, options if err
          return error model, "Couldn't find track #{model.id}", options unless track
          success model, parseTrack(track), options
    update: (model, success, error, options) ->
      # console.log "Saving track:"
      # console.log JSON.stringify model
      unless model.config?
        console.error "Saving track: NO CONFIG!"
        console.log JSON.stringify model
        return error model, null, options
      mo.Track
        .findOne(pub_id: model.id)
        .exec (err, track) ->
          data = jsonClone model
          _.extend track, _.pick data, [
            'config'
            'count_copy'
            'count_drive'
            'count_fav'
            'modified'
            'name'
            'published'
          ]
          track.save (err) ->
            if err
              console.log "Error saving track: #{err}"
              return error model, null, options
            success model, null, options
    delete: (model, success, error, options) ->
      mo.Track
        .findOne(pub_id: model.id)
        .exec (err, track) ->
          track.remove (err) ->
            if err
              console.log "Error deleting track: #{err}"
              return error model, null, options
            success model, null, options

bb.User::sync = makeSync
  read: (model, success, error, options) ->
    mo.User
      .findOne(pub_id: model.id)
      .exec (err, user) ->
        return error model, err, options if err or not user?
        mo.Track
          .find(user: user.id)
          .select('pub_id')
          .exec (err, tracks) ->
            return error model, err, options if err
            parsed = parseMongoose user
            parsed.tracks = (track.pub_id for track in tracks)
            success model, parsed, options

# NO MONGOOSE BEYOND THIS POINT

# UTILITY FUNCTIONS

findModel = (Model, pub_id, done) ->
  model = Model.findOrCreate pub_id
  model.fetch
    success: -> done model
    error:   -> done null

findCar   = -> findModel(bb.Car,   arguments...)
findEnv   = -> findModel(bb.Env,   arguments...)
findTrack = -> findModel(bb.Track, arguments...)
findUser  = -> findModel(bb.User,  arguments...)

# THE PUBLIC API

# This public-facing layer is responsible for validating requests and data.

module.exports = (app) ->
  base = '/v1'

  jsonError = (code, res, msg) ->
    text =
      400: "Bad Request"
      401: "Unauthorized"
      403: "Forbidden"
      404: "Not Found"
    result = { error: text[code] }
    result.extended = msg if msg
    res.json code, result

  boolean = (val) -> val? and val in ['1', 't', 'y', 'true', 'yes']

  app.get "#{base}/cars/:car_id", (req, res) ->
    findCar req.params['car_id'], (car) ->
      return jsonError 404, res unless car?
      res.json car

  app.get "#{base}/envs/:env_id", (req, res) ->
    findEnv req.params['env_id'], (env) ->
      return jsonError 404, res unless env?
      res.json env

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

  loadUrlTrack = (req, res, next) ->
    findTrack req.params['track_id'], (track) ->
      return jsonError 404, res unless track?
      req.apiUrlData or= {}
      req.apiUrlData.track = track
      next()

  editUrlTrack = (req, res, next) ->
    loadUrlTrack req, res, ->
      track = req.apiUrlData.track
      # Real security check.
      return jsonError 403, res unless track.user.id is req.user?.user.pub_id
      # Opt-in sanity checks to help protect against client bugs.
      return jsonError 400, res, 'id mismatch' if req.body.id and req.body.id isnt track.id
      modifiedExpected = track.modified.toISOString()
      modifiedActual = req.body.modified
      if modifiedActual and modifiedActual isnt modifiedExpected
        return jsonError 400, res, "expired: expected #{modifiedExpected} but got #{modifiedActual}"
      next()

  app.get "#{base}/tracks/:track_id", loadUrlTrack, (req, res) ->
    res.json req.apiUrlData.track

  app.put "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
    track = req.apiUrlData.track
    # Keys that the user has full control over.
    allowedKeys = [ 'config', 'name', 'published' ]
    attribs = _.pick req.body, allowedKeys
    prev = jsonClone _.pick track, allowedKeys
    if _.isEqual prev, attribs
      console.log "track #{track.id} (#{track.name}): no changes to save"
      return res.json {}
    if 'config' of attribs and not _.isEqual prev.config, attribs.config
      attribs.modified = new Date
    console.log "track #{track.id} (#{track.name}): saving changes"
    track.save attribs,
      success: -> res.json {}
      error:   -> jsonError 500, res

  app.delete "#{base}/tracks/:track_id", editUrlTrack, (req, res) ->
    req.apiUrlData.track.destroy
      success: -> res.json {}
      error:   -> jsonError 500, res

  app.get "#{base}/users/:user_id", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return jsonError 404, res unless user?
      authenticated = user.id is req.user?.user.pub_id
      res.json user.toJSON { authenticated }

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
