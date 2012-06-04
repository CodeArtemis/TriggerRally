###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_scenery = exports? and @ or @render_scenery = {}

class render_scenery.RenderScenery
  constructor: (@scene, @scenery, loadFunc) ->
    @lastCamPos = null
    @layers = ({ src: l } for l in scenery.layers)
    for layer in @layers
      layer.geoms = []
      for i, mesh of layer.src.config.render.meshes
        partial = (func, a...) ->
          (b...) -> func a..., b...
        loadFunc mesh, partial((i, geometry) ->
          layer.geoms[i] = geometry
          console.log i
          console.log geometry
          return
        , i)
    return

  update: (camera) ->
    unless @lastCamPos?
      for layer in @layers
        console.log layer
        tile = layer.src.getTile(0, 0)
        for geom in layer.geoms
          mergedGeom = new THREE.Geometry()
          for object in tile
            mesh = new THREE.Mesh(geom, geom.materials[0]);
            mesh.position.copy object.position
            THREE.GeometryUtils.merge mergedGeom, mesh
          mesh = new THREE.Mesh(mergedGeom, geom.materials[0]);
          #mesh.position.copy object.position
          scene.add mesh
      @lastCamPos = camera.position.clone()
    return
