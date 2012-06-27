###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_terrain = exports? and @ or @render_terrain = {}

class render_terrain.RenderTerrain
  constructor: (@scene, @terrain, loadFunc, @gl) ->
    # We currently grab the terrain source directly. This is not very kosher.
    @hmapTex = new THREE.Texture(
        @terrain.source.hmap,
        null,
        THREE.RepeatWrapping, THREE.RepeatWrapping
    )
    @geom = null
    return

  update: (camera, delta) ->
    unless @mesh
      @mesh
    return

  _createGeom: ->
    geom = new array_geometry.ArrayGeometry()
    SIZE = 8
    posn = geom.vertexPositionArray
    for y in [0..SIZE]
      for x in [0..SIZE]
        posn.push x, y, 0
    idx = geom.vertexIndexArray
    for y in [0...SIZE]
      for x in [0...SIZE]
        start = y * (SIZE + 1) + x
        idx.push start + 0, start + 1, start + SIZE + 1
        idx.push start + 1, start + SIZE + 1, start + SIZE + 2
    geom.createBuffers @gl
    geom

  immediateRenderCallback: (program, _gl, _frustum) ->
    @geom.render()
    return
