###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'underscore'
  'cs!client/array_geometry'
  'util/image'
  'cs!util/quiver'
], (THREE, _, array_geometry, uImg, quiver) ->
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3

  RenderTerrain: class RenderTerrain
    constructor: (@scene, @terrain, @gl, terrainhq) ->
      @geom = null
      if terrainhq
        @baseScale = 0.5
        @numLayers = 10
        @ringWidth = 15
      else
        @baseScale = 1
        @numLayers = 10
        @ringWidth = 7
      @totalTime = 0
      @glDerivs = @gl.getExtension('OES_standard_derivatives')
      # @glFloatLinear = @gl.getExtension('OES_texture_float_linear')
      @glAniso =
        @gl.getExtension("EXT_texture_filter_anisotropic") or
        @gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic")
      return

    update: (camera, delta) ->
      @totalTime += delta
      if not @material? and @terrain.source?
        @_setup()
      unless @geom? then return
      offsets = @material.uniforms['offsets'].value
      scales = @material.uniforms['scales'].value
      scale = @baseScale * Math.pow(2,
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
      diffuseDirtTex = THREE.ImageUtils.loadTexture('/a/textures/dirt.jpg')
      diffuseDirtTex.wrapS = THREE.RepeatWrapping
      diffuseDirtTex.wrapT = THREE.RepeatWrapping
      if @glAniso then diffuseDirtTex.onUpdate = =>
        @gl.texParameteri @gl.TEXTURE_2D, @glAniso.TEXTURE_MAX_ANISOTROPY_EXT, 4

      diffuseRockTex = THREE.ImageUtils.loadTexture('/a/textures/rock.jpg')
      diffuseRockTex.wrapS = THREE.RepeatWrapping
      diffuseRockTex.wrapT = THREE.RepeatWrapping

      @geom = @_createGeom()
      @material = new THREE.ShaderMaterial
        lights: yes
        fog: yes

        uniforms: _.extend( THREE.UniformsUtils.merge( [
            THREE.UniformsLib['lights'],
            THREE.UniformsLib['shadowmap'],
            THREE.UniformsLib['fog'],
          ]),
          tHeight:
            type: 't'
            value: null
          tHeightSize:
            type: 'v2'
            value: new Vec2 1, 1
          tHeightScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
          tSurface:
            type: 't'
            value: null
          tSurfaceSize:
            type: 'v2'
            value: new Vec2 1, 1
          tSurfaceScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
          tDetail:
            type: 't'
            value: null
          tDetailSize:
            type: 'v2'
            value: new Vec2 1, 1
          tDetailScale:
            type: 'v3'
            value: new Vec3 1, 1, 1
          tDiffuseDirt:
            type: 't'
            value: diffuseDirtTex
          tDiffuseRock:
            type: 't'
            value: diffuseRockTex
          offsets:
            type: 'v2v'
            value: []
          scales:
            type: 'fv1'
            value: []
        )

        vertexShader:
          THREE.ShaderChunk.shadowmap_pars_vertex + '\n' +
          """
          const int NUM_LAYERS = #{@numLayers};
          const float RING_WIDTH = #{@ringWidth}.0;

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

          // Cubic sampling in one dimension.
          float textureCubicU(sampler2D samp, vec2 uv00, float texel, float offsetV, float frac) {
            return catmullRom(
                texture2D(samp, uv00 + vec2(-texel, offsetV)).r,
                texture2D(samp, uv00 + vec2(0.0, offsetV)).r,
                texture2D(samp, uv00 + vec2(texel, offsetV)).r,
                texture2D(samp, uv00 + vec2(texel * 2.0, offsetV)).r,
                frac);
          }

          // Cubic sampling in two dimensions, taking advantage of separability.
          float textureBicubic(sampler2D samp, vec2 uv00, vec2 texel, vec2 frac) {
            return catmullRom(
                textureCubicU(samp, uv00, texel.x, -texel.y, frac.x),
                textureCubicU(samp, uv00, texel.x, 0.0, frac.x),
                textureCubicU(samp, uv00, texel.x, texel.y, frac.x),
                textureCubicU(samp, uv00, texel.x, texel.y * 2.0, frac.x),
                frac.y);
          }

          float getHeight(vec2 worldPosition) {
            vec2 heightUv = worldToMapSpace(worldPosition, tHeightSize, tHeightScale.xy);
            vec2 texel = 1.0 / tHeightSize;

            // Find the bottom-left texel we need to sample.
            vec2 heightUv00 = (floor(heightUv * tHeightSize + 0.5) - 0.5) / tHeightSize;

            // Determine the fraction across the 4-texel quad we need to compute.
            vec2 frac = (heightUv - heightUv00) * tHeightSize;

            // Compute an interpolated coarse height value.
            float coarseHeight = textureBicubic(tHeight, heightUv00, texel, frac) * tHeightScale.z;

            // Take a surface texture sample.
            vec2 surfaceUv = worldToMapSpace(worldPosition, tSurfaceSize, tSurfaceScale.xy);
            vec4 surfaceSample = texture2D(tSurface, surfaceUv - 0.5 / tSurfaceSize);

            // Use the surface type to work out how much detail noise to add.
            float detailHeightMultiplier = surfaceSample.a;
            vec2 detailHeightUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            vec4 detailSample = texture2D(tDetail, detailHeightUv);
            float detailHeightSample = detailSample.z - 0.5;
            float detailHeight = detailHeightSample * tDetailScale.z * detailHeightMultiplier;

            return coarseHeight + detailHeight;
          }

          void main() {
            int layer = int(position.z);
            vec2 layerOffset = offsets[layer];
            float layerScale = scales[layer];

            worldPosition = position * layerScale + vec3(layerOffset, 0.0);

            // Work out how much morphing we need to do.
            vec3 manhattan = abs(worldPosition - cameraPosition);
            float morphDist = max(manhattan.x, manhattan.y) / layerScale;
            float morph = min(1.0, max(0.0, morphDist / (RING_WIDTH / 2.0) - 3.0));

            // Compute the morph direction vector.
            vec2 layerPosition = worldPosition.xy / layerScale;
            vec2 morphVector = mod(layerPosition.xy, 2.0) * (mod(layerPosition.xy, 4.0) - 2.0);
            vec3 morphTargetPosition = vec3(worldPosition.xy + layerScale * morphVector, 0.0);

            // Get the unmorphed and fully morphed terrain heights.
            worldPosition.z = getHeight(worldPosition.xy);
            morphTargetPosition.z = getHeight(morphTargetPosition.xy);

            // Apply the morphing.
            worldPosition = mix(worldPosition, morphTargetPosition, morph);

            eyePosition = modelViewMatrix * vec4(worldPosition, 1.0);
            gl_Position = projectionMatrix * eyePosition;

            #ifdef USE_SHADOWMAP
            for( int i = 0; i < MAX_SHADOWS; i ++ ) {
              vShadowCoord[ i ] = shadowMatrix[ i ] * vec4( worldPosition, 1.0 );
            }
            #endif
          }
          """
        fragmentShader:
          THREE.ShaderChunk.fog_pars_fragment + '\n' +
          THREE.ShaderChunk.lights_phong_pars_fragment + '\n' +
          THREE.ShaderChunk.shadowmap_pars_fragment + '\n' +
          """
          #extension GL_OES_standard_derivatives : enable

          uniform sampler2D tSurface;

          uniform vec2 tSurfaceSize;
          uniform vec3 tSurfaceScale;
          uniform sampler2D tDetail;
          uniform vec2 tDetailSize;
          uniform vec3 tDetailScale;
          uniform sampler2D tDiffuseDirt;
          uniform sampler2D tDiffuseRock;

          varying vec4 eyePosition;
          varying vec3 worldPosition;

          vec2 worldToMapSpace(vec2 coord, vec2 size, vec2 scale) {
            return (coord / scale + 0.5) / size;
          }

          mat2 inverse(mat2 m) {
            float det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
            return mat2(m[1][1], -m[1][0], -m[0][1], m[0][0]) / det;
          }

          float bias_fast(float a, float b) {
            return b / ((1.0/a - 2.0) * (1.0-b) + 1.0);
          }

          float gain_fast(float a, float b) {
            return (b < 0.5) ?
              (bias_fast(1.0 - a, 2.0 * b) / 2.0) :
              (1.0 - bias_fast(1.0 - a, 2.0 - 2.0 * b) / 2.0);
          }

          void main() {
            gl_FragColor.a = 1.0;
            float height = worldPosition.z;
            float depth = length(eyePosition.xyz);
            vec2 diffUv = worldPosition.xy / 4.0;
            vec3 diffDirtSample = texture2D(tDiffuseDirt, diffUv).rgb;
            vec3 diffRockSample = texture2D(tDiffuseRock, diffUv / 8.0).rgb;
            vec2 surfaceUv = worldToMapSpace(worldPosition.xy, tSurfaceSize, tSurfaceScale.xy);
            vec4 surfaceSample = texture2D(tSurface, surfaceUv - 0.5 / tSurfaceSize);

            vec2 surfaceDerivs = 255.0 * tSurfaceScale.z / tSurfaceScale.xy * (surfaceSample.xy - 0.5);

            float surfaceType = surfaceSample.b;
            float detailHeightAmount = surfaceSample.a;

            vec2 detailUv = worldToMapSpace(worldPosition.xy, tDetailSize, tDetailScale.xy);
            vec4 detailSample = texture2D(tDetail, detailUv) - vec4(0.5, 0.5, 0.0, 0.0);
            float detailHeight = detailSample.z;
            vec2 detailDerivs = vec2(tDetailScale.z / tDetailScale.xy * detailSample.xy) * detailHeightAmount;

            vec2 epsilon = 1.0 / tDetailSize;

            vec3 normalDetail = normalize(vec3(- surfaceDerivs - detailDerivs, 1.0));
            vec3 normalRegion = normalize(vec3(- surfaceDerivs, 1.0));

            vec3 tangentU = vec3(1.0 - normalDetail.x * normalDetail.x, 0.0, -normalDetail.x);
            vec3 tangentV = vec3(0.0, 1.0 - normalDetail.y * normalDetail.y, -normalDetail.y);

            // Add another layer of high-detail noise.
            vec3 normalSq = normalDetail * normalDetail;
            vec2 detail2SampleX = texture2D(tDetail, worldToMapSpace(worldPosition.zy, tDetailSize, tDetailScale.xy / 37.3)).xy;
            vec2 detail2SampleY = texture2D(tDetail, worldToMapSpace(worldPosition.xz, tDetailSize, tDetailScale.xy / 37.3)).xy;
            vec2 detail2SampleZ = texture2D(tDetail, worldToMapSpace(worldPosition.yx, tDetailSize, tDetailScale.xy / 37.3)).xy;
            vec2 detail2Sample = detail2SampleX * normalSq.x +
                                 detail2SampleY * normalSq.y +
                                 detail2SampleZ * normalSq.z;
            vec2 detail2Derivs = vec2(2.0 / tDetailScale.xy * (detail2Sample.xy - 0.5));
            vec3 normalDetail2 = normalize(vec3(- detail2Derivs, 1.0));
            normalDetail2 = normalDetail2.x * tangentU +
                            normalDetail2.y * tangentV +
                            normalDetail2.z * normalDetail;

            float noiseSample = texture2D(tDetail, worldPosition.yx / 512.0).b;
            vec3 veggieColor1 = vec3(0.43, 0.45, 0.25);
            vec3 veggieColor2 = vec3(0.14, 0.18, 0.05);
            vec3 eyeVec = normalize(cameraPosition - worldPosition);
            float veggieMix = dot(eyeVec, normalDetail);
            veggieMix = bias_fast(veggieMix * 0.7 + 0.3, 0.7);
            vec3 veggieColor = mix(veggieColor1, veggieColor2, veggieMix);
            float rockMix = 1.0 - smoothstep(1.5*0.71, 1.5*0.74,
                normalRegion.z + normalDetail.z * 0.5 + (noiseSample - 0.5) * 0.3 - height * 0.0002);

            float trackMix = 1.0 - smoothstep(0.02, 0.04,
                surfaceType + (diffRockSample.b - 0.5) * 0.15);

            gl_FragColor.rgb = veggieColor;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, diffRockSample, rockMix);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, diffDirtSample, trackMix);

            vec3 specular = vec3(0.0);
            specular = mix(specular, vec3(0.20, 0.21, 0.22), rockMix);
            specular = mix(specular, vec3(0.0), trackMix);

            """ +
            #THREE.ShaderChunk.shadowmap_fragment +
            """

            float fDepth;
            vec3 shadowColor = vec3(1.0);
            #ifdef USE_SHADOWMAP
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

                // Fade out the edges of the shadow.
                const float edgeSize = 0.05;
                float falloff =
                    smoothstep(0.0, edgeSize, shadowCoord.x) *
                    smoothstep(-1.0, edgeSize - 1.0, -shadowCoord.x) *
                    smoothstep(0.0, edgeSize, shadowCoord.y) *
                    smoothstep(-1.0, edgeSize - 1.0, -shadowCoord.y);
                shadow *= falloff;
                shadowColor = shadowColor * vec3((1.0 - shadow));
              }
            }
            #endif

            vec3 directIllum = vec3(0.0);
            vec3 specularIllum = vec3(0.0);
            #if MAX_DIR_LIGHTS > 0
            for (int i = 0; i < MAX_DIR_LIGHTS; ++i) {
              vec4 lDirection = viewMatrix * vec4(directionalLightDirection[i], 0.0);
              vec3 dirVector = normalize(lDirection.xyz);
              directIllum += max(dot(normalDetail2, directionalLightDirection[i]), 0.0);
              specularIllum += specular *
                  pow(max(0.0, dot(normalDetail2,
                                   normalize(eyeVec + directionalLightDirection[i]))),
                      20.0);
              directIllum *= directionalLightColor[i];
              float mask = step(0.0, dot(normalDetail, directionalLightDirection[i])) *
                           step(0.0, dot(normalRegion, directionalLightDirection[i]));
              //directIllum *= mask;
              specularIllum *= mask;
            }
            #endif
            vec3 totalIllum = ambientLightColor + directIllum * shadowColor;
            gl_FragColor.rgb = gl_FragColor.rgb * totalIllum + specularIllum * shadowColor;

            const float LOG2 = 1.442695;
            float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
            fogFactor = clamp( 1.0 - fogFactor, 0.0, 1.0 );
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
          }
          """
      # lineMat = new THREE.MeshBasicMaterial# color: 0x000000, wireframe: true
      # lineMat.wireframe = true
      # @material.wireframe = true
      obj = new THREE.Mesh @geom, @material
      obj.frustumCulled = no
      obj.receiveShadow = yes
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

      createTexture = (buffer, mipmap) =>
        # console.log "createTexture " + buffer.url
        tex = new THREE.DataTexture(
            buffer.data,
            buffer.width,
            buffer.height,
            threeFmt(uImg.channels buffer),
            threeType(buffer.data),
            null,
            THREE.RepeatWrapping, THREE.RepeatWrapping,
            if mipmap then THREE.LinearFilter else THREE.NearestFilter,
            if mipmap then THREE.LinearMipMapLinearFilter else THREE.NearestFilter)
        tex.generateMipmaps = mipmap
        tex.needsUpdate = true
        tex.flipY = false
        tex

      # TODO: Don't grab the terrain source directly. It's supposed to be hidden implementation.
      maps = @terrain.source.maps
      uniforms = @material.uniforms

      quiver.connect maps.height.q_map, heightNode = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tHeight.value = createTexture buffer, false
        uniforms.tHeightSize.value.set buffer.width, buffer.height
        uniforms.tHeightScale.value.copy maps.height.scale
        uniforms.tHeightScale.value.z *= typeScale buffer.data
        done()

      quiver.connect maps.surface.q_map, surfaceNode = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tSurface.value = createTexture buffer, true
        uniforms.tSurfaceSize.value.set buffer.width, buffer.height
        uniforms.tSurfaceScale.value.copy maps.surface.scale
        #uniforms.tSurfaceScale.value.z *= typeScale buffer.data
        done()

      quiver.connect maps.detail.q_map, detailNode = new quiver.Node (ins, outs, done) ->
        buffer = ins[0]
        uniforms.tDetail.value = createTexture buffer, true
        #if @glAniso then uniforms.tDetail.value.onUpdate = =>
        #  @gl.texParameteri @gl.TEXTURE_2D, @glAniso.TEXTURE_MAX_ANISOTROPY_EXT, 8
        uniforms.tDetailSize.value.set buffer.width, buffer.height
        uniforms.tDetailScale.value.copy maps.detail.scale
        uniforms.tDetailScale.value.z *= typeScale buffer.data
        done()

      # Do a pull only if the rest of the pipeline has already executed.
      # TODO: Implement optimized quiver multi-pull.
      # console.log "maps:"
      # console.log maps
      quiver.pull heightNode if maps.height.q_map.updated
      quiver.pull surfaceNode if maps.surface.q_map.updated
      quiver.pull detailNode if maps.detail.q_map.updated

      return

    _createGeom: ->
      geom = new array_geometry.ArrayGeometry()
      geom.wireframe = false
      geom.attributes =
        "index":
          array: []
        "position":
          array: []
          itemSize: 3
      idx = geom.attributes["index"].array
      posn = geom.attributes["position"].array
      RING_WIDTH = @ringWidth
      ringSegments = [
        [  1,  0,  0,  1 ],
        [  0, -1,  1,  0 ],
        [ -1,  0,  0, -1 ],
        [  0,  1, -1,  0 ]
      ]
      scale = @baseScale
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

      #geom.removeIndices()
      geom.updateOffsets()
      return geom
