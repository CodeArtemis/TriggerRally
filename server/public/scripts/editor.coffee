###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'zepto'
  'THREE'
  'util/util'
  'cs!client/client'
  'game/track'
], ($, THREE, util, clientClient, gameTrack) ->
  KEYCODE = util.KEYCODE
  Vec3 = THREE.Vector3

  run: ->

    container = $(window)
    toolbox = $('#editor-toolbox')
    view3d = $('#view3d')

    client = new clientClient.TriggerClient view3d[0]

    track = new gameTrack.Track()
    track.loadWithConfig TRIGGER.TRACK.CONFIG, ->
      client.setTrack track

    layout = ->
      [toolbox, view3d].forEach (panel) ->
        panel.css 'position', 'absolute'
        panel.height container.height()
      TOOLBOX_WIDTH = 300
      toolbox.width TOOLBOX_WIDTH
      view3d.width container.width() - TOOLBOX_WIDTH
      view3d.css 'left', TOOLBOX_WIDTH
      client.setSize view3d.width(), view3d.height()
      return

    layout()
    container.on 'resize', ->
      layout()

    #view3d.on 'mousemove', ->
    #  client.render()

    client.camera.rotation.x = 1
    camPos = client.camera.position.set 0, 0, 5000
    camVel = new Vec3
    camVelTarget = new Vec3

    keyDown = []

    lastTime = 0
    tmpVec3 = new THREE.Vector3
    update = (time) ->
      delta = Math.min 0.1, (time - lastTime) * 0.001
      lastTime = time

      ACCEL = 5 * camPos.z
      VISCOSITY = 5
      if keyDown[KEYCODE.RIGHT] then camVel.x += ACCEL * delta
      if keyDown[KEYCODE.LEFT] then camVel.x -= ACCEL * delta
      if keyDown[KEYCODE.UP] then camVel.y += ACCEL * delta
      if keyDown[KEYCODE.DOWN] then camVel.y -= ACCEL * delta
      if keyDown[KEYCODE.Q] then camVel.z += ACCEL * delta
      if keyDown[KEYCODE.E] then camVel.z -= ACCEL * delta

      camPos.addSelf tmpVec3.copy(camVel).multiplyScalar delta

      mult = 1 / (1 + delta * VISCOSITY)
      camVel.x = camVelTarget.x + (camVel.x - camVelTarget.x) * mult
      camVel.y = camVelTarget.y + (camVel.y - camVelTarget.y) * mult
      camVel.z = camVelTarget.z + (camVel.z - camVelTarget.z) * mult

      if camVel.length() >= 1
        client.render()

      requestAnimationFrame update
      return

    requestAnimationFrame update

    keyWeCareAbout = (event) ->
      event.keyCode >= 32 and event.keyCode <= 127
    isModifierKey = (event) ->
      event.shiftKey or event.ctrlKey or event.altKey or event.metaKey
    $(document).on 'keydown', (event) ->
      if keyWeCareAbout(event) and not isModifierKey(event)
        keyDown[event.keyCode] = true
        event.preventDefault()
      return
    $(document).on 'keyup', (event) ->
      if keyWeCareAbout(event)
        keyDown[event.keyCode] = false
        event.preventDefault()
      return

    toolbox.show()
    return
