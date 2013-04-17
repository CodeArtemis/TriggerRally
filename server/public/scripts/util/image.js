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
    var Canvas = require('canvas');
    var fs = require('fs');
  }

  var util = require('util/util');
  var catmullRom = util.catmullRom;
  var catmullRomDeriv = util.catmullRomDeriv;

  var _assert = function(val, msg) {
    if (!val) throw new Error(msg || 'Assert failed.');
  };

  var _channels =
  exports.channels = function(buffer) {
    return buffer.data.length / buffer.width / buffer.height;
  };

  var _createBuffer =
  exports.createBuffer = function(buffer, width, height, channels, type) {
    buffer = buffer || {};
    buffer.width = width;
    buffer.height = height;
    buffer.data = new type(width * height * channels);
    return buffer;
  };

  var _ensureDims =
  exports.ensureDims = function(buffer, width, height, minChannels, defaultType) {
    if (!buffer.data ||
        buffer.width != width ||
        buffer.height != height ||
        _channels(buffer) < minChannels) {
      var type = defaultType, channels = minChannels;
      if (buffer.data) {
        type = buffer.data.constructor;
        channels = Math.max(channels, _channels(buffer));
      }
      _createBuffer(buffer, width, height, channels, type);
    }
  };

  var _wrap = function(x, lim) {
    return x - Math.floor(x / lim) * lim;
  };

  // TODO: Move to quiver? Unused?
  var _oneToOne = exports.oneToOne = function(fn) {
    return function(inputs, outputs, callback) {
      _assert(inputs.length === 1, 'Wrong number of inputs.');
      _assert(outputs.length === 1, 'Wrong number of outputs.');
      fn(inputs[0], outputs[0], callback);
    };
  };

  var _loadImageNode = function(url, callback) {
    var path = __dirname + url;
    fs.readFile(path, function(err, data) {
      if (err) callback(err);
      else {
        var img = new Canvas.Image();
        img.src = data;
        callback(null, img);
      }
    }.bind(this));
  };

  var _loadImageBrowser = function(url, callback) {
    if (!url) return callback("Empty image URL");
    var image = new Image();
    image.onload = callback.bind(null, null, image);
    image.src = url;
  };

  exports.imageFromUrl = function() {
    return _oneToOne(function(urlNode, imgObject, callback) {
      var load = inNode ? _loadImageNode : _loadImageBrowser;
      if (!urlNode.url) {
        console.error("imageFromUrl: Missing or empty URL");
        return callback();
      }
      load(urlNode.url, function(err, image) {
        if (err) return callback(err);
        // console.log("imageFromUrl: loaded " + urlNode.url);
        imgObject.img = image;
        callback();
      });
    });
  };

  exports.getImageData = function(params) {
    params = params || {};
    return function(ins, outs, callback) {
      _assert(ins.length === 1 && ins.length === 1);
      var image = ins[0].img;
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
      // TODO: Add dirty rectangle support.
      // Though this swap-buffer approach may be faster anyway.
      var data = ctx.getImageData(0, 0, cx, cy);
      outs[0].width = data.width;
      outs[0].height = data.height;
      outs[0].data = data.data;
      callback();
    };
  };

  // type: a JS array type, eg Float32Array.
  exports.changeType = function(type) {
    return function(ins, outs, callback) {
      _assert(ins.length === 1 && ins.length === 1);
      var src = ins[0], dst = outs[0];
      var channels = _channels(src);
      _createBuffer(outs[0], src.width, src.height, channels, type);
      var srcData = src.data, dstData = dst.data;
      for (var i = 0, l = srcData.length; i < l; ++i) {
        dstData[i] = srcData[i];
      }
      callback();
    };
  };

  exports.copyChannel = function(srcChannel, dstChannel) {
    srcChannel = srcChannel || 0;
    dstChannel = dstChannel || 0;
    return function(ins, outs, callback) {
      _assert(ins.length === 1 && ins.length === 1);
      var src = ins[0], dst = outs[0];
      var srcChannels = _channels(src);
      _assert(srcChannels > srcChannel);
      _ensureDims(dst, src.width, src.height, dstChannel + 1, Uint8Array);
      var srcData = src.data, dstData = dst.data;
      var dstChannels = _channels(dst);
      var minX = 0, minY = 0, maxX = src.width, maxY = src.height;
      var sX, sY, srcPtr, dstPtr;
      for (sY = minY; sY < maxY; ++sY) {
        srcPtr = (sY * src.width) * srcChannels + srcChannel;
        dstPtr = (sY * dst.width) * dstChannels + dstChannel;
        for (sX = minX; sX < maxX; ++sX) {
          dstData[dstPtr] = srcData[srcPtr];
          srcPtr += srcChannels;
          dstPtr += dstChannels;
        }
      }
      callback();
    };
  };

  exports.unpack16bit = function(dstChannel) {
    dstChannel = dstChannel || 0;
    return function(ins, outs, callback, dirty) {
      _assert(ins.length === 1 && ins.length === 1);
      var src = ins[0], dst = outs[0];
      var srcChannels = _channels(src);
      _assert(srcChannels >= 2);
      _ensureDims(dst, src.width, src.height, 1, Uint16Array);
      var srcData = src.data, dstData = dst.data;
      var dstChannels = _channels(dst);
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
        dstPtr = (sY * dst.width) * dstChannels + dstChannel;
        for (sX = minX; sX < maxX; ++sX) {
          dstData[dstPtr] = srcData[srcPtr] + srcData[srcPtr + 1] * 256;
          srcPtr += srcChannels;
          dstPtr += dstChannels;
        }
      }
      callback();
    };
  };

  exports.derivatives = function(multiply, add, srcChannel) {
    srcChannel = srcChannel || 0;
    return function(ins, outs, callback) {
      _assert(ins.length === 1 && ins.length === 1);
      var src = ins[0], dst = outs[0];
      // TODO: Implement different-sized map conversion.
      _ensureDims(dst, src.width, src.height, 1, Uint8Array);
      var cx = src.width, cy = src.height;
      var srcData = src.data, dstData = dst.data;
      var srcChannels = _channels(src);
      var dstChannels = _channels(dst);
      var x, y, dstPtr, derivX, derivY;
      var h = new Float32Array(4);
      for (y = 0; y < cy; ++y) {
        for (x = 0; x < cx; ++x) {
          h[0] = srcData[(_wrap(x - 1, cx) +       y          * cx) * srcChannels + srcChannel];
          h[1] = srcData[(_wrap(x + 1, cx) +       y          * cx) * srcChannels + srcChannel];
          h[2] = srcData[(      x          + _wrap(y - 1, cy) * cx) * srcChannels + srcChannel];
          h[3] = srcData[(      x          + _wrap(y + 1, cy) * cx) * srcChannels + srcChannel];
          derivX = (h[1] - h[0]) * 0.5;
          derivY = (h[3] - h[2]) * 0.5;
          dstPtr = (y * cx + x) * dstChannels;
          dstData[dstPtr + 0] = derivX * multiply + add;
          dstData[dstPtr + 1] = derivY * multiply + add;
        }
      }
      callback();
    };
  };

  exports.catmullRomDerivatives = function(multiply, add) {
    return function(ins, outs, callback) {
      _assert(ins.length === 1 && ins.length === 1);
      var src = ins[0], dst = outs[0];
      // TODO: Implement different-sized map conversion.
      _ensureDims(dst, src.width, src.height, 1, Uint8Array);
      var cx = src.width, cy = src.height;
      var srcData = src.data, dstData = dst.data;
      var srcChannels = _channels(src);
      var dstChannels = _channels(dst);
      var x, y, i, x2, y2, derivX, derivY;
      var h = new Float32Array(16);
      for (y = 0; y < cy; ++y) {
        for (x = 0; x < cx; ++x) {
          i = 0;
          if (x < 1 || x > cx - 3 || y < 1 || y > cy - 3) {
            for (y2 = -1; y2 <= 2; ++y2) {
              for (x2 = -1; x2 <= 2; ++x2) {
                h[i++] = srcData[(_wrap(x + x2, cx) + _wrap(y + y2, cy) * cx) * srcChannels];
              }
            }
          } else {
            for (y2 = -1; y2 <= 2; ++y2) {
              for (x2 = -1; x2 <= 2; ++x2) {
                h[i++] = srcData[(x + x2 + (y + y2) * cx) * srcChannels];
              }
            }
          }
          // TODO: Optimize these constant x catmullRom calls.
          // Or change this function to allow resampling.
          derivX = catmullRomDeriv(
              catmullRom(h[ 0], h[ 4], h[ 8], h[12], 0.5),
              catmullRom(h[ 1], h[ 5], h[ 9], h[13], 0.5),
              catmullRom(h[ 2], h[ 6], h[10], h[14], 0.5),
              catmullRom(h[ 3], h[ 7], h[11], h[15], 0.5),
              0.5);
          derivY = catmullRomDeriv(
              catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], 0.5),
              catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], 0.5),
              catmullRom(h[ 8], h[ 9], h[10], h[11], 0.5),
              catmullRom(h[12], h[13], h[14], h[15], 0.5),
              0.5);
          i = (y * cx + x) * dstChannels;
          dstData[i + 0] = Math.max(0, Math.min(255, derivX * multiply + add));
          dstData[i + 1] = Math.max(0, Math.min(255, derivY * multiply + add));
        }
      }
      callback();
    };
  };
});
