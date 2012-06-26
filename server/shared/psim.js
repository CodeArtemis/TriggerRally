/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'psim';

(function(exports) {
  var THREE = this.THREE || require('../THREE');
  var pubsub = this.pubsub || require('./pubsub');
  var util = this.util || require('./util');

  var Vec3 = THREE.Vector3;
  var Quat = THREE.Quaternion;

  var QuatFromEuler = util.QuatFromEuler;
  
  var tmpVec3a = new Vec3();
  var tmpVec3b = new Vec3();

  exports.Sim = function(timeStep) {
    this.gravity = new Vec3(0, 0, -9.81);
    //this.gravity = new Vec3(0, -1, 0);
    this.objects = [];
    this.staticObjects = [];  // Just used for clipping.
    this.cylinders = [];
    this.cylLists = {};
    this.time = 0;
    this.timeAccumulator = 0;
    this.timeStep = timeStep;
    this.alpha = 0;
    this.pubsub = new pubsub.PubSub();
  };

  exports.Sim.prototype.addObject = function(obj) {
    this.objects.push(obj);
  };

  exports.Sim.prototype.addStaticObject = function(obj) {
    this.staticObjects.push(obj);
  };

  exports.Sim.prototype.tick = function(delta) {
    // We can't step backwards.
    if (delta <= 0) return;
    // Cap to 10 FPS.
    if (delta > 0.1) delta = 0.1;
    var timeStep = this.timeStep;

    this.timeAccumulator += delta;
    while (this.timeAccumulator >= timeStep) {
      this.timeAccumulator -= timeStep;
      this.step();
    };
    // Cache interpolated state.
    this.alpha = this.timeAccumulator / timeStep;
    this.objects.forEach(function(object) {
      if (typeof object.getState === 'function') {
        object.interp = object.getState();
      }
    });
  };

  exports.Sim.prototype.step = function() {
    this.pubsub.publish('step');
    this.integrate(this.timeStep);
    this.time += this.timeStep;
  };

  exports.Sim.prototype.interpolatedTime = function() {
    return this.time + this.timeAccumulator;
  };

  exports.Sim.prototype.integrate = function(delta) {
    // TODO: Automatically recordState as part of object tick?
    this.objects.forEach(function(object) {
      if (typeof object.recordState === 'function') {
        object.recordState();
      }
    });
    this.objects.forEach(function(object) {
      object.tick(delta);
    });
  };

  exports.Sim.prototype.collide = function(pt) {
    var contacts = [];
    this.staticObjects.forEach(function(obj) {
      if (obj.getContact) {
        var contact = obj.getContact(pt);
        if (contact) {
          tmpVec3a.sub(contact.surfacePos, pt)
          contact.depth = tmpVec3a.dot(contact.normal);
          if (contact.depth > 0) {
            contacts.push(contact);
          }
        }
      }
    });
    return contacts;
  };

  // Collide a dynamic hull against registered static objects.
  exports.Sim.prototype.collideSphereHull = function(hull) {
    var contactsArrays = [];
    // Collide points first.
    var tmpVec3 = new Vec3();
    var offset = new Vec3(0, 0, -hull.radius).addSelf(hull.bounds.center);
    hull.points.forEach(function(point) {
      tmpVec3.add(point, offset);
      contactsArrays.push(this.collide(tmpVec3));
    }, this);
    // Then collide hulls.
    this.staticObjects.forEach(function(obj) {
      if (obj.collideSphereHull) {
        contactsArrays.push(obj.collideSphereHull(hull));
      }
    });
    return [].concat.apply([], contactsArrays);
  };

  exports.Sim.prototype.collideLineSegment = function(pt1, pt2) {
    var i, contacts = [];
    var direc = pt2.clone().subSelf(pt1);
    var leng = direc.length();
    direc.divideScalar(leng);
    var cylVec = new Vec3(0,1,0);
    var cross = new Vec3().cross(cylVec, direc);
    var lambda1 = cross.dot(pt1);
    // TODO: Use a hash map to optimize collision tests.
    // TODO: Migrate to ammo. This is messy.
    for (i = 0; i < this.cylinders.length; ++i) {
      var cyl = this.cylinders[i];
      var lambda2 = cross.dot(cyl);
      if (Math.abs(lambda1 - lambda2) < cyl.radius) {
        var dlambdac = direc.dot(cyl) - direc.dot(pt1);
        if (dlambdac > 0 && dlambdac < leng) {
          var ptOnLine = direc.clone().multiplyScalar(dlambdac).addSelf(pt1);
          tmpVec3a.sub(ptOnLine, cyl);
          var normal = tmpVec.subSelf(cylVec.clone().multiplyScalar(tmpVec3a.dot(cylVec)));
          normal.normalize();
          //var ptOnSurf = cylVec.multiplyScalar(cylVec.dot(ptOnLine)).
          //    addSelf(normal.clone().multiplyScalar(cyl.radius));
          var embedFactor = ptOnLine.clone().subSelf(cyl).dot(normal);
          var depth = cyl.radius - embedFactor;
          var contact = {
            normal: normal,
            surfacePos: ptOnLine.addSelf(normal.clone().multiplyScalar(depth)),
            depth: depth
          };
          contacts.push(contact);
        }
      }
    }
    return contacts;
  };

  exports.ReferenceFrame = function() {
    // Position in 3-space.
    this.pos = new Vec3();
    // Orientation.
    this.ori = new Quat();
    
    // Matrix forms of orientation.
    this.oriMat = new THREE.Matrix4();
    this.oriMatInv = new THREE.Matrix4();
  };

  exports.ReferenceFrame.prototype.updateMatrices = function() {
    this.ori.normalize();
    this.oriMat.setRotationFromQuaternion(this.ori);
    this.oriMatInv.copy(this.oriMat).transpose();
  };

  // Coordinate space transforms.
  var tmpVec3c = new Vec3();
  exports.ReferenceFrame.prototype.getLocToWorldVector = function(vec) {
    var v = tmpVec3c.copy(vec);
    this.oriMat.multiplyVector3(v);
    return v;
  };
  var tmpVec3d = new Vec3();
  exports.ReferenceFrame.prototype.getWorldToLocVector = function(vec) {
    var v = tmpVec3d.copy(vec);
    this.oriMatInv.multiplyVector3(v);
    return v;
  };
  var tmpVec3e = new Vec3();
  exports.ReferenceFrame.prototype.getLocToWorldPoint = function(pt) {
    var v = tmpVec3e.copy(pt);
    this.oriMat.multiplyVector3(v);
    v.addSelf(this.pos);
    return v;
  };
  var tmpVec3f = new Vec3();
  exports.ReferenceFrame.prototype.getWorldToLocPoint = function(pt) {
    var v = tmpVec3f.sub(pt, this.pos);
    this.oriMatInv.multiplyVector3(v);
    return v;
  };

  exports.RigidBody = function(sim) {
    exports.ReferenceFrame.call(this);

    this.sim = sim;
    sim.addObject(this);

    this.angMass = new Vec3();
    this.angMassInv = new Vec3();
    this.setMassCuboid(1, new Vec3(1,1,1));

    // Linear and angular velocity.
    this.linVel = new Vec3();
    this.angVel = new Vec3();

    // World space force accumulator, zeroed after each integration step.
    this.accumForce = new Vec3();
    // Local space torque accumulator, zeroed after each integration step.
    this.accumTorque = new Vec3();

    // Used for state recording.    
    this.old = {
      pos: new Vec3(),
      ori: new Quat(),
      linVel: new Vec3(),
      angVel: new Vec3()
    };
    this.recordState();
  };
  exports.RigidBody.prototype = Object.create(new exports.ReferenceFrame());

  exports.RigidBody.prototype.recordState = function() {
    // Copy current state so that we can refer to it later.
    this.old.pos.copy(this.pos);
    this.old.ori.copy(this.ori);
    this.old.linVel.copy(this.linVel);
    this.old.angVel.copy(this.angVel);
  };

  exports.RigidBody.prototype.getState = function() {
    var a = this.old, b = this, alpha = this.sim.alpha;
    return {
      pos: new Vec3(
          a.pos.x + (b.pos.x - a.pos.x) * alpha,
          a.pos.y + (b.pos.y - a.pos.y) * alpha,
          a.pos.z + (b.pos.z - a.pos.z) * alpha),
      ori: new Quat(
          a.ori.x + (b.ori.x - a.ori.x) * alpha,
          a.ori.y + (b.ori.y - a.ori.y) * alpha,
          a.ori.z + (b.ori.z - a.ori.z) * alpha,
          a.ori.w + (b.ori.w - a.ori.w) * alpha),
      linVel: new Vec3(
          a.linVel.x + (b.linVel.x - a.linVel.x) * alpha,
          a.linVel.y + (b.linVel.y - a.linVel.y) * alpha,
          a.linVel.z + (b.linVel.z - a.linVel.z) * alpha),
      angVel: new Vec3(
          a.angVel.x + (b.angVel.x - a.angVel.x) * alpha,
          a.angVel.y + (b.angVel.y - a.angVel.y) * alpha,
          a.angVel.z + (b.angVel.z - a.angVel.z) * alpha)
    };
  };

  exports.RigidBody.prototype.setMassCuboid = function(mass, radiusVec) {
    if (mass <= 0 ||
        radiusVec.x <= 0 ||
        radiusVec.y <= 0 ||
        radiusVec.z <= 0) return;

    this.mass = mass;
  
    // Hacked angular mass because we currently ignore its coordinate system.
    this.angMass.x = radiusVec.y * radiusVec.z;
    this.angMass.y = radiusVec.z * radiusVec.x;
    this.angMass.z = radiusVec.x * radiusVec.y;
    this.angMass.multiplyScalar(mass);
  
    this.angMassInv.x = 1 / this.angMass.x;
    this.angMassInv.y = 1 / this.angMass.y;
    this.angMassInv.z = 1 / this.angMass.z;
  };

  exports.RigidBody.prototype.getLinearVel = function() {
    return this.linVel;
  };
  
  exports.RigidBody.prototype.addForce = function(frc) {
    this.accumForce.addSelf(frc);
  };

  exports.RigidBody.prototype.addLocForce = function(frc) {
    this.addForce(this.getLocToWorldVector(frc));
  };

  exports.RigidBody.prototype.addForceAtPoint = function(frc, pt) {
    this.accumForce.addSelf(frc);
    var ptLoc = this.getWorldToLocPoint(pt);
    var frcLoc = this.getWorldToLocVector(frc);
    var torque = new Vec3().cross(ptLoc, frcLoc);
    this.addTorque(torque);
  };

  exports.RigidBody.prototype.addLocForceAtPoint = function(frc, pt) {
    this.addForceAtPoint(this.getLocToWorldVector(frc), pt);
  };

  exports.RigidBody.prototype.addForceAtLocPoint = function(frc, pt) {
    this.addForceAtPoint(frc, this.getLocToWorldPoint(pt));
  };

  exports.RigidBody.prototype.addLocForceAtLocPoint = function(frc, pt) {
    this.addForceAtPoint(this.getLocToWorldVector(frc),
                          this.getLocToWorldPoint(pt));
  };

  exports.RigidBody.prototype.addTorque = function(trq) {
    this.accumTorque.addSelf(trq);
  };

  exports.RigidBody.prototype.addLocTorque = function(trq) {
    this.addTorque(this.getLocToWorldVector(trq));
  };
  
  exports.RigidBody.prototype.getLinearVelAtPoint = function(pt) {
    var ptLoc = pt.clone().subSelf(this.pos);
    var angVel2 = this.getLocToWorldVector(this.angVel);
    var cross = tmpVec3a.cross(angVel2, ptLoc);
    return tmpVec3b.add(this.linVel, cross);
  };

  exports.RigidBody.prototype.tick = function(delta) {
    var linAccel = tmpVec3a.copy(this.accumForce).divideScalar(this.mass);
    linAccel.addSelf(this.sim.gravity);

    this.linVel.addSelf(linAccel.multiplyScalar(delta));

    this.pos.addSelf(tmpVec3a.copy(this.linVel).multiplyScalar(delta));

    var angAccel = tmpVec3a.multiply(this.accumTorque, this.angMassInv);
    this.angVel.addSelf(angAccel.multiplyScalar(delta));
  
    var angDelta = tmpVec3a.copy(this.angVel).multiplyScalar(delta);
    var angDeltaQuat = QuatFromEuler(angDelta);
    this.ori.multiplySelf(angDeltaQuat);
  
    this.accumForce.x = this.accumForce.y = this.accumForce.z = 0;
    this.accumTorque.x = this.accumTorque.y = this.accumTorque.z = 0;
  
    this.updateMatrices();
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
