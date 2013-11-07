_ = require 'underscore'
mongoskin = require 'mongoskin'

config = require '../config'

dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"
db = mongoskin.db dbUrl, { safe: false }

db.bind 'runs'


# sorted = []
# iterator = (a, b) -> a[0] - b[0]

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
#   return

# return

lengths = []
db.runs.find().each (err, run) ->
  return console.error 'Error: ' + err if err
  unless run
    # console.log "#{count_okay} okay and #{count_not_okay} not okay out of #{counter}"
    console.log 'Done'
    return

  length = run.times?.length
  if length
    lengths[length] ?= 0
    lengths[length]++

  return

for length, i of lengths
  console.log "#{i}: #{length}"
