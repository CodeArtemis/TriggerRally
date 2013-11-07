_ = require 'underscore'
db = require './batchdb'

db.bind 'tracks'
db.bind 'users'



console.log 'Fetching tracks'
db.tracks.find({}, {user:1}).toArray (err, tracks) ->
  console.log 'Fetching users'
  db.users.find({}, {_id:1}).toArray (err, users) ->

    hist = []
    for user in users
      count = 0
      count++ for track in tracks when ''+track.user is ''+user._id
      hist[count] ?= 0
      hist[count]++

    for val, idx in hist
      console.log "#{idx}\t#{val ? 0}"

    process.exit()
