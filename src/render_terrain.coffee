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
          gl_FragColor = mix(gl_FragColor, col, 0.5);

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
    idx = geom.vertexIndexArray
    posn = geom.vertexPositionArray
    uv = geom.vertexUvArray
    morph = geom.addCustomAttrib 'morph'
      size: 4
    RING_WIDTH = 3
    layerScales = [
      1.0 / 128.0,
      2.0 / 128.0,
      4.0 / 128.0,
      8.0 / 128.0
    ]
    ringSegments = [
      [  1,  0,  0,  1 ],
      [  0, -1,  1,  0 ],
      [ -1,  0,  0, -1 ],
      [  0,  1, -1,  0 ]
    ]
    for scale, layer in layerScales
      nextLayer = Math.min layer + 1, @numLayers - 1
      for segment, segNumber in ringSegments
        rowStart = []
        segStart = if layer > 0 then RING_WIDTH + 1 else 0
        segWidth = if layer > 0 then RING_WIDTH else RING_WIDTH * 2 + 1
        segLength = if layer > 0 then RING_WIDTH * 3 + 2 else RING_WIDTH * 2 + 1
        for i in [0..segLength]
          rowStart.push posn.length / 3
          modeli = segStart - i
          # Draw main part of ring.
          # TODO: Merge vertices between segments.
          # TODO: Add a range of smaller morph values for smoother morphing.
          for j in [0..segWidth]
            modelj = segStart + j
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, layer
            uv.push 0, 0
            m = [ 0, 0, 0, 0 ]
            if j == segWidth and i % 2 == 1
              m[segNumber] = 1
            else if i == segLength and j % 2 == 1
              m[(segNumber + 1) % 4] = 1
            morph.push m[0], m[1], m[2], m[3]
            if i > 0 and j > 0
              start0 = rowStart[i-1] + (j-1)
              start1 = rowStart[i]   + (j-1)
              idx.push start0 + 1, start0 + 0, start1 + 0
              idx.push start0 + 1, start1 + 0, start1 + 1
          if i % 2 == 0
            # Draw long edge of outer morph ring.
            modelj = RING_WIDTH * 2 + 2
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, nextLayer
            uv.push 0, 0
            morph.push 0, 0, 0, 0
            if i > 0
              start0 = rowStart[i-2] + segWidth
              start1 = rowStart[i-1] + segWidth
              start2 = rowStart[i]   + segWidth
              idx.push start0 + 0, start1 + 0, start0 + 1
              idx.push start0 + 1, start1 + 0, start2 + 1
              idx.push start2 + 1, start1 + 0, start2 + 0
        rowStart.push posn.length / 3
        # Draw short edge of outer morph ring.
        modeli = segStart - segLength - 1
        for j in [0..segWidth+1]
          if j % 2 == 0
            modelj = segStart + j
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, nextLayer
            uv.push 0, 0
            morph.push 0, 0, 0, 0
            if j > 0 and j < segWidth  # WHY NEEDED?
              start0 = rowStart[segLength]     + j-2
              start1 = rowStart[segLength + 1] + j/2-1
              idx.push start0 + 0, start1 + 0, start0 + 1
              idx.push start0 + 1, start1 + 0, start1 + 1
              idx.push start0 + 1, start1 + 1, start0 + 2
        # Draw corner of outer morph ring.
        j = segWidth + 1
        start0 = rowStart[segLength - 1] + j-2
        start1 = rowStart[segLength]     + j-2
        start2 = rowStart[segLength + 1] + j/2-1
        idx.push start1 + 0, start2 + 0, start1 + 1
        idx.push start1 + 1, start2 + 0, start2 + 1
        idx.push start1 + 1, start2 + 1, start0 + 2
        idx.push start1 + 1, start0 + 2, start0 + 1

    geom.updateOffsets()
    geom.createBuffers @gl
    return geom

  _render: (program, gl, frustum) ->
    @geom.render program, gl
    return
