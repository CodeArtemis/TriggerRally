###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
], () ->
  exports = {}
  class exports.Hash2D
    # Hashes objects into a grid of square tiles.
    constructor: (@gridSize) ->
      @tiles = {}

    hasTile: (tX, tY) ->
      key = tX + ',' + tY
      key in @tiles

    getTile: (tX, tY) ->
      key = tX + ',' + tY
      @tiles[key]

    setTile: (tX, tY, tile) ->
      key = tX + ',' + tY
      @tiles[key] = tile

    addObject: (x, y, object) ->
      tX = Math.floor(x / @gridSize)
      tY = Math.floor(y / @gridSize)
      key = tX + ',' + tY
      # tile = @tiles[key] ?= []
      tile = @tiles[key] or (@tiles[key] = [])
      tile.push object
      return

    getObjects: (minX, minY, maxX, maxY) ->
      tMinX = Math.floor(minX / @gridSize)
      tMaxX = Math.ceil(maxX / @gridSize)
      tMinY = Math.floor(minY / @gridSize)
      tMaxY = Math.ceil(maxY / @gridSize)
      tiles = []
      for tY in [tMinY...tMaxY]
        for tX in [tMinX...tMaxX]
          key = tX + ',' + tY
          tile = @tiles[key]
          if tile? then tiles.push tile
      return [].concat.apply([], tiles)

  # Hashes references to objects. When querying a region, returns each object
  # only once even if it appears in multiple tiles.
  class exports.IndirectHash2D extends exports.Hash2D
    constructor: (gridSize) ->
      super gridSize
      @objects = []
      @nextId = 0

    # Add an object to all tiles touched by a circle.
    addCircle: (x, y, radius, object) ->
      tCenterX = x / @gridSize
      tCenterY = y / @gridSize
      tRad = radius / @gridSize
      tMinX = Math.floor(tCenterX - tRad)
      tMaxX = Math.ceil(tCenterX + tRad)
      tMinY = Math.floor(tCenterY - tRad)
      tMaxY = Math.ceil(tCenterY + tRad)
      for tY in [tMinY...tMaxY]
        for tX in [tMinX...tMaxX]
          # TODO: Check that this tile actually touches the circle.
          key = tX + ',' + tY
          tile = @tiles[key] or (@tiles[key] = [])
          tile.push @nextId
      @objects[@nextId++] = object
      return

    getObjects: (minX, minY, maxX, maxY) ->
      ids = super minX, minY, maxX, maxY
      idSet = []
      for id in ids
        idSet[id] = true
      return (@objects[id] for id of idSet)

  return exports
