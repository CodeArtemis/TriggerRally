/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'async',
  'util/util'
],
function(THREE, async, util) {
  var exports = {};

  var Vec3 = THREE.Vector3;
  var INTERP = util.INTERP;

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
  };

  exports.ImageSource.prototype.load = function(config, callback) {
    this.config = config;
    var load;
    if (inNode) {
      // TODO: Move this into a separate module that never gets delivered
      // to browser clients.
      // We know that the URL refers to a local file, so just read it.
      load = function(url, map, cb) {
        if (!url) { cb(); return; }
        var path = __dirname + '/../public' + url;
        require('fs').readFile(path, function(err, data) {
          if (err) throw new Error(err);
          else {
            var img = new Canvas.Image();
            img.src = data;
            this.loadMapImage(img, map, cb);
          }
        }.bind(this));
      }
    } else {
      load = function(url, map, cb) {
        if (!url) { cb(); return; }
        var image = new Image();
        image.onload = this.loadMapImage.bind(this, image, map, cb);
        image.src = url;
      }
    }
    var requests = [];
    for (var k in config) {
      var map = this.maps[k] = {
        scale: new Vec3(config[k].scale[0], config[k].scale[1], config[k].scale[2])
      };
      requests.push(load.bind(this, config[k].url, map));
    }
    async.parallel(requests,
      function(err, results) {
        this.generateHeightMap(this.maps.height);
        this.generateNormalMap(this.maps.height);
        if (this.maps.detail) {
          this.generateHeightMap(this.maps.detail);
        }
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

  exports.ImageSource.prototype.loadMapImage = function(image, map, callback) {
    var imageData = getImageData(image);
    map.cx = imageData.width;
    map.cy = imageData.height;
    map.data = imageData.data;
    callback();
  };

  exports.ImageSource.prototype.generateHeightMap = function(map) {
    map.buffer = new Float32Array(map.cx * map.cy);
    this.regenHeightMap(map, 0, 0, map.cx, map.cy);
    // Discard the original data.
    //map.data = null;
  };

  exports.ImageSource.prototype.regenHeightMap = function(map, x, y, cx, cy) {
    var data = map.data;
    var buffer = map.displacement;
    var stride = map.cx;
    var ix, iy, i;
    for (iy = y + cy - 1; iy >= y; --iy) {
      for (ix = x + cx - 1; ix >= x; --ix) {
        i = iy * stride + ix;
        buffer[i] = data[i * 4];
      }
    }
  };

  exports.ImageSource.prototype.generateNormalMap = function(map) {
    var cx = map.cx, cy = map.cy;
    var normalMap = new Float32Array(cx * cy * 3);
    var tmpVec3 = new THREE.Vector3();
    var hmap = map.displacement;
    for (var y = 0; y < cy; ++y) {
      for (var x = 0; x < cx; ++x) {
        var h = [], i = 0, x2, y2;
        for (y2 = -1; y2 <= 2; ++y2) {
          for (x2 = -1; x2 <= 2; ++x2) {
            h[i++] = hmap[wrap(x + x2, cx) + wrap(y + y2, cy) * cx];
          }
        }
        // TODO: Optimize these constant x catmullRom calls.
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
        tmpVec3.set(-derivX, -derivY, 1).normalize();
        normalMap[(y * cx + x) * 3 + 0] = tmpVec3.x;
        normalMap[(y * cx + x) * 3 + 1] = tmpVec3.y;
        normalMap[(y * cx + x) * 3 + 2] = tmpVec3.z;
      }
    }
    map.normal = normalMap;
  };

  // cx, cy = width and height of heightmap
  exports.Terrain = function(source) {
    this.source = source;
    // We don't really support tiles yet, just repeat a single tile.
    this.theTile = new exports.TerrainTile(this);
  };

  exports.Terrain.prototype.getContact = function(pt) {
    return this.getContactRayZ(pt.x, pt.y);
  }

  // x, y = terrain space coordinates
  exports.Terrain.prototype.getContactRayZ = function(x, y) {
    var contact = null;
    // We just repeat a single tile infinitely.
    var tile = this.theTile; //this.getTile(tx, ty);
    if (tile) {
      contact = tile.getContactRayZ(x, y);
    } else {
      // TODO: Fire off a request to load this tile.
    }
    return contact;
  };

  exports.TerrainTile = function(terrain) {
    this.terrain = terrain;
  };

  // lx, ly = local tile space coordinates
  exports.TerrainTile.prototype.getContactRayZ = function(x, y) {
    var mapHeight = this.terrain.source.maps.height;
    var heightx = x / mapHeight.scale.x;
    var heighty = y / mapHeight.scale.y;
    var floorx = Math.floor(heightx);
    var floory = Math.floor(heighty);
    var fracx = heightx - floorx;
    var fracy = heighty - floory;
    var cx = mapHeight.cx, cy = mapHeight.cy;
    var hmap = mapHeight.displacement;
    var mapDetail = this.terrain.source.maps.detail;

    if (!hmap) {
      // No data yet.
      return {
        normal: new Vec3(0, 0, 1),
        surfacePos: new Vec3(x, y, 0)
      }
    }

    // This assumes that the tile repeats in all directions.
    var h = [], i = 0, sx, sy;
    for (sy = -1; sy <= 2; ++sy) {
      for (sx = -1; sx <= 2; ++sx) {
        h[i++] = hmap[wrap(floorx + sx, cx) + wrap(floory + sy, cy) * cx];
      }
    }
    var height = catmullRom(
        catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], fracx),
        catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], fracx),
        catmullRom(h[ 8], h[ 9], h[10], h[11], fracx),
        catmullRom(h[12], h[13], h[14], h[15], fracx),
        fracy) * mapHeight.scale.z;

    // TODO: Optimize this!
    var derivX = catmullRomDeriv(
        catmullRom(h[ 0], h[ 4], h[ 8], h[12], fracy),
        catmullRom(h[ 1], h[ 5], h[ 9], h[13], fracy),
        catmullRom(h[ 2], h[ 6], h[10], h[14], fracy),
        catmullRom(h[ 3], h[ 7], h[11], h[15], fracy),
        fracx);
    var derivY = catmullRomDeriv(
        catmullRom(h[ 0], h[ 1], h[ 2], h[ 3], fracx),
        catmullRom(h[ 4], h[ 5], h[ 6], h[ 7], fracx),
        catmullRom(h[ 8], h[ 9], h[10], h[11], fracx),
        catmullRom(h[12], h[13], h[14], h[15], fracx),
        fracy);

    var normal = new Vec3(
        -derivX,
        -derivY,
        1).divideSelf(mapHeight.scale).normalize();

    if (mapDetail) {
      var dmap = mapDetail.displacement;
      cx = mapDetail.cx;
      cy = mapDetail.cy;
      var detailx = x / mapDetail.scale.x;
      var detaily = y / mapDetail.scale.y;
      floorx = Math.floor(detailx);
      floory = Math.floor(detaily);
      fracx = detailx - floorx;
      fracy = detaily - floory;
      h[0] = dmap[wrap(floorx + 0, cx) + wrap(floory + 0, cy) * cx];
      h[1] = dmap[wrap(floorx + 1, cx) + wrap(floory + 0, cy) * cx];
      h[2] = dmap[wrap(floorx + 0, cx) + wrap(floory + 1, cy) * cx];
      h[3] = dmap[wrap(floorx + 1, cx) + wrap(floory + 1, cy) * cx];
      height += INTERP(
          INTERP(h[0], h[1], fracx),
          INTERP(h[2], h[3], fracx),
          fracy) * mapDetail.scale.z;
      var detailNormal = new Vec3(
          h[0] + h[2] - h[1] - h[3],
          h[0] + h[1] - h[2] - h[3],
          2).divideSelf(mapDetail.scale).normalize();
      normal.set(
          detailNormal.z * normal.x + detailNormal.x * (1 - normal.x * normal.x),
          detailNormal.z * normal.y + detailNormal.y * (1 - normal.y * normal.y),
          detailNormal.z * normal.z);
    }

    return {
      normal: normal,
      surfacePos: new Vec3(x, y, height)
    };
  };

  return exports;
});
