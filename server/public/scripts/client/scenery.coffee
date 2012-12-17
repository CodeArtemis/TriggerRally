###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'cs!client/array_geometry'
  'cs!util/quiver'
], (THREE, array_geometry, quiver) ->

  RenderScenery: class RenderScenery
    constructor: (@scene, @scenery, loadFunc, @renderer) ->
      @fadeSpeed = 2
      @layers = ({ src: l, tiles: {} } for l in @scenery.layers)
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

    createTile: (layer, tx, ty, skipFadeIn) ->
      entities = layer.src.getTile(tx, ty)
      renderConfig = layer.src.config.render
      tile = new THREE.Object3D
      tile.position.x = (tx + 0.5) * layer.src.cache.gridSize
      tile.position.y = (ty + 0.5) * layer.src.cache.gridSize
      tile.opacity = if skipFadeIn then 1 else 0
      if layer.meshes.length > 0 and entities.length > 0
        for object in layer.meshes
          # We merge copies of each object into a single mesh.
          mergedGeom = new array_geometry.ArrayGeometry()
          mesh = new THREE.Mesh object.geometry
          for entity in entities
            mesh.scale.copy object.scale
            if renderConfig.scale? then mesh.scale.multiplyScalar renderConfig.scale
            mesh.scale.multiplyScalar entity.scale
            mesh.position.sub entity.position, tile.position
            mesh.rotation.add object.rotation, entity.rotation
            mergedGeom.mergeMesh mesh
          mergedGeom.updateOffsets()
          mergedGeom.createBuffers(@renderer.context)
          # Clone the material so that we can adjust opacity per tile.
          material = new THREE.MeshLambertMaterial(object.material)
          # Color doesn't get copied correctly.
          material.color = object.material.color
          material.ambient = object.material.ambient
          material.emissive = object.material.emissive
          material.opacity = tile.opacity
          mesh = new THREE.Mesh mergedGeom, material
          mesh.doubleSided = object.doubleSided
          mesh.castShadow = object.castShadow
          mesh.receiveShadow = object.receiveShadow
          tile.add mesh
      return tile

    removeTile: (layer, key) ->
      @scene.remove layer.tiles[key]
      for mesh in layer.tiles[key]
        @renderer.deallocateObject mesh
      delete layer.tiles[key]
      return

    update: (camera, delta) ->
      added = false
      addAll = false
      fadeAmount = @fadeSpeed * delta

      for layer, i in @scenery.layers
        if @layers[i].src isnt layer
          keys = for key of @layers[i].tiles
            key
          @removeTile @layers[i], key for key in keys
          @layers[i].src = layer
          addAll = true

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
            if not tile and (addAll or not added)
              added = true
              tile = layer.tiles[key] = @createTile layer, tx, ty, addAll
              @scene.add tile
            if tile and tile.opacity < 1
                tile.opacity = Math.min 1, tile.opacity + fadeAmount
                for mesh in tile.children
                  mesh.material.opacity = tile.opacity
        toRemove = (key for key of layer.tiles when not visibleTiles[key])
        for key in toRemove
          tile = layer.tiles[key]
          tile.opacity -= fadeAmount
          if tile.opacity > 0
            for mesh in tile.children
              mesh.material.opacity = tile.opacity
          else
            @removeTile layer, key
      return
