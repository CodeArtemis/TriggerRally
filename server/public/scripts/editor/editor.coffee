###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'jquery'
  'backbone-full'
  'THREE'
  'util/util'
  'cs!client/client'
  'cs!client/misc'
  'client/car'
  'game/game'
  'game/track'
  'cs!util/quiver'
  'cs!models/index'
  'cs!models/sync'
  'cs!editor/inspector'
], (
  $
  Backbone
  THREE
  util
  clientClient
  clientMisc
  clientCar
  gameGame
  gameTrack
  quiver
  models
  sync
  inspector
) ->
  KEYCODE = util.KEYCODE
  Vec3FromArray = util.Vec3FromArray
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3
  TWOPI = Math.PI * 2

  tmpVec3 = new THREE.Vector3
  tmpVec3b = new THREE.Vector3
  plusZVec3 = new Vec3 0, 0, 1

  hasChanged = (model, attrs) ->
    for attr in attrs
      return yes if model.hasChanged attr
    no

  deepClone = (obj) -> JSON.parse JSON.stringify obj

  Sel = Backbone.Model.extend {}
  Selection = Backbone.Collection.extend
    model: Sel
    contains: (sel) ->
      @some (element) -> element.get('sel').object is sel.object

  run: ->
    $container = $(window)
    $statusbar = $('#editor-statusbar')
    $view3d = $('#view3d')
    $status = $statusbar.find('#status')

    setStatus = (msg) -> $status.text msg

    game = new gameGame.Game()
    prefs = TRIGGER.USER?.prefs or {}
    prefs.audio = no
    client = new clientClient.TriggerClient $view3d[0], game, prefs: prefs

    client.camera.eulerOrder = 'ZYX'
    camPos = client.camera.position
    camAng = client.camera.rotation
    camVel = new Vec3
    camVelTarget = new Vec3
    camAngVel = new Vec3
    camAngVelTarget = new Vec3

    selection = new Selection()

    socket = io.connect '/api'

    models.BaseModel::sync = sync.syncSocket socket

    class TrackCollection extends Backbone.Collection
      model: models.Track

    tracksColl = new TrackCollection [
      name: 'track a'
    ,
      name: 'track b'
    ,
      name: 'track c'
    ]

    trackModel = new models.Track
    #  id: TRIGGER.TRACK.id

    #trackModel.on 'all', ->
    #  console.log arguments

    track = null

    doSave = _.debounce ->
      setStatus 'Saving...'
      trackModel.save null,
        success: (model, response, options) ->
          setStatus 'OK'
        error: (model, xhr, options) ->
          setStatus 'ERROR: ' + xhr
    , 1000

    requestSave = ->
      setStatus 'Changed'
      doSave()

    trackModel.on 'change', (model, options) ->
      if hasChanged trackModel, ['config', 'env']
        game.setTrackConfig trackModel, (err, theTrack) ->
          track = theTrack
          client.addEditorCheckpoints track

      if options?.fromServer
        setStatus 'OK'
      else
        requestSave()

    trackModel.on 'childchange', ->
      requestSave()# unless options.fromServer

    trackModel.on 'sync', ->
      setStatus 'sync'

    startPos = new THREE.Object3D()
    client.scene.add startPos
    trackModel.on 'change:config', ->
      do changeCourse = ->
        do changeStartPos = ->
          startposition = trackModel.config.course.startposition
          Vec3::set.apply startPos.position, startposition.pos
          Vec3::set.apply startPos.rotation, startposition.rot
        trackModel.config.course.on 'change:startposition', changeStartPos
        trackModel.config.course.startposition.on 'change', changeStartPos
      trackModel.config.on 'change:course', changeCourse
      trackModel.config.course.on 'change', changeCourse

    trackModel.once 'change', ->
      startposition = trackModel.config.course.startposition
      Vec3::set.apply camPos, startposition.pos
      camAng.x = 0.9
      camAng.z = startposition.rot[2] - Math.PI / 2
      camPos.x -= 20 * Math.cos(startposition.rot[2])
      camPos.y -= 20 * Math.sin(startposition.rot[2])
      camPos.z += 40

    mockVehicle =
      cfg: null
      body:
        interp:
          pos: new Vec3(0,0,0)
          ori: (new THREE.Quaternion(1,1,1,1)).normalize()
    renderCar = null

    trackModel.on 'change:env', ->
      mockVehicle.cfg = trackModel.env.cars[0].config
      # TODO: Deallocate renderCar.
      startPos.remove renderCar if renderCar
      renderCar = new clientCar.RenderCar startPos, mockVehicle, null
      renderCar.update()

    trackModel.set TRIGGER.TRACK, fromServer: yes
    ###
    trackModel.fetch
      fromServer: yes
      success: -> setStatus 'OK'
      error: ->
        setStatus 'ERROR'
        console.log 'error details:'
        console.log arguments
    ###

    if TRIGGER.READONLY
      # Prevent any modification to the model.
      models.BaseModel::validate = (attrs) -> 'Read only mode'

    layout = ->
      #[$statusbar, $view3d].forEach (panel) ->
        #panel.css 'position', 'absolute'
        #panel.width $container.width()
      statusbar_HEIGHT = $statusbar.height()
      #$statusbar.height statusbar_HEIGHT
      $view3d.height $container.height() - statusbar_HEIGHT
      $view3d.css 'top', statusbar_HEIGHT
      client.setSize $view3d.width(), $view3d.height()
      return

    layout()
    $container.on 'resize', ->
      layout()

    inspectorController = new inspector.Controller selection, trackModel, tracksColl

    $('#editor-helpbox-wrapper').removeClass 'visible'
    $('#editor-helpbox-wrapper .close-tab').click ->
      $('#editor-helpbox-wrapper').toggleClass 'visible'

    requestId = 0

    objSpinVel = 0
    lastTime = 0
    update = (time) ->
      requestId = 0
      if lastTime
        delta = Math.min 0.1, (time - lastTime) * 0.001
      else
        delta = 0.001

      terrainHeight = 0
      if track?
        terrainHeight = (track.terrain.getContactRayZ camPos.x, camPos.y).surfacePos.z
      SPEED = 30 + 0.8 * Math.max 0, camPos.z - terrainHeight
      ANG_SPEED = 2
      VISCOSITY = 20
      camVelTarget.set 0, 0, 0
      camAngVelTarget.set 0, 0, 0
      keyDown = client.keyDown
      if keyDown[KEYCODE.SHIFT] then SPEED *= 3
      if keyDown[KEYCODE.RIGHT] then camVelTarget.x += SPEED
      if keyDown[KEYCODE.LEFT] then camVelTarget.x -= SPEED
      if keyDown[KEYCODE.UP] then camVelTarget.y += SPEED
      if keyDown[KEYCODE.DOWN] then camVelTarget.y -= SPEED

      if keyDown[188]
        objSpinVel += 5 * delta
      else if keyDown[190]
        objSpinVel -= 5 * delta
      else
        objSpinVel = 0

      if objSpinVel isnt 0
        for selModel in selection.models
          sel = selModel.get 'sel'
          continue unless sel.object.rot?
          rot = deepClone sel.object.rot
          rot[2] += objSpinVel * delta
          rot[2] -= Math.floor(rot[2] / TWOPI) * TWOPI
          switch sel.type
            when 'scenery'
              scenery = deepClone trackModel.config.scenery
              obj = scenery[sel.layer].add[sel.idx]
              obj.rot = rot
              trackModel.config.scenery = scenery
              sel.object = obj
            else
              sel.object.rot = rot

      camVelTarget.set(
          camVelTarget.x * Math.cos(camAng.z) - camVelTarget.y * Math.sin(camAng.z),
          camVelTarget.x * Math.sin(camAng.z) + camVelTarget.y * Math.cos(camAng.z),
          camVelTarget.z)

      mult = 1 / (1 + delta * VISCOSITY)
      camVel.x = camVelTarget.x + (camVel.x - camVelTarget.x) * mult
      camVel.y = camVelTarget.y + (camVel.y - camVelTarget.y) * mult
      camVel.z = camVelTarget.z + (camVel.z - camVelTarget.z) * mult
      camAngVel.x = camAngVelTarget.x + (camAngVel.x - camAngVelTarget.x) * mult
      camAngVel.y = camAngVelTarget.y + (camAngVel.y - camAngVelTarget.y) * mult
      camAngVel.z = camAngVelTarget.z + (camAngVel.z - camAngVelTarget.z) * mult

      camPos.addSelf tmpVec3.copy(camVel).multiplyScalar delta
      if track?
        terrainHeight = (track.terrain.getContactRayZ camPos.x, camPos.y).surfacePos.z
        camPos.z = Math.max camPos.z, terrainHeight + 1

      camAng.addSelf tmpVec3.copy(camAngVel).multiplyScalar delta
      camAng.x = Math.max 0, Math.min 2, camAng.x

      client.update delta
      client.render()

      if camVel.length() > 0.1 or
         camAngVel.length() > 0.01 or
         objSpinVel isnt 0 or
         true
        lastTime = time
        requestAnim()
      else
        lastTime = 0
      return

    requestAnim = ->
      unless requestId then requestId = requestAnimationFrame update

    setInterval requestAnim, 1000

    $(document).on 'keyup', (event) -> client.onKeyUp event
    $(document).on 'keydown', (event) -> client.onKeyDown event

    addSelection = (sel) -> selection.add {sel}

    handleSelAdd = (selModel) ->
      sel = selModel.get 'sel'
      sel.mesh = clientMisc.selectionMesh()
      pos = sel.object.pos
      radius = 2
      switch sel.type
        when 'checkpoint'
          radius = 4
      sel.mesh.scale.multiplyScalar radius
      sel.mesh.position.set pos[0], pos[1], pos[2]
      client.scene.add sel.mesh

    handleSelRemove = (selModel) ->
      mesh = selModel.get('sel').mesh
      client.scene.remove mesh

    selection.on 'add', handleSelAdd
    selection.on 'remove', handleSelRemove
    selection.on 'reset', (collection, options) ->
      handleSelRemove selModel for selModel in options.previousModels
      handleSelAdd selModel for selModel in selection.models

    # TODO: encapsulate mouse event handling
    mouseX = 0
    mouseY = 0
    cursor = null
    cursorMesh = clientMisc.selectionMesh()
    client.scene.add cursorMesh
    buttons = 0
    MB =
      LEFT: 1
      MIDDLE: 2
      RIGHT: 4
    hasMoved = no
    isSecondClick = no  # We only allow dragging on second click to prevent mistakes.

    findObject = (mouseX, mouseY) ->
      isect = client.findObject mouseX, mouseY
      obj.distance += 10 for obj in isect when obj.type is 'terrain'
      isect.sort (a, b) -> a.distance > b.distance
      isect[0]

    updateCursor = (newCursor) ->
      cursor = newCursor
      if cursor?
        Vec3::set.apply cursorMesh.position, cursor.object.pos
      return

    $view3d.mousedown (event) ->
      buttons |= 1 << event.button
      hasMoved = no
      return

    $view3d.mouseup (event) ->
      buttons &= ~(1 << event.button)
      unless hasMoved
        selection.reset() unless event.shiftKey
        if cursor
          unless selection.contains cursor
            addSelection cursor
      return

    $view3d.mouseout (event) ->
      # If the cursor leaves the view, we have to disable drag because we don't
      # know what buttons the user is holding when the cursor re-enters.
      buttons = 0

    intersectZPlane = (ray, pos) ->
      return null if Math.abs(ray.direction.z) < 1e-10
      lambda = (pos.z - ray.origin.z) / ray.direction.z
      return null if lambda < ray.near
      isect = ray.direction.clone()
      isect.multiplyScalar(lambda).addSelf(ray.origin)
      isect.z = pos.z  # Make sure no arithmetic error creeps in.
      diff = isect.clone().subSelf pos
      #if diff.length() > 20
      #  debugger
      pos: isect
      distance: lambda

    intersectZLine = (ray, pos) ->
      sideways = tmpVec3.cross ray.direction, plusZVec3
      normal = tmpVec3b.cross tmpVec3, plusZVec3
      normal.normalize()
      dot = normal.dot ray.direction
      return null if Math.abs(dot) < 1e-10
      tmpVec3.sub pos, ray.origin
      lambda = tmpVec3.dot(normal) / dot
      return null if lambda < ray.near
      isect = ray.direction.clone()
      isect.multiplyScalar(lambda).addSelf(ray.origin)
      isect.x = pos.x
      isect.y = pos.y
      pos: isect
      distance: lambda

    $view3d.mousemove (event) ->
      hasMoved = yes
      motionX = event.offsetX - mouseX
      motionY = event.offsetY - mouseY
      angX = motionY * 0.01
      angZ = motionX * 0.01
      mouseX = event.offsetX
      mouseY = event.offsetY
      if buttons & (MB.LEFT | MB.MIDDLE) and cursor
        rotateMode = (event.altKey and buttons & MB.LEFT) or buttons & MB.MIDDLE
        viewRay = client.viewRay mouseX, mouseY
        cursorPos = cursorMesh.position
        planeHit = if event.shiftKey
          intersectZLine viewRay, cursorPos
        else
          intersectZPlane viewRay, cursorPos
        return unless planeHit
        relMotion = planeHit.pos.clone().subSelf cursorPos
        if selection.contains cursor
          cursorPos.copy planeHit.pos
          for selModel in selection.models
            sel = selModel.get 'sel'
            continue if sel.type is 'terrain'
            if rotateMode
              rot = deepClone sel.object.rot
              rot[2] += angZ
              rot[2] -= Math.floor(rot[2] / TWOPI) * TWOPI
              switch sel.type
                when 'scenery'
                  # DUPLICATE CODE ALERT
                  scenery = deepClone trackModel.config.scenery
                  obj = scenery[sel.layer].add[sel.idx]
                  obj.rot = rot
                  trackModel.config.scenery = scenery
                  cursor.object = obj if cursor.object is sel.object
                  sel.object = obj
                else
                  sel.object.rot = rot
            else
              pos = deepClone sel.object.pos
              pos[0] += relMotion.x
              pos[1] += relMotion.y
              pos[2] += relMotion.z
              if sel.type isnt 'checkpoint'
                if inspectorController.snapToGround
                  tmp = new Vec3 pos[0], pos[1], -Infinity
                  contact = track.terrain.getContact tmp
                  pos[2] = contact.surfacePos.z
                  if sel.type is 'startpos'
                    pos[2] += 1
              switch sel.type
                when 'scenery'
                  # DUPLICATE CODE ALERT
                  scenery = deepClone trackModel.config.scenery
                  obj = scenery[sel.layer].add[sel.idx]
                  obj.pos = pos
                  trackModel.config.scenery = scenery
                  cursor.object = obj if cursor.object is sel.object
                  sel.object = obj
                else
                  sel.object.pos = pos
              sel.mesh.position.set pos[0], pos[1], pos[2]
        else
          if rotateMode
            # Rotate camera.
            rot = new THREE.Matrix4()
            rot.rotateZ -angZ + camAng.z + Math.PI
            rot.rotateX angX
            rot.rotateZ -camAng.z - Math.PI
            camPos.subSelf cursorPos
            rot.multiplyVector3 camPos
            camPos.addSelf cursorPos
            camAng.x -= angX
            camAng.z -= angZ
          else
            # Translate camera.
            camPos.subSelf relMotion
          # This seems to fix occasional glitches in THREE.Projector.
          client.camera.updateMatrixWorld()
      else
        updateCursor findObject mouseX, mouseY
      return

    scroll = (scrollY, event) ->
      return unless cursor
      vec = cursorMesh.position.clone()
      vec.subSelf camPos
      vec.multiplyScalar Math.exp(scrollY * -0.002) - 1
      camPos.subSelf vec
      event.preventDefault()
      return

    $view3d.on 'mousewheel', (event) ->
      origEvent = event.originalEvent
      deltaY = if origEvent.wheelDeltaY? then origEvent.wheelDeltaY else origEvent.deltaY
      scroll deltaY, event

    return
