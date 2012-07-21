###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'cs!client/array_geometry'
], (THREE, array_geometry) ->
  Vec2 = THREE.Vector2

  RenderTerrain: class RenderTerrain
    constructor: (@scene, @terrain, @gl) ->
      # We currently grab the terrain source directly. This is not very kosher.
      @geom = null
      #console.assert @gl.getExtension('OES_standard_derivatives')
      @numLayers = 10
      @totalTime = 0
      return

    update: (camera, delta) ->
      @totalTime += delta
      if not @material? and @terrain.source?
        @_setup()
      unless @geom? then return
      offsets = @material.uniforms['offsets'].value
      scales = @material.uniforms['scales'].value
      scale = Math.pow(2,
        Math.floor(Math.log(Math.max(1, camera.position.z / 2000)) / Math.LN2))
      for layer in [0...@numLayers]
        offset = offsets[layer] ?= new THREE.Vector2()
        doubleScale = scale * 2
        offset.x = (Math.floor(camera.position.x / doubleScale) + 0.5) * doubleScale
        offset.y = (Math.floor(camera.position.y / doubleScale) + 0.5) * doubleScale
        scales[layer] = scale
        scale *= 2
      return

    _setup: ->
      maps = @_createMaps @terrain
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
          tHeight:
            type: 't'
            value: 0
            texture: maps.height
          tHeightSize:
            type: 'v2'
            value: new Vec2 @terrain.source.maps.height.cx, @terrain.source.maps.height.cy
          tHeightScale:
            type: 'v3'
            value: @terrain.source.maps.height.scale
          tNormal:
            type: 't'
            value: 1
            texture: maps.normal
          tDetail:
            type: 't'
            value: 2
            texture: maps.detail
          tDetailSize:
            type: 'v2'
            value: new Vec2 @terrain.source.maps.detail.cx, @terrain.source.maps.detail.cy
          tDetailScale:
            type: 'v3'
            value: @terrain.source.maps.detail.scale
          tDiffuse:
            type: 't'
            value: 3
            texture: diffuseTex
          offsets:
            type: 'v2v'
            value: []
          scales:
            type: 'fv1'
            value: []
        )

        vertexShader:
          THREE.ShaderChunk.shadowmap_pars_vertex +
          "\nconst int NUM_LAYERS = " + @numLayers + ";\n" +
          """
          uniform sampler2D tHeight;
          uniform vec2 tHeightSize;
          uniform vec3 tHeightScale;
          //uniform sampler2D tNormal;
          uniform sampler2D tDetail;
          uniform vec2 tDetailSize;
          uniform vec3 tDetailScale;
          uniform vec2 offsets[NUM_LAYERS];
          uniform float scales[NUM_LAYERS];

          varying vec4 eyePosition;
          varying vec3 worldPosition;

          vec2 worldToMapSpace(vec2 coord, vec2 size, vec2 scale) {
            return (coord / scale + 0.5) / size;
          }

          float catmullRom(float pm1, float p0, float p1, float p2, float x) {
            float x2 = x * x;
            return 0.5 * (
              pm1 * x * ((2.0 - x) * x - 1.0) +
              p0 * (x2 * (3.0 * x - 5.0) + 2.0) +
              p1 * x * ((4.0 - 3.0 * x) * x + 1.0) +
              p2 * (x - 1.0) * x2);
          }

          float textureCubicU(sampler2D samp, vec2 uv00, float texel, float offsetV, float frac) {
            return catmullRom(
                texture2D(samp, uv00 + vec2(-texel, offsetV)).r,
                texture2D(samp, uv00 + vec2(0.0, offsetV)).r,
                texture2D(samp, uv00 + vec2(texel, offsetV)).r,
                texture2D(samp, uv00 + vec2(texel * 2.0, offsetV)).r,
                frac);
          }

          float textureBicubic(sampler2D samp, vec2 uv00, vec2 texel, vec2 frac) {
            return catmullRom(
                textureCubicU(samp, uv00, texel.x, -texel.y, frac.x),
                textureCubicU(samp, uv00, texel.x, 0.0, frac.x),
                textureCubicU(samp, uv00, texel.x, texel.y, frac.x),
                textureCubicU(samp, uv00, texel.x, texel.y * 2.0, frac.x),
                frac.y);
          }

          void main() {
            int layer = int(position.z);
            vec2 layerOffset = offsets[layer];
            float layerScale = scales[layer];

            worldPosition = position * layerScale + vec3(layerOffset, 0.0);
            vec2 heightUv = worldToMapSpace(worldPosition.xy, tHeightSize, tHeightScale.xy);
            vec2 texel = 1.0 / tHeightSize;
            vec2 heightUv00 = (floor(heightUv * tHeightSize + 0.5) - 0.5) / tHeightSize;
            vec2 frac = (heightUv - heightUv00) * tHeightSize;
            float height = textureBicubic(tHeight, heightUv00, texel, frac) * tHeightScale.z;
            worldPosition.z = height;

            float detailHeightAmount = 1.0;//smoothstep(0.7, 0.8, normal.z);
            vec2 detailHeightUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            float detailHeightSample = texture2D(tDetail, detailHeightUv).r;
            float detailHeight = (detailHeightSample * tDetailScale.z) * detailHeightAmount;
            worldPosition.z += detailHeight;

            eyePosition = modelViewMatrix * vec4(worldPosition, 1.0);
            gl_Position = projectionMatrix * eyePosition;

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

          //uniform sampler2D tHeight;
          uniform vec2 tHeightSize;
          uniform vec3 tHeightScale;
          uniform sampler2D tNormal;
          uniform sampler2D tDetail;
          uniform vec2 tDetailSize;
          uniform vec3 tDetailScale;
          uniform sampler2D tDiffuse;

          varying vec4 eyePosition;
          varying vec3 worldPosition;

          vec2 worldToMapSpace(vec2 coord, vec2 size, vec2 scale) {
            return (coord / scale + 0.5) / size;
          }

          void main() {
            float height = worldPosition.z;
            vec2 diffUv = worldPosition.xy / 4.0;
            vec3 diffSample = texture2D(tDiffuse, diffUv).rgb;
            //vec3 diffSample = vec3(0.8,0.2,0.2);
            vec3 rockDiffSample = texture2D(tDiffuse, diffUv / 16.0).rgb;
            //vec3 rockDiffSample = vec3(0.2,0.2,0.8);
            vec2 heightUv = worldToMapSpace(worldPosition.xy, tHeightSize, tHeightScale.xy);
            vec2 normSample = texture2D(tNormal, heightUv - 0.5 / tHeightSize).ra;
            vec3 normal = vec3(normSample.x, normSample.y, 1.0 - dot(normSample, normSample));
            normal = normalize(normal / tHeightScale);
            vec3 tangentU = vec3(1.0 - normal.x * normal.x, 0.0, -normal.x);
            vec3 tangentV = vec3(0.0, 1.0 - normal.y * normal.y, -normal.y);
            float depth = length(eyePosition.xyz);

            vec2 detailHeightUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            float detailHeightSample = texture2D(tDetail, detailHeightUv).r;

            float detailHeightAmount = 1.0;//smoothstep(-0.8, -0.7, -normal.z);
            vec2 epsilon = 1.0 / tDetailSize;
            vec3 normalDetail = normalize(vec3(
                detailHeightAmount * (detailHeightSample - vec2(
                    texture2D(tDetail, detailHeightUv + vec2(epsilon.x, 0.0)).r,
                    texture2D(tDetail, detailHeightUv + vec2(0.0, epsilon.y)).r)),
                1.0) / tDetailScale);
            normal = normalDetail.x * tangentU +
                     normalDetail.y * tangentV +
                     normalDetail.z * normal;

            gl_FragColor = vec4(diffSample, 1.0);

            float noiseSample = texture2D(tDiffuse, worldPosition.xy / 128.0).g;
            float veggieFactor = smoothstep(60.0, 80.0, depth + noiseSample * 70.0) * 0.7;
            vec3 veggieColor1 = vec3(0.16, 0.19, 0.12);
            vec3 veggieColor2 = vec3(0.06, 0.09, 0.04);
            vec3 eyeVec = normalize(cameraPosition - worldPosition);
            float veggieMix = pow(abs(dot(eyeVec, normal)), 0.4);
            vec3 veggieColor = mix(veggieColor1, veggieColor2, veggieMix);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, veggieColor, veggieFactor);
            float rockMix = smoothstep(1.27, 1.28, normal.z + noiseSample);
            gl_FragColor.rgb = mix(rockDiffSample, gl_FragColor.rgb, rockMix);

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
      RING_WIDTH = 31
      ringSegments = [
        [  1,  0,  0,  1 ],
        [  0, -1,  1,  0 ],
        [ -1,  0,  0, -1 ],
        [  0,  1, -1,  0 ]
      ]
      scale = 1
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
            for j in [0..segWidth]
              modelj = segStart + j
              segi = segment[0] * modeli + segment[1] * modelj
              segj = segment[2] * modeli + segment[3] * modelj
              posn.push segj, segi, layer
              m = [ 0, 0, 0, 0 ]
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
              # Draw long edge of stitch border.
              modelj = RING_WIDTH * 2 + 2
              segi = segment[0] * modeli + segment[1] * modelj
              segj = segment[2] * modeli + segment[3] * modelj
              posn.push segj / 2, segi / 2, nextLayer
              if i > 0
                start0 = rowStart[i-2] + segWidth
                start1 = rowStart[i-1] + segWidth
                start2 = rowStart[i]   + segWidth
                idx.push start0 + 0, start1 + 0, start0 + 1
                idx.push start0 + 1, start1 + 0, start2 + 1
                idx.push start2 + 1, start1 + 0, start2 + 0
          rowStart.push posn.length / 3
          #continue
          # Draw short edge of stitch border.
          modeli = segStart - segLength - 1
          for j in [0..segWidth+1]
            if j % 2 == 0
              modelj = segStart + j
              segi = segment[0] * modeli + segment[1] * modelj
              segj = segment[2] * modeli + segment[3] * modelj
              posn.push segj / 2, segi / 2, nextLayer
              if j > 0 and j < segWidth
                start0 = rowStart[segLength]     + j-2
                start1 = rowStart[segLength + 1] + j/2-1
                idx.push start0 + 0, start1 + 0, start0 + 1
                idx.push start0 + 1, start1 + 0, start1 + 1
                idx.push start0 + 1, start1 + 1, start0 + 2
          # Draw corner of stitch border.
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

    _createMaps: (terrain) ->
      source = terrain.source
      cx = source.maps.height.cx
      cy = source.maps.height.cy
      # Normal map has only 2 channels, X and Y.
      normArray = new Float32Array(cx * cy * 2)
      tmpVec3 = new THREE.Vector3()
      nmap = source.maps.height.normal
      for y in [0...cy]
        for x in [0...cx]
          normArray[(y * cx + x) * 2 + 0] = nmap[(y * cx + x) * 3 + 0]
          normArray[(y * cx + x) * 2 + 1] = nmap[(y * cx + x) * 3 + 1]

      heightTex = new THREE.DataTexture(
          source.maps.height.displacement,
          source.maps.height.cx,
          source.maps.height.cy,
          THREE.LuminanceFormat, THREE.FloatType,
          null,
          THREE.RepeatWrapping, THREE.RepeatWrapping,
          THREE.LinearFilter, THREE.LinearFilter)
      heightTex.generateMipmaps = false
      heightTex.needsUpdate = true

      normalTex = new THREE.DataTexture(
          normArray,
          cx, cy,
          THREE.LuminanceAlphaFormat, THREE.FloatType,
          null,
          THREE.RepeatWrapping, THREE.RepeatWrapping)
      normalTex.generateMipmaps = true
      normalTex.needsUpdate = true

      detailTex = new THREE.DataTexture(
          source.maps.detail.displacement,
          source.maps.detail.cx,
          source.maps.detail.cy,
          THREE.LuminanceFormat, THREE.FloatType,
          null,
          THREE.RepeatWrapping, THREE.RepeatWrapping,
          THREE.LinearFilter, THREE.LinearFilter)
      detailTex.generateMipmaps = true
      detailTex.needsUpdate = true

      height: heightTex
      normal: normalTex
      detail: detailTex
