###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_terrain = exports? and @ or @render_terrain = {}

class render_terrain.RenderTerrain
  constructor: (@scene, @terrain, @gl) ->
    # We currently grab the terrain source directly. This is not very kosher.
    @geom = null
    #console.assert @gl.getExtension('OES_standard_derivatives')
    return

  update: (camera, delta) ->
    if !@hmapTex? and @terrain.source?
      tile = @terrain.getTile 0, 0
      @hmapTex = new THREE.DataTexture(
          tile.heightMap,
          tile.size + 1, tile.size + 1,
          THREE.LuminanceFormat, THREE.FloatType,
          null,
          THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
          THREE.LinearFilter, THREE.LinearFilter
      )
      ###
      @hmapTex = new THREE.Texture(
          @terrain.source.hmap,
          null,
          THREE.RepeatWrapping, THREE.RepeatWrapping,
          undefined, undefined,
          THREE.LuminanceFormat, THREE.FloatType,
      )
      ###
      @hmapTex.generateMipmaps = false
      @hmapTex.needsUpdate = true
      unless @geom
        @geom = @_createGeom()
        obj = @_createImmediateObject()
        obj.material = new THREE.ShaderMaterial
          uniforms:
            clr:
              type: 'v4'
              value: new THREE.Vector4(1, 0, 1, 1)
            tHeightMap:
              type: 't'
              value: 0
              texture: @hmapTex
          vertexShader:
            """
            varying vec2 vUv;
            uniform sampler2D tHeightMap;
            varying vec4 eyePosition;
            varying vec3 worldPosition;

            void main() {
              worldPosition = position * 128.0 * 3.0;
              vUv = (position.xy + vec2(0.5, 0.5) / 128.0) * (128.0 / 129.0);
              vUv += uv * 0.0;
              worldPosition.z += texture2D(tHeightMap, vUv).r;
              eyePosition = modelViewMatrix * vec4(worldPosition, 1.0);
              gl_Position = projectionMatrix * eyePosition;
            }
            """
          fragmentShader:
            """
            varying vec2 vUv;
            uniform vec4 clr;
            varying vec4 eyePosition;
            varying vec3 worldPosition;

            void main() {
              //gl_FragColor = clr;
              float height = worldPosition.z;
              //float depth = -eyePosition.z;
              //vec2 gradient = vec2(dFdx(height), dFdy(height)) * 150.0 / depth;
              //gl_FragColor = vec4(sin(height * 10.0) * 0.5 + 0.5, 0.0, 0.0, 1.0);
              gl_FragColor = vec4(sin(worldPosition.xzy * 10.0) * 0.7 + 0.5, 1.0);
            }
            """
        @scene.add obj
    return

  _createImmediateObject: ->
    class ImmediateObject extends THREE.Object3D
      constructor: (@renderTerrain) ->
        super()
      immediateRenderCallback: (program, gl, frustum) ->
        @renderTerrain._render program, gl, frustum
    return new ImmediateObject @

  _createGeom: ->
    geom = new array_geometry.ArrayGeometry()
    SIZE = 512
    posn = geom.vertexPositionArray
    uv = geom.vertexUvArray
    for y in [0..SIZE]
      for x in [0..SIZE]
        posn.push x / SIZE, y / SIZE, 0
        uv.push x / SIZE, y / SIZE
    idx = geom.vertexIndexArray
    for y in [0...SIZE]
      for x in [0...SIZE]
        start = y * (SIZE + 1) + x
        idx.push start + 0, start + 1, start + SIZE + 1
        idx.push start + 1, start + SIZE + 2, start + SIZE + 1
    geom.updateOffsets()
    geom.createBuffers @gl
    geom

  _render: (program, gl, frustum) ->
    @geom.render program, gl
    return
