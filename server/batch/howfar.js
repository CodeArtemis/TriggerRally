/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const mongoskin = require('mongoskin');

const config = require('../config');

const dbUrl = `${config.db.host}:${config.db.port}/${config.db.name}?auto_reconnect`;
const db = mongoskin.db(dbUrl, { safe: false });

db.bind('runs');


// sorted = []
// iterator = (a, b) -> a[0] - b[0]

// db.runs.find().each (err, run) ->
//   return console.error 'Error: ' + err if err
//   unless run
//     console.log value for value in _.last sorted, 20
//     return console.log 'Done'
//   len1 = run.record_i.timeline.length
//   len2 = run.record_p.timeline.length
//   value = [ run.pub_id, len1 + len2 ]
//   idx = _.sortedIndex sorted, value, 1
//   sorted.splice idx, 0, value
//   return

// return

const lengths = [];
db.runs.find().each(function(err, run) {
  if (err) { return console.error(`Error: ${err}`); }
  if (!run) {
    // console.log "#{count_okay} okay and #{count_not_okay} not okay out of #{counter}"
    console.log('Done');
    return;
  }

  const length = run.times != null ? run.times.length : undefined;
  if (length) {
    if (lengths[length] == null) { lengths[length] = 0; }
    lengths[length]++;
  }

});

for (let length in lengths) {
  const i = lengths[length];
  console.log(`${i}: ${length}`);
}
