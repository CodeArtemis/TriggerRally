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
    this.lastCpDistSq = null;
    this.cpTimes = [];
    this.trigger('advance');
  };

  exports.Progress.prototype.nextCheckpoint = function(i) {
    return this.checkpoints.at(this.nextCpIndex + (i || 0)) || null;
  };

  var CP_RADIUS = 18;
  var CP_RADIUS_SQ = CP_RADIUS * CP_RADIUS;

  var cpVec = new Vec2();
  exports.Progress.prototype.update = function() {
    var vehic = this.vehicle;
    var nextCp = this.nextCheckpoint(0);
    if (!nextCp) return;
    cpVec.set(vehic.body.pos.x - nextCp.pos[0], vehic.body.pos.y - nextCp.pos[1]);
    var cpDistSq = cpVec.lengthSq();
    if (cpDistSq < CP_RADIUS_SQ) {
      var cpDist = Math.sqrt(cpDistSq);
      var time = vehic.sim.time;
      if (this.lastCpDistSq !== null) {
        var lastCpDist = Math.sqrt(this.lastCpDistSq);
        var diff = lastCpDist - cpDist;
        if (diff != 0) {
          var frac = (lastCpDist - CP_RADIUS) / diff;
          time -= vehic.sim.timeStep * frac;
        }
      }
      this.advanceCheckpoint(time);
    }
    this.lastCpDistSq = cpDistSq;
  };

  exports.Progress.prototype.isFinished = function() {
    return ! this.nextCheckpoint(0);
  };

  exports.Progress.prototype.finishTime = function() {
    return this.cpTimes[this.checkpoints.length - 1] || null;
  };

  exports.Progress.prototype.advanceCheckpoint = function(time) {
    ++this.nextCpIndex;
    this.cpTimes.push(time);
    this.trigger('advance');
  };

  var makeId = (function() {
    var nextId = 1;
    return function() {
      return nextId++;
    };
  })();

  exports.Game = function(track, replayRun) {
    this.id = makeId();
    this.track = track;
    this.progs = [];
    this.pubsub = new pubsub.PubSub();
    this.sim = new psim.Sim(1 / 150);
    this.sim.addStaticObject(this.track.terrain);
    this.sim.addStaticObject(this.track.scenery);
    this.sim.parent = this
    this.startTime = 3;
    this.sim.pubsub.subscribe('step', this.onSimStep.bind(this));
    this.simRate = 1;
    this.replayRun = replayRun
    this.replayRunStep = 0
  };

  exports.Game.prototype.setRunPos = function() {

    // TODO: define these functions somewhere else
    function mulVec(v, c){
      return {
        x: v.x * c,
        y: v.y * c,
        z: v.z * c
      }
    }

    function mulQuat(q, c){
      return {
        _x: q._x * c,
        _y: q._y * c,
        _z: q._z * c,
        _w: q._w * c
      }
    }
    
    function addVec(v1, v2){
      return {
        x:v1.x + v2.x,
        y:v1.y + v2.y,
        z:v1.z + v2.z
      }
    }

    function addQuat(q1, q2) {
      return {
        _x:q1._x + q2._x,
        _y:q1._y + q2._y,
        _z:q1._z + q2._z,
        _w:q1._w + q2._w
      }
    }
    
    const time = this.sim.time - this.startTime
    const local_record_p = this.replayRun.local_record_p
    const pos = this.sim.objects[0].pos
    const ori = this.sim.objects[0].ori
    const linVel = this.sim.objects[0].linVel
    const angMom = this.sim.objects[0].angMom
    
    while (local_record_p[this.replayRunStep+1] &&
           local_record_p[this.replayRunStep+1].raceTime < time) {
      this.replayRunStep++;
    }
    if (!local_record_p[this.replayRunStep+1]){
      return
    }

    const obj1 = local_record_p[this.replayRunStep    ]
    const obj2 = local_record_p[this.replayRunStep + 1]

    const t1 = obj1.raceTime
    const t2 = obj2.raceTime
    const x = (time - t1) / (t2 - t1)
    
    Object.assign(pos,    addVec (mulVec (obj1.pos   , (1-x)), mulVec (obj2.pos   , x)))
    Object.assign(ori,    addQuat(mulQuat(obj1.ori   , (1-x)), mulQuat(obj2.ori   , x)))
    Object.assign(linVel, addVec (mulVec (obj1.linVel, (1-x)), mulVec (obj2.linVel, x)))
    Object.assign(angMom, addVec (mulVec (obj1.angMom, (1-x)), mulVec (obj2.angMom, x)))

  }

  exports.Game.prototype.update = function(delta) {
    if (this.track.ready) {
      this.sim.tick(delta * this.simRate);
      if (this.replayRun){
        this.setRunPos()
      }
    }
  };

  exports.Game.prototype.destroy = function() {
    this.pubsub.trigger('destroy');
  };

  exports.Game.prototype.restart = function() {
    this.simRate = 1;
    this.sim.restart();
    this.progs.forEach(function(prog) {
      prog.restart();
      this.setupVehicle(prog.vehicle);
    }, this);
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
    // TODO: Remove redundant vehicle argument.
    this.pubsub.publish('addvehicle', vehicle, progress);
  };

  exports.Game.prototype.setupVehicle = function(vehicle) {
    vehicle.body.reset();
    vehicle.body.ori.set(1, 1, 1, 1).normalize();
    var startpos = this.track.root.track.config.course.startposition;
    vehicle.body.pos.set(startpos.pos[0], startpos.pos[1], startpos.pos[2]);
    var tmpQuat = new THREE.Quaternion().setFromAxisAngle(
        new Vec3(0,0,1), startpos.rot[2]);
    vehicle.body.ori = tmpQuat.multiply(vehicle.body.ori);
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
      progress.vehicle.disabled = disabled || progress.isFinished();
    });
  };

  return exports;
});
