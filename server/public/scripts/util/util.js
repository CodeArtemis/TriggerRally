/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE'
],
function(THREE) {
  var exports = {};

  var Vec3 = THREE.Vector3;
  var Quat = THREE.Quaternion;

  exports.TWOPI = Math.PI * 2;

  // TODO: Fix function caps. They vary for legacy reasons (C++ port).

  // Exponential decay towards target.
  exports.PULLTOWARD = function(val, target, delta) {
    return target + (val - target) / (1.0 + delta);
  };
  // Linear decay towards target.
  exports.MOVETOWARD = function(val, target, delta) {
    var moved;
    if (target < (moved = val - delta)) {
      return moved;
    } else if (target > (moved = val + delta)) {
      return moved;
    } else {
      return target;
    }
  };
  exports.INTERP = function(a, b, f) {
    return a + (b - a) * f;
  };
  exports.CLAMP = function(a, min, max) {
    return Math.min(Math.max(a, min), max);
  };
  exports.MAP_RANGE = function(value, premin, premax, postmin, postmax) {
    return (value - premin) * (postmax - postmin) / (premax - premin) + postmin;
  };
  exports.deadZone = function(value, zone) {
    if (value > zone)
      return exports.MAP_RANGE(value, zone, 1, 0, 1);
    else if (value < -zone)
      return exports.MAP_RANGE(value, -zone, -1, 0, -1);
    else
      return 0;
  };
  exports.cubic = function(value) {
    var val2 = value * value;
    return 3 * val2 - 2 * val2 * value;
  };
  exports.Vec3FromArray = function(arr) {
    return new Vec3(arr[0], arr[1], arr[2]);
  };
  exports.QuatFromEuler = function(angles) {
    var q = new Quat();
    q.setFromAxisAngle(new Vec3(1,0,0), angles.x);
    q.multiply(new Quat().setFromAxisAngle(new Vec3(0,1,0), angles.y));
    q.multiply(new Quat().setFromAxisAngle(new Vec3(0,0,1), angles.z));
    return q;
  };

  exports.KEYCODE = {
    BACKSPACE: 8,
    TAB: 9,
    ENTER: 13,
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    ESCAPE: 27,
    SPACE: 32,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    DELETE: 46,
    COMMA: 188,
    PERIOD: 190
  };
  (function() {
    for (var cc = 48; cc < 127; ++cc) {
      exports.KEYCODE[String.fromCharCode(cc)] = cc;
    }
  })();

  exports.CallbackQueue = function(callback) {
    this.callbacks = callback && [callback] || [];
  };

  exports.CallbackQueue.prototype.add = function(callback) {
    this.callbacks.push(callback);
  };

  exports.CallbackQueue.prototype.fire = function() {
    for (var i = 0; i < this.callbacks.length; ++i) {
      this.callbacks[i].apply(undefined, arguments);
    }
    this.callbacks = [];
  };

  exports.arraySlice = Function.prototype.call.bind(Array.prototype.slice);

  exports.catmullRom = function(pm1, p0, p1, p2, x) {
    var x2 = x * x;
    return 0.5 * (
      pm1 * x * ((2 - x) * x - 1) +
      p0 * (x2 * (3 * x - 5) + 2) +
      p1 * x * ((4 - 3 * x) * x + 1) +
      p2 * (x - 1) * x2
    );
  };

  exports.catmullRomDeriv = function(pm1, p0, p1, p2, x) {
    var x2 = x * x;
    return 0.5 * (
      pm1 * (4 * x - 3 * x2 - 1) +
      p0 * (9 * x2 - 10 * x) +
      p1 * (8 * x - 9 * x2 + 1) +
      p2 * (3 * x2 - 2 * x)
    );
  };

  exports.deepClone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  return exports;
});
