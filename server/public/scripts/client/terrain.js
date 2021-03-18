/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'underscore',
  'client/array_geometry',
  'util/image',
  'util/quiver'
], function(THREE, _, array_geometry, uImg, quiver) {
  let RenderTerrain;
  const Vec2 = THREE.Vector2;
  const Vec3 = THREE.Vector3;

  return {
    RenderTerrain: (RenderTerrain = class RenderTerrain {
      constructor(scene, terrain, gl, terrainhq) {
        this.scene = scene;
        this.terrain = terrain;
        this.gl = gl;
        this.geom = null;
        if (terrainhq) {
          this.baseScale = 0.5;
          this.numLayers = 10;
          this.ringWidth = 15;
        } else {
          this.baseScale = 1;
          this.numLayers = 10;
          this.ringWidth = 7;
        }
        this.totalTime = 0;
        this.glDerivs = this.gl.getExtension('OES_standard_derivatives');
        // @glFloatLinear = @gl.getExtension('OES_texture_float_linear')
        this.glAniso =
          this.gl.getExtension("EXT_texture_filter_anisotropic") ||
          this.gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
      }

      update(camera, delta) {
        this.totalTime += delta;
        if ((this.material == null) && (this.terrain.source != null)) {
          this._setup();
        }
        if (this.geom == null) { return; }

        const offsets = this.material.uniforms['offsets'].value;
        const scales = this.material.uniforms['scales'].value;
        let scale = this.baseScale * Math.pow(2,
          Math.floor(Math.log(Math.max(1, camera.position.z / 2000)) / Math.LN2));
        for (let layer = 0, end = this.numLayers, asc = 0 <= end; asc ? layer < end : layer > end; asc ? layer++ : layer--) {
          const offset = offsets[layer] != null ? offsets[layer] : (offsets[layer] = new THREE.Vector2());
          const doubleScale = scale * 2;
          offset.x = (Math.floor(camera.position.x / doubleScale) + 0.5) * doubleScale;
          offset.y = (Math.floor(camera.position.y / doubleScale) + 0.5) * doubleScale;
          scales[layer] = scale;
          scale *= 2;
        }
      }

      _setup() {
        let detailNode, heightNode, surfaceNode;
        const diffuseDirtTex = THREE.ImageUtils.loadTexture(window.BASE_PATH + '/a/textures/dirt.jpg');
        diffuseDirtTex.wrapS = THREE.RepeatWrapping;
        diffuseDirtTex.wrapT = THREE.RepeatWrapping;
        if (this.glAniso) { diffuseDirtTex.onUpdate = () => {
          return this.gl.texParameteri(this.gl.TEXTURE_2D, this.glAniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        }; }

        const diffuseRockTex = THREE.ImageUtils.loadTexture(window.BASE_PATH + '/a/textures/rock.jpg');
        diffuseRockTex.wrapS = THREE.RepeatWrapping;
        diffuseRockTex.wrapT = THREE.RepeatWrapping;

        this.geom = this._createGeom();
        this.material = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: false});
        this.material = new THREE.ShaderMaterial({
          lights: true,
          fog: true,

          uniforms: _.extend( THREE.UniformsUtils.merge( [
              THREE.UniformsLib['lights'],
              THREE.UniformsLib['fog'],
            ]), {
            tHeight: {
              type: 't',
              value: null
            },
            tHeightSize: {
              type: 'v2',
              value: new Vec2(1, 1)
            },
            tHeightScale: {
              type: 'v3',
              value: new Vec3(1, 1, 1)
            },
            tSurface: {
              type: 't',
              value: null
            },
            tSurfaceSize: {
              type: 'v2',
              value: new Vec2(1, 1)
            },
            tSurfaceScale: {
              type: 'v3',
              value: new Vec3(1, 1, 1)
            },
            tDetail: {
              type: 't',
              value: null
            },
            tDetailSize: {
              type: 'v2',
              value: new Vec2(1, 1)
            },
            tDetailScale: {
              type: 'v3',
              value: new Vec3(1, 1, 1)
            },
            tDiffuseDirt: {
              type: 't',
              value: diffuseDirtTex
            },
            tDiffuseRock: {
              type: 't',
              value: diffuseRockTex
            },
            offsets: {
              type: 'v2v',
              value: []
            },
            scales: {
              type: 'fv1',
              value: []
            }
          }
          ),

          vertexShader:
            '#extension GL_OES_standard_derivatives : enable\n' +
            THREE.ShaderChunk.shadowmap_pars_vertex + '\n' +
            `\

#define MAX_SHADOWS 1

const int NUM_LAYERS = ${this.numLayers};
const float RING_WIDTH = ${this.ringWidth}.0;

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
      vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * vec4( worldPosition, 1.0 );
    }
    #endif
}\
`,
          fragmentShader:
            `\

#define MAX_SHADOWS 1
\
` +
            THREE.ShaderChunk.common + '\n' +
            THREE.ShaderChunk.bsdfs + '\n' +
            THREE.ShaderChunk.packing + '\n' +
            THREE.ShaderChunk.fog_pars_fragment + '\n' +
            THREE.ShaderChunk.shadowmap_pars_fragment + '\n' +
            // THREE.ShaderChunk.lights_phong_pars_fragment + '\n' +
            // THREE.ShaderChunk.shadowmap_pars_fragment + '\n' +
            `\

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
uniform mat4 projectionMatrix;

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

#include <lights_pars_begin>
DirectionalLight directionalLight;
const float logOf2 = 1.442695;

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
\
` +
              //THREE.ShaderChunk.shadowmap_fragment +
              `\

    float fDepth;
    vec3 shadowColor = vec3(1.0);
    #ifdef USE_SHADOWMAP
    for( int i = 0; i < MAX_SHADOWS; i ++ ) {
      vec3 shadowCoord = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;
      bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
      bool inFrustum = all( inFrustumVec );
      bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
      bool frustumTest = all( frustumTestVec );
      if ( frustumTest ) {
        shadowCoord.z += directionalLights[i].shadowBias;
        float shadow = 0.0;
        const float shadowDelta = 1.0 / 9.0;
        float xPixelOffset = 1.0 / directionalLights[i].shadowMapSize.x;
        float yPixelOffset = 1.0 / directionalLights[i].shadowMapSize.y;
        float dx0 = -1.25 * xPixelOffset;
        float dy0 = -1.25 * yPixelOffset;
        float dx1 = 1.25 * xPixelOffset;
        float dy1 = 1.25 * yPixelOffset;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );
        if ( fDepth < shadowCoord.z ) shadow += shadowDelta;
        fDepth = unpackRGBAToDepth( texture2D( directionalShadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );
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

    #if ( NUM_DIR_LIGHTS > 0 )
    vec3 directIllum = vec3(0.0);
    vec3 specularIllum = vec3(0.0);
    #pragma unroll_loop
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      directionalLight = directionalLights[ i ];

      // hardcoding this as .9 because in three directionalLights[i].direction seems to be turning together with the view
      vec3 dirVector = normalize(vec3(.9, .9, .9));
      directIllum += max(dot(normalDetail2, dirVector), 0.0);
      specularIllum += specular *
          pow(max(0.0, dot(normalDetail2,
                           normalize(eyeVec + dirVector))),
              20.0);
      directIllum *= directionalLight.color;
      float mask = step(0.0, dot(normalDetail, dirVector)) *
                   step(0.0, dot(normalRegion, dirVector));
      //directIllum *= mask;
      specularIllum *= mask;
    }
    vec3 totalIllum = ambientLightColor + directIllum * shadowColor;
    gl_FragColor.rgb = gl_FragColor.rgb * totalIllum + specularIllum * shadowColor;
    #endif

    float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * logOf2 );
    fogFactor = clamp( 1.0 - fogFactor, 0.0, 1.0 );
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
}
\
`
        });
        // lineMat = new THREE.MeshBasicMaterial# color: 0x000000, wireframe: true
        // lineMat.wireframe = true
        // @material.wireframe = true
        const lights_pars_begin = `\

      "vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
      "vec3 dirVector = normalize( lDirection.xyz );",

      // diffuse

      "float dotProduct = dot( normal, dirVector );",

      "#ifdef WRAP_AROUND",

        "float dirDiffuseWeightFull = max( dotProduct, 0.0 );",
        "float dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );",

        "vec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );",

      "#else",

        "float dirDiffuseWeight = max( dotProduct, 0.0 );",

      "#endif",

      "dirDiffuse  += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;",

      // specular

      "vec3 dirHalfVector = normalize( dirVector + viewPosition );",
      "float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );",
      "float dirSpecularWeight = specularStrength * max( pow( dirDotNormalHalf, shininess ), 0.0 );",



    uniform vec3 ambientLightColor;
    vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
      vec3 irradiance = ambientLightColor;
      #ifndef PHYSICALLY_CORRECT_LIGHTS
        irradiance *= PI;
      #endif
      return irradiance;
}
    #if NUM_DIR_LIGHTS > 0
      struct DirectionalLight {
          vec3 direction;
        vec3 color;
        int shadow;
        float shadowBias;
        float shadowRadius;
        vec2 shadowMapSize;
      };
      uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
      void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
          directLight.color = directionalLight.color;
        directLight.direction = directionalLight.direction;
        directLight.visible = true;
      }
    #endif

    GeometricContext geometry;
    geometry.position = - vViewPosition;
    geometry.normal = normal;
    geometry.viewDir = normalize( vViewPosition );
    IncidentLight directLight;
    #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
      DirectionalLight directionalLight;
      #pragma unroll_loop
      for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
          directionalLight = directionalLights[ i ];
        getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
        #ifdef USE_SHADOWMAP
        directLight.color *= all( bvec2( directionalLight.shadow, directLight.visible ) ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
        #endif
        RE_Direct( directLight, geometry, material, reflectedLight );
      }
    #endif
    #if defined( RE_IndirectDiffuse )
      vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
      #if ( NUM_HEMI_LIGHTS > 0 )
        #pragma unroll_loop
        for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
            irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
        }
      #endif
    #endif
    #if defined( RE_IndirectSpecular )
      vec3 radiance = vec3( 0.0 );
      vec3 clearCoatRadiance = vec3( 0.0 );
    #endif
\
`;

        const obj = new THREE.Mesh(this.geom, this.material);
        obj.frustumCulled = false;
        obj.receiveShadow = true;
        this.scene.add(obj);

        const threeFmt = function(channels) {
          switch (channels) {
            case 1: return THREE.LuminanceFormat;
            case 2: return THREE.LuminanceAlphaFormat;
            case 3: return THREE.RGBFormat;
            case 4: return THREE.RGBAFormat;
            default: throw 'Unknown format';
          }
        };

        const threeType = function(data) {
          switch (data.constructor) {
            case Uint8Array: return THREE.UnsignedByteType;
            case Uint8ClampedArray: return THREE.UnsignedByteType;
            case Uint16Array: return THREE.UnsignedShortType;
            case Float32Array: return THREE.FloatType;
            default: throw 'Unknown type';
          }
        };

        const typeScale = function(data) {
          switch (data.constructor) {
            case Uint8Array: return 255;
            case Uint8ClampedArray: return 255;
            case Uint16Array: return 65535;
            case Float32Array: return 1;
            default: throw 'Unknown type';
          }
        };

        const createTexture = (buffer, mipmap) => {
          // console.log "createTexture " + buffer.url
          const tex = new THREE.DataTexture(
              buffer.data,
              buffer.width,
              buffer.height,
              threeFmt(uImg.channels(buffer)),
              threeType(buffer.data),
              null,
              THREE.RepeatWrapping, THREE.RepeatWrapping,
              mipmap ? THREE.LinearFilter : THREE.NearestFilter,
              mipmap ? THREE.LinearMipMapLinearFilter : THREE.NearestFilter);
          tex.generateMipmaps = mipmap;
          tex.needsUpdate = true;
          tex.flipY = false;
          return tex;
        };

        // TODO: Don't grab the terrain source directly. It's supposed to be hidden implementation.
        const { maps } = this.terrain.source;
        const { uniforms } = this.material;

        quiver.connect(maps.height.q_map, (heightNode = new quiver.Node(function(ins, outs, done) {
          const buffer = ins[0];
          uniforms.tHeight.value = createTexture(buffer, false);
          uniforms.tHeightSize.value.set(buffer.width, buffer.height);
          uniforms.tHeightScale.value.copy(maps.height.scale);
          uniforms.tHeightScale.value.z *= typeScale(buffer.data);
          return done();
        }))
        );

        quiver.connect(maps.surface.q_map, (surfaceNode = new quiver.Node(function(ins, outs, done) {
          const buffer = ins[0];
          uniforms.tSurface.value = createTexture(buffer, true);
          uniforms.tSurfaceSize.value.set(buffer.width, buffer.height);
          uniforms.tSurfaceScale.value.copy(maps.surface.scale);
          //uniforms.tSurfaceScale.value.z *= typeScale buffer.data
          return done();
        }))
        );

        quiver.connect(maps.detail.q_map, (detailNode = new quiver.Node(function(ins, outs, done) {
          const buffer = ins[0];
          uniforms.tDetail.value = createTexture(buffer, true);
          //if @glAniso then uniforms.tDetail.value.onUpdate = =>
          //  @gl.texParameteri @gl.TEXTURE_2D, @glAniso.TEXTURE_MAX_ANISOTROPY_EXT, 8
          uniforms.tDetailSize.value.set(buffer.width, buffer.height);
          uniforms.tDetailScale.value.copy(maps.detail.scale);
          uniforms.tDetailScale.value.z *= typeScale(buffer.data);
          return done();
        }))
        );

        // Do a pull only if the rest of the pipeline has already executed.
        // TODO: Implement optimized quiver multi-pull.
        // console.log "maps:"
        // console.log maps
        if (maps.height.q_map.updated) { quiver.pull(heightNode); }
        if (maps.surface.q_map.updated) { quiver.pull(surfaceNode); }
        if (maps.detail.q_map.updated) { quiver.pull(detailNode); }

      }

      _createGeom() {
        const geom = new array_geometry.ArrayGeometry();
        geom.wireframe = false;

        const idx = [];
        const posn = [];
        const RING_WIDTH = this.ringWidth;
        const ringSegments = [
          [  1,  0,  0,  1 ],
          [  0, -1,  1,  0 ],
          [ -1,  0,  0, -1 ],
          [  0,  1, -1,  0 ]
        ];
        let scale = this.baseScale;
        for (let layer = 0, end = this.numLayers, asc = 0 <= end; asc ? layer < end : layer > end; asc ? layer++ : layer--) {
          const nextLayer = Math.min(layer + 1, this.numLayers - 1);
          for (let segNumber = 0; segNumber < ringSegments.length; segNumber++) {
            const segment = ringSegments[segNumber];
            const rowStart = [];
            const segStart = layer > 0 ? RING_WIDTH + 0 : 0;
            const segWidth = layer > 0 ? RING_WIDTH + 1 : (RING_WIDTH * 2) + 1;
            const segLength = layer > 0 ? (RING_WIDTH * 3) + 1 : (RING_WIDTH * 2) + 1;
            for (let i = 0, end1 = segLength, asc1 = 0 <= end1; asc1 ? i <= end1 : i >= end1; asc1 ? i++ : i--) {
              rowStart.push(posn.length / 3);
              const modeli = segStart - i;
              // Draw main part of ring.
              // TODO: Merge vertices between segments.
              for (let j = 0, end2 = segWidth, asc2 = 0 <= end2; asc2 ? j <= end2 : j >= end2; asc2 ? j++ : j--) {
                const modelj = segStart + j;
                const segi = (segment[0] * modeli) + (segment[1] * modelj);
                const segj = (segment[2] * modeli) + (segment[3] * modelj);
                posn.push(segj, segi, layer);
                const m = [ 0, 0, 0, 0 ];
                if ((i > 0) && (j > 0)) {
                  const start0 = rowStart[i-1] + (j-1);
                  const start1 = rowStart[i]   + (j-1);
                  if (((i + j) % 2) === 1) {
                    idx.push(start0 + 1, start0 + 0, start1 + 0);
                    idx.push(start0 + 1, start1 + 0, start1 + 1);
                  } else {
                    idx.push(start0 + 0, start1 + 0, start1 + 1);
                    idx.push(start0 + 0, start1 + 1, start0 + 1);
                  }
                }
              }
            }
          }
          scale *= 2;
        }

        // TODO: would be better to precalculate these sizes instead of using [] in the beginning
        geom.addAttribute("index", new THREE.BufferAttribute(new Uint32Array(idx), 1));
        geom.addAttribute("position", new THREE.BufferAttribute(new Float32Array(posn), 3));

        //geom.removeIndices()
        geom.updateOffsets();
        return geom;
      }
    })
  };
});
