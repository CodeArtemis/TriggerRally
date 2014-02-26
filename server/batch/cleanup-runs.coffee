_ = require 'underscore'
mongoskin = require 'mongoskin'

config = require '../config'

dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"
db = mongoskin.db dbUrl, { safe: false }

db.bind 'runs'


# sorted = []
# counter = 0

# db.runs.find().each (err, run) ->
#   return console.error 'Error: ' + err if err
#   unless run
#     console.log value for value in _.last sorted, 20
#     return console.log 'Done'
#   len1 = run.record_i.timeline.length
#   len2 = run.record_p.timeline.length
#   value = [ run.pub_id, len1 + len2 ]
#   idx = _.sortedIndex sorted, value, 1
#   sorted.splice idx, 0, value
#   if ++counter % 1000 is 0 then console.log counter
#   return

# return



byTrack = {}
# iterator = (a, b) -> a[0] - b[0]
counter = 0
removed = 0

db.runs.find({}, {time:1, track:1}).each (err, run) ->
  # if ++counter % 1000 is 0 then console.log counter
  return console.error 'Error: ' + err if err
  unless run
    # console.log value for value in _.last sorted, 20
    for own track, runs of byTrack
      removed += runs.length
      for i in [10...runs.length]
        run = runs[i]
        continue unless run?
        db.runs.remove _id: run._id
      # break
    console.log "Removed #{removed} runs"
    return process.exit()
  run.time ?= Infinity
  runs = (byTrack[run.track] ?= [])
  idx = _.sortedIndex runs, run, 'time'
  runs.splice idx, 0, run
  return

return



counter = 0
count_okay = 0
count_not_okay = 0
db.runs.find().each (err, run) ->
  return console.error 'Error: ' + err if err
  unless run
    console.log "#{count_okay} okay and #{count_not_okay} not okay out of #{counter}"
    console.log 'Done'
    return

  counter++

  fail = (msg) ->
    count_not_okay++
    console.log msg
    console.log run

  return fail 'missing record_i' unless run.record_i
  return fail 'missing record_p' unless run.record_p
  return fail 'missing record_i.timeline' unless run.record_i.timeline
  return fail 'missing record_p.timeline' unless run.record_p.timeline
  return fail 'empty record_i.timeline' unless run.record_i.timeline[0]
  return fail 'empty record_p.timeline' unless run.record_p.timeline[0]
  return fail 'invalid record_i.timeline' unless run.record_i.timeline[0][0] is 0
  return fail 'invalid record_p.timeline' unless run.record_p.timeline[0][0] is 0

  count_okay++

  return
