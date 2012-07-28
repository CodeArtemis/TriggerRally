###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'cs!client/array_geometry'
  'util/image'
  'cs!util/quiver'
], (THREE, array_geometry, uImg, quiver) ->
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3

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
            texture: null
          tHeightSize:
            type: 'v2'
            value: new Vec2 1, 1
          tHeightScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
          tSurface:
            type: 't'
            value: 1
            texture: null
          tSurfaceSize:
            type: 'v2'
            value: new Vec2 1, 1
          tSurfaceScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
          tDetail:
            type: 't'
            value: 2
            texture: null
          tDetailSize:
            type: 'v2'
            value: new Vec2 1, 1
          tDetailScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
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
          uniform sampler2D tSurface;
          uniform vec2 tSurfaceSize;
          uniform vec3 tSurfaceScale;
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

            vec3 manhattan = abs(worldPosition - cameraPosition);
            float morphDist = max(manhattan.x, manhattan.y) / layerScale;
            float morph = min(1.0, max(0.0, morphDist / (31.0 / 2.0) - 3.0));
            vec2 scaledPosition = worldPosition.xy / layerScale;
            worldPosition.xy += layerScale *
              mod(scaledPosition.xy, 2.0) *
              (mod(scaledPosition.xy, 4.0) - 2.0) * morph;

            vec2 heightUv = worldToMapSpace(worldPosition.xy, tHeightSize, tHeightScale.xy);
            vec2 texel = 1.0 / tHeightSize;
            vec2 heightUv00 = (floor(heightUv * tHeightSize + 0.5) - 0.5) / tHeightSize;
            vec2 frac = (heightUv - heightUv00) * tHeightSize;
            float height = textureBicubic(tHeight, heightUv00, texel, frac) * tHeightScale.z;
            worldPosition.z = height;

            vec2 surfaceUv = worldToMapSpace(worldPosition.xy, tSurfaceSize, tSurfaceScale.xy);
            vec4 surfaceSample = texture2D(tSurface, surfaceUv - 0.5 / tSurfaceSize);

            float surfaceType = surfaceSample.b;
            float detailHeightAmount = abs(0.1 - surfaceType) * 10.0;
            vec2 detailHeightUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            vec4 detailSample = texture2D(tDetail, detailHeightUv);
            float detailHeightSample = detailSample.z;
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

          uniform sampler2D tSurface;
          uniform vec2 tSurfaceSize;
          uniform vec3 tSurfaceScale;
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
            float depth = length(eyePosition.xyz);
            vec2 diffUv = worldPosition.xy / 4.0;
            vec3 diffSample = texture2D(tDiffuse, diffUv).rgb;
            //vec3 diffSample = vec3(0.8,0.2,0.2);
            vec3 rockDiffSample = texture2D(tDiffuse, diffUv / 16.0).rgb;
            //vec3 rockDiffSample = vec3(0.2,0.2,0.8);
            vec2 surfaceUv = worldToMapSpace(worldPosition.xy, tSurfaceSize, tSurfaceScale.xy);
            vec4 surfaceSample = texture2D(tSurface, surfaceUv - 0.5 / tSurfaceSize);

            vec2 surfaceDerivs = 255.0 * tSurfaceScale.z / tSurfaceScale.xy * (surfaceSample.xy - 0.5);

            float surfaceType = surfaceSample.b;
            float detailHeightAmount = abs(0.1 - surfaceType) * 10.0;

            vec2 detailUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            vec4 detailSample = texture2D(tDetail, detailUv);
            vec2 detailDerivs = vec2(tDetailScale.z / tDetailScale.xy * (detailSample.xy - 0.5)) * detailHeightAmount;

            vec2 epsilon = 1.0 / tDetailSize;

            vec3 normalDetail = normalize(vec3(- surfaceDerivs - detailDerivs, 1.0));
            vec3 normalRegion = normalize(vec3(- surfaceDerivs, 1.0));

            vec3 tangentU = vec3(1.0 - normalDetail.x * normalDetail.x, 0.0, -normalDetail.x);
            vec3 tangentV = vec3(0.0, 1.0 - normalDetail.y * normalDetail.y, -normalDetail.y);

            // Add another layer of high-detail noise.
            vec2 detail2Uv = worldToMapSpace(worldPosition.yx, tDetailSize, tDetailScale.xy / 37.3);
            vec4 detail2Sample = texture2D(tDetail, detail2Uv);
            vec2 detail2Derivs = 0.5 * vec2(tDetailScale.z / tDetailScale.xy * (detail2Sample.xy - 0.5));
            vec3 normalDetail2 = normalize(vec3(- detail2Derivs, 1.0));
            normalDetail2 = normalDetail2.x * tangentU +
                            normalDetail2.y * tangentV +
                            normalDetail2.z * normalDetail;

            gl_FragColor = vec4(diffSample, 1.0);
            float noiseSample = texture2D(tDetail, worldPosition.yx / 512.0).b;
            float veggieFactor = 1.0; //smoothstep(60.0, 80.0, depth + noiseSample * 70.0) * 0.9;
            vec3 veggieColor1 = vec3(0.33, 0.35, 0.15);
            vec3 veggieColor2 = vec3(0.04, 0.07, 0.03);
            vec3 eyeVec = normalize(cameraPosition - worldPosition);
            float veggieMix = exp(dot(eyeVec, normalDetail2) - 1.0);
            vec3 veggieColor = mix(veggieColor1, veggieColor2, veggieMix);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, veggieColor, veggieFactor);
            float rockMix = smoothstep(1.5*0.7, 1.5*0.75,
                -1.0 + detailHeightAmount + normalRegion.z + normalDetail.z * 0.5 + (noiseSample - 0.5) * 0.3 - height * 0.0002);
            gl_FragColor.rgb = mix(rockDiffSample, gl_FragColor.rgb, rockMix);

            //gl_FragColor.rgb = vec3(0.5);

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
              directIllum += max(dot(normalDetail2, directionalLightDirection[i]), 0.0) * directionalLightColor[i];
              directIllum *= step(0.0, dot(normalDetail, directionalLightDirection[i]));
              directIllum *= step(0.0, dot(normalRegion, directionalLightDirection[i]));
            }
            #endif
            vec3 totalIllum = ambientLightColor + directIllum * shadowColor;
            gl_FragColor.rgb *= totalIllum;

            // For debugging.
            //gl_FragColor.rgb = mix(gl_FragColor.rgb, normalDetail * 0.5 + 0.5, 1.0);
            //gl_FragColor.rgb = mix(gl_FragColor.rgb, normal, 1.0);
            //gl_FragColor.rgb = mix(gl_FragColor.rgb, surfaceSample.rgb, 1.0);
            //gl_FragColor.rgb = vec3(veggieMix);
            //gl_FragColor.rgb = vec3(0.0, normal.y, 0.0);
            //gl_FragColor.rgb = vec3(detailSample);
            //gl_FragColor.rgb = 1.0 * vec3(normal.x, 0.0, normalDetail.x);
            //gl_FragColor.rgb = vec3(0.5);

            //vec3 fogCol = vec3(0.8, 0.85, 0.9);
            //float clarity = 160.0 / (depth + 160.0);
            const float LOG2 = 1.442695;
            float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
            fogFactor = clamp( 1.0 - fogFactor, 0.0, 0.9 );
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
          }
          """
      obj.material = @material
      @scene.add obj

      threeFmt = (channels) ->
        switch channels
          when 1 then THREE.LuminanceFormat
          when 2 then THREE.LuminanceAlphaFormat
          when 3 then THREE.RGBFormat
          when 4 then THREE.RGBAFormat
          else throw 'Unknown format'

      threeType = (data) ->
        switch data.constructor
          when Uint8Array then THREE.UnsignedByteType
          when Uint8ClampedArray then THREE.UnsignedByteType
          when Uint16Array then THREE.UnsignedShortType
          when Float32Array then THREE.FloatType
          else throw 'Unknown type'

      typeScale = (data) ->
        switch data.constructor
          when Uint8Array then 255
          when Uint8ClampedArray then 255
          when Uint16Array then 65535
          when Float32Array then 1
          else throw 'Unknown type'

      createTexture = (buffer, mipmap) ->
        tex = new THREE.DataTexture(
            buffer.data,
            buffer.width,
            buffer.height,
            threeFmt(uImg.channels buffer),
            threeType(buffer.data),
            null,
            THREE.RepeatWrapping, THREE.RepeatWrapping,
            THREE.LinearFilter,
            if mipmap then THREE.LinearMipMapLinearFilter else THREE.LinearFilter)
        tex.generateMipmaps = mipmap
        tex.needsUpdate = true
        tex

      maps = @terrain.source.maps
      uniforms = @material.uniforms

      quiver.connect maps.height, node = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tHeight.texture = createTexture buffer, false
        uniforms.tHeightSize.value.set buffer.width, buffer.height
        uniforms.tHeightScale.value.copy maps.height.scale
        uniforms.tHeightScale.value.z *= typeScale buffer.data
        done()
      quiver.pull node

      quiver.connect maps.surface, node = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tSurface.texture = createTexture buffer, true
        uniforms.tSurfaceSize.value.set buffer.width, buffer.height
        uniforms.tSurfaceScale.value.copy maps.surface.scale
        #uniforms.tSurfaceScale.value.z *= typeScale buffer.data
        done()
      quiver.pull node

      quiver.connect maps.detail, node = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tDetail.texture = createTexture buffer, true
        uniforms.tDetailSize.value.set buffer.width, buffer.height
        uniforms.tDetailScale.value.copy maps.detail.scale
        uniforms.tDetailScale.value.z *= typeScale buffer.data
        done()
      quiver.pull node
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
          segStart = if layer > 0 then RING_WIDTH + 0 else 0
          segWidth = if layer > 0 then RING_WIDTH + 1 else RING_WIDTH * 2 + 1
          segLength = if layer > 0 then RING_WIDTH * 3 + 1 else RING_WIDTH * 2 + 1
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
        scale *= 2

      geom.updateOffsets()
      geom.createBuffers @gl
      return geom

    _render: (program, gl, frustum) ->
      @geom.render program, gl
      return
