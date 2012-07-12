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
      if (wrapy < 0) wrapy += srcy;
      var wrapy_srcx = wrapy * srcx;
      for (ix = x; ix < x + cx; ++ix) {
        var wrapx = ix % srcx;
        if (wrapx < 0) wrapx += srcx;
        buffer[++i] = data[(wrapx + wrapy_srcx) * 4] * scaleVt;
      }
    }
    callback(buffer);
  };

  // cx, cy = width and height of heightmap
  exports.Terrain = function(source) {
    this.tileSize = 512;  // Hack alert.
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
    var tile = this.getTile(tx, ty);
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
    var sizeP1 = this.size + 1;
    this.heightMap = heightMap;
  };

  // lx, ly = local tile space coordinates
  exports.TerrainTile.prototype.getContactRayZ = function(lx, ly) {
    var floorlx = Math.floor(lx);
    var floorly = Math.floor(ly);
    var fraclx = lx - floorlx;
    var fracly = ly - floorly;
    var sizeP1 = this.size + 1;
    
    /*   y
         ^
        h01 - h11
         | \   |
         |   \ |
        h00 - h10 -> x
    */
    var h00 = this.heightMap[(floorlx + 0) + (floorly + 0) * sizeP1];
    var h10 = this.heightMap[(floorlx + 1) + (floorly + 0) * sizeP1];
    var h01 = this.heightMap[(floorlx + 0) + (floorly + 1) * sizeP1];
    var h11 = this.heightMap[(floorlx + 1) + (floorly + 1) * sizeP1];

    var normal = new Vec3();
    var height;
    normal.z = this.terrain.scaleHz;
    if (fraclx + fracly < 1) {
      normal.x = h00 - h10;
      normal.y = h00 - h01;
      height = h00 + (h10-h00) * fraclx + (h01-h00) * fracly;
    } else {
      normal.x = h01 - h11;
      normal.y = h10 - h11;
      height = h11 + (h01-h11) * (1-fraclx) + (h10-h11) * (1-fracly);
    }
    return {
      normal: normal.normalize(),
      surfacePos: new Vec3(0, 0, height)
    };
  }
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
