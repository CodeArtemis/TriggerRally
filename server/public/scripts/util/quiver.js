// Copyright (C) 2012 jareiko / http://www.jareiko.net/

// Node/CommonJS compatibility.
if (typeof define === 'undefined') {
  define = function(fn) {
    fn(require, exports, module);
  };
}

define(function(require, exports, module) {
  var async = require('async');

  var _getUniqueId = (function() {
    var nextId = 0;
    return function() {
      return ++nextId;
    };
  })();

  var _pluck = function(arr, property) {
    var result = [], i, l;
    for (i = 0, l = arr.length; i < l; ++i) {
      result.push(arr[i][property]);
    }
    return result;
  }

  var _callAll = function(arr) {
    for (var i = 0, l = arr.length; i < l; ++i) {
      arr[i]();
    }
  }

  /*
  async's queue introduces latency with nextTick.
  exports.Lock = function() {
    this.queue = new async.queue(function(task, callback) {
      task(null, callback);
    }, 1);
  };

  exports.Lock.prototype.acquire = function(callback) {
    this.queue.push(callback);
  };
  */

  exports.Lock = function() {
    // The first callback in the queue is always the one currently holding the lock.
    this.queue = [];
  };

  // callback(release)
  exports.Lock.prototype.acquire = function(callback) {
    var q = this.queue;
    function release() {
      q.shift();
      if (q.length > 0) {
        // Call the next waiting callback.
        q[0](release);
      }
    }
    q.push(callback);
    if (q.length === 1) {
      callback(release);
    }
  };

  exports.Lock.prototype.isLocked = function() {
    return this.queue.length > 0;
  };

  exports.Node = function(opt_payload) {
    this.payload = opt_payload || {};
    this.dirty = true;
    this.inputs = [];
    this.outputs = [];
    this.lock = new exports.Lock();
    this.id = _getUniqueId();

    this.payload._quiverNode = this;
  };

  exports.Node.prototype.pushInputs = function() {
    this.inputs.push.apply(this.inputs, arguments);
  };

  exports.Node.prototype.pushOutputs = function() {
    this.outputs.push.apply(this.outputs, arguments);
  };

  exports.Node.prototype.markDirty = function(visited) {
    this.lock.acquire(function(release) {
      visited = visited || {};
      if (visited[this.id]) {
        release();
        throw new Error('Circular dependency detected.');
      }
      visited[this.id] = true;
      for (var i = 0, l = this.outputs.length; i < l; ++i) {
        this.outputs[i].markDirty(visited);
      }
      release();
    }.bind(this));
  };

  // callback(err, release, payload)
  exports.Node.prototype.acquire = function(callback) {
    this.lock.acquire(function(release) {
      if (this.dirty || this.payload instanceof Function) {
        // We need to acquire our inputs first.
        this._acquireInputs(function(err, releaseInputs, inputPayloads) {
          var releaseAll = function() {
            releaseInputs();
            release();
          }
          if (err) {
            releaseAll();
            callback(err);
          } else {
            if (this.payload instanceof Function) {
              var outputPayloads = _pluck(this.outputs, 'payload');
              this.payload(inputPayloads, outputPayloads, function(err) {
                if (err) {
                  releaseAll();
                  callback(err);
                } else {
                  this.dirty = false;
                  callback(null, releaseAll, true);
                }
              }.bind(this));
            } else {
              this.dirty = false;
              callback(null, releaseAll, this.payload);
            }
          }
        }.bind(this));
      } else {
        // This is a clean non-function Node, so we don't need to acquire inputs.
        callback(null, release, this.payload);
      }
    }.bind(this));
  };

  // callback(err, release, inputPayloads)
  exports.Node.prototype._acquireInputs = function(callback) {
    var tasks = [], releaseCallbacks = [];
    var releaseAll = _callAll.bind(null, releaseCallbacks);
    for (var i = 0, l = this.inputs.length; i < l; ++i) {
      var input = this.inputs[i];
      tasks.push(function(cb) {
        input.acquire(function(err, release, payload) {
          releaseCallbacks.push(release);
          cb(err, payload);
        });
      });
    }
    async.parallel(tasks, function(err, inputPayloads) {
      if (err) {
        releaseAll();
        callback(err);
      } else {
        callback(null, releaseAll, inputPayloads);
      }
    });
  };

  exports.connect = function() {
    var prevNodes = [];

    var coerceToNode = function(value) {
      if (value instanceof exports.Node) {
        return value;
      } else if (value._quiverNode) {
        return value._quiverNode;
      } else {
        return new exports.Node(value);
      }
    };

    var coerceToNodeArray = function(value) {
      if (value instanceof Array) {
        var result = [];
        for (var i = 0, l = value.length; i < l; ++i) {
          result.push(coerceToNode(value[i]));
        }
        return result;
      } else {
        return [coerceToNode(value)];
      }
    };

    var connectNodes = function(nodes) {
      prevNodes.forEach(function(prevNode) {
        prevNode.pushOutputs.apply(prevNode, nodes);
      });
      nodes.forEach(function(node) {
        node.pushInputs.apply(node, prevNodes);
      });
      prevNodes = nodes;
    };

    for (var i = 0, l = arguments.length; i < l; ++i) {
      var arg = arguments[i];
      connectNodes(coerceToNodeArray(arg));
    }
  };

  /*
  Stuff to document and test:

  3-arg connect
  2-arg connect (op, [node, node])
  5-arg connect
  4-arg connect
  Creating two nodes with the same object
  Setup without connect?
  Async ops and locking
  Nested pipelines
  */
});
