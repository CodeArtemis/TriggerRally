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

    client.camera.eulerOrder = 'ZYX'
    camPos = client.camera.position.set 0, 0, 2000
    camAng = client.camera.rotation.set 0.6, 0, 0
    camVel = new Vec3
    camVelTarget = new Vec3
    camAngVel = new Vec3
    camAngVelTarget = new Vec3

    keyDown = []

    lastTime = 0
    tmpVec3 = new THREE.Vector3
    update = (time) ->
      delta = Math.min 0.1, (time - lastTime) * 0.001

      terrainHeight = (track.terrain.getContactRayZ camPos.x, camPos.y).surfacePos.z
      SPEED = 200 + 2 * Math.max 0, camPos.z - terrainHeight
      ANG_SPEED = 2
      VISCOSITY = 20
      camVelTarget.set 0, 0, 0
      camAngVelTarget.set 0, 0, 0
      if keyDown[KEYCODE.SHIFT] then SPEED *= 3
      if keyDown[KEYCODE.RIGHT] then camVelTarget.x += SPEED
      if keyDown[KEYCODE.LEFT] then camVelTarget.x -= SPEED
      if keyDown[KEYCODE.UP] then camVelTarget.y += SPEED
      if keyDown[KEYCODE.DOWN] then camVelTarget.y -= SPEED
      if keyDown[KEYCODE.R] then camVelTarget.z += SPEED
      if keyDown[KEYCODE.F] then camVelTarget.z -= SPEED
      if keyDown[KEYCODE.W] then camAngVelTarget.x += ANG_SPEED
      if keyDown[KEYCODE.S] then camAngVelTarget.x -= ANG_SPEED
      if keyDown[KEYCODE.A] then camAngVelTarget.z += ANG_SPEED
      if keyDown[KEYCODE.D] then camAngVelTarget.z -= ANG_SPEED

      camVelTarget.set(
          camVelTarget.x * Math.cos(camAng.z) - camVelTarget.y * Math.sin(camAng.z),
          camVelTarget.x * Math.sin(camAng.z) + camVelTarget.y * Math.cos(camAng.z),
          camVelTarget.z)

      mult = 1 / (1 + delta * VISCOSITY)
      camVel.x = camVelTarget.x + (camVel.x - camVelTarget.x) * mult
      camVel.y = camVelTarget.y + (camVel.y - camVelTarget.y) * mult
      camVel.z = camVelTarget.z + (camVel.z - camVelTarget.z) * mult
      camAngVel.x = camAngVelTarget.x + (camAngVel.x - camAngVelTarget.x) * mult
      camAngVel.y = camAngVelTarget.y + (camAngVel.y - camAngVelTarget.y) * mult
      camAngVel.z = camAngVelTarget.z + (camAngVel.z - camAngVelTarget.z) * mult

      camPos.addSelf tmpVec3.copy(camVel).multiplyScalar delta
      terrainHeight = (track.terrain.getContactRayZ camPos.x, camPos.y).surfacePos.z
      camPos.z = Math.max camPos.z, terrainHeight + 1

      camAng.addSelf tmpVec3.copy(camAngVel).multiplyScalar delta
      camAng.x = Math.max 0, Math.min 2, camAng.x

      if camVel.length() > 0.1 or
         camAngVel.length() > 0.01 or
         Math.floor(time / 1000) - Math.floor(lastTime / 1000) > 0
        # Render at max rate when moving, otherwise once a second.
        client.update delta
        client.render()

      requestAnimationFrame update
      lastTime = time
      return

    requestAnimationFrame update

    keyWeCareAbout = (event) ->
      event.keyCode <= 127
    isModifierKey = (event) ->
      event.ctrlKey or event.altKey or event.metaKey
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
