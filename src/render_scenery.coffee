###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_scenery = exports? and @ or @render_scenery = {}

class render_scenery.RenderScenery
  constructor: (@scene, @scenery, loadFunc, @gl) ->
    @layers = ({ src: l, tiles: {} } for l in scenery.layers)
    for layer in @layers
      do (layer) ->
        loadFunc layer.src.config.render.scene, (result) ->
          layer.meshes = for mesh in result.scene.children
            geom = new array_geometry.ArrayGeometry()
            geom.addGeometry mesh.geometry
            geom.material = mesh.material
            new THREE.Mesh(geom, mesh.material)
          return
    return

  createTile: (layer, tx, ty) ->
    entities = layer.src.getTile(tx, ty)
    renderConfig = layer.src.config.render
    tile = new THREE.Object3D
    tile.position.x = (tx + 0.5) * layer.src.tileSize
    tile.position.y = (ty + 0.5) * layer.src.tileSize
    for object in layer.meshes
      # We merge copies of each object into a single mesh.
      mergedGeom = new array_geometry.ArrayGeometry()
      mesh = new THREE.Mesh object.geometry
      for entity in entities
        mesh.scale.copy object.scale
        if renderConfig.scale? then mesh.scale.multiplyScalar renderConfig.scale
        mesh.scale.multiplyScalar entity.scale
        #mesh.position.copy entity.position
        mesh.position.sub entity.position, tile.position
        mesh.rotation.add object.rotation, entity.rotation
        mergedGeom.mergeMesh mesh
      mergedGeom.createBuffers(@gl)
      mesh = new THREE.Mesh mergedGeom, object.material
      mesh.doubleSided = object.doubleSided
      mesh.castShadow = object.castShadow
      mesh.receiveShadow = object.receiveShadow
      tile.add mesh
    return tile

  update: (camera) ->
    added = false
    for layer in @layers
      continue unless layer.meshes?  # Check that we have something to draw.
      visibleTiles = {}
      txCenter = Math.floor(camera.position.x / layer.src.tileSize)
      tyCenter = Math.floor(camera.position.y / layer.src.tileSize)
      for ty in [tyCenter-3..tyCenter+3]
        for tx in [txCenter-3..txCenter+3]
          key = tx + ',' + ty
          visibleTiles[key] = true
          unless added
            tile = layer.tiles[key]
            unless tile
              added = true
              tile = layer.tiles[key] = @createTile layer, tx, ty
              scene.add tile
      toRemove = (key for key of layer.tiles when not visibleTiles[key])
      for key in toRemove
        scene.remove layer.tiles[key]
        delete layer.tiles[key]
    return
