_ = require 'underscore'

db = require './batchdb'

lpad = (value, padding) ->
  zeroes = "0"
  zeroes += "0" for i in [1..padding]
  (zeroes + value).slice(-padding)

formatSpreadsheetTime = (d) ->
  "#{lpad d.getUTCHours(), 2}:#{lpad d.getUTCMinutes(), 2}:#{lpad d.getUTCSeconds(), 2}"

formatSpreadsheetDate = (d) ->
  "#{d.getUTCFullYear()}-#{lpad (d.getUTCMonth() + 1), 2}-#{lpad d.getUTCDate(), 2} " + formatSpreadsheetTime d

getSpreadsheetDate = -> formatSpreadsheetDate new Date()

# getIsodate = -> new Date().toISOString()

stats =
  count_copy: 0
  count_drive: 0
  count_fav: 0
  user_favs: 0
  credits: 0
  users: 0
  runs: 0
  tracks: 0
  comments: 0


require('async').series [
  (done) ->
    db.users.count (err, users) ->
      stats.users = users
      done()
  (done) ->
    db.runs.count (err, runs) ->
      stats.runs = runs
      done()
  (done) ->
    db.tracks.count (err, tracks) ->
      stats.tracks = tracks
      done()
  (done) ->
    db.comments.count (err, comments) ->
      stats.comments = comments
      done()
  (done) ->
    db.tracks.find({}, { count_fav: 1, count_drive: 1, count_copy: 1 }).each (err, track) ->
      return console.log err if err
      return done() unless track
      stats.count_copy += track.count_copy if track.count_copy
      stats.count_drive += track.count_drive if track.count_drive
      stats.count_fav += track.count_fav if track.count_fav
  (done) ->
    db.users.find({}, { credits: 1, favorite_tracks: 1 }).each (err, user) ->
      return console.log err if err
      return done() unless user
      stats.user_favs += user.favorite_tracks.length if user.favorite_tracks
      stats.credits += user.credits if user.credits
  ->
    # console.log 'fav mismatch!' if stats.count_fav isnt stats.user_favs
    keys = _.keys(stats)
    values = _.values(stats)
    keys.splice 0, 0, 'Date'
    values.splice 0, 0, getSpreadsheetDate()
    keys = keys.map((x) -> "\"#{x}\"")
    values = values.map((x) -> "\"#{x}\"")
    # console.log keys.join ','
    console.log values.join ','
    # for key, value of stats
    # console.log "#{key}: #{value}"
    process.exit()
]
