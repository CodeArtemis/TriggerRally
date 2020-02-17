/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
var moduleDef = function(require, exports, module) {
  const _ = require('underscore');

  // Observes and records object state in an efficient format.

  exports.StateSampler = class StateSampler {
    constructor(object, keys, freq, changeHandler) {
      this.object = object;
      this.keys = keys;
      if (freq == null) { freq = 1; }
      this.freq = freq;
      this.changeHandler = changeHandler;
      this.keyMap = generateKeyMap(keys);
      this.restart();
    }

    restart() {
      this.lastState = null;
      return this.counter = -1;
    }

    observe() {
      let stateDiff;
      ++this.counter;
      if ((this.counter % this.freq) !== 0) { return; }
      const newState = filterObject(this.object, this.keys);
      if (this.lastState) {
        // Store state difference for repeat observations.
        stateDiff = objDiff(newState, this.lastState);
        if (_.isEmpty(stateDiff)) { return; }
        this.lastState = newState;
      } else {
        // First observation.
        this.lastState = (stateDiff = newState);
      }
      const remapped = remapKeys(stateDiff, this.keyMap);
      this.changeHandler(this.counter, remapped);
      return this.counter = 0;
    }

    toJSON() {
      // freq: @freq  # No longer necessary to record this value.
      return {keyMap: _.invert(this.keyMap)};
    }
  };

  exports.StateRecorder = class StateRecorder {
    constructor(object, keys, freq) {
      this.object = object;
      this.keys = keys;
      this.freq = freq;
      this.restart();
    }

    restart() {
      let timeline;
      this.timeline = (timeline = []);
      const changeHandler = (offset, state) => timeline.push([offset, state]);
      return this.sampler = new exports.StateSampler(this.object, this.keys, this.freq, changeHandler);
    }

    observe() { return this.sampler.observe(); }

    toJSON() {
      return {
        keyMap: this.sampler.toJSON().keyMap,
        timeline: this.timeline
      };
    }
  };

  // # Records into a Backbone Collection.
  // class exports.CollectionRecorder
  //   constructor: (@collection, @object, @keys, @freq) ->
  //     @restart()
  //   restart: ->
  //     collection = @collection.reset()
  //     changeHandler = (offset, state) ->
  //       collection.add { offset, state }
  //     @sampler = new exports.StateSampler @object, @keys, @freq, changeHandler
  //   observe: -> @sampler.observe()

  exports.StatePlayback = class StatePlayback {
    constructor(object, saved) {
      this.object = object;
      this.saved = saved;
      this.restart();
    }

    restart() {
      // Set to -1 so that we advance to 0 and update object on first step.
      this.counter = -1;
      return this.currentSeg = -1;
    }

    step() {
      let duration, seg;
      const { timeline } = this.saved;
      ++this.counter;
      while ((seg = timeline[this.currentSeg + 1]) && ((duration = seg[0]) <= this.counter)) {
        ++this.currentSeg;
        applyDiff(this.object, timeline[this.currentSeg][1], this.saved.keyMap);
        this.counter -= duration;
      }
    }

    complete() { return (timeline[this.currentSeg + 1] != null); }
  };

  exports.StatePlaybackInterpolated = class StatePlaybackInterpolated {
    constructor(object, saved) {
      this.object = object;
      this.saved = saved;
      this.restart();
    }

    restart() {
      // Set to -1 so that we advance to 0 on first step.
      this.counter = -1;
      this.currentSeg = -1;
      return this.cache = {};
    }

    step() {
      let duration, nextSeg;
      const { timeline } = this.saved;
      ++this.counter;
      const { keyMap } = this.saved;
      while ((nextSeg = timeline[this.currentSeg + 1]) && ((duration = nextSeg[0]) <= this.counter)) {
        applyDiff(this.cache, nextSeg[1], keyMap);
        ++this.currentSeg;
        this.counter -= duration;
      }
      if (this.currentSeg < 0) { return; }
      const factor = this.counter / duration;
      if (nextSeg) {
        blendDiff(this.object, this.cache, nextSeg[1], keyMap, factor);
      } else {
        applyDiff(this.object, timeline[this.currentSeg][1], keyMap);
      }
    }

    complete() { return (timeline[this.currentSeg + 1] != null); }
  };

  // Returns only values in a that differ from those in b.
  // a and b must have the same attributes.
  var objDiff = function(a, b) {
    const changed = {};
    for (let k in a) {
      const aVal = a[k];
      if (_.isArray(aVal)) {
        // Always pass through arrays.
        // TODO: Actually diff arrays. _.isEqual?
        changed[k] = aVal;
      } else if (typeof aVal === 'object') {
        const c = objDiff(aVal, b[k]);
        if (!_.isEmpty(c)) { changed[k] = c; }
      } else {
        if (aVal !== b[k]) { changed[k] = aVal; }
      }
    }
    return changed;
  };

  var applyDiff = function(obj, diff, keyMap) {
    if (_.isArray(diff)) {
      if (obj == null) { obj = []; }
      for (let index = 0; index < diff.length; index++) {
        // No remapping for array indices.
        const el = diff[index];
        obj[index] = applyDiff(obj[index], el, keyMap);
      }
    } else if (_.isObject(diff)) {
      if (obj == null) { obj = {}; }
      for (let key in diff) {
        const val = diff[key];
        const mapped = keyMap[key];
        obj[mapped] = applyDiff(obj[mapped], val, keyMap);
      }
    } else {
      obj = parseFloat(diff);
    }
    return obj;
  };

  var blendDiff = function(obj, lastState, diff, keyMap, factor) {
    if (_.isArray(diff)) {
      for (let index = 0; index < diff.length; index++) {
        // No remapping for array indices.
        const el = diff[index];
        obj[index] = blendDiff(obj[index], lastState[index], el, keyMap, factor);
      }
    } else if (_.isObject(diff)) {
      for (let key in diff) {
        const val = diff[key];
        const mapped = keyMap[key];
        obj[mapped] = blendDiff(obj[mapped], lastState[mapped], val, keyMap, factor);
      }
    } else {
      const target = parseFloat(diff);
      obj = lastState + ((target - lastState) * factor);
    }
    return obj;
  };

  var generateKeyMap = function(keys) {
    let process;
    const keyMap = {};
    let nextKey = 0;

    (process = keys =>
      (() => {
        const result = [];
        for (let key in keys) {
          const val = keys[key];
          if (!(key in keyMap)) { keyMap[key] = (nextKey++).toString(36); }
          if (_.isArray(val)) {
            result.push(process(val[0]));
          } else if (typeof val === 'object') {
            result.push(process(val));
          } else {
            result.push(undefined);
          }
        }
        return result;
      })()
    )(keys);

    return keyMap;
  };

  var remapKeys = function(object, keyMap) {
    if (_.isArray(object)) {
      return Array.from(object).map((el) => remapKeys(el, keyMap));
    } else if (_.isObject(object)) {
      const remapped = {};
      for (let objKey in object) {
        const val = object[objKey];
        remapped[keyMap[objKey]] = remapKeys(val, keyMap);
      }
      return remapped;
    } else {
      return object;
    }
  };

  var filterObject = function(obj, keys) {
    if (_.isArray(keys)) {
      const subKeys = keys[0];
      return Array.from(obj).map((el) => filterObject(el, subKeys));
    } else if (_.isObject(keys)) {
      const result = {};
      for (let key in keys) {
        const val = keys[key];
        result[key] = filterObject(obj[key], val);
      }
      return result;
    } else {
      // keys is the precision value.
      // TODO: Experiment with rounding methods.
      // Also strip trailing .0s
      return obj.toFixed(keys).replace(/\.0*$/, '');
    }
  };

  return exports;
};

if (typeof define !== 'undefined' && define !== null) {
  define(moduleDef);
} else if (typeof exports !== 'undefined' && exports !== null) {
  moduleDef(require, exports, module);
}
