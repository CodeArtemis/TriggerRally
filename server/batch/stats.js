/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');

const db = require('./batchdb');

const lpad = function(value, padding) {
  let zeroes = "0";
  for (let i = 1, end = padding, asc = 1 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) { zeroes += "0"; }
  return (zeroes + value).slice(-padding);
};

const formatSpreadsheetTime = d => `${lpad(d.getUTCHours(), 2)}:${lpad(d.getUTCMinutes(), 2)}:${lpad(d.getUTCSeconds(), 2)}`;

const formatSpreadsheetDate = d => `${d.getUTCFullYear()}-${lpad((d.getUTCMonth() + 1), 2)}-${lpad(d.getUTCDate(), 2)} ` + formatSpreadsheetTime(d);

const getSpreadsheetDate = () => formatSpreadsheetDate(new Date());

// getIsodate = -> new Date().toISOString()

const stats = {
  count_copy: 0,
  count_drive: 0,
  count_fav: 0,
  user_favs: 0,
  credits: 0,
  users: 0,
  runs: 0,
  tracks: 0,
  comments: 0
};


require('async').series([
  done =>
    db.users.count(function(err, users) {
      stats.users = users;
      return done();
    })
  ,
  done =>
    db.runs.count(function(err, runs) {
      stats.runs = runs;
      return done();
    })
  ,
  done =>
    db.tracks.count(function(err, tracks) {
      stats.tracks = tracks;
      return done();
    })
  ,
  done =>
    db.comments.count(function(err, comments) {
      stats.comments = comments;
      return done();
    })
  ,
  done =>
    db.tracks.find({}, { count_fav: 1, count_drive: 1, count_copy: 1 }).each(function(err, track) {
      if (err) { return console.log(err); }
      if (!track) { return done(); }
      if (track.count_copy) { stats.count_copy += track.count_copy; }
      if (track.count_drive) { stats.count_drive += track.count_drive; }
      if (track.count_fav) { return stats.count_fav += track.count_fav; }
    })
  ,
  done =>
    db.users.find({}, { credits: 1, favorite_tracks: 1 }).each(function(err, user) {
      if (err) { return console.log(err); }
      if (!user) { return done(); }
      if (user.favorite_tracks) { stats.user_favs += user.favorite_tracks.length; }
      if (user.credits) { return stats.credits += user.credits; }
    })
  ,
  function() {
    // console.log 'fav mismatch!' if stats.count_fav isnt stats.user_favs
    let keys = _.keys(stats);
    let values = _.values(stats);
    keys.splice(0, 0, 'Date');
    values.splice(0, 0, getSpreadsheetDate());
    keys = keys.map(x => `\"${x}\"`);
    values = values.map(x => `\"${x}\"`);
    // console.log keys.join ','
    console.log(values.join(','));
    // for key, value of stats
    // console.log "#{key}: #{value}"
    return process.exit();
  }
]);
