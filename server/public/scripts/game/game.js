/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'game/track',
  'game/sim',
  'game/vehicle',
  'util/pubsub',
  'util/browserhttp'
],
function(THREE, track, psim, pvehicle, pubsub, http) {
  var exports = {};

  var Vec2 = THREE.Vector2;
  var Vec3 = THREE.Vector3;

  // Track state of a vehicle within game/race.
  exports.Progress = function(checkpoints, vehicle) {
    pubsub.PubSub.mixin(this);
    this.checkpoints = checkpoints;
    this.vehicle = vehicle;
    this.restart();
  };

  exports.Progress.prototype.restart = function() {
    this.nextCpIndex = 0;
    this.lastCpDistSq = 0;
    this.cpTimes = [];
    this.trigger('advance');
  };

  exports.Progress.prototype.nextCheckpoint = function(i) {
    return this.checkpoints.at(this.nextCpIndex + (i || 0)) || null;
  };

  exports.Progress.prototype.update = function() {
    var vehic = this.vehicle;
    var nextCp = this.nextCheckpoint(0);
    if (!nextCp) return;
    var cpVec = new Vec2(vehic.body.pos.x - nextCp.pos[0], vehic.body.pos.y - nextCp.pos[1]);
    var cpDistSq = cpVec.lengthSq();
    var CP_TEST = 18*18;
    if (cpDistSq < CP_TEST) {
      var cpDist = Math.sqrt(cpDistSq);
      var lastCpDist = Math.sqrt(this.lastCpDistSq);
      var frac = (lastCpDist - Math.sqrt(CP_TEST)) / (lastCpDist - cpDist);
      var time = vehic.sim.time - vehic.sim.timeStep * frac;
      this.advanceCheckpoint(time);
    }
    this.lastCpDistSq = cpDistSq;
  };

  exports.Progress.prototype.finishTime = function() {
    return this.cpTimes[this.checkpoints.length - 1] || null;
  };

  exports.Progress.prototype.advanceCheckpoint = function(time) {
    ++this.nextCpIndex;
    this.cpTimes.push(time);
    this.trigger('advance');
  };

  exports.Game = function(track) {
    this.track = track;
    this.progs = [];
    this.pubsub = new pubsub.PubSub();
    // TODO: Use a more sensible time step.
    this.sim = new psim.Sim(1 / 150);
    this.sim.addStaticObject(this.track.terrain);
    this.track.scenery.addToSim(this.sim);
    this.startTime = 3;
    this.sim.pubsub.subscribe('step', this.onSimStep.bind(this));
  };

  exports.Game.prototype.restart = function() {
    this.progs.forEach(function(prog) {
      prog.restart();
      this.setupVehicle(prog.vehicle);
    }, this);
    this.sim.restart();
  };

  exports.Game.prototype.on = function(event, callback) {
    this.pubsub.subscribe(event, callback);
  };

  exports.Game.prototype.interpolatedRaceTime = function() {
    return this.sim.interpolatedTime() - this.startTime;
  };

  exports.Game.prototype.addCar = function(carUrl, callback) {
    http.get({path:carUrl}, function(err, result) {
      if (err) {
        if (callback) callback(err);
        else throw new Error('Failed to fetch car: ' + err);
      } else {
        var config = JSON.parse(result);
        this.addCarConfig(config, callback);
      }
    }.bind(this));
  };

  exports.Game.prototype.addCarConfig = function(carConfig, callback) {
    var vehicle = new pvehicle.Vehicle(this.sim, carConfig);

    this.setupVehicle(vehicle);

    var checkpoints = this.track.root.track.config.course.checkpoints;
    var progress = new exports.Progress(checkpoints, vehicle);
    this.progs.push(progress);
    if (callback) callback(progress);
    this.pubsub.publish('addvehicle', vehicle, progress);
  };

  exports.Game.prototype.setupVehicle = function(vehicle) {
    vehicle.body.ori.set(1, 1, 1, 1).normalize();
    var startpos = this.track.root.track.config.course.startposition;
    vehicle.body.pos.set(startpos.pos[0], startpos.pos[1], startpos.pos[2]);
    var tmpQuat = new THREE.Quaternion().setFromAxisAngle(
        new Vec3(0,0,1), startpos.rot[2]);
    vehicle.body.ori = tmpQuat.multiplySelf(vehicle.body.ori);
    vehicle.body.updateMatrices();
    vehicle.init();
  };

  exports.Game.prototype.deleteCar = function(progress) {
    var idx = this.progs.indexOf(progress);
    if (idx !== -1) {
      this.progs.splice(idx, 1);
      this.pubsub.publish('deletevehicle', progress);
    }
  };

  exports.Game.prototype.onSimStep = function() {
    var disabled = (this.sim.time < this.startTime);
    this.progs.forEach(function(progress) {
      if (!disabled) progress.update();
      progress.vehicle.disabled = disabled;
    });
  };

  return exports;
});
