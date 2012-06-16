###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_scenery = exports? and @ or @render_scenery = {}

class render_scenery.RenderScenery
  constructor: (@scene, @scenery, loadFunc, @gl) ->
    @fadeSpeed = 2
    @layers = ({ src: l, tiles: {} } for l in scenery.layers)
    for layer in @layers
      do (layer) ->
        loadFunc layer.src.config.render.scene, (result) ->
          layer.meshes = for mesh in result.scene.children
            geom = new array_geometry.ArrayGeometry()
            geom.addGeometry mesh.geometry
            #geom.material = mesh.material
            mesh.geometry = geom
            mesh
          return
    return

  createTile: (layer, tx, ty) ->
    entities = layer.src.getTile(tx, ty)
    renderConfig = layer.src.config.render
    tile = new THREE.Object3D
    tile.position.x = (tx + 0.5) * layer.src.cache.gridSize
    tile.position.y = (ty + 0.5) * layer.src.cache.gridSize
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
      # Clone the material so that we can independently adjust opacity.
      material = new THREE.MeshLambertMaterial(object.material)
      # Color doesn't get copied correctly.
      material.color = object.material.color
      material.ambient = object.material.ambient
      material.emissive = object.material.emissive
      material.opacity = 0
      mesh = new THREE.Mesh mergedGeom, material
      mesh.doubleSided = object.doubleSided
      mesh.castShadow = object.castShadow
      mesh.receiveShadow = object.receiveShadow
      tile.add mesh
    return tile

  update: (camera, delta) ->
    added = false
    fadeAmount = @fadeSpeed * delta
    for layer in @layers
      continue unless layer.meshes?  # Check that we have something to draw.
      visibleTiles = {}
      txCenter = Math.floor(camera.position.x / layer.src.cache.gridSize)
      tyCenter = Math.floor(camera.position.y / layer.src.cache.gridSize)
      for ty in [tyCenter-3..tyCenter+3]
        for tx in [txCenter-3..txCenter+3]
          key = tx + ',' + ty
          visibleTiles[key] = true
          tile = layer.tiles[key]
          if not tile and not added
            added = true
            tile = layer.tiles[key] = @createTile layer, tx, ty
            scene.add tile
          if tile
            opacity = tile.children[0].material.opacity
            if opacity < 1
              opacity = Math.min(opacity + fadeAmount, 1)
              for mesh in tile.children
                mesh.material.opacity = opacity
      toRemove = (key for key of layer.tiles when not visibleTiles[key])
      for key in toRemove
        scene.remove layer.tiles[key]
        delete layer.tiles[key]
    return
