# This layer is not intended to be secure. It just syncs Backbone models to the DB.

_ = require 'underscore'
mongoose = require 'mongoose'
mo = do ->
  Car:     mongoose.model 'Car'
  Comment: mongoose.model 'Comment'
  Env:     mongoose.model 'Environment'
  Run:     mongoose.model 'Run'
  Track:   mongoose.model 'Track'
  User:    mongoose.model 'User'

favhot = require './util/favhot'

alpEnvId = new mongoose.Types.ObjectId '506754342668a4626133ccd7'
# alpEnvId = '506754342668a4626133ccd7'

jsonClone = (obj) -> JSON.parse JSON.stringify obj

parseMongoose = (doc) ->
  #if doc?.prefs then console.log doc.prefs
  if doc instanceof mongoose.Document
    parseMongoose doc.toObject getters: yes
  else if doc instanceof mongoose.Types.ObjectId
    "[bbm ObjectId]"
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
      error err
    # TODO: return a Promise object of some sort.
    null

module.exports = (bb) ->
  bb.Car::sync = makeSync
    read: (model, success, error, options) ->
      mo.Car
        .findOne(pub_id: model.id)
        .populate('user', 'pub_id')
        .exec (err, car) ->
          return error err if err
          return error "Couldn't find env #{model.id}" unless car
          parsed = parseMongoose car
          parsed.user = parsed.user.id if parsed.user
          success parsed

  bb.Comment::sync = makeSync
    create: (model, success, error, options) ->
      return error "Comment has no parent" unless model.parent
      return error "Empty comment" unless model.text
      return error "Comment too long" if model.text.length > 80
      comment = new mo.Comment
        parent: model.parent
        text: model.text
        user: options.user.id
      comment.save (err) ->
        if err
          console.log "Error creating comment: #{err}"
          return error null
        parsed = parseMongoose comment
        delete parsed.user
        success parsed

  bb.CommentSet::sync = makeSync
    read: (model, success, error, options) ->
      # [ type, objId ] = model.id
      mo.Comment
        .find(parent: model.id)
        .sort(_id: -1)
        .limit(50)
        .populate('user', 'pub_id')
        .exec (err, comments) ->
          return error err if err
          return error "Couldn't find comment set #{model.id}" unless comments
          parsed = parseMongoose comments
          for comment in parsed
            comment.user = comment.user.id if comment.user
          success
            id: model.id
            comments: parsed

  bb.Env::sync = makeSync
    read: (model, success, error, options) ->
      mo.Env
        .findOne(pub_id: model.id)
        .exec (err, env) ->
          return error err if err
          return error "Couldn't find env #{model.id}" unless env
          mo.Car
            .find(_id: { $in: env.cars })
            .select('pub_id')
            .exec (err, cars) ->
              return error err if err
              parsed = parseMongoose env
              parsed.cars = (car.pub_id for car in cars)
              success parsed

  bb.Run::sync = makeSync
    read: (model, success, error, options) ->
      mo.Run
        .findOne(pub_id: model.id)
        .populate('car', 'pub_id')
        .populate('track', 'pub_id')
        .populate('user', 'pub_id')
        .exec (err, run) ->
          return error err if err
          return error "Couldn't find run #{model.id}" unless run
          parsed = parseMongoose run
          parsed.car = parsed.car.id if parsed.car
          parsed.track = parsed.track.id if parsed.track
          parsed.user = parsed.user.id if parsed.user
          success parsed

  bb.Track::sync = do ->
    parseTrack = (track) ->
      parsed = parseMongoose track
      parsed.env = parsed.env.id if parsed.env
      parsed.next_track = parsed.next_track.id if parsed.next_track
      parsed.parent = parsed.parent.id if parsed.parent
      parsed.user = parsed.user.id if parsed.user
      parsed

    makeSync
      create: (model, success, error, options) ->
        mo.Track
          .findOne(pub_id: model.parent.id)
          .exec (err, parentTrack) ->
            return error err if err
            return error "Couldn't find track #{model.parent.id}" unless parentTrack
            data = jsonClone model
            track = new mo.Track
              parent: parentTrack.id
              user: options.user.id
              name: data.name
              env: parentTrack.env
              config: parentTrack.config
              modified: new Date()
            track.save (err) ->
              if err
                console.log "Error creating track: #{err}"
                return error null
              parsed = parseTrack(track)
              # parsed.user = options.user.pub_id
              # parsed.env = parentTrack.env.pub_id
              # We don't actually need these values. The API layer has set them already.
              delete parsed.env
              delete parsed.parent
              delete parsed.user
              success parsed
      read: (model, success, error, options) ->
        mo.Track
          .findOne(pub_id: model.id)
          .populate('env', 'pub_id')
          .populate('next_track', 'pub_id')
          .populate('parent', 'pub_id')
          .populate('user', 'pub_id')
          .exec (err, track) ->
            return error err if err
            return error "Couldn't find track #{model.id}" unless track
            mo.User
              .count {'favorite_tracks': track._id}, (err, count) ->
                parsed = parseTrack(track)
                parsed.count_fav = count
                success parsed
      update: (model, success, error, options) ->
        unless model.config?
          console.error "Saving track: NO CONFIG!"
          console.log JSON.stringify model
          return error null
        mo.Track
          .findOne(pub_id: model.id)
          .exec (err, track) ->
            return error err if err
            return error "Couldn't find track #{model.id}" unless track
            data = jsonClone model
            # TODO: Check if it's safe to just copy everything from the model.
            _.extend track, _.pick data, [
              'config'
              'count_copy'
              'count_drive'
              'count_fav'
              'modified'
              'name'
              'prevent_copy'
              'published'
            ]
            track.save (err) ->
              if err
                console.log "Error saving track: #{err}"
                return error null
              success null
      delete: (model, success, error, options) ->
        mo.Track
          .findOne(pub_id: model.id)
          .exec (err, track) ->
            track.remove (err) ->
              if err
                console.log "Error deleting track: #{err}"
                return error null
              success null

  bb.TrackRuns::sync = makeSync
    read: (model, success, error, options) ->
      mo.Track
        .findOne(pub_id: model.id)
        .exec (err, track) ->
          return error err if err
          return error "Couldn't find track #{model.id}" unless track
          # TODO: filter by car?
          mo.Run
            .find(track: track._id)
            # .where('time', { $not: { $type: 10 } })  # Exclude null times. Sort index also excludes.
            .sort(time: 1)
            .limit(10)
            .select('pub_id car track user status time')
            .populate('car', 'pub_id')
            .populate('track', 'pub_id')
            .populate('user', 'pub_id')
            .exec (err, runs) ->
              if err
                console.log "Error fetching runs: #{err}"
                return error null
              parsed = parseMongoose runs
              rank = 1
              for p in parsed
                p.car = p.car.id if p.car
                p.track = p.track.id if p.track
                p.user = p.user.id if p.user
                p.rank = rank++
              success
                id: model.id
                runs: parsed

  bb.TrackSet::sync = makeSync
    read: (model, success, error, options) ->
      switch model.id
        when 'favhot'
          query =
            env: alpEnvId  # TODO: Remove this filter.
            published: yes
          mo.Track
            .find(query)
            .select('count_fav modified pub_id')
            # .sort({modified: -1})
            # .limit(1000)
            .exec (err, tracks) ->
              if err
                console.log "Error fetching tracks: #{err}"
                return error null
              tracks.sort (a, b) ->
                favhot.trackScore(b) - favhot.trackScore(a)
              if tracks.length > 30 then tracks.length = 30
              response =
                name: 'Most favorited recent published tracks'
                tracks: (track.pub_id for track in tracks)
              success response
        when 'featured'
          response =
            name: 'Featured tracks'
            tracks: [
              'uUJTPz6M'
              'Alpina'
              'pRNGozkY'
              'Z7SkazUF'
              '8wuycma7'
              'KaXCxxFv'
            ]
          success response
        when 'recent'
          query =
            env: alpEnvId  # TODO: Remove this filter.
            published: yes
          mo.Track
            .find(query)
            .sort({modified: -1})
            .limit(30)
            .exec (err, tracks) ->
              if err
                console.log "Error fetching tracks: #{err}"
                return error null
              response =
                name: 'Recent published tracks'
                tracks: (track.pub_id for track in tracks)
              success response
        when 'all'
          query =
            env: alpEnvId  # TODO: Remove this filter.
          mo.Track
            .find(query)
            .sort({modified: -1})
            .limit(30)
            .exec (err, tracks) ->
              if err
                console.log "Error fetching tracks: #{err}"
                return error null
              response =
                name: 'Recently modified tracks'
                tracks: (track.pub_id for track in tracks)
              success response
        else
          error null

  bb.User::sync = makeSync
    read: (model, success, error, options) ->
      mo.User
        .findOne(pub_id: model.id)
        .populate('favorite_tracks', 'pub_id')
        .exec (err, user) ->
          return error err if err
          return error "Couldn't find user #{model.id}" unless user
          mo.Track
            .find(user: user.id)
            .select('pub_id env')
            .exec (err, tracks) ->
              return error err if err
              parsed = parseMongoose user
              parsed.favorite_tracks = (fav.pub_id for fav in user.favorite_tracks)
              parsed.tracks = (track.pub_id for track in tracks when track.env?.equals alpEnvId)
              success parsed
    update: (model, success, error, options) ->
      user = fav_tracks = null
      done = _.after 2, ->
        data = jsonClone model
        _.extend user, _.pick data, [
          # 'favorite_tracks'  # Done below.
          'credits'
          'name'
          'pay_history'
          'picture'
          'products'
          # 'tracks'  # This is a generated attribute.
        ]
        user.favorite_tracks = (ft._id for ft in fav_tracks)
        user.save (err) ->
          if err
            console.log "Error saving user: #{err}"
            return error null
          success null
      mo.User
        .findOne(pub_id: model.id)
        .exec (err, doc) ->
          return error err if err
          user = doc
          return error "Couldn't find user #{model.id}" unless user
          done()
      mo.Track
        .find(pub_id: { $in: model.favorite_tracks })
        .select('_id')
        .exec (err, docs) ->
          return error err if err
          fav_tracks = docs
          done()
