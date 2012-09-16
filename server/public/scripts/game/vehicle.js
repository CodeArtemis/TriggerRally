/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'game/sim',
  'cs!util/collision',
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
  var SUSP_CONSTANT = 70000;
  var SUSP_DAMPING = 50;
  var SUSP_MAX = 0.13;
  var WHEEL_MASS = 15;
  var THROTTLE_RESPONSE = 8;
  var BRAKE_RESPONSE = 5;
  var HANDBRAKE_RESPONSE = 20;
  var TURN_RESPONSE = 5;
  var ENGINE_BRAKE_REGION = 0.5;
  var ENGINE_BRAKE_TORQUE = 0.1;
  var REDLINE_RECOVER_FRACTION = 0.98;
  var LSD_VISCOUS_CONSTANT = 400;
  var MIN_TIME_BETWEEN_SHIFTS = 0.2;
  var FRICTION_DYNAMIC_CHASSIS = 0.9 * 0.9;
  var FRICTION_STATIC_CHASSIS = 1.2 * 0.9;
  var FRICTION_DYNAMIC_WHEEL = 0.9 * 1.2;
  var FRICTION_STATIC_WHEEL = 1.2 * 1.2;

  var tmpVec3a = new Vec3();
  var tmpVec2a = new Vec2();
  var plusXVec3 = new Vec3(1, 0, 0);
  var plusYVec3 = new Vec3(0, 1, 0);

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
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      handbrake: 0
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

    var accel = input.forward;
    var brake = input.back;

    // We estimate what the engine speed would be at a different gear, and see
    // if it would provide more torque.
    var engineAngVel = vehicle.engineAngVel;
    var currentPower = getEnginePower(vehicle.engineAngVel, powerband);
    var currentTorque = currentPower * vehicle.gearRatios[output.gear] / vehicle.engineAngVel;
    if (this.shiftTimer <= 0) {
      if (output.clutch && output.gear >= 1) {
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
        } else if (brake && vehicle.differentialAngVel < 1) {
          output.gear = -1;
          this.shiftTimer = MIN_TIME_BETWEEN_SHIFTS;
        }
      } else if (output.gear == -1) {
        if (accel) {
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

    output.throttle = PULLTOWARD(output.throttle, accel,
        delta * THROTTLE_RESPONSE);
    output.brake = PULLTOWARD(output.brake, brake,
        delta * BRAKE_RESPONSE);
    output.handbrake = PULLTOWARD(output.handbrake, input.handbrake,
        delta * HANDBRAKE_RESPONSE);
    output.desiredTurnPos = PULLTOWARD(output.desiredTurnPos, input.left - input.right,
        delta * TURN_RESPONSE);

    // Disengage clutch when using handbrake.
    output.clutch = 1;
    output.clutch *= (output.handbrake < 0.5) ? 1 : 0;
  };

  exports.Vehicle = function(sim, config) {
    this.sim = sim;
    // It's important that we add ourselves before our rigid bodies, so that we
    // get ticked first each frame.
    sim.addObject(this);

    this.cfg = config;

    this.body = new psim.RigidBody(sim);
    this.body.setMassCuboid(
        config.mass,
        Vec3FromArray(config.dimensions).multiplyScalar(0.5));

    this.wheelTurnPos = -1;
    this.wheelTurnVel = 0;
    this.totalDrive = 0;

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

    this.wheels = [];
    for (var w = 0; w < config.wheels.length; ++w) {
      var wheel = this.wheels[w] = {};
      wheel.cfg = config.wheels[w];
      wheel.pos = new Vec3(
        wheel.cfg.pos[0] - config.center[0],
        wheel.cfg.pos[1] - config.center[1],
        wheel.cfg.pos[2] - config.center[2]);
      wheel.ridePos = 0;
      wheel.rideVel = 0;
      wheel.spinPos = 0;
      wheel.spinVel = 0;
      wheel.frictionForce = new Vec2();
      this.totalDrive += wheel.cfg.drive || 0;
    }

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
      newOri = ninetyDeg.multiplySelf(newOri);

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
        pos: body.pos.clone().addSelf(posOffset),
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

    if (this.body.oriMat.elements[6] <= 0.1 ||
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
      differentialAngVel += wheel.spinVel * (wheel.cfg.drive || 0);
      wheelLateralForce += wheel.frictionForce.x;
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
      wheel.spinVel += 0.13 * wheelTorque * delta;
      var brake =
          controls.brake * (wheel.cfg.brake || 0) +
          controls.handbrake * (wheel.cfg.handbrake || 0);
      if (brake > 0) {
        wheel.spinVel = MOVETOWARD(wheel.spinVel, 0, brake * delta);
      }
    }

    (function() {
      // TODO: Use real clip geometry instead of just points.
      // TODO: Pre-alloc worldPts.
      var worldPts = [];
      this.clips.forEach(function(clip) {
        var pt = this.body.getLocToWorldPoint(clip.pos).clone();
        pt.radius = clip.radius;
        worldPts.push(pt);
      }, this);
      var list = new collision.SphereList(worldPts);
      var contacts = this.sim.collideSphereList(list);
      contacts.forEach(this.contactResponse, this);
    }).call(this);

    var wheelTurnVelTarget =
        (controls.desiredTurnPos - this.wheelTurnPos) * 300 +
        this.wheelTurnVel * -10.0 +
        wheelLateralForce * -0.005;
    wheelTurnVelTarget = CLAMP(wheelTurnVelTarget, -8, 8);
    this.wheelTurnVel = PULLTOWARD(this.wheelTurnVel,
                                   wheelTurnVelTarget,
                                   delta * 10);
    this.wheelTurnPos += this.wheelTurnVel * delta;
    this.wheelTurnPos = CLAMP(this.wheelTurnPos, -1, 1);
    for (c = 0; c < this.cfg.wheels.length; ++c) {
      this.tickWheel(this.wheels[c], delta);
    }

    this.engineAngVelSmoothed = PULLTOWARD(
        this.engineAngVelSmoothed, this.engineAngVel, delta * 20);
  };

  var tmpBasis = { u: new Vec3(), v: new Vec3(), w: new Vec3() };
  var getSurfaceBasis = function(normal, right) {
    // TODO: Return a matrix type.
    tmpBasis.w.copy(normal);  // Assumed to be normalized.
    tmpBasis.v.cross(normal, right);
    tmpBasis.v.normalize();
    tmpBasis.u.cross(tmpBasis.v, normal);
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

    // Disabled because it sounds a bit glitchy.
//    this.skidLevel += Math.sqrt(contactVelSurf.x * contactVelSurf.x +
//                                contactVelSurf.y * contactVelSurf.y);

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

      if (leng > testFriction)
        friction.multiplyScalar(maxFriction / leng);

      // Not bothering to clone at this point.
      var force = surf.w.multiplyScalar(perpForce);
      force.addSelf(surf.u.multiplyScalar(friction.x));
      force.addSelf(surf.v.multiplyScalar(friction.y));

      this.body.addForceAtPoint(force, contactPoint);

      this.crashLevel = Math.max(this.crashLevel, perpForce);
    }
  };

  exports.Vehicle.prototype.tickWheel = function(wheel, delta) {
    var suspensionForce = wheel.ridePos * SUSP_CONSTANT;
    wheel.frictionForce.set(0, 0);

    // F = m.a, a = F / m
    wheel.rideVel -= suspensionForce / WHEEL_MASS * delta;
    // We apply suspension damping semi-implicitly.
    wheel.rideVel *= 1 / (1 + SUSP_DAMPING * delta);
    wheel.ridePos += wheel.rideVel * delta;

    wheel.spinPos += wheel.spinVel * delta;
    wheel.spinPos -= Math.floor(wheel.spinPos / TWOPI) * TWOPI;

    // TICK STUFF ABOVE HERE

    var clipPos = this.body.getLocToWorldPoint(wheel.pos);

    // TODO: Try moving along radius instead of straight down?
    clipPos.z += wheel.ridePos - wheel.cfg.radius;
    var contactVel = this.body.getLinearVelAtPoint(clipPos);
    var contacts = this.sim.collidePoint(clipPos);
    for (var c = 0; c < contacts.length; ++c) {
      var contact = contacts[c];
      var surf = getSurfaceBasis(contact.normal,
                                 this.getWheelRightVector(wheel));

      // Local velocity in surface space.
      var contactVelSurf = tmpVec3a.set(
          contactVel.dot(surf.u),
          contactVel.dot(surf.v),
          contactVel.dot(surf.w));

      contactVelSurf.y += wheel.spinVel * wheel.cfg.radius;

      this.skidLevel += Math.sqrt(contactVelSurf.x * contactVelSurf.x +
                                  contactVelSurf.y * contactVelSurf.y);

      // Damped spring model for perpendicular contact force.
      var perpForce = suspensionForce - contactVelSurf.z * CLIP_DAMPING;
      wheel.ridePos += contact.depth;

      if (wheel.ridePos > SUSP_MAX) {
        // Suspension has bottomed out. Switch to hard clipping.
        var overDepth = wheel.ridePos - SUSP_MAX;

        wheel.ridePos = SUSP_MAX;
        wheel.rideVel = 0;

        perpForce = contact.depth * CLIP_CONSTANT -
                    contactVelSurf.z * CLIP_DAMPING;
      }

      if (wheel.rideVel < -contactVelSurf.z)
        wheel.rideVel = -contactVelSurf.z;

      // Make sure the objects are pushing apart.
      if (perpForce > 0) {
        // TODO: Reexamine this friction algorithm.
        var friction = tmpVec2a.set(-contactVelSurf.x, -contactVelSurf.y).
            multiplyScalar(3000);

        var maxFriction = perpForce * FRICTION_DYNAMIC_WHEEL;
        var testFriction = perpForce * FRICTION_STATIC_WHEEL;

        var leng = friction.length();

        if (leng > testFriction)
          friction.multiplyScalar(maxFriction / leng);

        wheel.frictionForce.addSelf(friction);

        // surf is corrupted by these calculations.
        var force = surf.w.multiplyScalar(perpForce);
        force.addSelf(surf.u.multiplyScalar(friction.x));
        force.addSelf(surf.v.multiplyScalar(friction.y));

        this.body.addForceAtPoint(force, clipPos);
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
    var left = this.body.oriMat.getColumnX().clone();
    var fwd = this.body.oriMat.getColumnZ();
    tmpWheelRight.set(
        left.x * cosTurn - fwd.x * sinTurn,
        left.y * cosTurn - fwd.y * sinTurn,
        left.z * cosTurn - fwd.z * sinTurn
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
