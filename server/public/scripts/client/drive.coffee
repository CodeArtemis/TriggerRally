###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'zepto'
  'THREE'
  'util/util'
  'cs!client/client'
  'game/game'
  'game/track'
  'cs!util/quiver'
], ($, THREE, util, clientClient, gameGame, gameTrack, quiver) ->
  KEYCODE = util.KEYCODE
  Vec3 = THREE.Vector3

  padZero = (val, digits) ->
    (1e15 + val + '').slice(-digits)

  formatRunTime = (time) ->
    mins = Math.floor(time / 60)
    time -= mins * 60
    secs = Math.floor(time)
    time -= secs
    cents = Math.floor(time * 100)
    mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2)

  run: ->
    container = $(window)
    view3d = $('.frame3d')
    fullscreenLink = $('#fullscreenlink')
    runTimer = $('#timer')
    countdown = $('#countdown')
    checkpoints = $('#checkpoints')

    updateTimer = true

    game = new gameGame.Game()

    client = new clientClient.TriggerClient view3d[0], game

    onWindowResize = ->
      client.setSize view3d.width(), view3d.height()
    onWindowResize()

    # TODO: Move this to client?
    $('#fullscreenlink').on 'click', (ev) ->
      el = view3d[0]
      reqFS = el.requestFullScreenWithKeys or
              el.mozRequestFullScreenWithKeys or
              el.webkitRequestFullScreenWithKeys or
              el.requestFullScreen or
              el.mozRequestFullScreen or
              el.webkitRequestFullScreen
      reqFS.bind(el)()
      return false

    # Workaround to wait for Chrome's fullscreen animation to finish.
    debouncedOnWindowResize = _.debounce onWindowResize, 1500
    container.on 'fullscreenchange', debouncedOnWindowResize
    container.on 'mozfullscreenchange', debouncedOnWindowResize
    container.on 'webkitfullscreenchange', debouncedOnWindowResize

    game.setTrackConfig TRIGGER.TRACK.CONFIG
    followProgress = null
    game.addCarConfig TRIGGER.CAR.CONFIG, (progress) ->
      followProgress = progress
      followProgress.on 'advance', ->
        checkpoints.html followProgress.nextCpIndex + ' / ' + game.track.checkpoints.length

        nextCp = followProgress.nextCheckpoint(0)

        if !nextCp
          # Race complete.
          updateTimer = false
          runTimer.removeClass()
          #if !TRIGGER.RUN
          #  if TRIGGER.USER_LOGGED_IN
          #    _.delay(uploadRun, 1000)
          #  else
          #    # We can't save the run, but show a Twitter link.
          #    showTwitterLink()

    lastTime = 0
    lastRaceTime = 0
    tmpVec3 = new THREE.Vector3
    update = (time) ->
      delta = Math.min 0.1, (time - lastTime) * 0.001

      if updateTimer
        raceTime = game.interpolatedRaceTime()
        if raceTime >= 0
          if lastRaceTime < 0
            countdown.html 'Go!'
            countdown.addClass ' fadeout'
            if followProgress?
              checkpoints.html followProgress.nextCpIndex + ' / ' + game.track.checkpoints.length
          runTimer.html formatRunTime raceTime
        else
          num = Math.ceil -raceTime
          lastNum = Math.ceil -lastRaceTime
          if num != lastNum
            countdown.html '' + num
        lastRaceTime = raceTime;

      client.update delta
      client.render()

      requestAnimationFrame update
      lastTime = time
      return

    requestAnimationFrame update

    $(document).on 'keydown', (event) -> client.onKeyDown event
    $(document).on 'keyup', (event) -> client.onKeyUp event

    $('.loading').addClass 'loaded'

    return
