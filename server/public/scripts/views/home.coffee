define [
  'backbone-full'
  'THREE'
  'util/util'
  'client/car'
  'cs!models/index'
  'cs!views/inspector'
  'cs!views/view'
  'jade!templates/home'
], (
  Backbone
  THREE
  util
  clientCar
  models
  InspectorView
  View
  template
) ->
  Vec3 = THREE.Vector3

  class HomeView extends View
    className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      @startpos = startpos = new THREE.Object3D
      startpos.position.set 0, 0, 430
      @client.scene.add startpos

      track = models.Track.findOrCreate 'ac74h5uA'
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger 'app:settrack', track
              startpos.position.set track.config.course.startposition.pos...
              startpos.rotation.set track.config.course.startposition.rot...

      carModel = new models.Car id: 'ArbusuG'
      carModel.fetch
        success: =>
          mockVehicle =
            cfg: carModel.config
            body:
              interp:
                pos: new Vec3(0,0,0)
                ori: (new THREE.Quaternion(1,1,1,1)).normalize()
          renderCar = new clientCar.RenderCar startpos, mockVehicle, null
          renderCar.update()

      @client.camera.idealFov = 50
      @client.updateCamera()

    setSize: (width, height) ->
      cx = 32
      cy = 18
      targetAspect = cx / cy
      aspect = width / height
      fontSize = if aspect >= targetAspect then height / cy else width / cx
      @$el.css "font-size", "#{fontSize}px"

    update: (deltaTime) ->
      cam = @client.camera
      rot = cam.rotation
      pos = cam.position

      rot.x = 1.5
      rot.z += deltaTime * 0.05

      radius = 4
      pos.copy @startpos.position
      pos.x += Math.sin(rot.x) * Math.sin(rot.z) * radius
      pos.y += Math.sin(rot.x) * Math.cos(rot.z) * -radius
      pos.z += 0.5 + Math.cos(rot.x) * radius
