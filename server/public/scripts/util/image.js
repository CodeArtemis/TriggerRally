// Copyright (C) 2012 jareiko / http://www.jareiko.net/

// Node/CommonJS compatibility.
var inNode = (typeof define === 'undefined');
if (inNode) {
  define = function(fn) {
    fn(require, exports, module);
  };
}

define(function(require, exports, module) {
  if (inNode) {
    // Running in Node.js.
    Canvas = require('canvas');
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

  exports.buffer2DFromImage = function(params) {
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

  exports.unpack16bit = function() {
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
});
