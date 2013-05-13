define [
  'underscore'
  'backbone-full'
  'THREE'
  'util/util'
  'cs!client/misc'
  'client/car'
  'cs!models/index'
  'cs!views/inspector'
  'cs!views/view'
  'jade!templates/editor'
], (
  _
  Backbone
  THREE
  util
  clientMisc
  clientCar
  models
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

  class EditorCameraControl
    constructor: (@camera) ->
      @pos = camera.position
      @ang = camera.rotation
      @vel = new Vec3
      @velTarget = new Vec3
      @angVel = new Vec3
      @angVelTarget = new Vec3
      @autoTimer = -1
      @autoPos = new Vec3
      @autoAng = new Vec3

    autoTo: (pos, rot) ->
      Vec3::set.apply @autoPos, pos
      @autoAng.x = 0.9
      @autoAng.z = rot[2] - Math.PI / 2
      @autoPos.x -= 20 * Math.cos(rot[2])
      @autoPos.y -= 20 * Math.sin(rot[2])
      @autoPos.z += 30
      @autoTimer = 0

    rotate: (origin, angX, angZ) ->
      rot = new THREE.Matrix4()
      rot.rotateZ -angZ + @ang.z + Math.PI
      rot.rotateX angX
      rot.rotateZ -@ang.z - Math.PI
      @pos.subSelf origin
      rot.multiplyVector3 @pos
      @pos.addSelf origin
      @ang.x -= angX
      @ang.z -= angZ
      @updateMatrix()

    translate: (vec) ->
      @pos.addSelf vec
      @updateMatrix()

    updateMatrix: ->
      # This seems to fix occasional glitches in THREE.Projector.
      @camera.updateMatrixWorld()

    update: (delta, keyDown, terrainHeight) ->
      SPEED = 30 + 0.8 * Math.max 0, @pos.z - terrainHeight
      VISCOSITY = 20

      @velTarget.set 0, 0, 0
      @angVelTarget.set 0, 0, 0
      if keyDown[KEYCODE.SHIFT] then SPEED *= 3
      if keyDown[KEYCODE.RIGHT] then @velTarget.x += SPEED
      if keyDown[KEYCODE.LEFT] then @velTarget.x -= SPEED
      if keyDown[KEYCODE.UP] then @velTarget.y += SPEED
      if keyDown[KEYCODE.DOWN] then @velTarget.y -= SPEED

      if @autoTimer isnt -1
        @autoTimer = Math.min 1, @autoTimer + delta
        if @autoTimer < 1
          @velTarget.sub @autoPos, @pos
          @velTarget.multiplyScalar delta * 10 * @autoTimer
          @pos.addSelf @velTarget

          @ang.z -= Math.round((@ang.z - @autoAng.z) / TWOPI) * TWOPI
          @velTarget.sub @autoAng, @ang
          @velTarget.multiplyScalar delta * 10 * @autoTimer
          @ang.addSelf @velTarget
        else
          @pos.copy @autoPos
          @ang.copy @autoAng
          @autoTimer = -1
      else
        @velTarget.set(
            @velTarget.x * Math.cos(@ang.z) - @velTarget.y * Math.sin(@ang.z),
            @velTarget.x * Math.sin(@ang.z) + @velTarget.y * Math.cos(@ang.z),
            @velTarget.z)

        mult = 1 / (1 + delta * VISCOSITY)
        @vel.x = @velTarget.x + (@vel.x - @velTarget.x) * mult
        @vel.y = @velTarget.y + (@vel.y - @velTarget.y) * mult
        @vel.z = @velTarget.z + (@vel.z - @velTarget.z) * mult
        @angVel.x = @angVelTarget.x + (@angVel.x - @angVelTarget.x) * mult
        @angVel.y = @angVelTarget.y + (@angVel.y - @angVelTarget.y) * mult
        @angVel.z = @angVelTarget.z + (@angVel.z - @angVelTarget.z) * mult

        @pos.addSelf tmpVec3.copy(@vel).multiplyScalar delta

        @ang.addSelf tmpVec3.copy(@angVel).multiplyScalar delta

      @ang.x = Math.max 0, Math.min 2, @ang.x

  class EditorView extends View
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      app = @app
      client = @client
      root = @app.root
      $ = @$.bind @

      # Set a dummy game object so that client will start collecting objects.
      # This lets us clean them up in destroy().
      # TODO: Come up with a cleaner way to do this.
      client.setGame {}

      client.camera.idealFov = 75
      client.camera.useQuaternion = no
      client.updateCamera()

      camControl = new EditorCameraControl client.camera

      selection = new Selection()

      @editorObjects = editorObjects = new THREE.Object3D
      client.scene.add editorObjects

      startPos = new THREE.Object3D()
      editorObjects.add startPos

      client.addEditorCheckpoints editorObjects

      doSave = _.debounce ->
        if root.user isnt root.track.user
          return Backbone.trigger 'app:status', 'Read only'
        Backbone.trigger 'app:status', 'Saving...'
        result = root.track.save null,
          success: (model, response, options) ->
            Backbone.trigger 'app:status', 'OK'
          error: (model, xhr, options) ->
            Backbone.trigger 'app:status', "ERROR: #{xhr.statusText} (#{xhr.status})"
        unless result
          Backbone.trigger 'app:status', 'ERROR: save failed'
      , 1000

      @listenTo root, 'all', (event) ->
        options = arguments[arguments.length - 1]
        return unless event.startsWith 'change:track'
        # console.log "Saving due to event: #{event}"

        if options?.dontSave
          Backbone.trigger 'app:status', 'OK'
        else
          Backbone.trigger 'app:status', 'Changed'
          doSave()

      do onChangeTrackId = ->
        return unless root.track
        selection.reset()

        startposition = root.track.config.course.startposition
        camControl.autoTo startposition.pos, startposition.rot

        Backbone.history.navigate "/track/#{root.track.id}/edit"
      @listenTo root, 'change:track.id', onChangeTrackId

      do onChangeTrackName = ->
        return unless root.track
        document.title = "#{root.track.name} - Trigger Rally"
      @listenTo root, 'change:track.name', -> onChangeTrackName

      do onChangeStartPosition = ->
        startposition = root.track?.config?.course.startposition
        return unless startposition
        startPos.position.set startposition.pos...
        startPos.rotation.set startposition.rot...
      @listenTo root, 'change:track.config.course.startposition.', onChangeStartPosition

      mockVehicle =
        cfg: null
        body:
          interp:
            pos: new Vec3(0,0,0)
            ori: (new THREE.Quaternion(1,1,1,1)).normalize()

      renderCar = null
      do updateCar = =>
        carId = root.getCarId() ? 'ArbusuG'
        carModel = models.Car.findOrCreate carId
        carModel.fetch
          success: =>
            mockVehicle.cfg = carModel.config
            renderCar?.destroy()
            renderCar = new clientCar.RenderCar startPos, mockVehicle, null
            renderCar.update()

      @listenTo root, 'change:user', updateCar
      @listenTo root, 'change:user.products', updateCar
      @listenTo root, 'change:prefs.car', updateCar

      inspectorView = new InspectorView @$('#editor-inspector'), app, selection
      inspectorView.render()

      # Hide the help window.
      _.delay ->
        $('#editor-helpbox-wrapper').removeClass 'visible'
      , 1000
      $('#editor-helpbox-wrapper .close-tab').click ->
        $('#editor-helpbox-wrapper').toggleClass 'visible'

      requestId = 0

      objSpinVel = 0
      lastTime = 0
      @update = (delta) ->
        terrainHeight = 0
        if client.track?
          terrainHeight = (client.track.terrain.getContactRayZ camControl.pos.x, camControl.pos.y).surfacePos.z
        keyDown = client.keyDown
        camControl.update delta, keyDown, terrainHeight

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
        editorObjects.add sel.mesh

      handleSelRemove = (selModel) ->
        mesh = selModel.get('sel').mesh
        editorObjects.remove mesh

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
      editorObjects.add cursorMesh
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
          if cursor
            if root.user is root.track.user
              unless selection.contains cursor
                addSelection cursor
            else
              Backbone.trigger 'app:status', 'Read only'
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
                  if inspectorView.snapToGround
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
              camControl.rotate cursorPos, angX, angZ
            else
              relMotion.multiplyScalar -1
              camControl.translate relMotion
        return

      scroll = (scrollY, event) ->
        return unless cursor
        vec = camControl.pos.clone().subSelf cursorMesh.position
        vec.multiplyScalar Math.exp(scrollY * -0.002) - 1
        camControl.translate vec
        event.preventDefault()
        return

      @onMouseWheel = (event) ->
        origEvent = event.originalEvent
        deltaY = origEvent.wheelDeltaY ? origEvent.deltaY
        scroll deltaY, event

    destroy: ->
      @client.scene.remove @editorObjects
      @client.setGame null
