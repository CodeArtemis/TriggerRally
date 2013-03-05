_ = require('underscore')

bb = require('./public/scripts/models')

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
    handlers[method] model, success, error, options

###
bb.User::sync = makeSync
  read: (model, success, error, options) ->
    mo.User
      .findOne(pub_id: model.id)
      .exec (err, user) ->
        return error model, err, options if err or not user?
        mo.Track
          .find(user: user.id)
          .populate('parent', 'pub_id')
          .exec (err, tracks) ->
            return error model, err, options if err
            envIds = _.uniq (track.env.toHexString() for track in tracks when track.env)
            mo.Env
              .find(_id: { $in: envIds })
              .exec (err, envs) ->
                return error model, err, options if err
                carIds = ((car.toHexString() for car in env.cars) for env in envs)
                carIds = _.uniq _.flatten carIds
                mo.Car
                  .find(_id: { $in: carIds })
                  .populate('user', 'pub_id')
                  .exec (err, cars) ->
                    return error model, err, options if err

                    parsedCars = for car in cars
                      parsedCar = parseMongoose car
                      parsedCar.user = _.pick parsedCar.user, 'id' if parsedCar.user?
                      parsedCar
                    #bb.Car.build car for car in parsedCars
                    carsById = _.object ([car.id, parsedCars[i]] for car, i in cars)

                    parsedEnvs = for env in envs
                      parsedEnv = parseMongoose env
                      parsedEnv.cars = (carsById[car] for car in env.cars)
                      parsedEnv
                    #bb.Env.build env for env in parsedEnvs
                    envsById = _.object ([env.id, parsedEnvs[i]] for env, i in envs)

                    parsedTracks = for track in tracks
                      parsedTrack = parseMongoose track
                      parsedTrack.parent = _.pick parsedTrack.parent, 'id' if parsedTrack.parent?
                      parsedTrack.env = envsById[track.env] if track.env
                      parsedTrack
                    #bb.Track.build track for track in parsedTracks

                    parsed = parseMongoose user
                    parsed.tracks = parsedTracks
                    success model, parsed, options
###

bb.Env::sync = makeSync
  read: (model, success, error, options) ->
    mo.Env
      .findOne(pub_id: model.id)
      .exec (err, env) ->
        return error model, err, options if err or not env?
        mo.Car
          .find(_id: { $in: env.cars })
          .select('pub_id')
          .exec (err, cars) ->
            return error model, err, options if err
            parsed = parseMongoose env
            parsed.cars = ({id: car.pub_id} for car in cars)
            success model, parsed, options

bb.Track::sync = makeSync
  read: (model, success, error, options) ->
    mo.Track
      .findOne(pub_id: model.id)
      .populate('env', 'pub_id')
      .populate('parent', 'pub_id')
      .populate('user', 'pub_id')
      .exec (err, track) ->
        return error model, err, options if err or not track?
        parsed = parseMongoose track
        parsed.env = id: parsed.env.id if parsed.env
        parsed.parent = id: parsed.parent.id if parsed.parent
        parsed.user = id: parsed.user.id if parsed.user
        success model, parsed, options

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
            parsed.tracks = ({id: track.pub_id} for track in tracks)
            success model, parsed, options

#for model in ['User', 'Track']
#  bb[model]::sync = syncModel mo[model]

# NO MONGOOSE BEYOND THIS POINT

###
bb.User::toPublic = (opts) ->
  include = [ 'id', 'bio', 'location', 'name', 'website' ]
  include.push 'tracks' if opts.tracks
  _.pick @toJSON(), include
###

###
class DataContext
  constructor: ->
    @data = {}

  witness: (model) ->
    try
      url = _.result model, 'url'
    catch e
      # Object does not have a URL mapping, so always treat it as unseen.
      return no
    seen = @data[url]?
    # In future, this may contain the actual data and/or a timestamp.
    @data[url] = yes
    seen

  scanValue: (value) ->
    if value instanceof bb.BackboneModel
      @scanModel value
    else if value instanceof bb.BackboneCollection
      @scanArray value.models
    else if _.isArray value
      @scanArray value
    else if _.isObject value
      @scanObject value
    else
      #console.log value
      value

  scanModel: (model) ->
    seen = @witness model
    if seen
      id: model.id
    else
      @scanObject model.attributes

  scanObject: (object) ->
    result = {}
    for key, value of object
      continue if key in ['_id', 'object_id', 'email', 'admin', 'created', 'modified', 'prefs']
      scanned = @scanValue value
      result[key] = scanned if scanned?
    console.log result
    if _.isEmpty result then null else result

  scanArray: (array) ->
    result = for item in array
      @scanValue item
    if _.isEmpty result then null else result
###

# bb.TrackCollection::toPublic = ->
#   exclude = [ 'object_id', 'config' ]
#   #include = [ 'id', 'bio', 'location', 'name', 'website' ]
#   (_.omit entry, exclude for entry in @toJSON())

# UTILITY FUNCTIONS

findModel = (Model, pub_id, done) ->
  model = Model.findOrCreate id: pub_id
  return done model if model.name?  # Already in the Store.
  model.fetch
    success: -> done model
    error:   -> done null

findEnv   = -> findModel(bb.Env,   arguments...)
findTrack = -> findModel(bb.Track, arguments...)
findUser  = -> findModel(bb.User,  arguments...)

# THE PUBLIC API

module.exports = (app) ->
  base = '/v1'

  error404 = (res) -> res.json 404, error: "Not Found"

  boolean = (val) -> val? and val in ['1', 't', 'y', 'true', 'yes']

  app.get "#{base}/tracks/:track_id", (req, res) ->
    findTrack req.params['track_id'], (track) ->
      return error404 res unless track?
      track.env.fetch
        success: -> res.json track.toJSON()
        error:   -> error404 res unless track?

  app.get "#{base}/users/:user_id", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return error404 res unless user?
      res.json user.toJSON()

  app.get "#{base}/auth/user", (req, res) ->
    if req.user?.user
      findUser req.user.user.pub_id, (user) ->
        return error404 res unless user?
        res.json user: user.toJSON()
    else
      res.json user: null
    return

  app.get "#{base}/*", (req, res) -> error404 res

  return
