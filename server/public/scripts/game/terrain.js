/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'async',
  'util/image',
  'util/quiver',
  'util/util'
],
function(THREE, async, uImg, quiver, util) {
  var exports = {};

  var Vec3 = THREE.Vector3;
  var INTERP = util.INTERP;
  var catmullRom = util.catmullRom;
  var catmullRomDeriv = util.catmullRomDeriv;

  var inNode = false;
  if (typeof Image === 'undefined') {
    // Running in node.
    inNode = true;
    var Canvas = require('canvas');
  }

  function wrap(x, lim) { return x - Math.floor(x / lim) * lim; }

  exports.ImageSource = function() {
    this.maps = {};
  };

  exports.ImageSource.prototype.load = function(config, callback) {
    this.config = config;
    var maps = this.maps;

    for (var k in config) {
      maps[k] = {
        scale: new Vec3(config[k].scale[0],
                        config[k].scale[1],
                        config[k].scale[2])
      };
    }
    if (!maps.surface) {
      maps.surface = {
        scale: maps.height.scale,
      };
    }
    // Create seed buffers. The pipeline will preserve their data types.
    maps.height.displacement = uImg.createBuffer(
        null, 1, 1, 1, Float32Array);  // TODO: Make this Uint16?
    maps.surface.packed = uImg.createBuffer(
        null, 1, 1, 4, Uint8ClampedArray);
    maps.detail.displacement = uImg.createBuffer(
        null, 1, 1, 1, Float32Array);  // TODO: Make this Uint8?

    // Note to self: elevation data in 8-bit PNG seems to compress 20% better
    // if you split the channels into separate greyscale PNG images.
    // (on Engelberg 1024x1024 dataset).

    // TODO: More uniform handling of data types. Scale
    // everything to a 0-1 range?

    var caller = function(err, fn) { fn && fn(); };

    // Set up processing pipelines.
    // TODO: discard intermediate buffers.
    quiver.connect(config.height.url,
                   uImg.imageFromUrl(),
                   {},
                   uImg.getImageData({flip: true}),
                   {},
                   uImg.unpack16bit(),
                   maps.height.displacement);

    // We scale the derivatives to fit a Uint8 buffer.
    quiver.connect(maps.height.displacement,
                   uImg.derivatives(127.5 / 10, 127.5),
                   maps.surface.packed);

    maps.height.displacement._quiverNode.acquire(caller);
    maps.surface.packed._quiverNode.acquire(caller);

    if (config.detail) {
      quiver.connect(config.detail.url,
                     uImg.imageFromUrl(),
                     {},
                     uImg.getImageData({flip: true}),
                     {},
                     uImg.copyChannel(0, 0),
                     maps.detail.displacement);

      maps.detail.displacement._quiverNode.acquire(caller)
    }
    callback();
  };

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
    var tX = x / mapHeight.scale.x;
    var tY = y / mapHeight.scale.y;
    var floorx = Math.floor(tX);
    var floory = Math.floor(tY);
    var fracx = tX - floorx;
    var fracy = tY - floory;
    var cx = mapHeight.displacement.width;
    var cy = mapHeight.displacement.height;
    var hmap = mapHeight.displacement.data;
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
      var dmap = mapDetail.displacement.data;
      cx = mapDetail.displacement.width;
      cy = mapDetail.displacement.height;
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
