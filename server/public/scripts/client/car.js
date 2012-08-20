/**
* @author alteredq / http://alteredqualia.com/
* Adapted by jareiko / http://www.jareiko.net/
*/

define([
  'THREE',
  'util/util'
],
function(THREE, util) {
  var exports = {};

  var Vec3FromArray = util.Vec3FromArray;

  exports.RenderCar = function(scene, vehic, audio) {
    this.bodyGeometry = null;
    this.wheelGeometry = null;

    this.aud = audio;
    this.root = new THREE.Object3D();
    this.root.useQuaternion = true;

    scene.add(this.root);

    this.bodyMesh = null;
    this.wheels = [];
    this.vehic = null;
    this.config = {};

    this.sourceEngine = null;
    this.sourceTransmission = null;
    this.sourceWind = null;
    this.sourceSkid = null;
    this.buffersCrash = [];

    // API

    this.loadWithVehicle = function(vehicle, callback) {
      this.vehic = vehicle;
      this.config = vehicle.cfg;
      this.loadPartsJSON(this.config.meshes.body,
                         this.config.meshes.wheel,
                         callback);
    };

    this.loadPartsJSON = function(bodyURL, wheelURL, callback) {
      var loader = new THREE.JSONLoader();
      var texturePath = '/a/textures';
      async.parallel({
        body: function(cb) {
          loader.load(bodyURL, function(geometry) { cb(null, geometry); }, texturePath);
        },
        wheel: function(cb) {
          loader.load(wheelURL, function(geometry) { cb(null, geometry); }, texturePath);
        }
      }, function(err, data) {
        if (err) throw err;
        else {
          this.bodyGeometry = data.body;
          this.wheelGeometry = data.wheel;
          this.createCar();
          callback && callback();
        }
      }.bind(this));
    };

  /*
    this.loadPartsBinary = function(bodyURL, wheelURL) {
      var loader = new THREE.BinaryLoader();

      loader.load(bodyURL, function(geometry) { createBody(geometry) } );
      loader.load(wheelURL, function(geometry) { createWheels(geometry) } );
    };*/

    this.update = function() {
      // Update graphics and audio state from physics.
      if (!this.vehic) return;

      var chassisState = this.vehic.body.interp;
      this.root.position.copy(chassisState.pos);
      this.root.quaternion.copy(chassisState.ori);

      for (var w = 0; w < this.wheels.length; ++w) {
        var wheel = this.wheels[w];
        var vWheel = this.vehic.wheels[w];
        wheel.root.position.y = wheel.cfg.pos[1] -
                                this.config.center[1] + vWheel.ridePos;
        wheel.root.rotation.y = this.vehic.getWheelTurnPos(vWheel);
        wheel.mesh.rotation.x = vWheel.spinPos;
      }

      if (this.aud) {
        if (this.sourceEngine) {
          this.sourceEngine.gain.value = this.vehic.controller.output.throttle * 0.2 + 0.4;
          this.sourceEngine.playbackRate.value = this.vehic.engineAngVelSmoothed /
              (this.config.sounds.engineRpm * Math.PI / 30);
        }
        if (this.sourceTransmission) {
          var transmissionRate = this.vehic.differentialAngVel /
              (this.config.sounds.transmissionRpm * Math.PI / 30);
          this.sourceTransmission.gain.value = Math.min(1, transmissionRate) * this.vehic.controller.output.throttle * 0.08;
          this.sourceTransmission.playbackRate.value = transmissionRate;
        }
        if (this.sourceWind) {
          var linVel = this.vehic.body.linVel;
          var windRate = linVel.length() / this.config.sounds.windSpeed;
          this.sourceWind.gain.value = Math.min(1.4, windRate) * 1.4;
          this.sourceWind.playbackRate.value = windRate + 0.5;
        }
        if (this.sourceSkid) {
          this.sourceSkid.gain.value = Math.log(1 + this.vehic.skidLevel * 0.05);
        }

        var cnl = this.vehic.getCrashNoiseLevel() * 0.000005;
        if (cnl > 0 && this.buffersCrash.length > 0) {
          this.aud.playSound(
              this.buffersCrash[Math.floor(Math.random() * this.buffersCrash.length)],
              false, Math.log(1 + cnl), 0.99 + Math.random() * 0.02);
        }
      }
    };

    // internal helper methods

    this.createCar = function () {
      var i;
      var center = Vec3FromArray(this.config.center);

      // rig the car

      var s = this.config.scale || 1;

      // body

      this.bodyMesh = new THREE.Mesh(this.bodyGeometry, this.bodyGeometry.materials[0]);
      this.bodyMesh.material.ambient = this.bodyMesh.material.color;
      this.bodyMesh.position.subSelf(center);
      this.bodyMesh.scale.set( s, s, s );
      this.bodyMesh.castShadow = true;
      this.bodyMesh.receiveShadow = true;

      this.root.add( this.bodyMesh );

      for (i = 0; i < this.config.wheels.length; ++i) {
        var cfg = this.config.wheels[i];
        var wheel = {};
        wheel.cfg = cfg;
        wheel.mesh = new THREE.Mesh(this.wheelGeometry, this.wheelGeometry.materials[0]);
        wheel.mesh.material.ambient = wheel.mesh.material.color;
        wheel.mesh.scale.set( s, s, s );
        if (cfg.flip) wheel.mesh.rotation.z = Math.PI;
        wheel.mesh.castShadow = true;
        wheel.mesh.receiveShadow = true;
        wheel.root = new THREE.Object3D();
  			wheel.root.position = new THREE.Vector3(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        wheel.root.position.subSelf(center);
        wheel.root.add(wheel.mesh);
        this.root.add(wheel.root);
        this.wheels.push(wheel);
      }

      if (this.aud) {
        var sounds = this.config.sounds;
        this.aud.loadBuffer(sounds.engine, function(buffer) {
          this.sourceEngine = this.aud.playSound(buffer, true, 0);
        }.bind(this));
        this.aud.loadBuffer(sounds.transmission, function(buffer) {
          this.sourceTransmission = this.aud.playSound(buffer, true, 0);
        }.bind(this));
        this.aud.loadBuffer(sounds.wind, function(buffer) {
          this.sourceWind = this.aud.playSound(buffer, true, 0);
        }.bind(this));
        this.aud.loadBuffer(sounds.skid, function(buffer) {
          this.sourceSkid = this.aud.playSound(buffer, true, 0);
        }.bind(this));
        for (var c = 0; c < sounds.crash.length; ++c) {
          this.aud.loadBuffer(sounds.crash[c], function(c, buffer) {
            this.buffersCrash[c] = buffer;
          }.bind(this, c));
        }
      }
    };

    this.destroy = function() {
      // TODO: More complete clean-up. (renderer.deallocateObject)
      scene.remove(this.root);
    };

    // TODO: Clean up this control flow.
    this.loadWithVehicle(vehic);
  };

  return exports;
});
