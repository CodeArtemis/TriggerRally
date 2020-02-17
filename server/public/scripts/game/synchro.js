/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'util/pubsub'
], function(utilPubsub) {
  let Synchro;
  var filterObject = function(obj, keys) {
    if (_.isArray(keys)) {
      const subKeys = keys[0];
      return Array.from(obj).map((el) =>
        filterObject(el, subKeys));
    } else if (typeof keys === 'object') {
      const result = {};
      for (let key in keys) {
        const val = keys[key];
        result[key] = filterObject(obj[key], val);
      }
      return result;
    } else {
      // Assume number.
      // TODO: Experiment with rounding methods.
      return obj.toFixed(keys);
    }
  };

  // Returns only values in a that differ from those in b.
  // a and b must have the same attributes.
  // Arrays may (currently) only contain objects.
  var objDiff = function(a, b) {
    const diff = {};
    for (let k in a) {
      var c;
      const aVal = a[k];
      const bVal = b[k];
      if (_.isArray(aVal)) {
        let changed = false;
        c = [];
        for (let index = 0; index < aVal.length; index++) {
          const el = aVal[index];
          const r = objDiff(el, bVal[index]);
          if (!_.isEmpty(r)) { changed = true; }
          c.push(r);
        }
        if (changed) { diff[k] = c; }
      } else if (typeof aVal === 'object') {
        c = objDiff(aVal, bVal);
        if (!_.isEmpty(c)) { diff[k] = c; }
      } else {
        if (aVal !== bVal) { diff[k] = aVal; }
      }
    }
    return diff;
  };

  var applyDiff = function(obj, diff, keyMap) {
    if (_.isArray(diff)) {
      for (let index = 0; index < diff.length; index++) {
        // No remapping for array indices.
        const el = diff[index];
        obj[index] = applyDiff(obj[index], el, keyMap);
      }
      return obj;
    } else if (typeof diff === 'object') {
      let key, val;
      if (keyMap) {
        for (key in diff) {
          val = diff[key];
          obj[keyMap[key]] = applyDiff(obj[keyMap[key]], val, keyMap);
        }
      } else {
        for (key in diff) {
          val = diff[key];
          obj[key] = applyDiff(obj[key], val);
        }
      }
      return obj;
    } else {
      return parseFloat(diff);
    }
  };

  const KEYS = {
    nextCpIndex: 0,
    vehicle: {
      body: {
        pos: {x:3,y:3,z:3},
        ori: {x:3,y:3,z:3,w:3},
        linVel: {x:3,y:3,z:3},
        angMom: {x:3,y:3,z:3}
      },
      wheels: [{
        spinVel: 1
      }],
      engineAngVel: 3,
      controller: {
        input: {
          forward: 0,
          back: 0,
          left: 0,
          right: 0,
          handbrake: 0
        }
      }
    }
  };

  // TODO: Remap keys (a la recorder.js) to reduce wire bandwidth.

  return {
    Synchro: (Synchro = class Synchro {
      constructor(game) {
        this.game = game;
        this.socket = io.connect('/');

        const pubsub = new utilPubsub.PubSub();
        this.on = pubsub.subscribe.bind(pubsub);

        game.on('addvehicle', (vehicle, progress) => {
          if (!vehicle.cfg.isRemote) {
            this._sendVehicleUpdates(vehicle, progress);
          }
        });

        const progresses = {};

        this.socket.on('addcar', function(data) {
          const { wireId, config } = data;
          if ((config != null) && (progresses[wireId] == null)) {
            return game.addCarConfig(config, progress => progresses[wireId] = progress);
          }
        });

        this.socket.on('deletecar', function(data) {
          const { wireId } = data;
          if (progresses[wireId] != null) {
            game.deleteCar(progresses[wireId]);
            return delete progresses[wireId];
          }
      });

        this.socket.on('s2c', function(data) {
          const { wireId, carstate } = data;
          const progress = progresses[wireId];
          // TODO: Blend in new state.
          if (progress != null) { applyDiff(progress, carstate); }
        });
      }

      _sendVehicleUpdates(vehicle, progress) {
        // We will send updates about this car to the server.
        this.socket.emit('c2s',
          {config: vehicle.cfg});
        let lastState = null;
        setInterval(() => {
          const state = filterObject(progress, KEYS);
          if (lastState != null) {
            const diff = objDiff(state, lastState);
            lastState = state;
            if (!_.isEmpty(diff)) {
              return this.socket.emit('c2s',
                {carstate: diff});
            }
          } else {
            return lastState = state;
          }
        }
        , 200);
      }
    })
  };
});
