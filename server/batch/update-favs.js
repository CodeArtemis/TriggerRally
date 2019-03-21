/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore');

const db = require('./batchdb');



db.tracks.find({}, {_id:1, count_fav:1}, function(err, trackCursor) {
  let iterate;
  if (err) { return console.log(err); }

  const processTrack = function(track, done) {
    if (track === null) {
      return process.exit();
    }

    return db.users.count({'favorite_tracks': track._id}, function(err, count_fav) {
      if (err) { return console.log(err); }
      if (count_fav === track.count_fav) { return done(); }
      // console.log "#{track._id}: Updating count_fav from #{track.count_fav} to #{count_fav}"
      db.tracks.update({ _id: track._id }, { $set: { count_fav } }, function(err) {
        if (err) { console.log(err); }
        return done();
      });
    });
  };

  (iterate = () =>
    trackCursor.nextObject(function(err, track) {
      if (err) { return console.log(err); }
      return processTrack(track, iterate);
    })
  )();

});
