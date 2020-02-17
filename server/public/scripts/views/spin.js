/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'underscore',
  'THREE',
  'client/car',
  'models/index'
], function(
  Backbone,
  _,
  THREE,
  clientCar,
  models
) {
  let Spin;
  const Vec3 = THREE.Vector3;

  return (Spin = class Spin {
    constructor(app, client) {
      this.app = app;
      this.client = client;
      _.extend(this, Backbone.Events);
    }

    destroy() {
      if (this.renderCar != null) {
        this.renderCar.destroy();
      }
      return this.stopListening();
    }

    render() {
      let startpos, updateCar, updateStartPos;
      this.startpos = (startpos = new THREE.Object3D);
      startpos.position.set(0, 0, 430);
      this.client.scene.add(startpos);

      const { root } = this.app;
      (updateStartPos = () => {
        if (!root.track) { return; }
        const { startposition } = root.track.config.course;
        startpos.position.set(...Array.from(startposition.pos || []));
        return startpos.rotation.set(...Array.from(startposition.rot || []));
      })();
      this.listenTo(root, 'change:track.', updateStartPos);

      if (!root.track) {
        const track = models.Track.findOrCreate('uUJTPz6M');
        track.fetch({
          success: () => {
            return track.env.fetch({
              success: () => {
                if (root.track) { return; }
                return Backbone.trigger('app:settrack', track);
              }
            });
          },
          error: () => {
            return console.log('ERROR LOADING TRACK');
          }
        });
      }


      this.renderCar = null;
      (updateCar = () => {
        // carId = @app.root.getCarId() ? 'ArbusuG'
        // This is just the Spin page, so allow showing any car.
        const carId = this.app.root.prefs.car;
        const carModel = models.Car.findOrCreate(carId);
        return carModel.fetch({
          success: () => {
            const mockVehicle = {
              cfg: carModel.config,
              body: {
                interp: {
                  pos: new Vec3(0,0,0),
                  ori: (new THREE.Quaternion(1,1,1,1)).normalize()
                }
              }
            };
            if (this.renderCar != null) {
              this.renderCar.destroy();
            }
            this.renderCar = new clientCar.RenderCar(startpos, mockVehicle, null);
            return this.renderCar.update();
          }
        });
      })();

      this.listenTo(this.app.root, 'change:user', updateCar);
      this.listenTo(this.app.root, 'change:user.products', updateCar);
      this.listenTo(this.app.root, 'change:prefs.car', updateCar);

      this.client.camera.idealFov = 50;
      this.client.updateCamera();
      return this;
    }

    update(deltaTime) {
      const cam = this.client.camera;
      const rot = cam.rotation;
      const pos = cam.position;

      rot.x = 1.5;
      rot.z += deltaTime * 0.3;

      const radius = 4;
      pos.copy(this.startpos.position);
      pos.x += Math.sin(rot.x) * Math.sin(rot.z) * radius;
      pos.y += Math.sin(rot.x) * Math.cos(rot.z) * -radius;
      return pos.z += 0.5 + (Math.cos(rot.x) * radius);
    }
  });
});
