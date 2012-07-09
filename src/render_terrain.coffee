###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_terrain = exports? and @ or @render_terrain = {}

class render_terrain.RenderTerrain
  constructor: (@scene, @terrain, @gl) ->
    # We currently grab the terrain source directly. This is not very kosher.
    @geom = null
    #console.assert @gl.getExtension('OES_standard_derivatives')
    @numLayers = 4
    return

  update: (camera, delta) ->
    if not @hmapTex? and @terrain.source?
      @_setup()
    unless @geom? then return
    offsets = @material.uniforms['offsets'].value
    scale = 3
    for layer in [0...@numLayers]
      offsets[layer] ?= new THREE.Vector2()
      offset = offsets[layer]
      offset.x = Math.round(camera.position.x / scale) * scale
      offset.y = Math.round(camera.position.y / scale) * scale
      scale *= 2
    return

  _setup: ->
    tile = @terrain.getTile 0, 0
    @hmapTex = new THREE.DataTexture(
        tile.heightMap,
        tile.size + 1, tile.size + 1,
        THREE.LuminanceFormat, THREE.FloatType,
        null,
        THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
        THREE.LinearFilter, THREE.LinearFilter
    )
    @hmapTex.needsUpdate = true
    
    diffuseTex = THREE.ImageUtils.loadTexture("/a/textures/mayang-earth.jpg")
    diffuseTex.wrapS = THREE.RepeatWrapping
    diffuseTex.wrapT = THREE.RepeatWrapping

    @geom = @_createGeom()
    obj = @_createImmediateObject()
    @material = new THREE.ShaderMaterial
      uniforms:
        tHeightMap:
          type: 't'
          value: 0
          texture: @hmapTex
        tDiffuse:
          type: 't'
          value: 1
          texture: diffuseTex
        offsets:
          type: 'v2v'
          value: []

      attributes:
        morph:
          type: 'v4'

      vertexShader:
        "const int NUM_LAYERS = " + @numLayers + ";\n" +
        """
        uniform sampler2D tHeightMap;
        uniform vec2 offsets[NUM_LAYERS];

        attribute vec4 morph;

        varying vec2 vUv;
        varying vec4 eyePosition;
        varying vec3 worldPosition;
        varying vec4 col;

        void main() {
          int layer = int(position.z);
          vec2 offset = offsets[layer];
          worldPosition = position * 128.0 * 3.0 + vec3(offset, 0.0);
          vUv = (worldPosition.xy / 128.0 / 3.0 + vec2(0.5) / 128.0) * (128.0 / 129.0);
          vUv += uv * 0.0;
          worldPosition.z = texture2D(tHeightMap, vUv).r;
          eyePosition = modelViewMatrix * vec4(worldPosition, 1.0);
          gl_Position = projectionMatrix * eyePosition;
          col = morph;
        }
        """
      fragmentShader:
        """
        //uniform sampler2D tHeightMap;
        uniform sampler2D tDiffuse;

        varying vec2 vUv;
        varying vec4 eyePosition;
        varying vec3 worldPosition;
        varying vec4 col;

        void main() {
          float height = worldPosition.z;
          vec3 diffSample = texture2D(tDiffuse, worldPosition.xy / 4.0).rgb;
          gl_FragColor = vec4(diffSample, 1.0);
          gl_FragColor = mix(gl_FragColor, col, 0.2);

          //float heightSample = texture2D(tHeightMap, vUv).r;
          //gl_FragColor.g = fract(heightSample);

          float depth = -eyePosition.z / eyePosition.w;
          vec3 fogCol = vec3(0.8, 0.8, 0.8);
          float clarity = 250.0 / (depth + 250.0);
          gl_FragColor.rgb = mix(fogCol, gl_FragColor.rgb, clarity);
        }
        """
    obj.material = @material
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
    # TODO: Draw innermost grid.
    idx = geom.vertexIndexArray
    posn = geom.vertexPositionArray
    uv = geom.vertexUvArray
    morph = geom.addCustomAttrib 'morph'
      size: 4
    RING_WIDTH = 7
    segments = [
      [  1,  0,  0,  1 ],
      [  0,  1, -1,  0 ],
      [ -1,  0,  0, -1 ],
      [  0, -1,  1,  0 ]
    ]
    scale = 1.0 / 128.0
    layerScales = [
      2.0 / 128.0,
      4.0 / 128.0,
      8.0 / 128.0
    ]
    GRID_SIZE = RING_WIDTH * 4 + 2
    for i in [0..GRID_SIZE]
      modeli = i - GRID_SIZE / 2
      for j in [0..GRID_SIZE]
        modelj = j - GRID_SIZE / 2
        posn.push modelj * scale, modeli * scale, 0
        uv.push 0, 0
        morph.push Math.random(), Math.random(), Math.random(), Math.random()
        if i > 0 and j > 0
          start = (i-1) * (GRID_SIZE + 1) + (j-1)
          idx.push start + 0, start + 1, start + GRID_SIZE + 1
          idx.push start + 1, start + GRID_SIZE + 2, start + GRID_SIZE + 1
    for scale, layer in layerScales
      for segment in segments
        idxStart = posn.length / 3
        for i in [0..RING_WIDTH*3 + 2]
          modeli = -i + RING_WIDTH + 1
          for j in [0..RING_WIDTH]
            modelj = j + RING_WIDTH + 1
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, layer + 1
            uv.push 0, 0
            morph.push Math.random(), Math.random(), Math.random(), Math.random()
            if i > 0 and j > 0
              start = idxStart + (i-1) * (RING_WIDTH + 1) + (j-1)
              idx.push start + 1, start + 0, start + RING_WIDTH + 1
              idx.push start + 1, start + RING_WIDTH + 1, start + RING_WIDTH + 2
    geom.updateOffsets()
    geom.createBuffers @gl
    return geom

  _render: (program, gl, frustum) ->
    @geom.render program, gl
    return
