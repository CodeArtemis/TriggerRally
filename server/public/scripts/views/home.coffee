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
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      track = models.Track.findOrCreate 'uUJTPz6M'  # Forest
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger 'app:settrack', track

      carModel = new models.Car id: 'ArbusuG'
      carModel.fetch
        success: =>
          mockVehicle =
            cfg: carModel.config
            body:
              interp:
                pos: new Vec3(0,0,0)
                ori: (new THREE.Quaternion(1,1,1,1)).normalize()
          obj = new THREE.Object3D
          obj.position.z = 430
          @client.scene.add obj
          renderCar = new clientCar.RenderCar obj, mockVehicle, null
          renderCar.update()

      @client.camera.idealFov = 50
      @client.updateCamera()

    update: (deltaTime) ->
      cam = @client.camera
      rot = cam.rotation
      pos = cam.position

      rot.x = 1.5
      rot.z += deltaTime * 0.05

      radius = 4
      pos.x = Math.sin(rot.x) * Math.sin(rot.z) * radius
      pos.y = Math.sin(rot.x) * Math.cos(rot.z) * -radius
      pos.z = 430 + 0.5 + Math.cos(rot.x) * radius
