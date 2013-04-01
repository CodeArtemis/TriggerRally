_ = require('underscore')
bb = require('./public/scripts/models')
Backbone = bb.Backbone

jsonClone = (obj) -> JSON.parse JSON.stringify obj

# BACKBONE TO MONGOOSE LAYER

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
          # It's not our job to do security checks at this layer.
          _.extend track, _.pick model, [
            'count_copy'
            'count_drive'
            'count_fav'
            'name'
            'published'
          ]
          newConfig = jsonClone model.config
          unless _.isEqual newConfig, track.config
            track.config = JSON.parse newConfig
            track.modified = new Date
          track.save (err) ->
            if err
              console.log "Error saving track: #{err}"
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

module.exports = (app) ->
  base = '/v1'

  jsonError = (code, res) ->
    text =
      400: "Bad Request"
      401: "Unauthorized"
      403: "Forbidden"
      404: "Not Found"
    res.json code, { error: text[code] }

  boolean = (val) -> val? and val in ['1', 't', 'y', 'true', 'yes']

  app.get "#{base}/cars/:car_id", (req, res) ->
    findCar req.params['car_id'], (car) ->
      return jsonError 404, res unless car?
      res.json car

  app.get "#{base}/envs/:env_id", (req, res) ->
    findEnv req.params['env_id'], (env) ->
      return jsonError 404, res unless env?
      res.json env

  app.get "#{base}/tracks/:track_id", (req, res) ->
    trackIds = req.params['track_id'].split('+')
    tracks = []

    done = _.after trackIds.length, ->
      for track in tracks
        return jsonError 404, res unless track?
      data = if tracks.length > 1 then tracks else tracks[0]
      res.json data

    trackIds.forEach (trackId, i) ->
      findTrack trackId, (track) ->
        tracks[i] = track
        done()

  app.put "#{base}/tracks/:track_id", (req, res) ->
    findTrack req.params['track_id'], (track) ->
      return jsonError 404, res unless track?
      return jsonError 403, res unless track.user.id is req.user?.user.pub_id
      # Keys that the user has full control over.
      allowedKeys = [ 'config', 'name', 'published' ]
      attribs = _.pick req.body, allowedKeys
      prev = _.pick track, allowedKeys
      unless _.isEqual prev, attribs
        track.save attribs,
          success: -> res.json {}
          error:   -> jsonError 500, res
      else
        console.log "track #{track.id} (#{track.name}): no changes to save"
        res.json {}

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
            console.log "Error saving track: #{err}"
            jsonError 500, res

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
