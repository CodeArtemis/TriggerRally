/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * DS209: Avoid top-level return
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const mongoskin = require('mongoskin');

const config = require('../config');

const dbUrl = `${config.db.host}:${config.db.port}/${config.db.name}?auto_reconnect`;
const db = mongoskin.db(dbUrl, { safe: false });

db.bind('runs');


// sorted = []
// counter = 0

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
//   if ++counter % 1000 is 0 then console.log counter
//   return

// return



const byTrack = {};
// iterator = (a, b) -> a[0] - b[0]
let counter = 0;
let removed = 0;

db.runs.find({}, {time:1, track:1}).each(function(err, run) {
  // if ++counter % 1000 is 0 then console.log counter
  let runs, track;
  if (err) { return console.error(`Error: ${err}`); }
  if (!run) {
    // console.log value for value in _.last sorted, 20
    for (track of Object.keys(byTrack || {})) {
      runs = byTrack[track];
      removed += runs.length;
      for (let i = 10, end = runs.length, asc = 10 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        run = runs[i];
        if (run == null) { continue; }
        db.runs.remove({_id: run._id});
      }
    }
      // break
    console.log(`Removed ${removed} runs`);
    return process.exit();
  }
  if (run.time == null) { run.time = Infinity; }
  runs = (byTrack[run.track] != null ? byTrack[run.track] : (byTrack[run.track] = []));
  const idx = _.sortedIndex(runs, run, 'time');
  runs.splice(idx, 0, run);
});

return;



counter = 0;
let count_okay = 0;
let count_not_okay = 0;
db.runs.find().each(function(err, run) {
  if (err) { return console.error(`Error: ${err}`); }
  if (!run) {
    console.log(`${count_okay} okay and ${count_not_okay} not okay out of ${counter}`);
    console.log('Done');
    return;
  }

  counter++;

  const fail = function(msg) {
    count_not_okay++;
    console.log(msg);
    return console.log(run);
  };

  if (!run.record_i) { return fail('missing record_i'); }
  if (!run.record_p) { return fail('missing record_p'); }
  if (!run.record_i.timeline) { return fail('missing record_i.timeline'); }
  if (!run.record_p.timeline) { return fail('missing record_p.timeline'); }
  if (!run.record_i.timeline[0]) { return fail('empty record_i.timeline'); }
  if (!run.record_p.timeline[0]) { return fail('empty record_p.timeline'); }
  if (run.record_i.timeline[0][0] !== 0) { return fail('invalid record_i.timeline'); }
  if (run.record_p.timeline[0][0] !== 0) { return fail('invalid record_p.timeline'); }

  count_okay++;

});
