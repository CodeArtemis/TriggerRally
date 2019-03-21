/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');
const db = require('./batchdb');

db.bind('tracks');
db.bind('users');



console.log('Fetching tracks');
db.tracks.find({}, {user:1}).toArray(function(err, tracks) {
  console.log('Fetching users');
  return db.users.find({}, {_id:1}).toArray(function(err, users) {

    const hist = [];
    for (let user of Array.from(users)) {
      let count = 0;
      for (let track of Array.from(tracks)) { if ((`${track.user}`) === (`${user._id}`)) { count++; } }
      if (hist[count] == null) { hist[count] = 0; }
      hist[count]++;
    }

    for (let idx = 0; idx < hist.length; idx++) {
      const val = hist[idx];
      console.log(`${idx}\t${val != null ? val : 0}`);
    }

    return process.exit();
  });
});
