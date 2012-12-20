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
  modelsModule
  sync
) ->
  KEYCODE = util.KEYCODE
  Vec3FromArray = util.Vec3FromArray
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3
  TWOPI = Math.PI * 2

  # Utility for manipulating objects in models.
  manipulate = (model, attrib, fn) ->
    fn obj = deepClone model.get(attrib)
    model.set attrib, obj

  hasChanged = (model, attrs) ->
    for attr in attrs
      return yes if model.hasChanged attr
    no

  deepClone = (obj) ->
    JSON.parse JSON.stringify obj

  Sel = Backbone.Model.extend {}
  Selection = Backbone.Collection.extend
    model: Sel
    contains: (sel) ->
      @some (element) -> element.get('sel').object is sel.object

  InspectorController = (selection, track) ->
    $inspector = $('#editor-inspector')
    $inspectorAttribs = $inspector.find('.attrib')

    attrib = (selector) ->
      $el = $inspector.find selector
      $root: $el
      $content: $el.find '.content'

    selType         = attrib '#sel-type'
    selTitle        = attrib '#title'
    selScale        = attrib '#scale'
    selDispRadius   = attrib '#disp-radius'
    selDispHardness = attrib '#disp-hardness'
    selDispStrength = attrib '#disp-strength'
    selSurfRadius   = attrib '#surf-radius'
    selSurfHardness = attrib '#surf-hardness'
    selSurfStrength = attrib '#surf-strength'
    sceneryType     = attrib '#scenery-type'
    cmdAdd          = attrib '#cmd-add'
    cmdCopy         = attrib '#cmd-copy'
    cmdDelete       = attrib '#cmd-delete'
    cmdCopyTrack    = attrib '#cmd-copy-track'

    for layer, idx in track.env.scenery.layers
      sceneryType.$content.append new Option layer.id, idx

    selTitle.$content.on 'input', ->
      track.name = selTitle.$content.val()

    bindSlider = (type, slider, eachSel) ->
      $content = slider.$content
      $content.change ->
        val = parseFloat $content.val()
        for selModel in selection.models
          sel = selModel.get 'sel'
          eachSel sel, val if sel.type is type

    bindSlider 'checkpoint', selDispRadius,   (sel, val) -> manipulate sel.object, 'disp', (o) -> o.radius   = val
    bindSlider 'checkpoint', selDispHardness, (sel, val) -> manipulate sel.object, 'disp', (o) -> o.hardness = val
    bindSlider 'checkpoint', selDispStrength, (sel, val) -> manipulate sel.object, 'disp', (o) -> o.strength = val
    bindSlider 'checkpoint', selSurfRadius,   (sel, val) -> manipulate sel.object, 'surf', (o) -> o.radius   = val
    bindSlider 'checkpoint', selSurfHardness, (sel, val) -> manipulate sel.object, 'surf', (o) -> o.hardness = val
    bindSlider 'checkpoint', selSurfStrength, (sel, val) -> manipulate sel.object, 'surf', (o) -> o.strength = val

    bindSlider 'scenery', selScale, (sel, val) ->
      scenery = deepClone track.config.scenery
      scenery[sel.layer].add[sel.idx].scale = Math.exp(val)
      track.config.scenery = scenery

    cmdAdd.$content.click ->
      scenery = deepClone track.config.scenery
      newSel = []
      $sceneryType = sceneryType.$content.find(":selected")
      layerIdx = $sceneryType.val()
      layer = $sceneryType.text()
      for selModel in selection.models
        sel = selModel.get 'sel'
        continue unless sel.type is 'terrain'
        newScenery =
          scale: 1
          rot: [ 0, 0, Math.random() * TWOPI ]
          pos: sel.object.pos
        scenery[layer] ?= { add: [] }
        idx = scenery[layer].add.length
        scenery[layer].add.push newScenery
        newSel.push
          sel:
            type: 'scenery'
            distance: sel.distance
            layer: layer
            idx: idx
            object: newScenery
      track.config.scenery = scenery
      selection.reset newSel

    cmdCopy.$content.click ->
      doneCheckpoint = no
      scenery = deepClone track.config.scenery
      for selModel in selection.models
        sel = selModel.get 'sel'
        switch sel.type
          when 'checkpoint'
            continue if doneCheckpoint
            doneCheckpoint = yes
            checkpoints = track.config.course.checkpoints
            sel = selection.first().get 'sel'
            idx = sel.idx
            selCp = checkpoints.at idx
            otherCp = checkpoints.at (if idx < checkpoints.length - 1 then idx + 1 else idx - 1)
            interpPos = [
              (selCp.pos[0] + otherCp.pos[0]) * 0.5
              (selCp.pos[1] + otherCp.pos[1]) * 0.5
              (selCp.pos[2] + otherCp.pos[2]) * 0.5
            ]
            newCp = selCp.clone()
            newCp.pos = interpPos
            selection.reset()
            checkpoints.add newCp, at: idx + 1
          when 'scenery'
            newObj = deepClone track.config.scenery[sel.layer].add[sel.idx]
            newObj.pos[2] += 5 + 10 * Math.random()
            scenery[sel.layer].add.push newObj
      track.config.scenery = scenery
      return

    cmdDelete.$content.click ->
      checkpoints = track.config.course.checkpoints
      scenery = deepClone track.config.scenery
      checkpointsToRemove = []
      sceneryToRemove = []
      for selModel in selection.models
        sel = selModel.get 'sel'
        switch sel.type
          when 'checkpoint'
            checkpointsToRemove.push sel.object if (
                sel.type is 'checkpoint' and
                sel.idx > 0 and
                sel.idx < checkpoints.length - 1)
          when 'scenery'
            sceneryToRemove.push scenery[sel.layer].add[sel.idx]
      selection.reset()
      checkpoints.remove checkpointsToRemove
      for name, layer of scenery
        layer.add = _.difference layer.add, sceneryToRemove
      track.config.scenery = scenery
      return

    cmdCopyTrack.$content.click ->
      return unless window.confirm "Are you sure you want to create a copy of the entire track?"
      form = document.createElement 'form'
      form.action = 'copy'
      form.method = 'POST'
      form.submit()

    checkpointSliderSet = (slider, val) ->
      slider.$content.val val
      slider.$root.addClass 'visible'

    onChange = ->
      # Hide and reset all controls first.
      $inspectorAttribs.removeClass 'visible'

      selType.$content.text switch selection.length
        when 0 then 'none'
        when 1
          sel = selection.first().get('sel')
          if sel.type is 'scenery'
            sel.layer
          else
            sel.type
        else '[multiple]'

      selTitle.$content.val track.name

      for selModel in selection.models
        sel = selModel.get 'sel'
        switch sel.type
          when 'checkpoint'
            checkpointSliderSet selDispRadius,   sel.object.disp.radius
            checkpointSliderSet selDispHardness, sel.object.disp.hardness
            checkpointSliderSet selDispStrength, sel.object.disp.strength
            checkpointSliderSet selSurfRadius,   sel.object.surf.radius
            checkpointSliderSet selSurfHardness, sel.object.surf.hardness
            checkpointSliderSet selSurfStrength, sel.object.surf.strength
            cmdDelete.$root.addClass 'visible'
            cmdCopy.$root.addClass 'visible'
          when 'scenery'
            selScale.$content.val Math.log sel.object.scale
            selScale.$root.addClass 'visible'
            cmdDelete.$root.addClass 'visible'
            cmdCopy.$root.addClass 'visible'
          when 'terrain'
            # Terrain selection acts as marker for adding scenery.
            sceneryType.$root.addClass 'visible'
            cmdAdd.$root.addClass 'visible'
      return

    onChange()
    selection.on 'add', onChange
    selection.on 'remove', onChange
    selection.on 'reset', onChange

  run: ->
    $container = $(window)
    $statusbar = $('#editor-statusbar')
    $view3d = $('#view3d')
    $status = $statusbar.find('#status')

    setStatus = (msg) -> $status.text msg

    game = new gameGame.Game()
    client = new clientClient.TriggerClient $view3d[0], game, noAudio: yes

    client.camera.eulerOrder = 'ZYX'
    camPos = client.camera.position
    camAng = client.camera.rotation
    camVel = new Vec3
    camVelTarget = new Vec3
    camAngVel = new Vec3
    camAngVelTarget = new Vec3

    selection = new Selection()

    socket = io.connect '/api'
    models = modelsModule.genModels()
    models.BaseModel::sync = sync.syncSocket socket

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
    , 1500

    requestSave = ->
      setStatus 'Changed'
      doSave()

    trackModel.on 'change', (model, options) ->
      if hasChanged trackModel, ['config', 'env']
        game.setTrackConfig trackModel, (err, theTrack) ->
          track = theTrack
          client.addEditorCheckpoints track

      if options.fromServer
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


    trackModel.on 'change', ->
      trackModel.off null, null, this  # No 'once' :(
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

    inspectorController = new InspectorController selection, trackModel

    requestId = 0

    objSpinVel = 0
    lastTime = 0
    tmpVec3 = new THREE.Vector3
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
      if keyDown[KEYCODE.R] then camVelTarget.z += SPEED
      if keyDown[KEYCODE.F] then camVelTarget.z -= SPEED
      if keyDown[KEYCODE.W] then camAngVelTarget.x += ANG_SPEED
      if keyDown[KEYCODE.S] then camAngVelTarget.x -= ANG_SPEED
      if keyDown[KEYCODE.A] then camAngVelTarget.z += ANG_SPEED
      if keyDown[KEYCODE.D] then camAngVelTarget.z -= ANG_SPEED

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
      client.scene.remove selModel.get('sel').mesh

    selection.on 'add', handleSelAdd
    selection.on 'remove', handleSelRemove
    selection.on 'reset', (collection, options) ->
      handleSelRemove selModel for selModel in options.previousModels
      handleSelAdd selModel for selModel in selection.models

    # TODO: encapsulate mouse event handling
    mouseX = 0
    mouseY = 0
    lockObject = null
    buttons = 0
    isSecondClick = no  # We only allow dragging on second click to prevent mistakes.

    $view3d.mousedown (event) ->
      buttons |= Math.pow(2, event.button)
      mouseX = event.offsetX
      mouseY = event.offsetY
      isect = client.findObject mouseX, mouseY
      obj.distance += 10 for obj in isect when obj.type is 'terrain'
      isect.sort (a, b) -> a.distance > b.distance
      firstHit = isect[0]
      underCursor = firstHit
      if firstHit?
        lockObject = firstHit.object
      else
        lockObject = null
      isSecondClick = if underCursor then selection.contains(underCursor) else no
      unless isSecondClick
        selection.reset() unless event.shiftKey
        addSelection underCursor if underCursor
      requestAnim()
      return

    $view3d.mouseup (event) ->
      buttons &= ~Math.pow(2, event.button)
      return

    intersectZPlane = (ray, pos) ->
      return null if Math.abs(ray.direction.z) < 1e-10
      lambda = (pos.z - ray.origin.z) / ray.direction.z
      return null if lambda < ray.near
      z = pos.z
      pos.copy ray.direction
      pos.multiplyScalar(lambda).addSelf(ray.origin)
      pos.z = z  # Make sure no arithmetic error creeps in.
      pos: pos
      distance: lambda

    intersectZLine = (ray, pos) ->
      return null if Math.abs(ray.direction.z) < 1e-10
      lambda = (pos.z - ray.origin.z) / ray.direction.z
      return null if lambda < ray.near
      z = pos.z
      pos.copy ray.direction
      pos.multiplyScalar(lambda).addSelf(ray.origin)
      pos.z = z  # Make sure no arithmetic error creeps in.
      pos: pos
      distance: lambda

    $view3d.mousemove (event) ->
      if buttons & 3 and lockObject
        motionX = event.offsetX - mouseX
        motionY = event.offsetY - mouseY
        mouseX = event.offsetX
        mouseY = event.offsetY
        viewRay = client.viewRay mouseX, mouseY
        lockObjectPos = Vec3FromArray lockObject.pos
        planeHit = if event.shiftKey
          intersectZLine viewRay, lockObjectPos
        else
          intersectZPlane viewRay, lockObjectPos
        if buttons & 1 and isSecondClick
          for selModel in selection.models
            sel = selModel.get 'sel'
            continue if sel.type is 'terrain'
            pos = deepClone sel.object.pos
            pos[0] = planeHit.pos.x
            pos[1] = planeHit.pos.y
            pos[2] = planeHit.pos.z
            switch sel.type
              when 'scenery'
                # TODO: Make ground aligment optional.
                #tmp = new Vec3 pos[0], pos[1], -Infinity
                #contact = track.terrain.getContact tmp
                #pos[2] = contact.surfacePos.z
                scenery = deepClone trackModel.config.scenery
                obj = scenery[sel.layer].add[sel.idx]
                obj.pos = pos
                trackModel.config.scenery = scenery
                sel.object = obj
              else
                sel.object.pos = pos
            sel.mesh.position.set pos[0], pos[1], pos[2]
        else
          if event.shiftKey or buttons & 2
            camAngVel.z += motionX * 0.1
            camAngVel.x += motionY * 0.1
          else
            motion.multiplyScalar 10
            camVel.subSelf motion
        requestAnim()
      return

    scroll = (scrollY) ->
      return unless lockObject
      vec = Vec3FromArray lockObject.pos
      vec.subSelf camPos
      vec.multiplyScalar Math.exp(scrollY * -0.002) - 1
      camPos.subSelf vec
      event.preventDefault()
      return

    $view3d.on 'mousewheel', (event) ->
      origEvent = event.originalEvent
      scroll origEvent.wheelDeltaY or origEvent.deltaY

    return
