###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

render_terrain = exports? and @ or @render_terrain = {}

class render_terrain.RenderTerrain
  constructor: (@scene, @terrain, @gl) ->
    # We currently grab the terrain source directly. This is not very kosher.
    @geom = null
    #console.assert @gl.getExtension('OES_standard_derivatives')
    @numLayers = 5
    @totalTime = 0
    return

  update: (camera, delta) ->
    @totalTime += delta
    if not @material? and @terrain.source?
      @_setup()
    unless @geom? then return
    offsets = @material.uniforms['offsets'].value
    scales = @material.uniforms['scales'].value
    morphFactors = @material.uniforms['morphFactors'].value
    scale = 0.75 * 2
    for layer in [0...@numLayers]
      offset = offsets[layer] ?= new THREE.Vector2()
      offset.x = (Math.floor(camera.position.x / scale) + 0.5) * scale
      offset.y = (Math.floor(camera.position.y / scale) + 0.5) * scale
      #factor = Math.pow(Math.sin(@totalTime * 10) * 0.5 + 0.5, 4.0)
      #offset.x += (camera.position.x - offset.x) * factor
      #offset.y += (camera.position.y - offset.y) * factor
      scales[layer] = scale
      morphFactor = morphFactors[layer] ?= new THREE.Vector4()
      morphFactor.x = Math.max 0, (offset.x - camera.position.x) / scale
      scale *= 2
    return

  _setup: ->
    tile = @terrain.getTile 0, 0
    hmapTex = new THREE.DataTexture(
        tile.heightMap,
        tile.size + 1, tile.size + 1,
        THREE.LuminanceFormat, THREE.FloatType,
        null,
        THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
        THREE.LinearFilter, THREE.LinearFilter)
    hmapTex.needsUpdate = true

    diffuseTex = THREE.ImageUtils.loadTexture('/a/textures/mayang-earth.jpg')
    diffuseTex.wrapS = THREE.RepeatWrapping
    diffuseTex.wrapT = THREE.RepeatWrapping

    @geom = @_createGeom()
    obj = @_createImmediateObject()
    @material = new THREE.ShaderMaterial
      lights: true

      uniforms: _.extend( THREE.UniformsUtils.merge( [
          THREE.UniformsLib['lights']
        ]),
        tHeightMap:
          type: 't'
          value: 0
          texture: hmapTex
        tDiffuse:
          type: 't'
          value: 1
          texture: diffuseTex
        tNormal:
          type: 't'
          value: 2
          texture: @_createNormalMap tile
        offsets:
          type: 'v2v'
          value: []
        scales:
          type: 'fv1'
          value: []
        morphFactors:
          type: 'v4v'
          value: []
      )

      attributes:
        morph:
          type: 'v4'

      vertexShader:
        "const int NUM_LAYERS = " + @numLayers + ";\n" +
        """
        uniform sampler2D tHeightMap;
        uniform vec2 offsets[NUM_LAYERS];
        uniform float scales[NUM_LAYERS];
        uniform vec4 morphFactors[NUM_LAYERS];

        //attribute vec4 morph;

        varying vec2 vUv;  // TODO: Remove this.
        varying vec4 eyePosition;
        varying vec3 worldPosition;
        varying vec4 col;
        
        /*
        const mat4 MORPH_CODING_MATRIX = mat4(
           1.0, 0.0, 0.0, 0.0,
           0.0, 1.0, 0.0, 0.0,
           1.0, 1.0, 0.0, 0.0,
           -1.0, 1.0, 0.0, 0.0
        );
        const mat2 MORPH_X = mat2(0.0, -1.0, 1.0, 0.0);
        const mat2 MORPH_Y = mat2(1.0, 0.0, 0.0, 1.0);
        const mat2 MORPH_Z = mat2(0.0, 1.0, -1.0, 0.0);
        const mat2 MORPH_W = mat2(-1.0, 0.0, 0.0, -1.0);
        */

        const float SIZE = 512.0;
        const float SCALE = 0.75;

        vec2 worldToTerrainSpace(vec2 coord) {
          return (coord / SIZE / SCALE + vec2(0.5) / SIZE) * (SIZE / (SIZE+1.0));
        }
        
        /*
        vec2 decodeMorph(float morph) {
          const vec4 MORPH_CODING = vec4(1.0, 2.0, 3.0, 4.0);
          vec4 morphDecoded = max(vec4(1.0) - abs(vec4(morph) - MORPH_CODING), 0.0);
          return (MORPH_CODING_MATRIX * morphDecoded).xy;
        }
        */

        void main() {
          int layer = int(position.z);
          vec2 layerOffset = offsets[layer];
          float layerScale = scales[layer];
          vec4 morphFactor = morphFactors[layer];

          worldPosition = position * SIZE * SCALE + vec3(layerOffset, 0.0);
          vUv = worldToTerrainSpace(worldPosition.xy);
          vUv += uv * 0.0;
          worldPosition.z = texture2D(tHeightMap, vUv).r;

          /*
          if (morph.x > 0.0) {
            vec3 morphDirection = vec3(MORPH_X * decodeMorph(morph.x), 0.0) * layerScale;
            vec3 morphPosition = worldPosition + morphDirection;
            vec2 morphUv = worldToTerrainSpace(morphPosition.xy);
            morphDirection.z = texture2D(tHeightMap, morphUv).r - worldPosition.z;
            worldPosition += morphDirection * morphFactor.x;
          }
          */

          eyePosition = modelViewMatrix * vec4(worldPosition, 1.0);
          gl_Position = projectionMatrix * eyePosition;
          col = vec4(1,0,0,1);
          //col.rgb = morphDecoded;
        }
        """
      fragmentShader:
        #THREE.ShaderChunk.lights_phong_pars_fragment +
        """
        uniform vec3 ambientLightColor;
        #if MAX_DIR_LIGHTS > 0
          uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];
          uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];
        #endif

        //uniform sampler2D tHeightMap;
        uniform sampler2D tDiffuse;
        uniform sampler2D tNormal;

        varying vec2 vUv;
        varying vec4 eyePosition;
        varying vec3 worldPosition;
        varying vec4 col;

        void main() {
          float height = worldPosition.z;
          vec3 diffSample = texture2D(tDiffuse, worldPosition.xy / 4.0).rgb;
          vec2 normSample = texture2D(tNormal, vUv).ra;
          vec3 normal = vec3(normSample.x, normSample.y, 1.0 - dot(normSample, normSample));
          gl_FragColor = vec4(diffSample, 1.0);
          gl_FragColor = mix(gl_FragColor, vec4(1.0), 0.0);
          gl_FragColor = mix(gl_FragColor, col, 0.0);
          
          vec3 illum = ambientLightColor;
          #if MAX_DIR_LIGHTS > 0
          for (int i = 0; i < MAX_DIR_LIGHTS; ++i) {
            vec4 lDirection = viewMatrix * vec4(directionalLightDirection[i], 0.0);
            vec3 dirVector = normalize(lDirection.xyz);
            illum += dot(normal, directionalLightDirection[i]) * directionalLightColor[i];
          }
          #endif
          gl_FragColor.rgb *= illum;

          //float heightSample = texture2D(tHeightMap, vUv).r;
          //gl_FragColor.g = fract(heightSample);

          float depth = -eyePosition.z / eyePosition.w;
          vec3 fogCol = vec3(0.5, 0.5, 0.5);
          float clarity = 100.0 / (depth + 100.0);
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
    geom.wireframe = false
    idx = geom.vertexIndexArray
    posn = geom.vertexPositionArray
    uv = geom.vertexUvArray
    #morph = geom.addCustomAttrib 'morph'
    #  size: 4
    RING_WIDTH = 31
    TERRAIN_SIZE = 512
    ringSegments = [
      [  1,  0,  0,  1 ],
      [  0, -1,  1,  0 ],
      [ -1,  0,  0, -1 ],
      [  0,  1, -1,  0 ]
    ]
    scale = 1 / TERRAIN_SIZE
    for layer in [0...@numLayers]
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
            #morph.push m[0], m[1], m[2], m[3]
            if i > 0 and j > 0
              start0 = rowStart[i-1] + (j-1)
              start1 = rowStart[i]   + (j-1)
              if (i + j) % 2 == 1
                idx.push start0 + 1, start0 + 0, start1 + 0
                idx.push start0 + 1, start1 + 0, start1 + 1
              else
                idx.push start0 + 0, start1 + 0, start1 + 1
                idx.push start0 + 0, start1 + 1, start0 + 1
          if i % 2 == 0
            # Draw long edge of outer morph ring.
            modelj = RING_WIDTH * 2 + 2
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, nextLayer
            uv.push 0, 0
            #morph.push 0, 0, 0, 0
            if i > 0
              start0 = rowStart[i-2] + segWidth
              start1 = rowStart[i-1] + segWidth
              start2 = rowStart[i]   + segWidth
              idx.push start0 + 0, start1 + 0, start0 + 1
              idx.push start0 + 1, start1 + 0, start2 + 1
              idx.push start2 + 1, start1 + 0, start2 + 0
        rowStart.push posn.length / 3
        #continue
        # Draw short edge of outer morph ring.
        modeli = segStart - segLength - 1
        for j in [0..segWidth+1]
          if j % 2 == 0
            modelj = segStart + j
            segi = segment[0] * modeli + segment[1] * modelj
            segj = segment[2] * modeli + segment[3] * modelj
            posn.push segj * scale, segi * scale, nextLayer
            uv.push 0, 0
            #morph.push 0, 0, 0, 0
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
      scale *= 2

    geom.updateOffsets()
    geom.createBuffers @gl
    return geom

  _render: (program, gl, frustum) ->
    @geom.render program, gl
    return

  _createNormalMap: (tile) ->
    # Normal map has only 2 channels, X and Y.
    normArray = new Float32Array(tile.size * tile.size * 2)
    tmpVec3 = new THREE.Vector3()
    hmap = tile.heightMap
    tileSize = tile.size
    tileSizeP1 = tileSize + 1
    for y in [0...tile.size]
      for x in [0...tile.size]
        tmpVec3.set(
          hmap[y * tileSizeP1 + x] + hmap[(y+1) * tileSizeP1 + x] - hmap[y * tileSizeP1 + x+1] - hmap[(y+1) * tileSizeP1 + x+1],
          hmap[y * tileSizeP1 + x] + hmap[y * tileSizeP1 + x+1] - hmap[(y+1) * tileSizeP1 + x] - hmap[(y+1) * tileSizeP1 + x+1],
          tile.terrain.scaleHz * 2)
        tmpVec3.normalize()
        normArray[(y * tileSize + x) * 2 + 0] = tmpVec3.x
        normArray[(y * tileSize + x) * 2 + 1] = tmpVec3.y
    normalTex = new THREE.DataTexture(
        normArray,
        tileSize, tileSize,
        THREE.LuminanceAlphaFormat, THREE.FloatType,
        null,
        THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping)
    normalTex.needsUpdate = true
    return normalTex
