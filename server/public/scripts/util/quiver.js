/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Copyright (C) 2012 jareiko / http://www.jareiko.net/

var moduleDef = function(require, exports, module) {
  const _ = require('underscore');
  const async = require("async");

  const _getUniqueId = (function() {
    let nextId = 0;
    return () => ++nextId;
  })();

  const _pluck = (arr, property) => Array.from(arr).map((x) => x[property]);

  const _callAll = function(arr) {
    for (let x of Array.from(arr)) { x(); }
  };

  exports.wrapSync = fn =>
    function(...args) {
      const callback = args[-1];
      const otherArgs = args.slice(0, -1);
      const err = fn(...Array.from(otherArgs || []));
      return callback(err);
    }
  ;

  const _coerceToNode = function(value) {
    if (value instanceof exports.Node) {
      return value;
    } else if (value._quiverNode) {
      return value._quiverNode;
    } else {
      return new exports.Node(value);
    }
  };

  exports.Lock = class Lock {
    constructor() {
      // The first callback in the queue is holding the lock.
      this.queue = [];
    }

    // callback(release)
    acquire(callback) {
      const q = this.queue;
      var release = function() {
        q.shift();
        // Call the next waiting callback.
        if (q.length > 0) { return q[0](release); }
      };
      q.push(callback);
      if (q.length === 1) { callback(release); }
    }

    isLocked() {
      return this.queue.length > 0;
    }
  };

  const LockedSet = (exports.LockedSet = class LockedSet {
    constructor() {
      this.nodes = {};
    }

    // callback()
    acquireNode(node, callback) {
      if (this.nodes[node.id]) {
        callback();
      } else {
        node.lock.acquire(release => {
          this.nodes[node.id] = {
            node,
            release
          };
          return callback();
        });
      }
    }

    release() {
      for (let nodeId in this.nodes) {
        const node = this.nodes[nodeId];
        node.release();
      }
      this.nodes = {};
    }
  });

  exports.Node = class Node {
    constructor(payload) {
      if (payload == null) { payload = {}; }
      this.payload = payload;
      this.inputs = [];
      this.outputs = [];
      this.updated = false;
      this.lock = new exports.Lock();
      this.id = _getUniqueId();
      // It's probably not a good idea to attach multiple Nodes to the same
      // object, but if you do, the first one keeps the _quiverNode reference.
      if (!this.payload._quiverNode) { this.payload._quiverNode = this; }
    }

    pushInputs(...values) {
      for (let value of Array.from(values)) {
        this.inputs.push(_coerceToNode(value));
      }
    }

    pushOutputs(...values) {
      for (let value of Array.from(values)) {
        this.outputs.push(_coerceToNode(value));
      }
    }

    // Node, inputs and outputs should be locked before calling.
    execute(callback) {
      this.updated = true;
      if (this.payload instanceof Function) {
        const inputPayloads = _pluck(this.inputs, 'payload');
        const outputPayloads = _pluck(this.outputs, 'payload');
        this.payload(inputPayloads, outputPayloads, callback);
      } else {
        callback();
      }
    }
  };

  // callback()
  const _walk = (exports._walk = function(node, nodeInfo, lockedSet, callback, doIn, doOut) {
    lockedSet.acquireNode(node, function() {
      if (nodeInfo[node.id] == null) { nodeInfo[node.id] = {
        node,
        deps: []
      }; }
      const tasks = [];
      for (let inNode of Array.from(node.inputs)) { tasks.push(doIn(inNode, tasks)); }
      for (let outNode of Array.from(node.outputs)) { tasks.push(doOut(outNode, tasks)); }
      return async.parallel(tasks, function(err, results) {
        if (err) { throw err; }
        return callback();
      });
    });
  });

  // callback()
  var _walkOut = (exports._walkOut = (node, nodeInfo, lockedSet, callback) =>
    _walk(node, nodeInfo, lockedSet, callback,
      inNode => cb => lockedSet.acquireNode(inNode, cb) ,
      outNode => cb =>
        lockedSet.acquireNode(outNode, function() {
          const done = function() {
            nodeInfo[outNode.id].deps.push(node.id + "");
            return cb();
          };
          if (nodeInfo[outNode.id]) { return done(); } else {
            return _walkOut(outNode, nodeInfo, lockedSet, done);
          }
        })
      
     )
  );

  // callback()
  var _walkIn = (exports._walkIn = (node, nodeInfo, lockedSet, callback) =>
    _walk(node, nodeInfo, lockedSet, callback,
      inNode => cb =>
        lockedSet.acquireNode(inNode, function() {
          if (inNode.updated) {
            return cb();
          } else {
            nodeInfo[node.id].deps.push(inNode.id + "");
            if (nodeInfo[inNode.id]) { return cb(); } else {
              return _walkIn(inNode, nodeInfo, lockedSet, cb);
            }
          }
        })
       ,
      outNode => cb => lockedSet.acquireNode(outNode, cb)
     )
  );

  exports.push = function(node, callback) {
    const nodeInfo = {};
    const releases = [];
    const lockedSet = new LockedSet();
    const tasks = {};
    node = node instanceof exports.Node ? node : node._quiverNode;
    _walkOut(node, nodeInfo, lockedSet, function() {
      for (var nodeId in nodeInfo) {
        const info = nodeInfo[nodeId];
        (info =>
          tasks[nodeId] = info.deps.concat([
            cb =>
              _.defer(() => info.node.execute(cb))
            
          ])
        )(info);
      }
      return async.auto(tasks, function(err, results) {
        lockedSet.release();
        return (typeof callback === 'function' ? callback() : undefined);
      });
    });
  };

  exports.pull = function(node, callback) {
    const nodeInfo = {};
    const releases = [];
    const lockedSet = new LockedSet();
    const tasks = {};
    node = node instanceof exports.Node ? node : node._quiverNode;
    _walkIn(node, nodeInfo, lockedSet, function() {
      for (var nodeId in nodeInfo) {
        const info = nodeInfo[nodeId];
        (info =>
          tasks[nodeId] = info.deps.concat([
            cb =>
              _.defer(() => info.node.execute(cb))
            
          ])
        )(info);
      }
      return async.auto(tasks, function(err, results) {
        lockedSet.release();
        return (typeof callback === 'function' ? callback() : undefined);
      });
    });
  };

  exports.connect = function(...args) {
    const tasks = [];
    let prevNode = null;
    const ls = new LockedSet;
    for (let arg of Array.from(args)) {
      const node = _coerceToNode(arg);
      ((prevNode, node) =>
        tasks.push(cb =>
          ls.acquireNode(node, function() {
            if (prevNode) {
              prevNode.pushOutputs(node);
              node.pushInputs(prevNode);
            }
            return cb();
          })
        )
      )(prevNode, node);
      prevNode = node;
    }
    async.parallel(tasks, () => ls.release());
  };

  return exports;
};

if (typeof define !== 'undefined' && define !== null) {
  define(moduleDef);
} else if (typeof exports !== 'undefined' && exports !== null) {
  moduleDef(require, exports, module);
}
