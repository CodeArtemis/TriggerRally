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

  var getUniqueId = (function() {
    var nextId = 0;
    return function() {
      return ++nextId;
    };
  })();

  quiver.Lock = function(concurrency) {
    concurrency = concurrency || 1;
    this.queue = new async.queue(function(task, callback) {
      task(callback);
    }, concurrency);
  };

  quiver.Lock.prototype.acquire = function(callback) {
    this.queue.push(callback);
  };

  quiver.connect = function() {
    var prevNodes, prevOp;
    var i, arg, anonNodes;

    function connectOperation(op) {
      if (prevOp) {
        connectNodes(prevNodes)
        // Create an anonymous intermediate node.
        prevNodes = [new quiver.Node()];
      }
      if (prevNodes) {
        op.addInNodes.apply(op, prevNodes);
      }
      prevOp = op;
    }

    function connectNodes(nodes) {
      if (prevOp) {
        prevOp.addOutNodes.apply(op, nodes);
        prevOp = null;
      }
      prevNodes = nodes;
    }

    for (i = 0; i < arguments.length; ++i) {
      arg = arguments[i];
      if (arg instanceof quiver.Operation) {
        connectOperation(arg);
      } else if (arg instanceof Function) {
        connectOperation(new quiver.Operation(arg));
      } else if (arg instanceof quiver.Node) {
        connectNodes([arg]);
      } else if (arg instanceof Array) {
        connectNodes(arg);
      } else if (arg instanceof Object) {
        connectNodes([new Node(arg)]);
      } else if (typeof arg === 'number') {
        anonNodes = [];
        while (arg--) anonNodes.push(new quiver.Node());
        connectNodes(anonNodes);
      } else {
        // Ignore unrecognized arguments.
        // Should this throw an error?
      }
    }
  };

  quiver.Operation = function(func) {
    this.id = getUniqueId();
    this.inNodes = [];
    this.outNodes = [];
    this.func = func;
    this.dirty = false;
    this.lock = new quiver.Lock();
    // Cached values for passing to func.
    this.ins = [];
    this.outs = [];
  };

  quiver.Operation.prototype.addInNode = function(node) {
    this.inNodes.push(node);
    this.ins.push(node.object);
    node._addOutOp(this);
  };

  quiver.Operation.prototype.addOutNode = function(node) {
    this.outNodes.push(node);
    this.outs.push(node.object);
    node._addInOp(this);
  };

  quiver.Operation.prototype.markDirty = function(visited) {
    visited = visited || {};
    if (!this.dirty) {
      this.dirty = true;
      for (var i = 0, l = this.outNodes.length; i < l; ++i) {
        this.outNodes[i].markDirty();
      }
    }
  };

  quiver.Operation.prototype.processIfDirty = function(callback) {
    this.lock.acquire(function(release) {
      if (this.dirty) {
        async.forEach(this.inNodes, function(inNode, cb) {
          inNode.get(cb);
        }, function(err) {
          this.func(this.ins, this.outs, callback);
          this.dirty = false;
          release();
        });
      } else {
        release();
      }
    });
  };

  quiver.Node = function(opt_object) {
    this.id = getUniqueId();
    this.object = opt_object || {};
    this.inOps = [];
    this.outOps = [];
  };

  quiver.Node.prototype._addInOp = function(op) {
    this.inOps.push(op);
  };

  quiver.Node.prototype._addOutOp = function(op) {
    this.outOps.push(op);
  };

  quiver.Node.prototype.markDirty = function() {
    for (var i = 0; l = this.outOps.length; i < l; ++i) {
      this.outOps[i].markDirty();
    });
  };

  quiver.Node.prototype.get = function(callback) {
    async.forEach(this.inOps, function(inOp, cb) {
      inOp.processIfDirty(cb);
    }, function(err) {
      callback(err, this.object);
    });
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
