###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'cs!client/array_geometry'
  'cs!util/quiver'
], (THREE, array_geometry, quiver) ->

  RenderScenery: class RenderScenery
    constructor: (@scene, @scenery, @loadFunc) ->
      @fadeSpeed = 2
      @layers = (@createLayer l for l in @scenery.layers)

    createLayer: (src) ->
      meshes = []
      tiles = Object.create null
      render = src.config.render
      @loadFunc render["scene-r54"] or render["scene"], (result) ->
        for mesh in result.scene.children
          geom = new array_geometry.ArrayGeometry()
          geom.addGeometry mesh.geometry
          #geom.material = mesh.material
          mesh.geometry = geom
          meshes.push mesh
        return
      { src, tiles, meshes }

    createTile: (layer, tx, ty, skipFadeIn) ->
      entities = layer.src.getTile(tx, ty)
      return null unless entities
      renderConfig = layer.src.config.render
      tile = new THREE.Object3D
      tile.position.x = (tx + 0.5) * layer.src.cache.gridSize
      tile.position.y = (ty + 0.5) * layer.src.cache.gridSize
      tile.opacity = if skipFadeIn then 1 else 0
      if entities.length > 0
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
          # Clone the material so that we can adjust opacity per tile.
          material = object.material.clone()
          material.opacity = tile.opacity
          # Force all objects to be transparent so we can fade them in and out.
          material.transparent = yes
          # material.blending = THREE.NormalBlending
          mesh = new THREE.Mesh mergedGeom, material
          mesh.doubleSided = object.doubleSided
          mesh.castShadow = object.castShadow
          mesh.receiveShadow = object.receiveShadow
          tile.add mesh
      return tile

    removeTile: (layer, key) ->
      @scene.remove layer.tiles[key]
      for mesh in layer.tiles[key]
        mesh.dispose()
      delete layer.tiles[key]
      return

    update: (camera, delta) ->
      added = no
      addAll = no
      fadeAmount = @fadeSpeed * delta

      # TODO: This shouldn't be done every frame. It should be notified of changes.
      for layer, i in @scenery.layers
        @layers[i] or= @createLayer layer
        continue unless @layers[i].src isnt layer
        keys = (key for key of @layers[i].tiles)
        @removeTile @layers[i], key for key in keys
        @layers[i].src = layer
        addAll = yes
      # TODO: Remove layers that have disappeared from @scenery.

      for layer in @layers
        continue unless layer.meshes.length > 0  # Check that we have something to draw.
        visibleTiles = {}
        txCenter = Math.floor(camera.position.x / layer.src.cache.gridSize)
        tyCenter = Math.floor(camera.position.y / layer.src.cache.gridSize)
        for ty in [tyCenter-3..tyCenter+3]
          for tx in [txCenter-3..txCenter+3]
            key = tx + ',' + ty
            visibleTiles[key] = yes
            tile = layer.tiles[key]
            if not tile and (addAll or not added)
              tile = @createTile layer, tx, ty, addAll
              added = yes
              if tile
                layer.tiles[key] = tile
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
