/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const trackCreated = track => new Date(parseInt(track._id.toHexString().substring(0, 8), 16) * 1000);

const trackModified = track => track.modified != null ? track.modified : trackCreated(track);

const trackScore = function(track, timeNow) {
  // Hacker News algorithm: http://amix.dk/blog/post/19574
  if (timeNow == null) { timeNow = Date.now(); }
  const gravity = 1.5;
  const time = trackModified(track).getTime();
  const ageDays = Math.round((timeNow - time) / (1000 * 60 * 60 * 24));
  const count_fav = track.count_fav != null ? track.count_fav : 0;
  return (count_fav - 0.5) / Math.pow(ageDays + 2, gravity);
};

module.exports = {
  trackModified,
  trackScore
};
