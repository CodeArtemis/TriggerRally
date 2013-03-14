###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
  'client/audio'
  'client/car'
  'cs!client/misc'
  'cs!client/scenery'
  'cs!client/terrain'
  'game/game'
  'game/track'
  'cs!game/synchro'
  'util/pubsub'
  'cs!util/quiver'
  'util/util'
], (
  THREE
  clientAudio
  clientCar
  clientMisc
  clientScenery
  clientTerrain
  gameGame
  gameTrack
  synchro
  pubsub
  quiver
  util
) ->
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3
  PULLTOWARD = util.PULLTOWARD
  MAP_RANGE = util.MAP_RANGE
  KEYCODE = util.KEYCODE
  deadZone = util.deadZone

  projector = new THREE.Projector

  class RenderCheckpointsEditor
    constructor: (scene, root) ->
      @ang = 0
      @meshes = []

      @selectedMat = new THREE.MeshBasicMaterial
        color: 0x903030
        blending: THREE.AdditiveBlending
        transparent: 1
        depthWrite: false

      updateCheckpoints = =>
        for mesh in @meshes
          scene.remove mesh
        @meshes = for cp in root.track.config.course.checkpoints.models
          mesh = clientMisc.checkpointMesh()
          mesh.position.x += cp[0]
          mesh.position.y += cp[1]
          mesh.position.z += cp[2]
          scene.add mesh
          mesh
      root.on 'change:track.config.course.checkpoints', updateCheckpoints

    update: (camera, delta) ->

    highlightCheckpoint: (i) ->
      for mesh in @meshes
        mesh.material = clientMisc.checkpointMaterial()
      @meshes[i]?.material = @selectedMat

  class RenderCheckpointsDrive
    constructor: (scene, @root) ->
      @ang = 0
      @mesh = clientMisc.checkpointMesh()
      @initPos = @mesh.position.clone()
      @current = 0
      scene.add @mesh

    update: (camera, delta) ->
      targetCp = @root.track.config.course.checkpoints.at @current
      return unless targetCp?
      @mesh.rotation.z += delta * 3
      meshPos = @mesh.position
      pull = delta * 2
      pull = 1 if @current is 0
      meshPos.x = PULLTOWARD meshPos.x, targetCp[0] + @initPos.x, pull
      meshPos.y = PULLTOWARD meshPos.y, targetCp[1] + @initPos.y, pull
      meshPos.z = PULLTOWARD meshPos.z, targetCp[2] + @initPos.z, pull

    highlightCheckpoint: (i) ->
      @current = i

  class RenderDials
    constructor: (scene, @vehic) ->
      geom = new THREE.Geometry()
      geom.vertices.push new Vec3(1, 0, 0)
      geom.vertices.push new Vec3(-0.1, 0.02, 0)
      geom.vertices.push new Vec3(-0.1, -0.02, 0)
      geom.faces.push new THREE.Face3(0, 1, 2)
      geom.computeCentroids()
      mat = new THREE.MeshBasicMaterial
        color: 0x206020
        blending: THREE.AdditiveBlending
        transparent: 1
        depthTest: false
      @revMeter = new THREE.Mesh geom, mat
      @revMeter.position.x = -1.3
      @revMeter.position.y = -0.2
      @revMeter.scale.multiplyScalar 0.4
      scene.add @revMeter
      @speedMeter = new THREE.Mesh geom, mat
      @speedMeter.position.x = -1.3
      @speedMeter.position.y = -0.7
      @speedMeter.scale.multiplyScalar 0.4
      scene.add @speedMeter

      @$digital = $("#speedo")

    update: (camera, delta) ->
      vehic = @vehic
      @revMeter.rotation.z = -2.5 - 4.5 *
          ((vehic.engineAngVelSmoothed - vehic.engineIdle) /
              (vehic.engineRedline - vehic.engineIdle))
      # I'm not sure where or how this factor has crept in. It's suspiciously close to the
      # first gear ratio though (3.636).
      # Approx max speed of ArbusuG measured as 7678m / 112s = 246.8 km/h,
      # while this magic number shows a max speed of 250km/h which is close enough for now.
      MAGIC_CONVERSION = 3.6
      speed = Math.abs(vehic.differentialAngVel) * vehic.avgDriveWheelRadius * MAGIC_CONVERSION
      @speedMeter.rotation.z = -2.5 - 4.5 * speed * 0.0035
      @$digital.text speed.toFixed(0) + " km/h"
      return

    highlightCheckpoint: (i) ->
      @current = i
      return

  class RenderCheckpointArrows
    constructor: (@scene, @progress) ->
      mat = new THREE.MeshBasicMaterial
        color: 0x206020
        blending: THREE.AdditiveBlending
        transparent: 1
        depthTest: false
      mat2 = new THREE.MeshBasicMaterial
        color: 0x051005
        blending: THREE.AdditiveBlending
        transparent: 1
        depthTest: false
      # TODO: Use an ArrayGeometry.
      geom = new THREE.Geometry()
      geom.vertices.push new Vec3(0, 0, 0.6)
      geom.vertices.push new Vec3(0.1, 0, 0.3)
      geom.vertices.push new Vec3(-0.1, 0, 0.3)
      geom.vertices.push new Vec3(0.1, 0, -0.2)
      geom.vertices.push new Vec3(-0.1, 0, -0.2)
      geom.faces.push new THREE.Face3(0, 2, 1)
      geom.faces.push new THREE.Face4(1, 2, 4, 3)
      @meshArrow = new THREE.Mesh(geom, mat)
      @meshArrow.position.set(0, 1, -2)
      @meshArrow2 = new THREE.Mesh(geom, mat2)
      @meshArrow2.position.set(0, 0, 0.8)
      scene.add @meshArrow
      @meshArrow.add @meshArrow2

    update: (camera, delta) ->
      nextCp = @progress.nextCheckpoint 0
      nextCp2 = @progress.nextCheckpoint 1
      carPos = @progress.vehicle.body.pos
      camMatrixEl = camera.matrixWorld.elements
      @meshArrow.visible = nextCp?
      if nextCp
        cpVec = new Vec2(nextCp.x - carPos.x,
                         nextCp.y - carPos.y)
        cpVecCamSpace = new Vec2(
            cpVec.x * camMatrixEl[1] + cpVec.y * camMatrixEl[9],
            cpVec.x * camMatrixEl[0] + cpVec.y * camMatrixEl[8])
        @meshArrow.rotation.y = Math.atan2(cpVecCamSpace.y, cpVecCamSpace.x)
      @meshArrow2.visible = nextCp2?
      if nextCp2
        cpVec = new Vec2(nextCp2.x - carPos.x,
                         nextCp2.y - carPos.y)
        cpVecCamSpace = new Vec2(
            cpVec.x * camMatrixEl[1] + cpVec.y * camMatrixEl[9],
            cpVec.x * camMatrixEl[0] + cpVec.y * camMatrixEl[8])
        @meshArrow2.rotation.y = Math.atan2(cpVecCamSpace.y, cpVecCamSpace.x) - @meshArrow.rotation.y

  class CamControl
    constructor: (@camera, @car) ->
      # Note that CamControl controls the camera it's given at construction,
      # not the one passed into update().
      @mode = 0

      pullTransformedQuat = (quat, quatTarget, amount) ->
        quat.x = PULLTOWARD(quat.x, -quatTarget.z, amount)
        quat.y = PULLTOWARD(quat.y,  quatTarget.w, amount)
        quat.z = PULLTOWARD(quat.z,  quatTarget.x, amount)
        quat.w = PULLTOWARD(quat.w, -quatTarget.y, amount)
        quat.normalize()

      translate = (pos, matrix, x, y, z) ->
        el = matrix.elements
        pos.x += el[0] * x + el[4] * y + el[8] * z
        pos.y += el[1] * x + el[5] * y + el[9] * z
        pos.z += el[2] * x + el[6] * y + el[10] * z

      pullCameraQuat = (cam, car, amount) ->
        cam.useQuaternion = true
        pullTransformedQuat cam.quaternion, car.root.quaternion, amount
        cam.updateMatrix()

      translateCam = (cam, car, x, y, z) ->
        cam.position.copy car.root.position
        translate cam.position, cam.matrix, x, y, z
        cam.matrix.setPosition cam.position

      chaseCam =
        update: (cam, car, delta) ->
          car.bodyMesh?.visible = yes
          targetPos = car.root.position.clone()
          targetPos.addSelf(car.vehic.body.linVel.clone().multiplyScalar(.17))
          targetPos.addSelf(car.root.matrix.getColumnX().clone().multiplyScalar(0))
          targetPos.addSelf(car.root.matrix.getColumnY().clone().multiplyScalar(1.2))
          targetPos.addSelf(car.root.matrix.getColumnZ().clone().multiplyScalar(-2.9))
          camDelta = delta * 5
          cam.position.x = PULLTOWARD(cam.position.x, targetPos.x, camDelta)
          cam.position.y = PULLTOWARD(cam.position.y, targetPos.y, camDelta)
          cam.position.z = PULLTOWARD(cam.position.z, targetPos.z, camDelta)

          cam.useQuaternion = false
          pullTransformedQuat cam.quaternion, car.root.quaternion, 1
          lookPos = car.root.position.clone()
          translate lookPos, car.root.matrix, 0, 0.7, 0
          cam.lookAt(lookPos)
          return

      insideCam =
        update: (cam, car, delta) ->
          car.bodyMesh?.visible = yes
          pullCameraQuat cam, car, delta * 30
          translateCam cam, car, 0, 0.7, -1
          return

      insideCam2 =
        update: (cam, car, delta) ->
          car.bodyMesh?.visible = no
          pullCameraQuat cam, car, 1
          translateCam cam, car, 0, 0.7, -1
          return

      wheelCam =
        update: (cam, car, delta) ->
          car.bodyMesh?.visible = yes
          pullCameraQuat cam, car, delta * 100
          translateCam cam, car, 1, 0, -0.4
          return

      @modes = [
        chaseCam
        insideCam
        insideCam2
        wheelCam
      ]
      return

    getMode: -> @modes[@mode]

    update: (camera, delta) ->
      if @car.root?
        @getMode().update @camera, @car, delta
      return

    nextMode: ->
      @mode = (@mode + 1) % @modes.length

  class CamTerrainClipping
    constructor: (@camera, @terrain) ->
      return

    update: (camera, delta) ->
      camPos = @camera.position
      contact = @terrain.getContactRayZ camPos.x, camPos.y
      terrainHeight = contact.surfacePos.z
      camPos.z = Math.max camPos.z, terrainHeight + 0.2
      return

  class KeyboardController
    THROTTLE_RESPONSE = 8
    BRAKE_RESPONSE = 5
    HANDBRAKE_RESPONSE = 20
    TURN_RESPONSE = 5

    constructor: (@vehic, @client) ->
      @controls = util.deepClone @vehic.controller.input

    update: (delta) ->
      keyDown = @client.keyDown
      throttle = if keyDown[KEYCODE['UP']] or keyDown[KEYCODE['W']] then 1 else 0
      brake = if keyDown[KEYCODE['DOWN']] or keyDown[KEYCODE['S']] then 1 else 0
      left = if keyDown[KEYCODE['LEFT']] or keyDown[KEYCODE['A']] then 1 else 0
      right = if keyDown[KEYCODE['RIGHT']] or keyDown[KEYCODE['D']] then 1 else 0
      handbrake = if keyDown[KEYCODE['SPACE']] then 1 else 0

      controls = @controls
      controls.throttle = PULLTOWARD(controls.throttle, throttle, THROTTLE_RESPONSE * delta)
      controls.brake = PULLTOWARD(controls.brake, brake, BRAKE_RESPONSE * delta)
      controls.handbrake = PULLTOWARD(controls.handbrake, handbrake, HANDBRAKE_RESPONSE * delta)
      controls.turn = PULLTOWARD(controls.turn, left - right, TURN_RESPONSE * delta)

  class GamepadController
    constructor: (@vehic, @gamepad) ->
      @controls = util.deepClone @vehic.controller.input

    update: (delta) ->
      controls = @controls
      axes = @gamepad.axes
      buttons = @gamepad.buttons
      axes0 = deadZone axes[0], 0.01
      axes3 = deadZone axes[3], 0.01
      controls.throttle = Math.max 0, -axes3, buttons[0] or 0, buttons[5] or 0, buttons[7] or 0
      controls.brake = Math.max 0, axes3, buttons[4] or 0, buttons[6] or 0
      controls.handbrake = buttons[2] or 0
      controls.turn = -axes0 - (buttons[15] or 0) + (buttons[14] or 0)

  class WheelController
    constructor: (@vehic, @gamepad) ->
      @controls = util.deepClone @vehic.controller.input

    update: (delta) ->
      controls = @controls
      axes = @gamepad.axes
      buttons = @gamepad.buttons
      axes0 = deadZone axes[0], 0.01
      axes1 = deadZone axes[1], 0.01
      controls.throttle = Math.max 0, -axes1
      controls.brake = Math.max 0, axes1
      controls.handbrake = Math.max buttons[6] or 0, buttons[7] or 0
      controls.turn = -axes0

  getGamepads = ->
    nav = navigator
    nav.getGamepads?() or nav.gamepads or
    nav.mozGetGamepads?() or nav.mozGamepads or
    nav.webkitGetGamepads?() or nav.webkitGamepads or
    []

  gamepadType = (id) ->
    if /Racing Wheel/.test id
      WheelController
    else
      GamepadController

  class CarControl
    constructor: (@vehic, @client) ->
      @controllers = []
      @gamepadMap = {}
      @controllers.push new KeyboardController vehic, client

    update: (camera, delta) ->
      for gamepad, i in getGamepads()
        if gamepad? and i not of @gamepadMap
          @gamepadMap[i] = yes
          type = gamepadType gamepad.id
          @controllers.push new type @vehic, gamepad

      controls = @vehic.controller.input
      for key of controls
        controls[key] = 0
      for controller in @controllers
        controller.update delta
        for key of controls
          controls[key] += controller.controls[key]
      return

  class SunLight
    constructor: (scene, useShadows) ->
      sunLight = @sunLight = new THREE.DirectionalLight( 0xffe0bb )
      sunLight.intensity = 1.3
      @sunLightPos = new Vec3 -6, 7, 10
      sunLight.position.copy @sunLightPos

      sunLight.castShadow = useShadows

      if useShadows
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
    event.keyCode <= 255
  isModifierKey = (event) ->
    event.ctrlKey or event.altKey or event.metaKey

  TriggerClient: class TriggerClient
    constructor: (@containerEl, @root, @options = {}) ->
      # TODO: Add Detector support.
      @objects = {}
      @pubsub = new pubsub.PubSub()

      prefs = options.prefs or {
        audio: yes
        shadows: yes
        terrainhq: yes
      }

      @renderer = @createRenderer prefs.shadows
      @containerEl.appendChild @renderer.domElement

      @sceneHUD = new THREE.Scene()
      @cameraHUD = new THREE.OrthographicCamera -1, 1, 1, -1, 1, -1

      @scene = new THREE.Scene()
      @camera = new THREE.PerspectiveCamera 75, 1, 0.1, 10000000
      @camera.up.set 0, 0, 1
      @camera.position.set 110, 2530, 500
      @scene.add @camera
      @camControl = null
      @scene.fog = new THREE.FogExp2 0xdddddd, 0.0002

      @scene.add new THREE.AmbientLight 0x446680
      @scene.add @cubeMesh()

      @add new SunLight @scene, prefs.shadows

      @audio = new clientAudio.WebkitAudio() if prefs.audio
      checkpointBuffer = null
      @audio?.loadBuffer '/a/sounds/checkpoint.wav', (buffer) ->
        checkpointBuffer = buffer

      # onTrackCar = (track, car, progress) =>
      #   unless car.cfg.isRemote
      #     @add renderCheckpoints = new RenderCheckpointsDrive @scene, track.checkpoints
      #     @add new RenderCheckpointArrows @camera, progress
      #     progress.on 'advance', =>
      #       renderCheckpoints.highlightCheckpoint progress.nextCpIndex
      #       if checkpointBuffer?
      #         @audio?.playSound checkpointBuffer, false, 1, 1

      # deferredCars = []

      @track = new gameTrack.Track @root

      @add new clientTerrain.RenderTerrain(
          @scene, @track.terrain, @renderer.context, prefs.terrainhq)
      sceneLoader = new THREE.SceneLoader()
      loadFunc = (url, callback) -> sceneLoader.load url, callback
      @add new clientScenery.RenderScenery @scene, @track.scenery, loadFunc, @renderer
      @add new CamTerrainClipping(@camera, @track.terrain), 10

      # @game.on 'addvehicle', (car, progress) =>
      #   audio = if car.cfg.isRemote then null else @audio
      #   renderCar = new clientCar.RenderCar @scene, car, audio
      #   progress._renderCar = renderCar
      #   @add renderCar
      #   unless car.cfg.isRemote
      #     @add @camControl = new CamControl @camera, renderCar
      #     @add new CarControl car, this
      #     @add new RenderDials @sceneHUD, car
      #   if @track
      #     onTrackCar @track, car, progress
      #   else
      #     deferredCars.push [car, progress]
      #   return

      # @game.on 'deletevehicle', (progress) =>
      #   renderCar = progress._renderCar
      #   progress._renderCar = null
      #   for layer in @objects
      #     idx = layer.indexOf renderCar
      #     if idx isnt -1
      #       layer.splice idx, 1
      #   renderCar.destroy()

      @keyDown = []

    onKeyDown: (event) ->
      if keyWeCareAbout(event) and not isModifierKey(event)
        @keyDown[event.keyCode] = true
        @pubsub.publish 'keydown', event
        event.preventDefault() if @options.blockKeys and event.keyCode in [
          KEYCODE.UP
          KEYCODE.DOWN
          KEYCODE.LEFT
          KEYCODE.RIGHT
          KEYCODE.SPACE
        ]
      return
    onKeyUp: (event) ->
      if keyWeCareAbout(event)
        @keyDown[event.keyCode] = false
        #event.preventDefault()
      return

    on: (event, handler) -> @pubsub.subscribe event, handler

    add: (obj, priority = 0) ->
      layer = @objects[priority] ?= []
      layer.push obj
      obj

    createRenderer: (useShadows) ->
      r = new THREE.WebGLRenderer
        alpha: false
        antialias: false
        premultipliedAlpha: false
        clearColor: 0xffffff
      r.devicePixelRatio = Math.min 4/3, r.devicePixelRatio
      if useShadows
        r.shadowMapEnabled = true
        r.shadowMapSoft = true
        r.shadowMapCullFrontFaces = false
      r.autoClear = false
      r

    setSize: (@width, @height) ->
      @renderer.setSize @width, @height
      aspect = if @height > 0 then @width / @height else 1
      @camera.aspect = aspect
      @camera.fov = 75 / Math.max 1, aspect / 1.777
      @camera.updateProjectionMatrix()
      @cameraHUD.left = -aspect
      @cameraHUD.right = aspect
      @cameraHUD.updateProjectionMatrix()
      #@render()
      return

    addEditorCheckpoints: (track) ->
      @add @renderCheckpoints = new RenderCheckpointsEditor @scene, @root

    debouncedMuteAudio: _.debounce((audio) ->
      audio.setGain 0
    , 500)

    muteAudioIfStopped: ->
      if @audio?
        @audio.setGain 1
        @debouncedMuteAudio @audio
      return

    update: (delta) ->
      @game?.sim.tick delta
      for priority, layer of @objects
        for object in layer
          object.update @camera, delta
      @muteAudioIfStopped()
      return

    render: ->
      delta = 0
      @renderer.clear false, true
      @renderer.render @scene, @camera
      @renderer.render @sceneHUD, @cameraHUD
      return

    cubeMesh: ->
      path = "/a/textures/miramar-z-512/miramar_"
      format = '.jpg'
      urls = [
        path + 'rt' + format, path + 'lf' + format
        path + 'ft' + format, path + 'bk' + format
        path + 'up' + format, path + 'dn' + format
      ]
      textureCube = THREE.ImageUtils.loadTextureCube urls
      cubeShader = THREE.ShaderUtils.lib["cube"]
      cubeShader.uniforms["tCube"].value = textureCube
      cubeMaterial = new THREE.ShaderMaterial
        fog: yes
        side: THREE.BackSide
        uniforms: _.extend THREE.UniformsLib['fog'], cubeShader.uniforms
        vertexShader: cubeShader.vertexShader
        fragmentShader:
          THREE.ShaderChunk.fog_pars_fragment +
          """

          uniform samplerCube tCube;
          uniform float tFlip;
          varying vec3 vWorldPosition;
          void main() {
            gl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );
            vec3 worldVec = normalize(vWorldPosition);
            gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.05, 0.15, worldVec.z));
          }
          """
      cubeMaterial.transparent = yes
      cubeMesh = new THREE.Mesh(
          new THREE.CubeGeometry(5000000, 5000000, 5000000), cubeMaterial)
      cubeMesh.geometry.faces.splice(5, 1)
      cubeMesh.flipSided = no
      cubeMesh.doubleSided = yes
      cubeMesh.position.set 0, 0, 20000
      cubeMesh.renderDepth = 1000000  # Force draw at end.
      cubeMesh

    viewToEye: (vec) ->
      vec.x = (vec.x / @width) * 2 - 1
      vec.y = 1 - (vec.y / @height) * 2
      vec

    viewToEyeRel: (vec) ->
      vec.x = (vec.x / @height) * 2
      vec.y = - (vec.y / @height) * 2
      vec

    viewRay: (viewX, viewY) ->
      vec = @viewToEye new Vec3 viewX, viewY, 0.9
      projector.unprojectVector vec, @camera
      vec.subSelf(@camera.position)
      vec.normalize()
      new THREE.Ray @camera.position, vec

    findObject: (viewX, viewY) ->
      @intersectRay @viewRay viewX, viewY

    # TODO: Does this intersection stuff belong in client?
    intersectRay: (ray) ->
      isect = []
      if @track?
        isect = isect.concat @track.scenery.intersectRay ray
        isect = isect.concat @intersectCheckpoints ray
        isect = isect.concat @intersectTerrain ray
        isect = isect.concat @intersectStartPosition ray
      [].concat.apply [], isect

    intersectTerrain: (ray) ->

      zeroCrossing = (fn, lower, upper, iterations = 4) ->
        fnLower = fn lower
        fnUpper = fn upper
        # Approximate the function as a line.
        gradient = (fnUpper - fnLower) / (upper - lower)
        constant = fnLower - gradient * lower
        crossing = -constant / gradient
        return crossing if iterations <= 1
        fnCrossing = fn crossing
        if fnCrossing < 0
          zeroCrossing fn, crossing, upper, iterations - 1
        else
          zeroCrossing fn, lower, crossing, iterations - 1

      terrainContact = (lambda) =>
        test = ray.direction.clone().multiplyScalar lambda
        test.addSelf ray.origin
        {
          test
          contact: @track.terrain.getContact test
        }

      terrainFunc = (lambda) =>
        tc = terrainContact lambda
        tc.contact.surfacePos.z - tc.test.z

      lambda = 0
      step = 0.2
      count = 0
      while lambda < 50000
        nextLambda = lambda + step
        if terrainFunc(nextLambda) > 0
          lambda = zeroCrossing terrainFunc, lambda, nextLambda
          contact = terrainContact(lambda).contact
          return [
            type: 'terrain'
            distance: lambda
            object:
              pos: [
                contact.surfacePos.x
                contact.surfacePos.y
                contact.surfacePos.z
              ]
          ]
        lambda = nextLambda
        step *= 1.1
        count++
      []

    intersectStartPosition: (ray) ->
      startpos = @root.track.config.course.startposition
      pos = startpos.pos
      return [] unless pos?
      hit = @intersectSphere ray, new Vec3(pos[0], pos[1], pos[2]), 4
      if hit
        hit.type = 'startpos'
        hit.object = startpos
        [hit]
      else
        []

    intersectSphere: (ray, center, radiusSq) ->
      # Destructive to center.
      center.subSelf ray.origin
      # We assume unit length ray direction.
      a = 1  # ray.direction.dot(ray.direction)
      along = ray.direction.dot center
      b = -2 * along
      c = center.dot(center) - radiusSq
      discrim = b * b - 4 * a * c
      return null unless discrim >= 0
      distance: along

    intersectCheckpoints: (ray) ->
      radiusSq = 16
      isect = []
      for cp, idx in @root.track.config.course.checkpoints.models
        hit = @intersectSphere ray, new Vec3(cp.pos[0], cp.pos[1], cp.pos[2]), radiusSq
        if hit
          hit.type = 'checkpoint'
          hit.object = cp
          hit.idx = idx
          isect.push hit
      isect
