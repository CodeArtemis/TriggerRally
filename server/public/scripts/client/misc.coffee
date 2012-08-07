###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  checkpointMat = new THREE.MeshBasicMaterial
    color: 0x103010
    blending: THREE.AdditiveBlending
    transparent: 1
    depthWrite: false
  checkpointGeom = new THREE.Geometry()
  do ->
    ringGeom = new THREE.CylinderGeometry 16, 16, 1, 32, 1, true
    ringMesh = new THREE.Mesh ringGeom, checkpointMat
    ringMesh.eulerOrder = 'ZYX'
    ringMesh.rotation.x = 1.1
    THREE.GeometryUtils.merge checkpointGeom, ringMesh
    ringMesh.rotation.z = Math.PI * 2 / 3
    THREE.GeometryUtils.merge checkpointGeom, ringMesh
    ringMesh.rotation.z = Math.PI * 4 / 3
    THREE.GeometryUtils.merge checkpointGeom, ringMesh

  checkpointMaterial: -> checkpointMat

  checkpointMesh: ->
    meshCheckpoint = new THREE.Mesh checkpointGeom, checkpointMat
    meshCheckpoint.position.z = 2
    #meshCheckpoint.rotation.x = Math.PI / 2
    meshCheckpoint.castShadow = true
    meshCheckpoint.doubleSided = true
    meshCheckpoint
