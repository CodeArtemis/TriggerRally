###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'cs!client/misc'
  'cs!client/terrain'
  'cs!util/quiver'
], (THREE, clientMisc, clientTerrain, quiver) ->
  Vec3 = THREE.Vector3

  class RenderCheckpoints
    constructor: (@scene, checkpoints) ->
      @ang = 0
      @meshes = []
      quiver.connect checkpoints, (ins, outs, done) =>
        for mesh in @meshes
          @scene.remove mesh
        @meshes = for cp in checkpoints
          mesh = clientMisc.checkpointMesh()
          mesh.position.addSelf cp
          @scene.add mesh
          mesh
        done()

    update: (camera, delta) ->
      if false
        @ang += delta * 3
        for mesh in @meshes
          mesh.rotation.y = @ang
      return

  TriggerClient: class TriggerClient
    constructor: (@containerEl) ->
      # TODO: Add Detector support.
      @renderer = @createRenderer()
      @containerEl.appendChild @renderer.domElement

      @scene = new THREE.Scene()
      @camera = new THREE.PerspectiveCamera 75, 1, 0.1, 10000000
      @camera.up.set 0, 0, 1
      @scene.add @camera
      @scene.fog = new THREE.FogExp2 0xdddddd, 0.00005

      @scene.add new THREE.AmbientLight 0x446680
      @scene.add @sunLight()
      @scene.add @cubeMesh()

      @objects = []

    createRenderer: ->
      r = new THREE.WebGLRenderer
        alpha: false
        antialias: false
        premultipliedAlpha: false
      r.shadowMapEnabled = true
      r.shadowMapSoft = true
      r.shadowMapCullFrontFaces = false
      r.autoClear = false
      return r

    setSize: (@width, @height) ->
      @renderer.setSize @width, @height
      @camera.aspect = if @height > 0 then @width / @height else 1
      @camera.updateProjectionMatrix()
      @render()
      return

    update: (delta) ->
      @objects.forEach (object) =>
        object.update @camera, delta

    render: ->
      delta = 0
      @renderer.clear false, true
      @renderer.render @scene, @camera
      return

    sunLight: ->
      sunLight = new THREE.DirectionalLight( 0xffe0bb )
      sunLight.intensity = 1.3
      @sunLightPos = sunLight.position.set 10, 0, 10

      sunLight.castShadow = true

      sunLight.shadowCameraNear = -20
      sunLight.shadowCameraFar = 60
      sunLight.shadowCameraLeft = -24
      sunLight.shadowCameraRight = 24
      sunLight.shadowCameraTop = 24
      sunLight.shadowCameraBottom = -24

      #sunLight.shadowCameraVisible = true

      #sunLight.shadowBias = -0.001
      sunLight.shadowDarkness = 0.5

      sunLight.shadowMapWidth = 1024
      sunLight.shadowMapHeight = 1024

      sunLight

    cubeMesh: ->
      path = "/a/textures/miramar-512/miramar_"
      format = '.jpg'
      urls = [
        path + 'rt' + format, path + 'lf' + format
        path + 'ft' + format, path + 'bk' + format
        path + 'up' + format, path + 'dn' + format
      ]
      textureCube = THREE.ImageUtils.loadTextureCube urls
      cubeMaterial = new THREE.ShaderMaterial
        fog: true
        uniforms: _.extend(
            THREE.UniformsUtils.merge([
              THREE.UniformsLib['fog']
            ]),
              tFlip:
                type: 'f'
                value: -1
              tCube:
                type: 't'
                value: 0
                texture: textureCube
        )
        vertexShader:
          """
          varying vec3 vViewPosition;
          void main() {
            vec4 mPosition = objectMatrix * vec4( position, 1.0 );
            vViewPosition = cameraPosition - mPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }
          """
        fragmentShader:
          THREE.ShaderChunk.fog_pars_fragment +
          """

          uniform samplerCube tCube;
          uniform float tFlip;
          varying vec3 vViewPosition;
          void main() {
            vec3 wPos = normalize(cameraPosition - vViewPosition);
            gl_FragColor = textureCube( tCube, vec3( tFlip * wPos.x, wPos.yz ) );
            gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.05, 0.3, wPos.z));
          }
          """
      #cubeMaterial.transparent = 1  # Force draw at end.
      cubeMesh = new THREE.Mesh(
          new THREE.CubeGeometry(5000000, 5000000, 5000000), cubeMaterial)
      cubeMesh.geometry.faces.splice(5, 1)
      cubeMesh.flipSided = true
      cubeMesh.position.set(0, 0, 20000)
      cubeMesh

    setTrack: (@track) ->
      @objects.push new clientTerrain.RenderTerrain(@scene, track.terrain, @renderer.context)
      @objects.push new RenderCheckpoints(@scene, track.checkpoints)
