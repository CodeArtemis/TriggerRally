###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'jquery'
  'backbone-full'
  'THREE'
  'util/util'
  'cs!client/misc'
  'client/car'
  'game/game'
  'cs!models/index'
  'cs!models/sync'
  'cs!views/inspector'
  'cs!views/view'
  'jade!templates/editor'
], (
  $
  Backbone
  THREE
  util
  clientMisc
  clientCar
  gameGame
  models
  sync
  InspectorView
  View
  template
) ->
  KEYCODE = util.KEYCODE
  Vec3FromArray = util.Vec3FromArray
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3
  TWOPI = Math.PI * 2

  tmpVec3 = new THREE.Vector3
  tmpVec3b = new THREE.Vector3
  plusZVec3 = new Vec3 0, 0, 1

  deepClone = (obj) -> JSON.parse JSON.stringify obj

  Sel = Backbone.Model.extend {}
  Selection = Backbone.Collection.extend
    model: Sel
    contains: (sel) ->
      @some (element) -> element.get('sel').object is sel.object

  class EditorView extends View
    template: template
    constructor: (@app, @client) -> super()

    show: ->
      # TODO: Use backbone view delegateEvents?
      $capture = $('#view3d')
      $capture.on 'mousedown', @onMouseDown
      $capture.on 'mouseup', @onMouseUp
      $capture.on 'mouseout', @onMouseOut
      $capture.on 'mousemove', @onMouseMove
      $capture.on 'mousewheel', @onMouseWheel

    hide: ->
      # undelegateEvents?
      $capture = $('#view3d')
      $capture.off 'mousedown', @onMouseDown
      $capture.off 'mouseup', @onMouseUp
      $capture.off 'mouseout', @onMouseOut
      $capture.off 'mousemove', @onMouseMove
      $capture.off 'mousewheel', @onMouseWheel

    afterRender: ->
      app = @app
      client = @client
      root = @app.root

      $(document).on 'click', 'a.login', (event) ->
        width = 1000
        height = 700
        left = (window.screen.width - width) / 2
        top = (window.screen.height - height) / 2
        popup = window.open "/login?popup=1",
                            "Login",
                            "width=#{width},height=#{height},left=#{left},top=#{top}"
        if popup
          timer = setInterval ->
            if popup.closed
              clearInterval timer
              Backbone.trigger 'app:checklogin'
          , 1000
        # If the popup fails to open, allow the link to trigger as normal.
        not popup

      $(document).on 'click', 'a.logout', (event) ->
        $.ajax('/v1/auth/logout')
        .done (data) ->
          Backbone.trigger 'app:logout'
        false

      root.on 'change:user.tracks.', ->
        root.user.tracks.each (track) ->
          track.fetch()
      # root.on 'add:user.tracks.', (track) ->
      #   track.fetch()

      #game = new gameGame.Game()
      prefs = root.user?.prefs or {
        shadows: no
        terrainhq: yes
      }
      prefs.audio = no

      client.camera.eulerOrder = 'ZYX'
      camPos = client.camera.position
      camAng = client.camera.rotation
      camVel = new Vec3
      camVelTarget = new Vec3
      camAngVel = new Vec3
      camAngVelTarget = new Vec3
      camAutoTimer = -1
      camAutoPos = new Vec3
      camAutoAng = new Vec3

      selection = new Selection()

      startPos = new THREE.Object3D()
      client.scene.add startPos

      client.addEditorCheckpoints()

      #socket = io.connect '/api'
      #models.Model::sync = sync.syncSocket socket

      doSave = _.debounce ->
        if root.user isnt root.track.user
          return Backbone.trigger 'app:status', 'Read only'
        Backbone.trigger 'app:status', 'Saving...'
        root.track.save null,
          success: (model, response, options) ->
            Backbone.trigger 'app:status', 'OK'
          error: (model, xhr, options) ->
            Backbone.trigger 'app:status', "ERROR: #{xhr.statusText} (#{xhr.status})"
      , 1000

      root.on 'all', (event) ->
        options = arguments[arguments.length - 1]
        return unless event.startsWith 'change:track'
        # console.log "Saving due to event: #{event}"

        if options?.dontSave
          Backbone.trigger 'app:status', 'OK'
        else
          Backbone.trigger 'app:status', 'Changed'
          doSave()

      root.on 'change:track.id', ->
        selection.reset()

        startposition = root.track.config.course.startposition
        Vec3::set.apply camAutoPos, startposition.pos
        camAutoAng.x = 0.9
        camAutoAng.z = startposition.rot[2] - Math.PI / 2
        camAutoPos.x -= 20 * Math.cos(startposition.rot[2])
        camAutoPos.y -= 20 * Math.sin(startposition.rot[2])
        camAutoPos.z += 40
        camAutoTimer = 0

      root.on 'change:track.name', ->
        document.title = "#{root.track.name} - Trigger Rally"

      root.on 'change:track.config.course.startposition.', ->
        startposition = root.track.config.course.startposition
        Vec3::set.apply startPos.position, startposition.pos
        Vec3::set.apply startPos.rotation, startposition.rot

      #root.track.on 'all', -> console.log arguments

      mockVehicle =
        cfg: null
        body:
          interp:
            pos: new Vec3(0,0,0)
            ori: (new THREE.Quaternion(1,1,1,1)).normalize()

      # We always use an ArbusuG to represent the start position, for now.
      arbusuModel = new models.Car id: 'ArbusuG'
      arbusuModel.fetch
        success: ->
          mockVehicle.cfg = arbusuModel.config
          # TODO: Deallocate old startposCar, if any.
          renderCar = new clientCar.RenderCar startPos, mockVehicle, null
          renderCar.update()

      inspectorController = new InspectorView @$('#editor-inspector'), app, selection

      # Hide the help window.
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
        if client.track?
          terrainHeight = (client.track.terrain.getContactRayZ camPos.x, camPos.y).surfacePos.z
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
                scenery = deepClone root.track.config.scenery
                obj = scenery[sel.layer].add[sel.idx]
                obj.rot = rot
                root.track.config.scenery = scenery
                sel.object = obj
              else
                sel.object.rot = rot

        if camAutoTimer isnt -1
          camAutoTimer = Math.min 1, camAutoTimer + delta
          if camAutoTimer < 1
            camVelTarget.sub camAutoPos, camPos
            camVelTarget.multiplyScalar delta * 10 * camAutoTimer
            camPos.addSelf camVelTarget

            camAng.z -= Math.round((camAng.z - camAutoAng.z) / TWOPI) * TWOPI
            camVelTarget.sub camAutoAng, camAng
            camVelTarget.multiplyScalar delta * 10 * camAutoTimer
            camAng.addSelf camVelTarget
          else
            camPos.copy camAutoPos
            camAng.copy camAutoAng
            camAutoTimer = -1
        else
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

      @onMouseDown = (event) ->
        buttons |= 1 << event.button
        hasMoved = no
        event.preventDefault()
        false

      @onMouseUp = (event) ->
        buttons &= ~(1 << event.button)
        if event.button is 0 and not hasMoved
          selection.reset() unless event.shiftKey
          if cursor and root.user is root.track.user
            unless selection.contains cursor
              addSelection cursor
        return

      @onMouseOut = (event) ->
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

      @onMouseMove = (event) ->
        hasMoved = yes
        motionX = event.offsetX - mouseX
        motionY = event.offsetY - mouseY
        angX = motionY * 0.01
        angZ = motionX * 0.01
        mouseX = event.offsetX
        mouseY = event.offsetY
        unless buttons & (MB.LEFT | MB.MIDDLE) and cursor
          updateCursor findObject mouseX, mouseY
        else
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
                    scenery = deepClone root.track.config.scenery
                    obj = scenery[sel.layer].add[sel.idx]
                    obj.rot = rot
                    root.track.config.scenery = scenery
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
                    contact = client.track.terrain.getContact tmp
                    pos[2] = contact.surfacePos.z
                    pos[2] += 1 if sel.type is 'startpos'
                switch sel.type
                  when 'scenery'
                    # DUPLICATE CODE ALERT
                    scenery = deepClone root.track.config.scenery
                    obj = scenery[sel.layer].add[sel.idx]
                    obj.pos = pos
                    root.track.config.scenery = scenery
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
        return

      scroll = (scrollY, event) ->
        return unless cursor
        vec = cursorMesh.position.clone()
        vec.subSelf camPos
        vec.multiplyScalar Math.exp(scrollY * -0.002) - 1
        camPos.subSelf vec
        event.preventDefault()
        return

      @onMouseWheel = (event) ->
        origEvent = event.originalEvent
        deltaY = if origEvent.wheelDeltaY? then origEvent.wheelDeltaY else origEvent.deltaY
        scroll deltaY, event
