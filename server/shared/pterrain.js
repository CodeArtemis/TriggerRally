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

  function wrap(x, lim) { return x - Math.floor(x / lim) * lim; }

  // TODO: Implement float buffer source.
  exports.ImageSource = function() {
    this.maps = {};
    this.onload = [];
  };

  exports.ImageSource.prototype.load = function(heightUrl, detailUrl, callback) {
    var load;
    if (inNode) {
      // TODO: Move this into a separate module that never gets delivered
      // to browser clients.
      // We know that the URL refers to a local file, so just read it.
      load = function(url, type, cb) {
        var path = __dirname + '/../public' + url;
        require('fs').readFile(path, function(err, data) {
          if (err) throw new Error(err);
          else {
            var img = new Canvas.Image();
            img.src = data;
            this.loadWithImage(img, type, cb);
          }
        }.bind(this));
      }
    } else {
      load = function(url, type, cb) {
        var image = new Image();
        image.onload = this.loadWithImage.bind(this, image, type, cb);
        image.src = url;
      }
    }
    async.parallel([
        load.bind(this, heightUrl, 'height'),
        load.bind(this, detailUrl, 'detail')
      ],
      function(err, results) {
        this.generateHeightMap();
        for (var i in this.onload) {
          this.onload[i]();
        }
        this.onload = null;
        callback(this);
      }.bind(this)
    );
  };

  function getImageData(image) {
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
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, cx, cy);
  }

  exports.ImageSource.prototype.loadWithImage = function(image, callback, type) {
    this.maps[type] = getImageData(image);
    //this.cx = imageData.width;
    //this.cy = imageData.height;
    //this.hmap = imageData.data;
    callback && callback();
  };

  exports.ImageSource.prototype.callbackOnLoad = function(callback) {
    if (this.onload) {
      this.onload.push(callback);
    } else {
      callback();
    }
  };

  exports.ImageSource.prototype.generateHeightMap = function() {
    var cx = this.maps['height'].width;
    var cy = this.maps['height'].height;
    var data = this.maps['height'].data;
    var buffer = new Float32Array(cx * cy);
    var scaleVt = this.scaleVt;
    var pixels = cx * cy;
    for (i = 0; i < pixels; ++i) {
      buffer[i] = data[i * 4] * scaleVt;
    }
    this.heightMap = buffer;
  };

  // cx, cy = width and height of heightmap
  exports.Terrain = function(source) {
    //this.tileSize = 512;  // Hack alert.
    this.scaleHz = 1;
    this.scaleVt = 1;
    this.tileTotalSize = this.tileSize * this.scaleHz;
    this.tiles = {};
    this.source = source;
    // We actually just use a single tile for now.
    this.theTile = new exports.TerrainTile(this, tx, ty);
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

    var normalMap = new Float32Array(tileSize * tileSize * 3);
    var tmpVec3 = new THREE.Vector3();
    for (var y = 0; y < tileSize; ++y) {
      for (var x = 0; x < tileSize; ++x) {
        var h = [], i = 0, x2, y2;
        for (y2 = -1; y2 <= 2; ++y2) {
          for (x2 = -1; x2 <= 2; ++x2) {
            h[i++] = heightMap[wrap(x + x2, tileSize) + wrap(y + y2, tileSize) * tileSize];
          }
        }
        var derivX = catmullRomDeriv(
            catmullRom(h[ 0], h[ 4], h[ 8], h[12], 0.5),
            catmullRom(h[ 1], h[ 5], h[ 9], h[13], 0.5),
            catmullRom(h[ 2], h[ 6], h[10], h[14], 0.5),
            catmullRom(h[ 3], h[ 7], h[11], h[15], 0.5),
            0.5);
        var derivY = catmullRomDeriv(
            catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], 0.5),
            catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], 0.5),
            catmullRom(h[ 8], h[ 9], h[10], h[11], 0.5),
            catmullRom(h[12], h[13], h[14], h[15], 0.5),
            0.5);
        tmpVec3.set(-derivX, -derivY, terrain.scaleHz / terrain.scaleVt).normalize();
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

    // This assumes that the tile repeats in all directions.
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

    // TODO: Optimize this!
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
        this.terrain.scaleHz / this.terrain.scaleVt);
    return {
      normal: normal.normalize(),
      surfacePos: new Vec3(0, 0, height)
    };
  }
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
