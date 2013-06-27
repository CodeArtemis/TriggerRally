define [
  'underscore'
  'backbone-full'
  'THREE'
  'util/util'
  'cs!util/util2'
  'cs!client/misc'
  'cs!client/editor_camera'
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
  util2
  clientMisc
  EditorCameraControl
  clientCar
  models
  InspectorView
  View
  template
) ->
  { MB } = util2
  { KEYCODE, Vec3FromArray } = util
  Vec2 = THREE.Vector2
  Vec3 = THREE.Vector3
  TWOPI = Math.PI * 2

  tmpVec3 = new THREE.Vector3
  tmpVec3b = new THREE.Vector3

  deepClone = (obj) -> JSON.parse JSON.stringify obj

  Sel = Backbone.Model.extend {}
  Selection = Backbone.Collection.extend
    model: Sel
    contains: (sel) ->
      @some (element) -> element.get('sel').object is sel.object

  class EditorView extends View
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      app = @app
      client = @client
      root = @app.root
      $ = @$.bind @

      @objs = []

      client.camera.idealFov = 75
      client.camera.useQuaternion = no
      client.updateCamera()

      camControl = new EditorCameraControl client.camera

      selection = new Selection()

      @editorObjects = editorObjects = new THREE.Object3D
      client.scene.add editorObjects

      startPos = new THREE.Object3D()
      editorObjects.add startPos

      @objs.push client.addEditorCheckpoints editorObjects

      doSave = _.debounce ->
        if root.user isnt root.track.user or root.track.published
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

      @inspectorView = new InspectorView @$('#editor-inspector'), app, selection
      @inspectorView.render()

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
            unless root.user isnt root.track.user or root.track.published
              unless selection.contains cursor
                addSelection cursor
            else
              Backbone.trigger 'app:status', 'Read only'
        return

      @onMouseOut = (event) ->
        # If the cursor leaves the view, we have to disable drag because we don't
        # know what buttons the user is holding when the cursor re-enters.
        buttons = 0

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
            util2.intersectZLine viewRay, cursorPos
          else
            util2.intersectZPlane viewRay, cursorPos
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
                  if @inspectorView.snapToGround
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
      @inspectorView.destroy()
      @client.scene.remove @editorObjects
      @client.destroyObjects @objs
