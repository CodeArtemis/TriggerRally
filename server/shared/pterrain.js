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

  var catmullRom = function(pm1, p0, p1, p2, x) {
    var x2 = x * x;
    return 0.5 * (
      pm1 * x * ((2 - x) * x - 1) +
      p0 * (x2 * (3 * x - 5) + 2) +
      p1 * x * ((4 - 3 * x) * x + 1) +
      p2 * (x - 1) * x2
    );
  };

  var catmullRomDeriv = function(pm1, p0, p1, p2, x) {
    var x2 = x * x;
    return 0.5 * (
      pm1 * (4 * x - 3 * x2 - 1) +
      p0 * (9 * x2 - 10 * x) +
      p1 * (8 * x - 9 * x2 + 1) +
      p2 * (3 * x2 - 2 * x)
    );
  };

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
    this.hmap = ctx.getImageData(0, 0, cx, cy).data;
    for (var i in this.onload) {
      this.onload[i]();
    }
    if (callback) {
      callback(this);
    }
  };

  exports.ImageSource.prototype.loadTile = function(x, y, cx, cy, scaleVt, callback) {
    if (!this.hmap) {
      // Enqueue ourselves to be called later.
      this.onload.push(this.loadTile.bind(this, x, y, cx, cy, scaleVt, callback));
      return;
    }
    var srcx = this.cx;
    var srcy = this.cy;
    var data = this.hmap;
    var buffer = new Float32Array(cx * cy);
    var ix, iy, i = 0;
    for (iy = y; iy < y + cy; ++iy) {
      var wrapy = iy % srcy;
      var wrapy_srcx = wrapy * srcx;
      for (ix = x; ix < x + cx; ++ix) {
        var wrapx = ix % srcx;
        buffer[i++] = data[(wrapx + wrapy_srcx) * 4] * scaleVt;
      }
    }
    callback(buffer);
  };

  // cx, cy = width and height of heightmap
  exports.Terrain = function(source) {
    this.tileSize = 8;  // Hack alert.
    this.scaleHz = 1;
    this.scaleVt = 1;
    this.tileTotalSize = this.tileSize * this.scaleHz;
    this.tiles = {};
    this.source = source;
  };

  // Get tile iff loaded.
  // tx, ty = tile coordinate indices
  exports.Terrain.prototype.getTile = function(tx, ty) {
    var key = tx + ',' + ty;
    return this.tiles[key];
  };

  // tx, ty = tile coordinate indices
  exports.Terrain.prototype.loadTile = function(tx, ty, callback) {
    var key = tx + ',' + ty;
    if (key in this.tiles) {
      callback(this.tiles[key]);
    } else {
      var size = this.tileSize;
      var sizeP1 = size + 1;
      this.source.loadTile(
          tx * size, ty * size, sizeP1, sizeP1, this.scaleVt,
          function(heightMap) {
        var tile = new exports.TerrainTile(this, tx, ty, heightMap);
        this.tiles[key] = tile;
        if (callback) {
          callback(tile);
        }
      }.bind(this));
    }
  };

  exports.Terrain.prototype.getContact = function(pt) {
    return this.getContactRayZ(pt.x, pt.y);
  }

  // x, y = terrain space coordinates
  exports.Terrain.prototype.getContactRayZ = function(x, y) {
    var contact = null;
    var sx = x / this.scaleHz;
    var sy = y / this.scaleHz;
    var tx = Math.floor(sx / this.tileSize);
    var ty = Math.floor(sy / this.tileSize);
    // HACK to repeat a single tile infinitely.
    var tile = this.getTile(0, 0); //this.getTile(tx, ty);
    if (tile) {
      contact = tile.getContactRayZ(
          sx - tx * this.tileSize,
          sy - ty * this.tileSize);
      if (contact) {
        contact.surfacePos.x = x;
        contact.surfacePos.y = y;
      }
    } else {
      // TODO: Fire off a request to load this tile.
    }
    return contact;
  };

  // tx, ty = tile coordinate indices
  exports.TerrainTile = function(terrain, tx, ty, heightMap) {
    var that = this;
    this.terrain = terrain;
    this.size = terrain.tileSize;
    this.heightMap = heightMap;
    var tileSize = this.size;
    var tileSizeP1 = tileSize + 1;

    var normalMap = new Float32Array(tileSize * tileSize * 3);
    var tmpVec3 = new THREE.Vector3();
    for (var y = 0; y < tileSize; ++y) {
      for (var x = 0; x < tileSize; ++x) {
        tmpVec3.set(
          heightMap[y * tileSizeP1 + x] + heightMap[(y+1) * tileSizeP1 + x]
               - heightMap[y * tileSizeP1 + x+1] - heightMap[(y+1) * tileSizeP1 + x+1],
          heightMap[y * tileSizeP1 + x] + heightMap[y * tileSizeP1 + x+1]
               - heightMap[(y+1) * tileSizeP1 + x] - heightMap[(y+1) * tileSizeP1 + x+1],
          terrain.scaleHz * 2);
        tmpVec3.normalize();
        normalMap[(y * tileSize + x) * 3 + 0] = tmpVec3.x;
        normalMap[(y * tileSize + x) * 3 + 1] = tmpVec3.y;
        normalMap[(y * tileSize + x) * 3 + 2] = tmpVec3.z;
      }
    }
    this.normalMap = normalMap;
  };

  // lx, ly = local tile space coordinates
  exports.TerrainTile.prototype.getContactRayZ = function(lx, ly) {
    var floorlx = Math.floor(lx);
    var floorly = Math.floor(ly);
    var fraclx = lx - floorlx;
    var fracly = ly - floorly;
    var size = this.size;
    var sizeP1 = this.size + 1;

    function wrap(x, lim) { return x - Math.floor(x / lim) * lim; }

    /*   y
         ^
        h01 - h11
         | \   |
         |   \ |
        h00 - h10 -> x
    */
    //var n00 = this.normalMap[
    var h = [], i = 0, x, y;
    for (y = -1; y <= 2; ++y) {
      for (x = -1; x <= 2; ++x) {
        h[i++] = this.heightMap[wrap(floorlx + x, size) + wrap(floorly + y, size) * sizeP1];
      }
    }
    var height = catmullRom(
        catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], fraclx),
        catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], fraclx),
        catmullRom(h[ 8], h[ 9], h[10], h[11], fraclx),
        catmullRom(h[12], h[13], h[14], h[15], fraclx),
        fracly);

    var derivX = catmullRomDeriv(
        catmullRom(h[ 0], h[ 4], h[ 8], h[12], fracly),
        catmullRom(h[ 1], h[ 5], h[ 9], h[13], fracly),
        catmullRom(h[ 2], h[ 6], h[10], h[14], fracly),
        catmullRom(h[ 3], h[ 7], h[11], h[15], fracly),
        fraclx);
    var derivY = catmullRomDeriv(
        catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], fraclx),
        catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], fraclx),
        catmullRom(h[ 8], h[ 9], h[10], h[11], fraclx),
        catmullRom(h[12], h[13], h[14], h[15], fraclx),
        fracly);

    var normal = new Vec3(
        -derivX,
        -derivY,
        this.terrain.scaleHz);
    return {
      normal: normal.normalize(),
      surfacePos: new Vec3(0, 0, height)
    };
  }
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
