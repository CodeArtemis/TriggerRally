###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_scenery = exports? and @ or @render_scenery = {}

class render_scenery.RenderScenery
  constructor: (@scene, @scenery, loadFunc) ->
    partial = (func, a...) ->
      (b...) -> func a..., b...
    @lastCamPos = null
    @layers = ({ src: l } for l in scenery.layers)
    for layer in @layers
      layer.geoms = []
      loadFunc layer.src.config.render.scene, (result) ->
        layer.objects = result.scene.children
        return
###
      for i, mesh of layer.src.config.render.meshes
        loadFunc mesh.src, partial((i, scene) ->
          layer.objects[i] = geometry
          #mat = geometry.materials[0]
          #mat.ambient = mat.color
          #if mesh.transparent
          #  mat.transparent = true
          return
        , i)
###
    return

  update: (camera) ->
    unless @lastCamPos?
      for layer in @layers
        console.log layer
        tile = layer.src.getTile(0, 0)
        for object in layer.objects
          # We merge copies of each object into a single mesh.
          mergedGeom = new THREE.Geometry
          mesh = object
          for object in tile
            mesh.scale.set object.scale, object.scale, object.scale
            mesh.position.copy object.position
            mesh.rotation.y = object.rotation
            THREE.GeometryUtils.merge mergedGeom, mesh
          mesh = new THREE.Mesh mergedGeom, mat
          scene.add mesh
        for geom in layer.geoms
          mergedGeom = new THREE.Geometry()
          mesh = new THREE.Mesh(geom)
          for object in tile
            mesh.scale.set object.scale, object.scale, object.scale
            mesh.position.copy object.position
            mesh.rotation.y = object.rotation
            THREE.GeometryUtils.merge mergedGeom, mesh
          mat = geom.materials[0]
          mesh = new THREE.Mesh(mergedGeom, new THREE.MeshFaceMaterial())
          mesh.castShadow = true
          if mat.transparent
            mesh.doubleSided = true
          else
            mesh.receiveShadow = true
          scene.add mesh
      @lastCamPos = camera.position.clone()
    return
