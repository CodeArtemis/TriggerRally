/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');

const db = require('./batchdb');
const favhot = require('../util/favhot');


const lpad = function(value, padding) {
  let zeroes = "0";
  for (let i = 1, end = padding, asc = 1 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) { zeroes += "0"; }
  return (zeroes + value).slice(-padding);
};

const formatDate = date => `${date.getUTCFullYear()}-${lpad((date.getUTCMonth()+1), 2)}-${lpad(date.getUTCDate(), 2)}`;


db.tracks.find({}, {name:1, count_fav:1, modified:1}).toArray(function(err, tracks) {
  if (err) { return console.log(err); }

  tracks.sort((a, b) => favhot.trackScore(b) - favhot.trackScore(a));

  for (let i = 0; i < 30; i++) {
    const track = tracks[i];
    console.log(`${track._id}: ${formatDate(favhot.trackModified(track))} ${track.count_fav} ${favhot.trackScore(track)}`);
  }

  process.exit();
});
