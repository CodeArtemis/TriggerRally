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
      loadFunc layer.src.config.render.scene, partial((layer, result) ->
        layer.objects = result.scene.children
        return
      , layer)
    return

  update: (camera) ->
    unless @lastCamPos?
      for layer in @layers
        tile = layer.src.getTile(0, 0)
        unless layer.objects then return
        for object in layer.objects
          # We merge copies of each object into a single mesh.
          mergedGeom = new THREE.Geometry
          mesh = new THREE.Mesh object.geometry
          for entity in tile
            mesh.scale.copy object.scale
            mesh.scale.multiplyScalar entity.scale
            mesh.position.copy entity.position
            mesh.rotation.add object.rotation, entity.rotation
            THREE.GeometryUtils.merge mergedGeom, mesh
          mesh = new THREE.Mesh mergedGeom, object.material
          mesh.doubleSided = object.doubleSided
          mesh.castShadow = object.castShadow
          mesh.receiveShadow = object.receiveShadow
          console.log mesh
          console.log object
          scene.add mesh
      @lastCamPos = camera.position.clone()
    return
