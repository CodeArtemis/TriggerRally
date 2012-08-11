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

  run: ->

    container = $(window)
    view3d = $('.frame3d')
    runTimer = $('#timer')
    fullscreenLink = $('#fullscreenlink')

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
    game.addCarConfig TRIGGER.CAR.CONFIG

    lastTime = 0
    tmpVec3 = new THREE.Vector3
    update = (time) ->
      delta = Math.min 0.1, (time - lastTime) * 0.001

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
