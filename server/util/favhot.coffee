
trackCreated = (track) ->
  new Date(parseInt(track._id.toHexString().substring(0, 8), 16) * 1000)

trackModified = (track) ->
  track.modified ? trackCreated track

trackScore = (track, timeNow = Date.now()) ->
  # Hacker News algorithm: http://amix.dk/blog/post/19574
  gravity = 1.5
  time = trackModified(track).getTime()
  ageDays = Math.round (timeNow - time) / (1000 * 60 * 60 * 24)
  count_fav = track.count_fav ? 0
  (count_fav - 0.5) / Math.pow(ageDays + 2, gravity)

module.exports = {
  trackModified
  trackScore
}
