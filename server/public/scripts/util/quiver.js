// Copyright (C) 2012 jareiko / http://www.jareiko.net/

/*

[
  {
    name: "height-source"
    type: "imagedata"
  }
  {
    name: "tHeight"
    type: ""
  }
]

*/

define([
  'async'
], function(async) {
  var quiver = {};

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
  quiver.Lock = function() {
    this.queue = new async.queue(function(task, callback) {
      task(null, callback);
    }, 1);
  };

  quiver.Lock.prototype.acquire = function(callback) {
    this.queue.push(callback);
  };
  */

  quiver.Lock = function() {
    // The first callback in the queue is always the one currently holding the lock.
    this.queue = [];
  };

  // callback(release)
  quiver.Lock.prototype.acquire = function(callback) {
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

  quiver.Lock.prototype.isLocked = function() {
    return this.queue.length > 0;
  };

  quiver.Node = function(opt_payload) {
    this.payload = opt_payload || {};
    this.dirty = false;
    this.inputs = [];
    this.outputs = [];
    this.lock = new quiver.Lock();
    this.id = _getUniqueId();
  };

  quiver.Node.prototype.pushInputs = function() {
    this.inputs.push.apply(this.inputs, arguments);
  };

  quiver.Node.prototype.pushOutputs = function() {
    this.outputs.push.apply(this.outputs, arguments);
  };

  quiver.Node.prototype.markDirty = function(visited) {
    visited = visited || {};
    if (visited[this.id]) {
      throw new Error('Circular dependency detected.');
    }
    visited[this.id] = true;
    for (var i = 0; l = this.outputs.length; i < l; ++i) {
      this.outputs[i].markDirty(visited);
    });
  };

  // callback(err, release, payload)
  quiver.Node.prototype.acquire = function(callback) {
    this.lock.acquire(function(release) {
      if (this.dirty || this.payload instanceof function) {
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
              });
            } else {
              this.dirty = false;
              callback(null, releaseAll, this.payload);
            }
          }
        });
      } else {
        // This is a clean non-function Node, so we don't need to acquire inputs.
        callback(null, releaseAll, this.payload);
      }
    });
  };

  // callback(err, release, inputPayloads)
  quiver.Node.prototype._acquireInputs = function(callback) {
    var tasks = [], releaseCallbacks = [];
    var releaseAll = _callAll.bind(null, releaseCallbacks);
    for (var i = 0; l = this.inputs.length; i < l; ++i) {
      var input = this.inputs[i];
      task.push(function(cb) {
        input.acquire(function(err, release, payload) {
          releaseCallbacks.push(release);
          cb(err, payload);
        });
      });
    });
    async.parallel(tasks, function(err, inputPayloads) {
      if (err) {
        releaseAll();
        callback(err);
      } else {
        callback(null, releaseAll, inputPayloads);
      }
    });
  };

  quiver.connect = function() {
    var prevNodes = [];

    var coerceToNode = function(value) {
      if (value instanceof quiver.Node) {
        return value;
      } else {
        return new quiver.Node(value);
      }
    };

    var coerceToNodeArray = function(arr) {
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









  var inNode = (typeof Image === 'undefined');
  if (inNode) {
    // Running in Node.js.
    var Canvas = require('canvas');
  }

  function assert(val, msg) {
    if (!val) throw new Error(msg || 'Assert failed.');
  }

  function channels(buffer) {
    return buffer.data.length / buffer.width / buffer.height;
  }

  function ensureDims(buffer, width, height, channels, type) {
    if (!buffer.data ||
        buffer.width != width ||
        buffer.height != height) {
      buffer.width = width;
      buffer.height = height;
      buffer.data = new type(width * height * channels);
    }
  }

  function buffer2DFromImage(params) {
    params = params || {};
    return function(ins, outs) {
      assert(ins.length === 1, 'Wrong number of inputs.');
      assert(outs.length === 1, 'Wrong number of outputs.');
      var image = ins[0];
      var cx = image.width;
      var cy = image.height;
      var canvas;
      if (inNode) {
        canvas = new Canvas(cx, cy);
      } else {
        canvas = document.createElement('canvas');
        canvas.width = cx;
        canvas.height = cy;
      }
      var ctx = canvas.getContext('2d');
      if (params.flip) {
        ctx.translate(0, cy);
        ctx.scale(1, -1);
      }
      ctx.drawImage(image, 0, 0);
      var data = ctx.getImageData(0, 0, cx, cy);
      outs[0].width = data.width;
      outs[0].height = data.height;
      // TODO: Add dirty rectangle support.
      // This swap-buffer approach may be better anyway.
      outs[0].data = data.data;
    };
  }

  function unpack16bit() {
    return function(ins, outs, callback, dirty) {
      assert(ins.length === 1, 'Wrong number of inputs.');
      assert(outs.length === 1, 'Wrong number of outputs.');
      var src = ins[0], dst = outs[0];
      assert(src.width  === dst.width );
      assert(src.height === dst.height);
      var srcData = src.data, dstData = dst.data;
      var srcChannels = channels(src);
      assert(srcChannels >= 2);
      ensureDims(dst, src.width, src.height, 1, Uint16Array);
      var minX = 0, minY = 0, maxX = src.width, maxY = src.height;
      if (dirty) {
        minX = dirty.x;
        minY = dirty.y;
        maxX = minX + dirty.width;
        maxY = minY + dirty.height;
      }
      var sX, sY, srcPtr, dstPtr;
      for (sY = minY; sY < maxY; ++sY) {
        srcPtr = (sY * src.width) * srcChannels;
        dstPtr = (sY * dst.width);
        for (sX = minX; sX < maxX; ++sX) {
          dst[dstPtr] = src[srcPtr] + src[srcPtr + 1] * 256;
          srcPtr += srcChannels;
          dstPtr += 1;
        }
      }
      callback();
    }
  }

  src = new quiver.Node(img);
  var hmap = {};  // Shared object.
  hm1 = new quiver.Node(hmap);
  hm2 = new quiver.Node(hmap);
  surf = new quiver.Node();
  quiver.connect(src, buffer2DFromImage({flip:true}), unpack16bit(), hm1);
  quiver.connect(hm1, drawTrack(), [hm2, surf]);
  quiver.connect(hm2, derivatives(), surf);
  // or without connect:
  step = new quiver.Operation(buffer2DFromImage({flip:true}));
  step.addInNodes(src);
  step.addOutNodes(hm)

  hm.get(function(err, tHeight) {
    if (err) throw new Error(err);
  });

  /*
  Stuff to document and test:

  3-arg connect
  2-arg connect (op, [node, node])
  5-arg connect
  4-arg connect
  Creating two nodes with the same object
  Setup without connect?
  Async ops and locking
  */

  return quiver;
});
