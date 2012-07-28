/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/LFIB4',
  'cs!util/collision',
  'cs!util/hash2d',
  'util/util',
  'THREE'
],
function(LFIB4, collision, hash2d, util, THREE) {
  var exports = {};

  var Vec2 = THREE.Vector2;
  var Vec3 = THREE.Vector3;
  var catmullRom = util.catmullRom;

  var COLLISION_HASH_SIZE = 5;

  exports.Scenery = function(config, track) {
    this.config = config;
    this.track = track;
    this.layers = [];
    this.layersById = {};
    for (var i = 0; i < config.layers.length; ++i) {
      var layer = new exports.Layer(config.layers[i], this);
      this.layers.push(layer);
      this.layersById[layer.config.id] = layer;
    }
    this.trackPts = new hash2d.IndirectHash2D(10);
    var radius = 10;
    var points = [ new Vec2(100, 100) ].concat(track.checkpoints);
    for (var i = 0; i < points.length - 1; ++i) {
      var cp = [
        points[i - 1] || points[i + 0],
        points[i + 0],
        points[i + 1],
        points[i + 2] || points[i + 1]
      ];
      var dist = new Vec2().sub(cp[1], cp[2]).length();
      var step = 1 / Math.ceil(dist / 10);
      for (var x = 0; x < 0.9999; x += step) {
        var interp = new THREE.Vector2(
          catmullRom(cp[0].x, cp[1].x, cp[2].x, cp[3].x, x),
          catmullRom(cp[0].y, cp[1].y, cp[2].y, cp[3].y, x)
        );
        interp.radius = radius;
        this.trackPts.addCircle(interp.x, interp.y, radius, interp);
      }
    }
  };

  exports.Scenery.prototype.getLayer = function(id) {
    return this.layersById[id];
  };

  exports.Scenery.prototype.addToSim = function(sim) {
    this.layers.forEach(function(layer) {
      if (layer.config.collision) {
        sim.addStaticObject(layer);
      }
    });
  };

  exports.Layer = function(config, scenery) {
    this.config = config;
    this.scenery = scenery;
    this.cache = new hash2d.Hash2D(config['tileSize']);
    this.add = null;
    this.sub = null;
    if (config.density.add) {
      this.add = new hash2d.Hash2D(config['tileSize']);
      config.density.add.forEach(function(obj) {
        var object = {
          position: new Vec3(obj.pos[0], obj.pos[1], obj.pos[2]),
          rotation: new Vec3(obj.rot[0], obj.rot[1], obj.rot[2]),
          scale: obj.scale
        };
        this.add.addObject(object.position.x, object.position.y, object);
      }, this);
    }
    this.hull = null;
    if (config.collision) {
      if (config.collision.capsule) {
        this.hull = new collision.SphereHull([
          new Vec3(0, 0, 1.0),
          new Vec3(0, 0, config.collision.capsule.height - 0.5)
        ], config.collision.capsule.radius);
        this.hull.originalCenter = this.hull.bounds.center.clone();
      }
    }
  };

  exports.Layer.prototype.collideSphereHull = function(hull) {
    // TODO: This algorithm seems more efficient than IndirectHash2D. Replace it?
    var radius = hull.bounds.radius + this.hull.bounds.radius;
    var center = hull.bounds.center;
    var objects = this.getObjects(
        center.x - radius, center.y - radius,
        center.x + radius, center.y + radius);
    var contactArrays = [];
    var objHull = this.hull;
    objects.forEach(function(object) {
      objHull.bounds.center.add(objHull.originalCenter, object.position);
      contactArrays.push(objHull.collideSphereHull(hull));
    });
    return [].concat.apply([], contactArrays);
  };

  exports.Layer.prototype.getObjects = function(minX, minY, maxX, maxY) {
    return this.cache.getObjects(minX, minY, maxX, maxY);
  };

  exports.Layer.prototype.getTile = function(tX, tY) {
    var tile = this.cache.getTile(tX, tY);
    if (tile) return tile;
    tile = this.createTile(tX, tY);
    this.cache.setTile(tX, tY, tile);
    return tile;
  };

  exports.Layer.prototype.createTile = function(tX, tY) {
    var terrain = this.scenery.track.terrain;
    var objects = [];
    var i, j, k, leng;
    var tmpVec1 = new Vec3(), tmpVec2 = new Vec2();
    var randomseed = 1;
    var key = tX + ',' + tY;
    var random = LFIB4.LFIB4(randomseed, key, this.config.id);
    var tileSize = this.cache.gridSize;
    var baseX = tX * tileSize, baseY = tY * tileSize;
    var maxObjects = 1;
    var avoids = [];
    var density = this.config.density;
    if (density) {
      maxObjects = density.base * tileSize * tileSize;
      if ('avoidLayers' in density) {
        for (i in density['avoidLayers']) {
          var avoid = density['avoidLayers'][i];
          var layer = this.scenery.getLayer(avoid.layer);
          avoids.push({
            objects: layer.getObjects(
              baseX, baseY, baseX + tileSize, baseY + tileSize),
            distanceSq: avoid.distance * avoid.distance
          });
        }
      }
    }
    if (this.add) {
      var addObjects = this.add.getTile(tX, tY);
      if (addObjects && addObjects.length) {
        objects = objects.concat(addObjects);
      }
    }
    var trackPts = this.scenery.trackPts.getObjects(
        baseX, baseY, baseX + tileSize, baseY + tileSize);
    for (i = 0; i < maxObjects; ++i) {
      // TODO: Remove object if in 'sub' list.
      var drop = false;
      var object = {};
      object.position = new Vec3(
          baseX + random() * tileSize,
          baseY + random() * tileSize,
          -Infinity);
      var contact = terrain.getContact(object.position);
      if (contact) {
        object.position.z = contact.surfacePos.z;
      }

      var probability = 1;
      var gradient = density && density.gradient;
      if (gradient && contact) {
        var gradProb = (contact.normal.z - gradient.min) /
                       (gradient.full - gradient.min);
        if (gradProb <= 0) continue;
        probability *= Math.min(gradProb, 1);
      }

      for (j in trackPts) {
        var tp = trackPts[j];
        tmpVec2.sub(object.position, tp);
        leng = tmpVec2.length();
        var probTp = (leng - tp.radius) / 2;
        probability *= Math.min(probTp, 1);
        if (probability <= 0) break;
      }

      if (probability <= 0 ||
          probability < random()) continue;

      object.scale = (random() * 0.3 + 0.3) * probability;

      /*
      // Enforce minimum distance between objects.
      for (j = 0; j < objects.length; ++j) {
        tmpVec1.sub(object.position, objects[j].position);
        leng = tmpVec1.lengthSq();
        if (leng < 25) {
          drop = true;
          break;
        }
      }
      if (drop) continue;
      */
      for (j in avoids) {
        var avoid = avoids[j];
        for (j in avoid.objects) {
          var other = avoid.objects[j];
          tmpVec1.sub(object.position, other.position);
          leng = tmpVec1.lengthSq();
          if (leng < avoid.distanceSq) {
            drop = true;
            break;
          }
        }
        if (drop) break;
      }
      if (drop) continue;

      object.rotation = new Vec3(0, 0, random() * 2 * Math.PI);
      objects.push(object);
    }
    return objects;
  };

  return exports;
});