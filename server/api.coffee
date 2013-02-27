_ = require('underscore')

bb = require('./public/scripts/models')

# BACKBONE TO MONGOOSE LAYER

mo = do ->
  mongoose = require('mongoose')
  Car:   mongoose.model('Car')
  Run:   mongoose.model('Run')
  Track: mongoose.model('Track')
  User:  mongoose.model('User')

parseMongoose = (attributeNames, response) ->
  attribs = {}
  for name in attributeNames
    attribs[name] = response[name]
  attribs.id = response.pub_id
  attribs.object_id = response._id
  attribs

syncModel = (Model) ->
  (method, model, options) ->
    success = options.success or ->
    error = options.error or ->

    switch method
      when 'read'
        Model
          .findOne(pub_id: model.id)
          .exec (err, doc) ->
            return error model, err, options if err or not doc?
            parsed = parseMongoose model.attributeNames, doc.toObject(virtuals:yes)
            success model, parsed, options
      else
        error model, "#{method} method not implemented", options
    return

makeSync = (handlers) ->
  (method, model, options) ->
    success = options.success or ->
    error = options.error or ->
    handlers[method] model, success, error

bb.User::sync = makeSync
  read: (model, success, error) ->
    mo.User
      .findOne(pub_id: model.id)
      .exec (err, user) ->
        return error model, err, options if err or not user?
        mo.Track
          .find(user: user.id)
          .populate('env', 'pub_id')
          .exec (err, tracks) ->
            parsed = parseMongoose model.attributeNames, user.toObject(virtuals:yes)
            parsed.tracks = for track in tracks
              parseMongoose bb.Track.attributeNames, track.toObject()
            success model, parsed, options

#for model in ['User', 'Track']
#  bb[model]::sync = syncModel mo[model]

#bb.UserTracks::sync = syncCollection mo.Tracks

# NO MONGOOSE BEYOND THIS POINT

bb.User::toPublic = ->
  include = [ 'id', 'bio', 'location', 'name', 'website' ]
  _.pick @toJSON(), include

bb.UserTracks::toPublic = ->
  exclude = [ 'object_id', 'config' ]
  #include = [ 'id', 'bio', 'location', 'name', 'website' ]
  (_.omit entry, exclude for entry in @toJSON())

###
bb.User::fetchTracks = (done) ->
  mo.Track
    .find(user: @get('object_id'))
    .populate('env', {'pub_id':1})
    .exec (error, tracks) =>
      throw error if error
      attribs = bb.Track::attributeNames
      plainTracks = (parseMongoose attribs, track.toObject() for track in tracks)
      @tracks.reset plainTracks
      done()
###

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

  app.get "#{base}/users/:user_id", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return error404 res unless user?
      res.json user.toPublic()

  app.get "#{base}/users/:user_id/tracks", (req, res) ->
    findUser req.params['user_id'], (user) ->
      return error404 res unless user?
      user.tracks.fetch
        success: -> res.json user.tracks.toPublic()
        error: -> error404 res

  app.get "#{base}/*", (req, res) -> error404 res

  return
