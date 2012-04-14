/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'recorder';

(function(exports) {
  var _ = this._ || require('underscore');
  var pubsub = this.pubsub || require('./pubsub');

  // Observes and records object state in an efficient format.
  exports.StateRecorder = function(object, keys, freq) {
    this.timeline = [];
    this.keys = keys;
    this.keyMap = generateKeyMap(keys);
    this.freqCount = 0;
    this.index = 0;
    this.freq = freq;
    this.object = object;
    this.lastState = null;
    this.lastDiff = null;
  };

  exports.StateRecorder.prototype.observe = function() {
    if (this.freq) {
      if (++this.freqCount != this.freq) return;
      this.freqCount = 0;
    }
    var newState = filterObject(this.object, this.keys);
    if (this.lastState) {
      // Repeat observation.
      var stateDiff = objDiff(newState, this.lastState);
      if (!_.isEmpty(stateDiff)) {
        // Push the LAST state onto the timeline.
        var remapped = remapKeys(this.lastDiff, this.keyMap);
        this.timeline.push([this.index, remapped]);
        // Store the diff for next time.
        this.lastDiff = stateDiff;
        this.lastState = newState;
        this.index = 0;
      }
    } else {
      // Store the full state for the first observation.
      this.lastDiff = this.lastState = newState;
    }
    ++this.index;
  };

  // Serializing adds an extra record to the timeline.
  exports.StateRecorder.prototype.serialize = function() {
    var reverseMap = {};
    for (var k in this.keyMap) reverseMap[this.keyMap[k]] = k;
    var remapped = remapKeys(this.lastDiff, this.keyMap);
    this.timeline.push([this.index, remapped]);
    this.lastDiff = {};
    this.index = 0;
    return {
      freq: this.freq,
      keyMap: reverseMap,
      timeline: this.timeline
    };
  };

  exports.StatePlayback = function(object, serialized) {
    this.object = object;
    this.serialized = serialized;
    this.index = 0;
    this.freq = serialized.freq;
    this.freqCount = 0;
    this.nextSeg = 0;
    this.pubsub = new pubsub.PubSub();
  };

  exports.StatePlayback.prototype.step = function() {
    if (this.freq) {
      if (++this.freqCount != this.freq) return;
      this.freqCount = 0;
    }
    var seg = this.serialized.timeline[this.nextSeg];
    if (seg) {
      applyDiff(this.object, seg[1], this.serialized.keyMap);
      if (++this.index >= seg[0]) {
        this.index = 0;
        if (++this.nextSeg >= this.serialized.timeline.length) {
          this.pubsub.publish('complete');
        }
      }
    }
  };

  // Returns only values in a that differ from those in b.
  // a and b must have the same attributes.
  function objDiff(a, b) {
    var changed = {};
    for (var k in a) {
      aVal = a[k];
      if (_.isArray(aVal)) {
        // TODO: Actually diff arrays.
        changed[k] = a[k];
      } else if (typeof aVal === 'object') {
        var c = objDiff(aVal, b[k]);
        if (!_.isEmpty(c)) {
          changed[k] = c;
        }
      } else {
        if (aVal !== b[k]) changed[k] = aVal;
      }
    }
    return changed;
  }

  function applyDiff(obj, diff, keyMap) {
    if (_.isArray(diff)) {
      diff.forEach(function(el, index) {
        // No remapping for array indices.
        obj[index] = applyDiff(obj[index], el, keyMap);
      });
      return obj;
    } else if (typeof diff === 'object') {
      _.each(diff, function(val, key) {
        obj[keyMap[key]] = applyDiff(obj[keyMap[key]], val, keyMap);
      });
      return obj;
    } else {
      return parseFloat(diff);
    }
  }

  function generateKeyMap(keys) {
    var keyMap = {};
    var nextKey = 0;

    function process(keys) {
      _.each(keys, function(val, key) {
        if (!(key in keyMap)) {
          keyMap[key] = (nextKey++).toString(36);
        }
        if (_.isArray(val)) {
          process(val[0]);
        } else if (typeof val === 'object') {
          process(val);
        }
      });
    };
    process(keys);
    return keyMap;
  };

  function remapKeys(object, keyMap) {
    if (_.isArray(object)) {
      var remapped = [];
      object.forEach(function(el) {
        remapped.push(remapKeys(el, keyMap));
      });
      return remapped;
    } else if (typeof object === 'object') {
      var remapped = {};
      _.each(object, function(val, objKey) {
        var key = keyMap[objKey];
        remapped[key] = remapKeys(val, keyMap);
      });
      return remapped;
    } else {
      return object;
    }
  };

  // a and b must have the same attributes.
  function objEqual(a, b) {
    for (var k in a) {
      if (typeof a[k] === 'object') {
        if (!objEqual(a[k], b[k])) return false;
      } else {
        if (a[k] !== b[k]) return false;
      }
    }
    return true;
  }

  var filterObject = function(obj, keys) {
    if (_.isArray(keys)) {
      var subKeys = keys[0];
      var result = [];
      obj.forEach(function(el) {
        result.push(filterObject(el, subKeys));
      });
      return result;
    } else if (typeof keys === 'object') {
      var result = {};
      _.each(keys, function(val, key) {
        result[key] = filterObject(obj[key], val);
      });
      return result;
    } else {
      // TODO: Experiment with rounding methods.
      return obj.toFixed(keys);
    }
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
