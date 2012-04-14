/**
 * @author jareiko / http://www.jareiko.net/
 */

// Runs DETERMINISTICALLY on both server and client.

var MODULE = 'game';

(function(exports) {
  var THREE = this.THREE || require('../THREE');
  var track = this.track || require('./track');
  var psim = this.psim || require('./psim');
  var pvehicle = this.pvehicle || require('./pvehicle');
  var pubsub = this.pubsub || require('./pubsub');

  var Vec2 = THREE.Vector2;

  // Track state of a vehicle within game/race.
  exports.Progress = function(track, vehicle) {
    this.checkpoints = track.checkpoints;
    this.vehicle = vehicle;
    this.nextCpIndex = 0;
    this.pubsub = new pubsub.PubSub();
    this.lastCpDistSq = 0;
    this.cpTimes = [];
  };

  exports.Progress.prototype.nextCheckpoint = function(i) {
    return this.checkpoints[this.nextCpIndex + (i || 0)] || null;
  };

  exports.Progress.prototype.update = function() {
    var vehic = this.vehicle;
    var nextCp = this.nextCheckpoint(0);
    if (nextCp) {
      var cpVec = new Vec2(vehic.body.pos.x - nextCp.x, vehic.body.pos.z - nextCp.z);
      var cpDistSq = cpVec.lengthSq();
      var CP_TEST = 64;
      if (cpDistSq < CP_TEST) {
        var cpDist = Math.sqrt(cpDistSq);
        var lastCpDist = Math.sqrt(this.lastCpDistSq);
        var frac = (lastCpDist - Math.sqrt(CP_TEST)) / (lastCpDist - cpDist);
        var time = vehic.sim.time - vehic.sim.timeStep * frac;
        this.advanceCheckpoint(time);
      }
      this.lastCpDistSq = cpDistSq;
    }
  };
  
  exports.Progress.prototype.finishTime = function() {
    return this.cpTimes[this.checkpoints.length - 1] || null;
  };

  exports.Progress.prototype.advanceCheckpoint = function(time) {
    ++this.nextCpIndex;
    this.cpTimes.push(time);
    this.pubsub.publish('advance');
  };

  exports.Game = function(http) {
    this.http = http;
    this.track = new track.Track();
    this.progs = [];
    // TODO: Use a more sensible time step.
    this.sim = new psim.Sim(1 / 150);
    this.startTime = 3;
    this.sim.pubsub.subscribe('step', this.onSimStep.bind(this));
  };

  exports.Game.prototype.interpolatedRaceTime = function() {
    return this.sim.interpolatedTime() - this.startTime;
  };

  exports.Game.prototype.setTrack = function(trackUrl, callback) {
    this.http.get({path:trackUrl}, function(err, result) {
      if (err) {
        if (callback) callback(err);
        else throw new Error('Failed to fetch track: ' + err);
      } else {
        var config = JSON.parse(result);
        this.setTrackConfig(config, callback);
      }
    }.bind(this));
  };

  exports.Game.prototype.setTrackConfig = function(trackConfig, callback) {
    this.track.loadWithConfig(trackConfig, function() {
      this.sim.addStaticObject(this.track.terrain);

      this.track.trees.forEach(function(tree) {
        this.sim.addCylinder(tree);
      }.bind(this));
      
      if (callback) callback(null, this.track);
    }.bind(this));
  };

  exports.Game.prototype.addCar = function(carUrl, callback) {
    this.http.get({path:carUrl}, function(err, result) {
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

    // TODO: Get this initial state from track.
    vehicle.body.pos.x = 100;
    vehicle.body.pos.y = 10;
    vehicle.body.pos.z = -100;
    vehicle.body.ori = new THREE.Quaternion(0, 0.5, 0, 0.5);
    //vehicle.body.ori = new THREE.Quaternion(0.9, 0.6, 0.7, -0.2);
    vehicle.body.ori.normalize();

    var progress = new exports.Progress(this.track, vehicle);
    this.progs.push(progress);
    if (callback) callback(null, progress);
  };

  exports.Game.prototype.onSimStep = function() {
    //console.log(this.progs[0].vehicle.body.pos.y);

    var disabled = (this.sim.time < this.startTime);
    this.progs.forEach(function(progress) {
      progress.update();
      progress.vehicle.disabled = disabled;
    });
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
