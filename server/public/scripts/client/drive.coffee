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

    game = new gameGame.Game()

    client = new clientClient.TriggerClient view3d[0], game
    client.setSize view3d.width(), view3d.height()

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
