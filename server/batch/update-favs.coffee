_ = require 'underscore'

db = require './batchdb'



db.tracks.find {}, {_id:1, count_fav:1}, (err, trackCursor) ->
  return console.log err if err

  processTrack = (track, done) ->
    if track is null
      return process.exit()

    db.users.count {'favorite_tracks': track._id}, (err, count_fav) ->
      return console.log err if err
      return done() if count_fav is track.count_fav
      # console.log "#{track._id}: Updating count_fav from #{track.count_fav} to #{count_fav}"
      db.tracks.update { _id: track._id }, { $set: { count_fav } }, (err) ->
        console.log err if err
        done()
      return

  do iterate = ->
    trackCursor.nextObject (err, track) ->
      return console.log err if err
      processTrack track, iterate

  return
