/**
* @author alteredq / http://alteredqualia.com/
* Adapted by jareiko / http://www.jareiko.net/
*/

define([
  'THREE',
  'util/util',
  'THREE-json-loader',
  'THREE-scene-loader'
],
function(THREE, util) {
  var exports = {};

  var Vec3FromArray = util.Vec3FromArray;

  var tmpVec3a = new THREE.Vector3();

  exports.RenderCar = function(scene, vehic, audio, dust, isGhost) {
    var showClips = false;

    if (showClips) isGhost = true;

    this.bodyGeometry = null;
    this.wheelGeometry = null;

    this.aud = audio;
    this.root = new THREE.Object3D();

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
      this.loadPartsJSON(this.config.meshes, callback);
    };

    let BASE_PATH = window.BASE_PATH

    this.loadPartsJSON = function(meshes, callback) {
      var loader = new THREE.LegacyJSONLoader(); // geometries must be converted to buffer geometries
      var sceneLoader = new THREE.SceneLoader();
      async.parallel({
        body: function(cb) {
          if (meshes.body) {
            loader.load(BASE_PATH + meshes.body, function() { cb(null, arguments); });
          } else if (meshes.scene) {
            sceneLoader.load(meshes.scene, function() { cb(null, arguments); });
          } else {
            throw new Error("Invalid car config");
          }
        },
        wheel: function(cb) {
          if (meshes.wheel) {
            loader.load(BASE_PATH + meshes.wheel, function() { cb(null, arguments); });
          } else {
            cb(null, null);
          }
        }
      }, function(err, data) {
        if (err) throw err;
        else {
          if (data.body.length == 1) {
            // Scene data.
            this.loadedData = data.body[0];
          } else {
            this.bodyGeometry = data.body[0];
            this.bodyMaterials = data.body[1];
          }
          if (data.wheel) {
            this.wheelGeometry = data.wheel[0];
            this.wheelMaterials = data.wheel[1];
          }
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

    this.createCar = function () {
      var i;
      var center = Vec3FromArray(this.config.center);

      var s = this.config.scale || 1;

      var bodyMaterial;
      var wheelGeom = this.wheelGeometry;
      var wheelMaterial = this.wheelMaterials && this.wheelMaterials[0];

      if (this.loadedData) {
        var scene = this.loadedData.scene;
        var meshes = {};
        var children = scene.children;
        for (var k in children) {
          var mesh = children[k]
          meshes[children[k].name] = mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
        this.root.add(meshes.Body);
        meshes.Body.rotation.x = -Math.PI/2;
        meshes.Body.position.sub(center);
        meshes.Body.add(meshes.BodyNR);
        meshes.Body.add(meshes.Glass);
        meshes.Body.add(meshes.WingLI);
        meshes.Body.add(meshes.WingRI);
        if (this.config.wings) {
          meshes.WingLI.add(meshes.WingLO);
          meshes.WingLO.position.sub(meshes.WingLI.position);
          meshes.WingRI.add(meshes.WingRO);
          meshes.WingRO.position.sub(meshes.WingRI.position);
        }
        this.meshes = meshes;
        bodyMaterial = meshes.Body.material;
        if (meshes.Wheel) {
          wheelGeom = meshes.Wheel.geometry;
          wheelMaterial = meshes.Wheel.material;
        }
      } else {
        // Support for older (non-scene) car models.
        this.bodyMesh = new THREE.Mesh(this.bodyGeometry, this.bodyMaterials[0]);
        // this.bodyMesh.material.ambient.copy(this.bodyMesh.material.color);
        this.bodyMesh.material.map.flipY = false;
        this.bodyMesh.position.sub(center);
        this.bodyMesh.scale.set(s, s, s);
        if (!isGhost) {
          this.bodyMesh.castShadow = true;
          this.bodyMesh.receiveShadow = true;
        }
        this.root.add( this.bodyMesh );
        bodyMaterial = this.bodyMesh.material;
      }

      if (wheelGeom) for (i = 0; i < this.config.wheels.length; ++i) {
        var cfg = this.config.wheels[i];
        var wheel = {};
        wheel.cfg = cfg;
        wheel.mesh = new THREE.Mesh(wheelGeom, wheelMaterial);
        // wheel.mesh.material.ambient = wheel.mesh.material.color;
        wheel.mesh.material.map.flipY = false;
        wheel.mesh.scale.set( s, s, s );
        if (cfg.flip) wheel.mesh.rotation.z = Math.PI;
        if (!isGhost) {
          wheel.mesh.castShadow = true;
          wheel.mesh.receiveShadow = true;
        }
        wheel.root = new THREE.Object3D();
  			wheel.root.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        wheel.root.position.sub(center);
        wheel.root.add(wheel.mesh);
        this.root.add(wheel.root);
        this.wheels.push(wheel);
      }

      if (isGhost) {
        bodyMaterial.opacity = 0.4;
        bodyMaterial.transparent = true;
        bodyMaterial.depthWrite = false;
        wheelMaterial.opacity = 0.4;
        wheelMaterial.transparent = true;
        wheelMaterial.depthWrite = false;
      }

      if (showClips) {
        var geom = new THREE.IcosahedronGeometry(1, 1);
        for (i = 0; i < this.config.clips.length; ++i) {
          var clip = this.config.clips[i];
          var mat = new THREE.MeshBasicMaterial({
            color: Math.floor(Math.random() * 0xffffff),
            opacity: 0.4,
            transparent: true,
            depthWrite: false
          });
          var mesh = new THREE.Mesh(geom, mat)
          mesh.position.set(clip.pos[0], clip.pos[1], clip.pos[2]);
          mesh.position.sub(center);
          mesh.scale.set(clip.radius, clip.radius, clip.radius);
          this.root.add(mesh);
        }
      }

      if (this.aud) {
        var sounds = this.config.sounds;
        this.aud.loadBuffer(sounds.engine, function(buffer) {
          this.sourceEngine = this.aud.playSound(buffer, true, 0);
          // var biquad = this.aud.createBiquadFilter();
          // this.sourceEngine.disconnect(0);
          // this.sourceEngine.connect(biquad);
          // // biquad.connect(this.aud.master);
          // biquad.type = 'lowshelf';
          // biquad.gain = 40;
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
        if (this.config.wings) {
          this.aud.loadBuffer(sounds.hydraulic, function(c, buffer) {
            this.bufferHydraulic = buffer;
          }.bind(this, c));
          this.aud.loadBuffer(sounds.slam, function(c, buffer) {
            this.bufferSlam = buffer;
          }.bind(this, c));
        }
      }
    };

    this.update = function() {
      // Update graphics and audio state from physics.
      var vehic = this.vehic;
      if (!vehic) return;

      var chassisState = vehic.body.interp;
      if (!chassisState) return;
      this.root.position.copy(chassisState.pos);
      this.root.quaternion.copy(chassisState.ori);

      for (var w = 0; w < this.wheels.length; ++w) {
        var wheel = this.wheels[w];
        var vWheel = vehic.wheels[w];
        wheel.root.position.y = wheel.cfg.pos[1] -
                                this.config.center[1] + vWheel.ridePos;
        wheel.root.rotation.y = vehic.getWheelTurnPos(vWheel);
        wheel.mesh.rotation.x = vWheel.spinPos;

        if (vWheel.frictionForce.length() > 1000 + 1000 * Math.random()) {
          tmpVec3a.copy(vWheel.contactVel);
          tmpVec3a.x *= Math.random() + 0.5;
          tmpVec3a.y *= Math.random() + 0.5;
          tmpVec3a.z *= Math.random() + 0.5;
          if (dust) dust.spawnDust(vWheel.clipPos, tmpVec3a);
        }
      }

      if (this.config.wings && this.meshes) {
        var fold = vehic.wingFold;
        // console.log(fold);
        var meshes = this.meshes;
        var foldI = util.cubic(fold);
        var tmp = fold - 1;
        var foldO = 1 - tmp * tmp * tmp * tmp;
        var liftFlex = 0.000002 * vehic.liftForce - 0.02;
        var aileron = vehic.wingAileron * -0.3;
        meshes.WingLI.rotation.set(liftFlex, -liftFlex, foldI);
        meshes.WingLO.rotation.set(liftFlex + aileron, -liftFlex, foldO);
        meshes.WingRI.rotation.set(liftFlex, liftFlex, -foldI);
        meshes.WingRO.rotation.set(liftFlex - aileron, liftFlex, -foldO);

        this.root.updateMatrixWorld();
        if (dust && fold == 0) {
          tmpVec3a.set(0.45, 1.45, 0);
          tmpVec3a.applyMatrix4(meshes.WingLO.matrixWorld);
          dust.spawnContrail(tmpVec3a, vehic.body.getLinearVelAtPoint(tmpVec3a).multiplyScalar(0.95));
          tmpVec3a.set(-0.45, 1.45, 0);
          tmpVec3a.applyMatrix4(meshes.WingRO.matrixWorld);
          dust.spawnContrail(tmpVec3a, vehic.body.getLinearVelAtPoint(tmpVec3a).multiplyScalar(0.95));
        }
      }

      if (this.aud) {
        if (this.sourceEngine) {
          this.sourceEngine.gain.value = vehic.controller.output.throttle * 0.2 + 0.4;
          this.sourceEngine.playbackRate.value = vehic.engineAngVelSmoothed /
              (this.config.sounds.engineRpm * Math.PI / 30);
        }
        if (this.sourceTransmission) {
          var transmissionRate = Math.abs(vehic.differentialAngVel) /
              (this.config.sounds.transmissionRpm * Math.PI / 30);
          this.sourceTransmission.gain.value = Math.min(1, transmissionRate) * vehic.controller.output.throttle * 0.08;
          this.sourceTransmission.playbackRate.value = transmissionRate;
        }
        if (this.sourceWind) {
          var linVel = vehic.body.linVel;
          var windRate = linVel.length() / this.config.sounds.windSpeed;
          this.sourceWind.gain.value = Math.min(1.4, windRate) * 1.4;
          this.sourceWind.playbackRate.value = windRate + 0.5;
        }
        if (this.sourceSkid) {
          var skidLev = vehic.skidLevel * 0.0001;
          this.sourceSkid.gain.value = Math.log(1 + skidLev) * 0.6;
          this.sourceSkid.playbackRate.value = Math.log(1 + skidLev) * 0.2 + 0.7;
        }

        var cnl = vehic.getCrashNoiseLevel() * 0.000005;
        if (cnl > 0 && this.buffersCrash.length > 0) {
          var gain = Math.log(1 + cnl);
          if (gain > 0.01) {
            var rate = (0.5 + 675 / vehic.cfg.mass) * (0.99 + Math.random() * 0.02);
            this.aud.playSound(
                this.buffersCrash[Math.floor(Math.random() * this.buffersCrash.length)],
                false, gain, rate);
          }
        }
        for (var k in vehic.events) {
          var event = vehic.events[k];
          if (event.type == 'sfx:hydraulic' && this.bufferHydraulic) {
            this.aud.playSound(this.bufferHydraulic, false, 1, 1);
          } else if (event.type == 'sfx:slam' && this.bufferSlam) {
            var gain = event.gain === undefined ? 1 : event.gain;
            this.aud.playSound(this.bufferSlam, false, gain, 1);
          }
        }
        vehic.events = [];
      }
    };

    this.destroy = function() {
      scene.remove(this.root);

      // FIXME: Doesn't stop sounds that haven't finished loading at this point.

      if (this.sourceEngine) this.sourceEngine.stop(0);
      if (this.sourceTransmission) this.sourceTransmission.stop(0);
      if (this.sourceWind) this.sourceWind.stop(0);
      if (this.sourceSkid) this.sourceSkid.stop(0);
    };

    // TODO: Clean up this control flow.
    this.loadWithVehicle(vehic);
  };

  return exports;
});
