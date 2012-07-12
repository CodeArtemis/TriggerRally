/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'pterrain';

(function(exports) {
  var THREE = this.THREE || require('../THREE');

  var Vec3 = THREE.Vector3;

  var inNode = false;
  if (typeof Image === 'undefined') {
    // Running in node.
    inNode = true;
    var Canvas = require('canvas');
  }

  // TODO: Implement float buffer source.
  exports.ImageSource = function() {
    this.hmap = null;
    this.onload = [];
  };

  exports.ImageSource.prototype.load = function(url, callback) {
    if (inNode) {
      // TODO: Move this into a separate module that never gets delivered
      // to browser clients.
      // We know that the URL refers to a local file, so just read it.
      var path = __dirname + '/../public' + url;
      require('fs').readFile(path, function(err, data) {
        if (err) throw new Error(err);
        else {
          var img = new Canvas.Image();
          img.src = data;
          this.loadWithImage(img, callback);
        }
      }.bind(this));
    } else {
      var image = new Image();
      image.onload = this.loadWithImage.bind(this, image, callback);
      image.src = url;
    }
  };

  exports.ImageSource.prototype.loadWithImage = function(image, callback) {
    var cx = this.cx = image.width;
    var cy = this.cy = image.height;
    var canvas;
    if (inNode) {
      canvas = new Canvas(cx, cy);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = cx;
      canvas.height = cy;
    }
    var ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    var data = ctx.getImageData(0, 0, cx, cy).data;
    var heightMap = new Float32Array(cx * cy);

    for (y = 0; y < cy; ++y) {
      var wrapy = y % cy;
      if (wrapy < 0) wrapy += cy;
      for (x = 0; x < cx; ++x) {
        var wrapx = x % cx;
        if (wrapx < 0) wrapx += cx;
        heightMap[x + y * cx] = data[(x + y * cx) * 4] * scaleVt;
      }
    }

    this.heightMap = heightMap;

    for (var i in this.onload) {
      this.onload[i]();
    }
    if (callback) {
      callback(this);
    }
  };

  exports.ImageSource.prototype.getHeightMap = function(callback) {
    if (!this.source.heightMap) {
      // Enqueue ourselves to be called later.
      this.onload.push(this.getHeightMap.bind(this, callback));
      return;
    }
    callback(this.source.heightMap);
  };

  // cx, cy = width and height of heightmap
  exports.Terrain = function(source) {
    this.scaleHz = 1;
    this.scaleVt = 1;
    this.source = source;
  };

  exports.Terrain.prototype.getContact = function(pt) {
    return this.getContactRayZ(pt.x, pt.y);
  }

  exports.Terrain.prototype.getContactRayZ = function(x, y) {
    var floorx = Math.floor(x);
    var floory = Math.floor(y);
    var fraclx = x - floorx;
    var fracly = y - floory;
    var size = this.source.size;
    var heightMap = this.source.heightMap;

    /*   y
         ^
        h01 - h11
         | \   |
         |   \ |
        h00 - h10 -> x
    */
    var h00 = heightMap[(floorx + 0) + (floory + 0) * size];
    var h10 = heightMap[(floorx + 1) % size + ((floory + 0) % size) * size];
    var h01 = heightMap[(floorx + 0) + (floory + 1) * size];
    var h11 = heightMap[(floorx + 1) % size + ((floory + 1) % size) * size];

    var normal = new Vec3();
    var height;
    normal.z = this.scaleHz;
    if (fracx + fracy < 1) {
      normal.x = h00 - h10;
      normal.y = h00 - h01;
      height = h00 + (h10-h00) * fraclx + (h01-h00) * fracly;
    } else {
      normal.x = h01 - h11;
      normal.y = h10 - h11;
      height = h11 + (h01-h11) * (1-fracx) + (h10-h11) * (1-fracy);
    }
    return {
      normal: normal.normalize(),
      surfacePos: new Vec3(0, 0, height)
    };
  }
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
