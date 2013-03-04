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
  #if doc?.created then console.log doc.created
  if doc instanceof mongoose.Document
    parseMongoose doc.toObject getters: yes
  else if doc instanceof mongoose.Types.ObjectId
    doc.toHexString()
  else if _.isArray doc
    (parseMongoose el for el in doc)
  else if doc instanceof Date
    doc
  else if _.isObject doc
    result = {}
    for key, value of doc
      result[key] = parseMongoose value
    result.id = doc.pub_id
    delete result.pub_id
    delete result["__v"]
    result
  else
    doc

makeSync = (handlers) ->
  (method, model, options) ->
    success = options?.success or ->
    error = options?.error or ->
    handlers[method] model, success, error, options

# bb.Track::sync = makeSync
#   read: (model, success, error, options) ->
#     mo.Track
#       .findOne(pub_id: model.id)

#TODO: break up this megafunction
bb.User::sync = makeSync
  read: (model, success, error, options) ->
    mo.User
      .findOne(pub_id: model.id)
      .exec (err, user) ->
        return error model, err, options if err or not user?
        mo.Track
          .find(user: user.id)
          #.populate('env', 'pub_id')
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
                  .exec (err, cars) ->
                    return error model, err, options if err

                    parsedCars = (parseMongoose car for car in cars)
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
                      parsedTrack.env = envsById[track.env] if track.env
                      parsedTrack
                    bb.Track.build track for track in parsedTracks

                    parsed = parseMongoose user
                    parsed.tracks = parsedTracks
                    success model, parsed, options

#for model in ['User', 'Track']
#  bb[model]::sync = syncModel mo[model]

# NO MONGOOSE BEYOND THIS POINT

bb.User::toPublic = (opts) ->
  include = [ 'id', 'bio', 'location', 'name', 'website' ]
  include.push 'tracks' if opts.tracks
  _.pick @toJSON(), include

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

serializeModel = (model, context = new DataContext) ->
  seen = context.witness model
  if seen
    id: model.id
  else
    result = {}
    for key, value of model.attributes
      if key in ['_id', 'object_id', 'email', 'admin', 'created', 'modified']
        continue
      else if value instanceof bb.Model
        result[key] = serializeModel value, context
      else if value instanceof bb.BackboneCollection
        result[key] = (serializeModel model, context for model in value.models)
      else if _.isArray value
        for item in value
          if item instanceof bb.Model
            result[key] = serializeModel item, context
          else
            result[key] = item
      else
        #console.log value
        result[key] = value
    result

# bb.TrackCollection::toPublic = ->
#   exclude = [ 'object_id', 'config' ]
#   #include = [ 'id', 'bio', 'location', 'name', 'website' ]
#   (_.omit entry, exclude for entry in @toJSON())

# UTILITY FUNCTIONS

findUser = (pub_id, done) ->
  user = bb.User.findOrCreate(id: pub_id)
  return done user if user.name?  # Already in the Store.
  user.fetch
    success: -> done user
    error: -> done null

# THE PUBLIC API

module.exports = (app) ->
  base = '/v1'

  error404 = (res) -> res.json 404, error: "Not Found"

  boolean = (val) -> val? and val in ['1', 't', 'y', 'true', 'yes']

  app.get "#{base}/users/:user_id", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return error404 res unless user?
      res.json serializeModel user
      return
      res.json
        users: [
          user.toPublic
            tracks: boolean req.query.with_tracks
        ]

  ###
  app.get "#{base}/users/:user_id/tracks", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return error404 res unless user?
      user.tracks.fetch
        success: -> res.json user.tracks.toPublic()
        error: -> error404 res
  ###

  app.get "#{base}/*", (req, res) -> error404 res

  return
