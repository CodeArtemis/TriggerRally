###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'zepto'
], ($) ->
  attach: (client) ->
    client.camera.rotation.x = 0.8
    camPos = client.camera.position.set 0, 0, 5000
    camVel = new THREE.Vector3(1000,0,0)
    camVelTarget = new THREE.Vector3(0,0,0)
    return
