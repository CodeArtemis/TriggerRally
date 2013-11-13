_ = require 'underscore'

db = require './batchdb'
favhot = require '../util/favhot'


lpad = (value, padding) ->
  zeroes = "0"
  zeroes += "0" for i in [1..padding]
  (zeroes + value).slice(-padding)

formatDate = (date) ->
  "#{date.getUTCFullYear()}-#{lpad (date.getUTCMonth()+1), 2}-#{lpad date.getUTCDate(), 2}"


db.tracks.find({}, {name:1, count_fav:1, modified:1}).toArray (err, tracks) ->
  return console.log err if err

  tracks.sort (a, b) -> favhot.trackScore(b) - favhot.trackScore(a)

  for i in [0...30]
    track = tracks[i]
    console.log "#{track._id}: #{formatDate favhot.trackModified track} #{track.count_fav} #{favhot.trackScore track}"

  process.exit()
  return
