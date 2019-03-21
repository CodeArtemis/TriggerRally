/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'game/sim',
  'util/collision',
  'util/util'
],
function(THREE, psim, collision, util) {
  var exports = {};

  var Vec2 = THREE.Vector2;
  var Vec3 = THREE.Vector3;
  var Quat = THREE.Quaternion;

  var Vec3FromArray = util.Vec3FromArray;
  var TWOPI = util.TWOPI;
  var PULLTOWARD = util.PULLTOWARD;
  var MOVETOWARD = util.MOVETOWARD;
  var CLAMP = util.CLAMP;
  var INTERP = util.INTERP;

  // TODO: Transfer these to config.
  var CLIP_CONSTANT = 200000;
  var CLIP_DAMPING = 8000;
  var SUSP_CONSTANT = 120000;
  var SUSP_DAMPING_1 = 100;
  var SUSP_DAMPING_2 = 20000;
  var SUSP_MAX = 0.14;
  var WHEEL_MASS = 15;
  var ENGINE_BRAKE_REGION = 0.5;
  var ENGINE_BRAKE_TORQUE = 0.1;
  var REDLINE_RECOVER_FRACTION = 0.98;
  var LSD_VISCOUS_CONSTANT = 400;
  var MIN_TIME_BETWEEN_SHIFTS = 0.2;
  var FRICTION_DYNAMIC_CHASSIS = 0.9 * 0.9;
  var FRICTION_STATIC_CHASSIS = 1.2 * 0.9;
  var FRICTION_DYNAMIC_WHEEL = 0.9 * 1.2;
  var FRICTION_STATIC_WHEEL = 1.2 * 1.2;
  var WHEEL_LATERAL_FEEDBACK = 0.025;

  var tmpVec3a = new Vec3();
  var tmpVec3b = new Vec3();
  var tmpVec3c = new Vec3();
  var tmpVec2a = new Vec2();
  var tmpWheelPos = new Vec3();
  var plusXVec3 = new Vec3(1, 0, 0);
  var plusYVec3 = new Vec3(0, 1, 0);
  var plusZVec3 = new Vec3(0, 0, 1);

  var RPM_TO_RPS = function (r) { return r * TWOPI / 60; };

  function BiasedPull(val, target, deltaUp, deltaDown) {
    if (target >= val) {
      return PULLTOWARD(val, target, deltaUp);
    } else {
      return PULLTOWARD(val, target, deltaDown);
    }
  };

  function getEnginePower(angVel, powerband) {
    if (angVel <= 0) {
      return 0;
    }
    if (angVel <= powerband[0].radps) {
      return powerband[0].power * angVel / powerband[0].radps;
    }
    var p;
    for (p = 1; p < powerband.length; ++p) {
      if (angVel <= powerband[p].radps) {
        // TODO: Precompute radps divisors.
        return INTERP(powerband[p - 1].power,
                      powerband[p].power,
                      (angVel - powerband[p - 1].radps) /
                          (powerband[p].radps - powerband[p - 1].radps));
      }
    }
    return powerband[p - 1].power;
  }

  exports.AutomaticController = function(vehicle) {
    this.vehicle = vehicle;
    this.shiftTimer = 0;
    this.input = {
      brake: 0,
      handbrake: 0,
      throttle: 0,
      turn: 0
    };
    this.output = {
      throttle: 0,
      clutch: 1,  // 0 = disengaged, 1 = fully engaged
      gear: 1,  // -1 = reverse, 0 = neutral, 1 = first gear, etc.
      brake: 0,
      handbrake: 0,
      desiredTurnPos: 0
    };
  };

  exports.AutomaticController.prototype.tick = function(delta) {
    var input = this.input;
    var output = this.output;
    var vehicle = this.vehicle;
    var powerband = vehicle.cfg.engine.powerband;

    var GetTorque = function(testGear) {
      var testAngVel = vehicle.engineAngVel *
          vehicle.gearRatios[testGear] / vehicle.gearRatios[output.gear];
      var testPower = getEnginePower(testAngVel, powerband);
      return testPower * vehicle.gearRatios[testGear] / testAngVel;
    };

    var accel = input.throttle;
    var brake = input.brake;

    // We estimate what the engine speed would be at a different gear, and see
    // if it would provide more torque.
    var engineAngVel = vehicle.engineAngVel;
    var currentPower = getEnginePower(vehicle.engineAngVel, powerband);
    var currentTorque = currentPower * vehicle.gearRatios[output.gear] / vehicle.engineAngVel;
    if (this.shiftTimer <= 0) {
      if (output.clutch >= 0.5 && output.gear >= 1) {
        var nextGearRel = 0;
        if (output.gear > 1 &&
            GetTorque(output.gear - 1) > currentTorque) {
          output.gear -= 1;
          this.shiftTimer = MIN_TIME_BETWEEN_SHIFTS;
          //output.clutch = 0;
        } else if (output.gear < vehicle.gearRatios.length - 1 &&
                   GetTorque(output.gear + 1) > currentTorque) {
          output.gear += 1;
          this.shiftTimer = MIN_TIME_BETWEEN_SHIFTS;
          //output.clutch = 0;
        } else if (brake > 0.1 && vehicle.differentialAngVel < 1) {
          output.gear = -1;
          accel = brake;
          brake = 0;
          this.shiftTimer = MIN_TIME_BETWEEN_SHIFTS;
        }
      } else if (output.gear == -1) {
        if (accel > 0.1) {
          output.gear = 1;
          this.shiftTimer = MIN_TIME_BETWEEN_SHIFTS;
        } else {
          accel = brake;
          brake = 0;
        }
      }
    } else {
      this.shiftTimer -= delta;
      //output.clutch = 0;
    }

    output.throttle = accel;
    output.brake = brake;
    output.handbrake = input.handbrake;
    output.desiredTurnPos = input.turn;
    output.clutch = 1;

    // Disengage clutch when using handbrake.
    if (output.handbrake >= 0.5 && !vehicle.cfg.wings) output.clutch = 0;
  };

  exports.Vehicle = function(sim, config) {
    this.events = [];
    this.sim = sim;
    this.cfg = config;

    this.body = new psim.RigidBody(sim);

    this.init(sim, config);

    sim.addObject(this);
  }

  exports.Vehicle.prototype.init = function() {
    var config = this.cfg;

    this.body.linVel.set(0, 0, 0);
    this.body.angVel.set(0, 0, 0);
    this.body.angMom.set(0, 0, 0);

    this.body.setMassCuboid(
        config.mass,
        Vec3FromArray(config.dimensions).multiplyScalar(0.5));

    this.body.recordState();

    this.wheelTurnPos = -1;
    this.wheelTurnVel = 0;
    this.totalDrive = 0;

    this.wheelFrictionStatic = config.wheelFrictionStatic || FRICTION_STATIC_WHEEL;
    this.wheelFrictionDynamic = config.wheelFrictionDynamic || FRICTION_DYNAMIC_WHEEL;

    this.clips = [];
    for (var i = 0; i < config.clips.length; ++i) {
      var cfg = config.clips[i];
      this.clips.push({
        pos: new Vec3(
          cfg.pos[0] - config.center[0],
          cfg.pos[1] - config.center[1],
          cfg.pos[2] - config.center[2]),
        radius: cfg.radius
      });
    }

    this.wheelLateralFeedback = config.wheelLateralFeedback || WHEEL_LATERAL_FEEDBACK;
    this.avgDriveWheelRadius = 0;
    this.wheels = [];
    for (var w = 0; w < config.wheels.length; ++w) {
      var wheel = this.wheels[w] = {};
      var wcfg = wheel.cfg = config.wheels[w];
      wheel.pos = new Vec3(
        wcfg.pos[0] - config.center[0],
        wcfg.pos[1] - config.center[1],
        wcfg.pos[2] - config.center[2]);
      wheel.ridePos = 0;
      wheel.rideVel = 0;
      wheel.spinPos = 0;
      wheel.spinVel = 0;
      wheel.frictionForce = new Vec2();
      wheel.contactVel = new Vec3();
      wheel.clipPos = new Vec3();
      wheel.clipPos.radius = wcfg.radius;  // For collideSphere use.
      var drive = wcfg.drive || 0;
      this.totalDrive += drive;
      this.avgDriveWheelRadius += wcfg.radius * drive;

      wheel.MASS = wcfg.mass || WHEEL_MASS;
      wheel.SUSP_MAX = wcfg.suspMax || SUSP_MAX;
      wheel.SUSP_CONSTANT = wcfg.suspConstant || SUSP_CONSTANT;
      wheel.SUSP_DAMPING_1 = wcfg.suspDamping1 || SUSP_DAMPING_1;
      wheel.SUSP_DAMPING_2 = wcfg.suspDamping2 || SUSP_DAMPING_2;
    }
    this.avgDriveWheelRadius /= this.totalDrive;

    this.controller = new exports.AutomaticController(this);

    for (var p = 0; p < config.engine.powerband.length; ++p) {
      config.engine.powerband[p].radps =
          config.engine.powerband[p].rpm * TWOPI / 60;
    }
    this.engineAngVel = 0;  // radians per second
    this.engineAngVelSmoothed = 0;  // for display purposes
    this.engineIdle = config.engine.powerband[0].radps;
    this.engineRedline = config.engine.redline * TWOPI / 60;
    this.engineRecover = this.engineRedline * REDLINE_RECOVER_FRACTION;
    this.engineOverspeed = false;
    this.enginePowerscale = config.engine.powerscale * 1000;  // kW to W

    var finalRatio = config.transmission['final'];
    this.gearRatios = [];
    this.gearRatios[-1] = -config.transmission.reverse * finalRatio;
    this.gearRatios[0] = 0;
    for (var g = 0; g < config.transmission.forward.length; ++g) {
      this.gearRatios[g + 1] = config.transmission.forward[g] * finalRatio;
    }

    this.recoverTimer = 0;
    this.crashLevel = 0;
    this.crashLevelPrev = 0;
    this.skidLevel = 0;
    this.disabled = false;
    this.hasContact = false;

    if (config.wings) {
      this.wingFold = 1;
      this.foldTimer = 0;
      this.origAngMass = this.body.angMass.clone();
      this.origAngMassInv = this.body.angMassInv.clone();
      var guess = this.origAngMass.x;
      this.wingAngMass = new Vec3(guess, guess * 2, guess);
      guess = 1 / guess;
      this.wingAngMassInv = new Vec3(guess, guess * 2, guess);
      this.liftForce = 0;
    }
  };

  exports.Vehicle.prototype.recordState = function() {
    // TODO: Implement.
  };

  exports.Vehicle.prototype.getState = function() {
    // TODO: Implement.
    return {};
  };

  exports.Vehicle.prototype.recover = function(delta) {
    var state = this.recoverState;
    var body = this.body;

    if (!state) {
      // Work out which way vehicle is facing.
      var angleY = Math.atan2(body.oriMat.elements[8], body.oriMat.elements[0]);
      var ninetyDeg = new Quat(1, 0, 0, 1).normalize();
      var newOri = new Quat().setFromAxisAngle(plusYVec3, Math.PI - angleY);
      newOri = ninetyDeg.multiply(newOri);
      // newOri.set(0,0,0,1);

      // Make sure we take the shortest path.
      var cosHalfTheta = newOri.x * body.ori.x + newOri.y * body.ori.y +
                         newOri.z * body.ori.z + newOri.w * body.ori.w;
      if (cosHalfTheta < 0) {
        newOri.x *= -1; newOri.y *= -1;
        newOri.z *= -1; newOri.w *= -1;
      }

      var posOffset = Vec3FromArray(this.cfg.recover.posOffset);
      // TODO: Transfer this to config.
      posOffset.set(0, 0, 4);
      state = this.recoverState = {
        pos: body.pos.clone().add(posOffset),
        ori: newOri
      };
      this.disabled = true;
    }
    var pull = delta * 4;
    body.pos.x = PULLTOWARD(body.pos.x, state.pos.x, pull);
    body.pos.y = PULLTOWARD(body.pos.y, state.pos.y, pull);
    body.pos.z = PULLTOWARD(body.pos.z, state.pos.z, pull);
    body.ori.x = PULLTOWARD(body.ori.x, state.ori.x, pull);
    body.ori.y = PULLTOWARD(body.ori.y, state.ori.y, pull);
    body.ori.z = PULLTOWARD(body.ori.z, state.ori.z, pull);
    body.ori.w = PULLTOWARD(body.ori.w, state.ori.w, pull);
    body.linVel.set(0, 0, 0);
    body.angVel.set(0, 0, 0);
    body.angMom.set(0, 0, 0);

    if (this.recoverTimer >= this.cfg.recover.releaseTime) {
      this.recoverTimer = 0;
      this.recoverState = null;
      this.disabled = false;
    }
  };

  /*
  Powertrain layout:
  Engine - Clutch - Gearbox - Differential - Wheels
  */

  exports.Vehicle.prototype.tick = function(delta) {
    var c;
    this.controller.tick(delta);
    var powerband = this.cfg.engine.powerband;
    var controls = this.controller.output;
    var throttle = controls.throttle;

    if (this.disabled) {
      // Car is disabled, eg. before start or for recovery.
      controls.clutch = 0;
      controls.brake = 1;
      controls.desiredTurnPos = 0;
    }

    this.crashLevelPrev = PULLTOWARD(this.crashLevelPrev, this.crashLevel, delta * 5);
    this.crashLevel = PULLTOWARD(this.crashLevel, 0, delta * 5);
    this.skidLevel = 0;

    if ((this.hasContact &&
         this.body.oriMat.elements[6] <= 0.1) ||
        this.recoverTimer >= this.cfg.recover.triggerTime) {
      this.recoverTimer += delta;

      if (this.recoverTimer >= this.cfg.recover.triggerTime) {
        this.recover(delta);
      }
    } else {
      this.recoverTimer = 0;
    }

    // Compute some data about vehicle's current state.
    var differentialAngVel = 0;
    var wheelLateralForce = 0;
    for (c = 0; c < this.wheels.length; ++c) {
      var wheel = this.wheels[c];
      var driveFactor = wheel.cfg.drive || 0;
      differentialAngVel += wheel.spinVel * driveFactor;
      var turnFactor = wheel.cfg.turn || 0;
      wheelLateralForce += wheel.frictionForce.x * turnFactor;
    }
    differentialAngVel /= this.totalDrive;
    this.differentialAngVel = differentialAngVel;

    // If we're in gear, lock engine speed to differential.
    var gearRatio = this.gearRatios[controls.gear];
    if (gearRatio != 0 && controls.clutch) {
      this.engineAngVel = differentialAngVel * gearRatio;
    }
    if (this.engineAngVel < this.engineIdle) {
      this.engineAngVel = this.engineIdle;
    }

    // Check for over-revving.
    if (this.engineOverspeed) {
      this.engineOverspeed = (this.engineAngVel > this.engineRecover);
      if (this.engineOverspeed) {
        throttle = 0;
        // Make throttle come up smoothly from zero again.
        controls.throttle = 0;  // TODO: Find a better way to do this?
      }
    } else {
      if (this.engineAngVel > this.engineRedline) {
        throttle = 0;
        this.engineOverspeed = true;
      }
    }

    // Extend throttle range to [-1, 1] including engine braking.
    var extendedThrottle = throttle - ENGINE_BRAKE_REGION;
    if (extendedThrottle >= 0) {
      extendedThrottle /= (1 - ENGINE_BRAKE_REGION);
    } else {
      extendedThrottle /= ENGINE_BRAKE_REGION;
    }

    var engineTorque;
    if (extendedThrottle >= 0) {
      // Positive engine power.
      var enginePower = extendedThrottle * this.enginePowerscale *
          getEnginePower(this.engineAngVel, powerband);
      engineTorque = enginePower / this.engineAngVel;
    } else {
      // Engine braking does not depend on powerband.
      // TODO: Add engine braking range and power to config.
      engineTorque = ENGINE_BRAKE_TORQUE * extendedThrottle * (this.engineAngVel - this.engineIdle);
    }

    var perWheelTorque = 0;
    if (gearRatio != 0 && controls.clutch) {
      var differentialTorque = engineTorque * gearRatio;
      perWheelTorque = differentialTorque / this.totalDrive;
    } else {
      this.engineAngVel += 50000 * engineTorque * delta / this.cfg.engine.flywheel;
      if (this.engineAngVel < this.engineIdle) {
        this.engineAngVel = this.engineIdle;
      }
    }

    if (this.cfg.wings) {
      var timeOut = 0.5;
      var wingsShouldFold = true;

      if (this.hasContact) {
        if (this.foldTimer >= timeOut) {
          this.events.push({type:'sfx:hydraulic', gain: 0.5});
        }
        this.foldTimer = 0;
        wingsShouldFold = true;
      } else {
        if (this.foldTimer < timeOut) {
          this.foldTimer += delta;
          if (this.foldTimer >= timeOut)
            wingsShouldFold = false;
        }
        if (this.foldTimer >= timeOut)
          wingsShouldFold = false;
        else
          wingsShouldFold = true;
      }
      // if (controls.handbrake > 0.5) wingsShouldFold = false;

      if (wingsShouldFold) {
        if (this.wingFold == 0)
          this.events.push({type:'sfx:hydraulic', gain: 0.5});
        if (this.wingFold < 1) {
          this.wingFold += delta * 3;
          if (this.wingFold >= 1) {
            this.wingFold = 1;
            this.events.push({type:'sfx:slam', gain: 0.3});
          }
        }
      } else {
        if (this.wingFold == 1)
          this.events.push({type:'sfx:hydraulic', gain: 0.5});
        if (this.wingFold > 0) {
          this.wingFold -= delta * 3;
          if (this.wingFold <= 0) {
            this.wingFold = 0;
            this.events.push({type:'sfx:slam'});
          }
        }
      }
      var wingFactor = (1 - this.wingFold);
      var oam = this.origAngMass;
      var wam = this.wingAngMass;
      this.body.angMass.set(oam.x + (wam.x - oam.x) * wingFactor,
                            oam.y + (wam.y - oam.y) * wingFactor,
                            oam.z + (wam.z - oam.z) * wingFactor);
      var oami = this.origAngMassInv;
      var wami = this.wingAngMassInv;
      this.body.angMassInv.set(oami.x + (wami.x - oami.x) * wingFactor,
                               oami.y + (wami.y - oami.y) * wingFactor,
                               oami.z + (wami.z - oami.z) * wingFactor);
      // TODO: Transfer all this stuff to config.
      var liftX = wingFactor * 150;
      var liftY = wingFactor * 150;
      var linDragX = 10 * wingFactor;
      var linDragY = 10 * wingFactor;
      var linDragZ = 0.3 * wingFactor;
      this.body.angDamping = Math.pow(10, -10 + 1.5 * wingFactor);
      var finEffectX = 300 * wingFactor;
      var finEffectY = 300 * wingFactor;
      var finEffectZ = 30 * wingFactor;
      var llv = this.body.getLocLinearVel();
      var locLinVelX = llv.x;
      var locLinVelY = llv.y;
      var locLinVelZ = llv.z;
      var locAngVel = this.body.getLocAngularVel();  // overwrites llv.
      var logFwdVel = Math.log(Math.abs(locLinVelZ) + 0.5);
      var turnSpeed = 2;
      var turnRateA = 30 * wingFactor;  // Speed independent turn thrust.
      var turnRateB = 1500 * wingFactor;  // Speed dependent control surface turn rate.

      var input = this.controller.input;
      var turn = this.wheelTurnPos;

      var elements = this.body.oriMat.elements;
      // var heading = Math.atan2(elements[1], elements[0]);
      var pitch = Math.acos(elements[10]);
      // TODO: Fix roll - it's only accurate when pitch = pi/2.
      var roll = Math.asin(elements[2]);

      // X: Pitch down
      // Y: Yaw left
      // Z: Roll right (clockwise)

      var angX = 0.05 + Math.PI/2 - pitch + (input.throttle - input.brake) * 0.6;
      var angY = turn * 0.8;
      var angZ = turn * 0.2 - roll;
      angX = CLAMP(angX, -1, 1);
      angY = CLAMP(angY, -1, 1);
      angZ = CLAMP(angZ, -1, 1);
      tmpVec3a.set(angX, angY, angZ).multiplyScalar(turnSpeed);
      this.wingElevator = angX;
      this.wingRudder = angY;
      this.wingAileron = angZ;

      tmpVec3b.copy(tmpVec3a).multiplyScalar(turnRateA);
      this.body.addLocTorque(tmpVec3b);
      tmpVec3a.sub(locAngVel).multiplyScalar(logFwdVel * turnRateB);
      this.body.addLocTorque(tmpVec3a);

      // Fin effect (torque due to drag).
      this.body.addLocTorque(tmpVec3a.set(
                -locLinVelY * finEffectX - locLinVelZ * finEffectZ,
                locLinVelX * finEffectY,
                0));

      // Linear drag and lift.
      tmpVec3a.x = -(linDragX + liftX * logFwdVel) * locLinVelX * Math.abs(locLinVelX);
      tmpVec3a.y = -(linDragY + liftY * logFwdVel) * locLinVelY * Math.abs(locLinVelY);
      tmpVec3a.z = -linDragZ * locLinVelZ * Math.abs(locLinVelZ);
      // Thrust.
      //tmpVec3a.z += wingFactor * 10000;
      this.body.addLocForce(tmpVec3a);
      this.liftForce = tmpVec3a.y;
    }

    // var handbrake = this.cfg.wings ? 0 : controls.handbrake;
    var handbrake = controls.handbrake;

    this.hasContact = false;
    for (c = 0; c < this.wheels.length; ++c) {
      var wheel = this.wheels[c];
      var wheelTorque = wheel.frictionForce.y * 0.3;
      // Viscous 2-way LSD.
      if (wheel.cfg.drive) {
        var diffSlip = wheel.spinVel - differentialAngVel;
        var diffTorque = diffSlip * LSD_VISCOUS_CONSTANT;
        wheelTorque += (perWheelTorque - diffTorque) * wheel.cfg.drive;
      }
      // TODO: Convert torque to ang accel with proper units.
      var angAccel = 2 * wheelTorque / wheel.MASS / wheel.cfg.radius * 0.3;
      wheel.spinVel += angAccel * delta;
      // wheel.spinVel += 0.13 * wheelTorque * delta;
      var brake =
          controls.brake * (wheel.cfg.brake || 0) +
          handbrake * (wheel.cfg.handbrake || 0);
      if (brake > 0) {
        wheel.spinVel = MOVETOWARD(wheel.spinVel, 0, brake * delta);
      }
    }

    (function() {
      // TODO: Use real clip geometry instead of just points.
      // TODO: GARBAGE: Pre-alloc worldPts.
      var worldPts = [];
      this.clips.forEach(function(clip) {
        var pt = this.body.getLocToWorldPoint(clip.pos).clone();
        pt.radius = clip.radius;
        worldPts.push(pt);
      }, this);
      var list = new collision.SphereList(worldPts);
      var contacts = this.sim.collideSphereList(list);
      if (contacts.length > 0) this.hasContact = true;
      contacts.forEach(this.contactResponse, this);
    }).call(this);

    var wheelTurnVelTarget =
        (controls.desiredTurnPos - this.wheelTurnPos) * 400 -
        this.wheelTurnVel * 20.0 -
        wheelLateralForce * this.wheelLateralFeedback;
    wheelTurnVelTarget = CLAMP(wheelTurnVelTarget, -8, 8);
    this.wheelTurnVel = PULLTOWARD(this.wheelTurnVel,
                                   wheelTurnVelTarget,
                                   delta * 10);
    this.wheelTurnPos += this.wheelTurnVel * delta;
    this.wheelTurnPos = CLAMP(this.wheelTurnPos, -1, 1);
    for (c = 0; c < this.cfg.wheels.length; ++c) {
      this.tickWheel(this.wheels[c], delta);
    }

    var smoothRate = delta * 100000 / this.cfg.engine.flywheel;
    this.engineAngVelSmoothed = PULLTOWARD(
        this.engineAngVelSmoothed, this.engineAngVel, smoothRate);
  };

  var tmpBasis = { u: new Vec3(), v: new Vec3(), w: new Vec3() };
  var getSurfaceBasis = function(normal, right) {
    // TODO: Return a matrix type.
    tmpBasis.w.copy(normal);  // Assumed to be normalized.
    tmpBasis.v.copy(normal).cross(right);
    tmpBasis.v.normalize();
    tmpBasis.u.copy(tmpBasis.v).cross(normal);
    tmpBasis.u.normalize();
    return tmpBasis;
  }

  exports.Vehicle.prototype.contactResponse = function(contact) {
    var surf = getSurfaceBasis(contact.normal, plusXVec3);
    // TODO: Remove surfacePos.
    var contactPoint = contact.pos2 || contact.surfacePos;
    var contactVel = this.body.getLinearVelAtPoint(contactPoint);

    // Local velocity in surface space.
    var contactVelSurf = tmpVec3a.set(
        contactVel.dot(surf.u),
        contactVel.dot(surf.v),
        contactVel.dot(surf.w));

    // Damped spring model for perpendicular contact force.
    var perpForce = contact.depth * CLIP_CONSTANT -
                    contactVelSurf.z * CLIP_DAMPING;

    // Make sure the objects are pushing apart.
    if (perpForce > 0) {
      // TODO: Reexamine this friction algorithm.
      var friction = tmpVec2a.set(-contactVelSurf.x, -contactVelSurf.y).
          multiplyScalar(10000);

      var maxFriction = perpForce * FRICTION_DYNAMIC_CHASSIS;
      var testFriction = perpForce * FRICTION_STATIC_CHASSIS;

      var leng = friction.length();

      this.skidLevel += Math.min(1, Math.max(0, leng / maxFriction - 0.75)) * perpForce;

      if (leng > testFriction) {
        friction.multiplyScalar(maxFriction / leng);
      }

      // Not bothering to clone at this point.
      var force = surf.w.multiplyScalar(perpForce);
      force.add(surf.u.multiplyScalar(friction.x));
      force.add(surf.v.multiplyScalar(friction.y));

      this.body.addForceAtPoint(force, contactPoint);

      this.crashLevel = Math.max(this.crashLevel, perpForce);
    }
  };

  exports.Vehicle.prototype.tickWheel = function(wheel, delta) {
    var suspensionForce = wheel.ridePos * wheel.SUSP_CONSTANT;
    wheel.frictionForce.set(0, 0);

    // F = m.a, a = F / m
    wheel.rideVel -= suspensionForce / wheel.MASS * delta;
    // We apply suspension damping semi-implicitly.
    wheel.rideVel *= 1 / (1 + wheel.SUSP_DAMPING_1 * delta);
    wheel.ridePos += wheel.rideVel * delta;

    wheel.spinPos += wheel.spinVel * delta;
    wheel.spinPos -= Math.floor(wheel.spinPos / TWOPI) * TWOPI;

    // TICK STUFF ABOVE HERE

    tmpWheelPos.copy(wheel.pos);
    tmpWheelPos.y += wheel.ridePos;
    var clipPos = wheel.clipPos.copy(this.body.getLocToWorldPoint(tmpWheelPos));

    var contacts = this.sim.collideSphere(clipPos);

    // var sideways = this.body.oriMat.getColumnX();
    // tmpVec3a.cross(sideways, plusZVec3);
    // tmpVec3b.cross(tmpVec3a, sideways);
    var wheelRight = this.getWheelRightVector(wheel);
    tmpVec3a.copy(wheelRight).cross(plusZVec3);
    tmpVec3b.copy(wheelRight).cross(tmpVec3a);
    tmpVec3b.multiplyScalar(wheel.cfg.radius);
    clipPos.add(tmpVec3b);
    Array.prototype.push.apply(contacts, this.sim.collidePoint(clipPos));
    if (contacts.length == 0) return;
    var wheelSurfaceVel = wheel.spinVel * wheel.cfg.radius;
    this.hasContact = true;
    for (var c = 0; c < contacts.length; ++c) {
      var contact = contacts[c];
      var surf = getSurfaceBasis(contact.normal, wheelRight);

      // This is wrong if there are multiple contacts.
      var contactVel = wheel.contactVel.copy(this.body.getLinearVelAtPoint(contact.pos2 || clipPos));

      // Local velocity in surface space.
      var contactVelSurf = tmpVec3a.set(
          contactVel.dot(surf.u),
          contactVel.dot(surf.v),
          contactVel.dot(surf.w));

      contactVelSurf.y += wheelSurfaceVel;
      // This is wrong if there are multiple contacts.
      contactVel.add(tmpVec3b.copy(surf.v).multiplyScalar(wheelSurfaceVel));

      tmpVec3c.set(this.body.oriMat.elements[4], this.body.oriMat.elements[5], this.body.oriMat.elements[6]);
      var suspensionDotContact = contact.normal.dot(tmpVec3c);
      wheel.ridePos += suspensionDotContact * contact.depth;

      var perpForce;
      if (wheel.ridePos > wheel.SUSP_MAX) {
        // Suspension has bottomed out. Add hard clipping force.
        var overDepth = wheel.ridePos - wheel.SUSP_MAX;

        wheel.ridePos = wheel.SUSP_MAX;
        wheel.rideVel = 0;

        perpForce = wheel.SUSP_MAX * wheel.SUSP_CONSTANT +
                    overDepth * CLIP_CONSTANT -
                    contactVelSurf.z * CLIP_DAMPING;
      } else {
        if (wheel.ridePos < -wheel.SUSP_MAX) {
          // Suspension has "topped" out. Cap the force.
          wheel.ridePos = -wheel.SUSP_MAX;
        }

        wheel.rideVel = Math.max(wheel.rideVel, -contactVelSurf.z);

        // Damped spring model for perpendicular contact force.
        // Recompute suspension force given new ridePos.
        perpForce = wheel.ridePos * wheel.SUSP_CONSTANT +
                    wheel.rideVel * wheel.SUSP_DAMPING_2;
      }

      perpForce *= suspensionDotContact;
      var hardClipForce = contact.depth * CLIP_CONSTANT -
                          contactVelSurf.z * CLIP_DAMPING;
      var sideFactor = 1 - suspensionDotContact * suspensionDotContact;
      // perpForce += hardClipForce * (1 - Math.abs(suspensionDotContact));
      perpForce += hardClipForce * sideFactor;

      // Only interact further if there's a positive normal force.
      if (perpForce > 0) {
        // TODO: Reexamine this friction algorithm.
        var friction = tmpVec2a.set(-contactVelSurf.x, -contactVelSurf.y).
            multiplyScalar(3000);

        var maxFriction = perpForce * this.wheelFrictionDynamic;
        var testFriction = perpForce * this.wheelFrictionStatic;

        var leng = friction.length();

        this.skidLevel += Math.min(1, Math.max(0, leng / maxFriction - 0.75)) * perpForce;

        if (leng > testFriction) {
          friction.multiplyScalar(maxFriction / leng);
        }

        wheel.frictionForce.add(friction);

        // surf is corrupted by these calculations.
        var force = surf.w.multiplyScalar(perpForce);
        force.add(surf.u.multiplyScalar(friction.x));
        force.add(surf.v.multiplyScalar(friction.y));

        this.body.addForceAtPoint(force, clipPos);

        this.crashLevel = Math.max(this.crashLevel, perpForce * sideFactor);
      }
    }
  };

  exports.Vehicle.prototype.getWheelTurnPos = function(wheel) {
    // TODO: Turning-circle alignment.
    return (wheel.cfg.turn || 0) * this.wheelTurnPos;
  }

  var tmpWheelRight = new Vec3();
  exports.Vehicle.prototype.getWheelRightVector = function(wheel) {
    var turnPos = this.getWheelTurnPos(wheel);
    var cosTurn = Math.cos(turnPos);
    var sinTurn = Math.sin(turnPos);
    var mat = this.body.oriMat.elements;
    tmpWheelRight.set(
        mat[0] * cosTurn - mat[8] * sinTurn,
        mat[1] * cosTurn - mat[9] * sinTurn,
        mat[2] * cosTurn - mat[10] * sinTurn
    );
    return tmpWheelRight;
  };

  exports.Vehicle.prototype.getCrashNoiseLevel = function() {
    if (this.crashLevel > this.crashLevelPrev) {
      this.crashLevelPrev = this.crashLevel * 2;
      return this.crashLevel;
    } else {
      return 0;
    }
  };

  exports.Vehicle.prototype.grabSnapshot = function() {
    return filterObject(this, keys);
  };

  return exports;
});
