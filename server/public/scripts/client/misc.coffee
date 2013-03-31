###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  checkpointGeom = new THREE.Geometry()
  checkpointMat = new THREE.MeshBasicMaterial
    color: 0x103010
    blending: THREE.AdditiveBlending
    transparent: 1
    depthWrite: false
    side: THREE.DoubleSide
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

  selectionGeom = new THREE.IcosahedronGeometry 1, 2
  selectionMat = new THREE.MeshBasicMaterial
    color: 0x101070
    blending: THREE.AdditiveBlending
    transparent: 1
    depthWrite: false

  checkpointMaterial: -> checkpointMat

  checkpointMesh: ->
    mesh = new THREE.Mesh checkpointGeom, checkpointMat
    mesh.position.z = 2
    #mesh.rotation.x = Math.PI / 2
    mesh.castShadow = true
    wrapper = new THREE.Object3D
    wrapper.add mesh
    wrapper

  selectionMesh: ->
    new THREE.Mesh selectionGeom, selectionMat
