define [
  'backbone-full'
  'underscore'
  'THREE'
  'client/car'
  'cs!models/index'
], (
  Backbone
  _
  THREE
  clientCar
  models
) ->
  Vec3 = THREE.Vector3

  class Spin
    constructor: (@app, @client) ->
      _.extend @, Backbone.Events

    destroy: ->
      @renderCar?.destroy()
      @stopListening()

    render: ->
      @startpos = startpos = new THREE.Object3D
      startpos.position.set 0, 0, 430
      @client.scene.add startpos

      root = @app.root
      do updateStartPos = =>
        return unless root.track
        startposition = root.track.config.course.startposition
        startpos.position.set startposition.pos...
        startpos.rotation.set startposition.rot...
      @listenTo root, 'change:track.', updateStartPos

      unless root.track
        track = models.Track.findOrCreate 'RF87t6b6'
        track.fetch
          success: =>
            track.env.fetch
              success: =>
                return if root.track
                Backbone.trigger 'app:settrack', track

      @renderCar = null
      do updateCar = =>
        # carId = @app.root.getCarId() ? 'ArbusuG'
        # This is just the Spin page, so allow showing any car.
        carId = @app.root.prefs.car
        carModel = models.Car.findOrCreate carId
        carModel.fetch
          success: =>
            mockVehicle =
              cfg: carModel.config
              body:
                interp:
                  pos: new Vec3(0,0,0)
                  ori: (new THREE.Quaternion(1,1,1,1)).normalize()
            @renderCar?.destroy()
            @renderCar = new clientCar.RenderCar startpos, mockVehicle, null
            @renderCar.update()

      @listenTo @app.root, 'change:user', updateCar
      @listenTo @app.root, 'change:user.products', updateCar
      @listenTo @app.root, 'change:prefs.car', updateCar

      @client.camera.idealFov = 50
      @client.updateCamera()
      @

    update: (deltaTime) ->
      cam = @client.camera
      cam.useQuaternion = no
      rot = cam.rotation
      pos = cam.position

      rot.x = 1.5
      rot.z += deltaTime * 0.3

      radius = 4
      pos.copy @startpos.position
      pos.x += Math.sin(rot.x) * Math.sin(rot.z) * radius
      pos.y += Math.sin(rot.x) * Math.cos(rot.z) * -radius
      pos.z += 0.5 + Math.cos(rot.x) * radius
