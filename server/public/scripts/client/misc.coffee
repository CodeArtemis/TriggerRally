###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  checkpointMat = new THREE.MeshBasicMaterial
    color: 0x309030
    blending: THREE.AdditiveBlending
    transparent: 1
    depthWrite: false
  checkpointGeom = new THREE.CylinderGeometry 16, 16, 3, 32, 1, false

  checkpointMaterial: -> checkpointMat

  checkpointMesh: ->
    meshCheckpoint = new THREE.Mesh checkpointGeom, checkpointMat
    #meshCheckpoint.position.z = 1.5
    meshCheckpoint.rotation.x = Math.PI / 2
    meshCheckpoint.castShadow = true
    meshCheckpoint
