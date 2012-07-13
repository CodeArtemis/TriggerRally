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
    scale = @terrain.scaleHz * 2 * 8 / 256
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
    maps = @_createMaps tile
    diffuseTex = THREE.ImageUtils.loadTexture('/a/textures/mayang-earth2.jpg')
    diffuseTex.wrapS = THREE.RepeatWrapping
    diffuseTex.wrapT = THREE.RepeatWrapping

    @geom = @_createGeom()
    obj = @_createImmediateObject()
    @material = new THREE.ShaderMaterial
      lights: true
      fog: true

      uniforms: _.extend( THREE.UniformsUtils.merge( [
          THREE.UniformsLib['lights'],
          THREE.UniformsLib['shadowmap'],
          THREE.UniformsLib['fog'],
        ]),
        tHeightMap:
          type: 't'
          value: 0
          texture: maps.height
        tDiffuse:
          type: 't'
          value: 1
          texture: diffuseTex
        tNormal:
          type: 't'
          value: 2
          texture: maps.normal
        offsets:
          type: 'v2v'
          value: []
        scales:
          type: 'fv1'
          value: []
        morphFactors:
          type: 'v4v'
          value: []
        terrainScaleHz:
          type: 'f'
          value: @terrain.scaleHz
        terrainSize:
          type: 'f'
          value: @terrain.tileSize
      )

      attributes:
        morph:
          type: 'v4'

      vertexShader:
        THREE.ShaderChunk.shadowmap_pars_vertex +
        "\nconst int NUM_LAYERS = " + @numLayers + ";\n" +
        """
        uniform sampler2D tHeightMap;
        uniform sampler2D tNormal;
        uniform vec2 offsets[NUM_LAYERS];
        uniform float scales[NUM_LAYERS];
        uniform vec4 morphFactors[NUM_LAYERS];
        uniform float terrainScaleHz;
        uniform float terrainSize;

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

        vec2 worldToTerrainSpace(vec2 coord) {
          return (coord / terrainScaleHz + vec2(0.5)) / terrainSize;
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

          worldPosition = position * terrainSize * terrainScaleHz + vec3(layerOffset, 0.0);
          vUv = worldToTerrainSpace(worldPosition.xy);
          float texel = 1.0 / terrainSize;
          float halfTexel = texel * 0.5;
          vec2 uv00 = (floor(vUv * terrainSize + 0.5) - 0.5) / terrainSize;
          vec2 uv01 = uv00 + vec2(0.0, texel);
          vec2 uv10 = uv00 + vec2(texel, 0.0);
          vec2 uv11 = uv00 + vec2(texel, texel);
          vec2 frac = (vUv - uv00) * terrainSize;
          vec2 normal00 = texture2D(tNormal, uv00 - halfTexel).ra;
          vec2 normal01 = texture2D(tNormal, uv01 - halfTexel).ra;
          vec2 normal10 = texture2D(tNormal, uv10 - halfTexel).ra;
          vec2 normal11 = texture2D(tNormal, uv11 - halfTexel).ra;
          float height00 = texture2D(tHeightMap, uv00).r
              - dot(vec2(frac.x, frac.y), normal00) * terrainScaleHz;
          float height01 = texture2D(tHeightMap, uv01).r
              - dot(vec2(frac.x, frac.y-1.0), normal01) * terrainScaleHz;
          float height10 = texture2D(tHeightMap, uv10).r
              - dot(vec2(frac.x-1.0, frac.y), normal10) * terrainScaleHz;
          float height11 = texture2D(tHeightMap, uv11).r
              - dot(vec2(frac.x-1.0, frac.y-1.0), normal11) * terrainScaleHz;
          frac = smoothstep(0.0, 1.0, frac);
          float height = mix(
            mix(height00, height01, frac.y),
            mix(height10, height11, frac.y),
            frac.x);
          //height = height11 - dot(frac, normal11) * terrainScaleHz;
          //height = texture2D(tHeightMap, vUv).r;
          //height = height00;
          worldPosition.z = height;
          //vec2 normSample = texture2D(tNormal, vUv).ra;
          //worldPosition.z = normSample.r * 10.0;

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
          
          #ifdef USE_SHADOWMAP
          for( int i = 0; i < MAX_SHADOWS; i ++ ) {
            vShadowCoord[ i ] = shadowMatrix[ i ] * objectMatrix * vec4( worldPosition, 1.0 );
          }
          #endif
        }
        """
      fragmentShader:
        THREE.ShaderChunk.fog_pars_fragment + '\n' +
        THREE.ShaderChunk.lights_phong_pars_fragment + '\n' +
        THREE.ShaderChunk.shadowmap_pars_fragment + '\n' +
        """
        
        //uniform sampler2D tHeightMap;
        uniform sampler2D tDiffuse;
        uniform sampler2D tNormal;
        uniform float terrainSize;
        const float normalSize = 512.0;

        varying vec2 vUv;
        varying vec4 eyePosition;
        varying vec3 worldPosition;
        varying vec4 col;

        void main() {
          float height = worldPosition.z;
          vec2 diffUv = worldPosition.xy / 4.0;
          vec3 diffSample = texture2D(tDiffuse, diffUv).rgb;
          vec2 normSample = texture2D(tNormal, vUv - vec2(0.5) / terrainSize).ra;
          vec3 normal = vec3(normSample.x, normSample.y, 1.0 - dot(normSample, normSample));
          vec3 tangentU = vec3(1.0 - normal.x * normal.x, 0.0, -normal.x);
          vec3 tangentV = vec3(0.0, 1.0 - normal.y * normal.y, -normal.y);
          float depth = length(eyePosition.xyz);

          gl_FragColor = vec4(diffSample, 1.0);

          float noiseSample = texture2D(tDiffuse, worldPosition.xy / 128.0).g;
          float veggieFactor = smoothstep(60.0, 80.0, depth + noiseSample * 70.0) * 0.6;
          vec3 veggieColor1 = vec3(0.1, 0.2, 0.05);
          vec3 veggieColor2 = vec3(0.03, 0.1, 0.0);
          vec3 eyeVec = normalize(cameraPosition - worldPosition);
          float veggieMix = dot(eyeVec, normal);
          //veggieMix *= veggieMix;
          vec3 veggieColor = mix(veggieColor1, veggieColor2, veggieMix);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, veggieColor, veggieFactor);
          gl_FragColor.rgb = mix(vec3(0.4), gl_FragColor.rgb, smoothstep(0.77, 0.78, normal.z));

          //gl_FragColor.rgb = mix(gl_FragColor.rgb, tangentV, 1.0);
          gl_FragColor = mix(gl_FragColor, col, 0.0);

          float epsilon = 0.5 / normalSize;
          vec3 normalDetail = normalize(vec3(
            diffSample.g - texture2D(tDiffuse, diffUv + vec2(epsilon, 0.0)).g,
            diffSample.g - texture2D(tDiffuse, diffUv + vec2(0.0, epsilon)).g,
            0.25));
          normal = normalDetail.x * tangentU +
                   normalDetail.y * tangentV +
                   normalDetail.z * normal;


          """ +
          #THREE.ShaderChunk.shadowmap_fragment +
          """
          
          float fDepth;
          vec3 shadowColor = vec3( 1.0 );
          for( int i = 0; i < MAX_SHADOWS; i ++ ) {
            vec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;
            bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
            bool inFrustum = all( inFrustumVec );
            bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
            bool frustumTest = all( frustumTestVec );
            if ( frustumTest ) {
              shadowCoord.z += shadowBias[ i ];
              float shadow = 0.0;
              const float shadowDelta = 1.0 / 9.0;
              float xPixelOffset = 1.0 / shadowMapSize[ i ].x;
              float yPixelOffset = 1.0 / shadowMapSize[ i ].y;
              float dx0 = -1.25 * xPixelOffset;
              float dy0 = -1.25 * yPixelOffset;
              float dx1 = 1.25 * xPixelOffset;
              float dy1 = 1.25 * yPixelOffset;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              fDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );
              if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
              //shadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );
              shadowColor = shadowColor * vec3( ( 1.0 - shadow ) );
            }
          }
          //gl_FragColor.xyz = gl_FragColor.xyz * shadowColor;

          vec3 directIllum = vec3(0.0);
          #if MAX_DIR_LIGHTS > 0
          for (int i = 0; i < MAX_DIR_LIGHTS; ++i) {
            vec4 lDirection = viewMatrix * vec4(directionalLightDirection[i], 0.0);
            vec3 dirVector = normalize(lDirection.xyz);
            directIllum += max(dot(normal, directionalLightDirection[i]), 0.0) * directionalLightColor[i];
          }
          #endif
          vec3 totalIllum = ambientLightColor + directIllum * shadowColor;
          gl_FragColor.rgb *= totalIllum;

          //vec3 fogCol = vec3(0.8, 0.85, 0.9);
          //float clarity = 160.0 / (depth + 160.0);
          const float LOG2 = 1.442695;
          float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
          fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
        }
        """
    obj.material = @material
    @scene.add obj
    return

  _createImmediateObject: ->
    class TerrainImmediateObject extends THREE.Object3D
      constructor: (@renderTerrain) ->
        super()
        @receiveShadow = true
      immediateRenderCallback: (program, gl, frustum) ->
        @renderTerrain._render program, gl, frustum
    return new TerrainImmediateObject @

  _createGeom: ->
    geom = new array_geometry.ArrayGeometry()
    geom.wireframe = false
    idx = geom.vertexIndexArray
    posn = geom.vertexPositionArray
    #morph = geom.addCustomAttrib 'morph'
    #  size: 4
    RING_WIDTH = 31
    ringSegments = [
      [  1,  0,  0,  1 ],
      [  0, -1,  1,  0 ],
      [ -1,  0,  0, -1 ],
      [  0,  1, -1,  0 ]
    ]
    scale = 1 / 256
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

  _createMaps: (tile) ->
    # We strip off the final row and column to make a POT map.
    heightArray = new Float32Array(tile.size * tile.size)
    # Normal map has only 2 channels, X and Y.
    normArray = new Float32Array(tile.size * tile.size * 2)
    tmpVec3 = new THREE.Vector3()
    hmap = tile.heightMap
    nmap = tile.normalMap
    tileSize = tile.size
    tileSizeP1 = tileSize + 1
    for y in [0...tile.size]
      for x in [0...tile.size]
        heightArray[y * tileSize + x] = hmap[y * tileSizeP1 + x]
        normArray[(y * tileSize + x) * 2 + 0] = nmap[(y * tileSize + x) * 3 + 0]
        normArray[(y * tileSize + x) * 2 + 1] = nmap[(y * tileSize + x) * 3 + 1]

    heightTex = new THREE.DataTexture(
        heightArray,
        tile.size, tile.size,
        THREE.LuminanceFormat, THREE.FloatType,
        null,
        THREE.RepeatWrapping, THREE.RepeatWrapping,
        THREE.LinearFilter, THREE.LinearFilter)
    heightTex.generateMipmaps = false
    heightTex.needsUpdate = true

    normalTex = new THREE.DataTexture(
        normArray,
        tileSize, tileSize,
        THREE.LuminanceAlphaFormat, THREE.FloatType,
        null,
        THREE.RepeatWrapping, THREE.RepeatWrapping)
    normalTex.needsUpdate = true

    height: heightTex
    normal: normalTex
