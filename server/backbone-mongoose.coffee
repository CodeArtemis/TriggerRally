# This layer is not intended to be secure. It just syncs Backbone models to the DB.

_ = require 'underscore'
mongoose = require 'mongoose'
mo = do ->
  Car:   mongoose.model 'Car'
  Env:   mongoose.model 'Environment'
  Run:   mongoose.model 'Run'
  Track: mongoose.model 'Track'
  User:  mongoose.model 'User'

jsonClone = (obj) -> JSON.parse JSON.stringify obj

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

module.exports = (bb) ->
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
          .populate('env', 'pub_id')
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
              parsed = parseTrack(track)
              # Hacky workaround for Mongoose population/ext ref problem.
              # It would be nice to get rid of Mongoose.
              parsed.user = options.user.pub_id
              parsed.env = parentTrack.env.pub_id
              success model, parsed, options
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
        unless model.config?
          console.error "Saving track: NO CONFIG!"
          console.log JSON.stringify model
          return error model, null, options
        mo.Track
          .findOne(pub_id: model.id)
          .exec (err, track) ->
            data = jsonClone model
            # TODO: Check if it's safe to just copy everything from the model.
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
            .select('pub_id env')
            .exec (err, tracks) ->
              return error model, err, options if err
              parsed = parseMongoose user
              parsed.tracks = (track.pub_id for track in tracks when track.env)
              success model, parsed, options
    update: (model, success, error, options) ->
      mo.User
        .findOne(pub_id: model.id)
        .exec (err, user) ->
          data = jsonClone model
          # TODO: Check if it's safe to just copy everything from the model.
          _.extend user, _.pick data, [
            'name'
            'picture'
            'products'
          ]
          user.save (err) ->
            if err
              console.log "Error saving user: #{err}"
              return error model, null, options
            success model, null, options
