###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'client/audio'
  'client/car'
  'cs!client/misc'
  'cs!client/terrain'
  'game/game'
  'util/pubsub'
  'cs!util/quiver'
  'util/util'
], (THREE, clientAudio, clientCar, clientMisc, clientTerrain, gameGame, pubsub, quiver, util) ->
  Vec3 = THREE.Vector3
  PULLTOWARD = util.PULLTOWARD

  class RenderCheckpoints
    constructor: (@scene, checkpoints) ->
      @ang = 0
      @meshes = []

      @selectedMat = new THREE.MeshBasicMaterial
        color: 0x903030
        blending: THREE.AdditiveBlending
        transparent: 1
        depthWrite: false

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
      return

    highlightCheckpoint: (i) ->
      for mesh in @meshes
        mesh.material = clientMisc.checkpointMaterial()
      @meshes[i]?.material = @selectedMat
      return

  class CamControl
    constructor: (@camera, @car) ->
      # Note that CamControl controls the camera given at construction,
      # not the one passed into update().
      return

    update: (camera, delta) ->
      if @car.root?
        targetPos = @car.root.position.clone()
        targetPos.addSelf(@car.vehic.body.linVel.clone().multiplyScalar(.17))
        targetPos.addSelf(@car.root.matrix.getColumnX().clone().multiplyScalar(0))
        targetPos.addSelf(@car.root.matrix.getColumnY().clone().multiplyScalar(1.2))
        targetPos.addSelf(@car.root.matrix.getColumnZ().clone().multiplyScalar(-2.9))
        camDelta = delta * 5
        @camera.position.x = PULLTOWARD(@camera.position.x, targetPos.x, camDelta)
        @camera.position.y = PULLTOWARD(@camera.position.y, targetPos.y, camDelta)
        @camera.position.z = PULLTOWARD(@camera.position.z, targetPos.z, camDelta)

        @camera.useQuaternion = false
        lookPos = @car.root.position.clone()
        lookPos.addSelf(@car.root.matrix.getColumnY().clone().multiplyScalar(0.7))
        @camera.lookAt(lookPos)
      return

  class CarControl
    constructor: (@vehic, @input) ->
      return

    update: (camera, delta) ->
      controls = @vehic.controller.input;
      keyDown = @input.keyDown
      KEYCODE = util.KEYCODE
      controls.forward = if keyDown[KEYCODE['UP']] or keyDown[KEYCODE['W']] then 1 else 0
      controls.back = if keyDown[KEYCODE['DOWN']] or keyDown[KEYCODE['S']] then 1 else 0
      controls.left = if keyDown[KEYCODE['LEFT']] or keyDown[KEYCODE['A']] then 1 else 0
      controls.right = if keyDown[KEYCODE['RIGHT']] or keyDown[KEYCODE['D']] then 1 else 0
      controls.handbrake = if keyDown[KEYCODE['SPACE']] then 1 else 0
      return

  class SunLight
    constructor: (scene) ->
      sunLight = @sunLight = new THREE.DirectionalLight( 0xffe0bb )
      sunLight.intensity = 1.3
      @sunLightPos = new Vec3 -6, 7, 10
      sunLight.position.copy @sunLightPos

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

      scene.add sunLight
      return

    update: (camera, delta) ->
      @sunLight.target.position.copy camera.position
      @sunLight.position.copy(camera.position).addSelf @sunLightPos
      @sunLight.updateMatrixWorld()
      @sunLight.target.updateMatrixWorld()
      return

  keyWeCareAbout = (event) ->
    event.keyCode <= 127
  isModifierKey = (event) ->
    event.ctrlKey or event.altKey or event.metaKey

  TriggerClient: class TriggerClient
    constructor: (@containerEl, @game) ->
      # TODO: Add Detector support.
      @objects = []
      @pubsub = new pubsub.PubSub()

      @renderer = @createRenderer()
      @containerEl.appendChild @renderer.domElement

      @scene = new THREE.Scene()
      @camera = new THREE.PerspectiveCamera 75, 1, 0.1, 10000000
      @camera.up.set 0, 0, 1
      @scene.add @camera
      @scene.fog = new THREE.FogExp2 0xdddddd, 0.0001

      @scene.add new THREE.AmbientLight 0x446680
      @scene.add @cubeMesh()

      @add new SunLight @scene

      @audio = new clientAudio.WebkitAudio()

      @game.on 'settrack', (track) =>
        @add new clientTerrain.RenderTerrain(@scene, track.terrain, @renderer.context)
        @add @renderCheckpoints = new RenderCheckpoints(@scene, track.checkpoints)
        return

      @game.on 'addcar', (car) =>
        renderCar = new clientCar.RenderCar(@scene, car, @audio)
        @add renderCar
        @add new CamControl(@camera, renderCar)
        @add new CarControl(car, this)
        @pubsub.publish 'addcar'
        return

      @keyDown = []

    onKeyDown: (event) ->
      if keyWeCareAbout(event) and not isModifierKey(event)
        @keyDown[event.keyCode] = true
        event.preventDefault()
        @pubsub.publish 'keydown', event
      return
    onKeyUp: (event) ->
      if keyWeCareAbout(event)
        @keyDown[event.keyCode] = false
        event.preventDefault()
      return

    on: (event, handler) -> @pubsub.subscribe event, handler

    add: (obj) -> @objects.push obj

    createRenderer: ->
      r = new THREE.WebGLRenderer
        alpha: false
        antialias: false
        premultipliedAlpha: false
        clearColor: 0xffffff
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

    debouncedMuteAudio: _.debounce((audio) ->
      audio.setGain 0
    , 500)

    muteAudioIfStopped: ->
      @audio.setGain 1
      @debouncedMuteAudio @audio
      return

    update: (delta) ->
      @game.sim.tick delta
      @objects.forEach (object) =>
        object.update @camera, delta
      @muteAudioIfStopped()
      return

    render: ->
      delta = 0
      @renderer.clear false, true
      @renderer.render @scene, @camera
      return

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
            gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.0, 0.05, wPos.z));
          }
          """
      #cubeMaterial.transparent = 1  # Force draw at end.
      cubeMesh = new THREE.Mesh(
          new THREE.CubeGeometry(5000000, 5000000, 5000000), cubeMaterial)
      cubeMesh.geometry.faces.splice(5, 1)
      cubeMesh.flipSided = true
      cubeMesh.position.set(0, 0, 20000)
      cubeMesh
