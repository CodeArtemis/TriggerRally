_ = require 'underscore'
mongoskin = require 'mongoskin'

config = require '../config'

dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"
db = mongoskin.db dbUrl, { safe: false }

db.bind 'tracks'
db.bind 'users'



db.tracks.find {}, {_id:1}, (err, trackCursor) ->
  return console.log err if err

  processTrack = (track, done) ->
    if track is null
      console.log 'Done'
      return process.exit()

    trackId = track._id

    do (trackId) ->
      db.users.count {'favorite_tracks': trackId}, (err, count_fav) ->
        return console.log err if err
        # console.log "#{trackId}: #{count_fav}"
        # done()
        db.tracks.update { _id: trackId }, { $set: { count_fav } }, (err) ->
          console.log err if err
          done()
        return

  do iterate = ->
    trackCursor.nextObject (err, track) ->
      return console.log err if err
      processTrack track, iterate

  return
