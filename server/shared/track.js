/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'track';

(function(exports) {
  var LFIB4 = this.LFIB4 || require('./LFIB4');
  var THREE = this.THREE || require('../THREE');
  var pterrain = this.pterrain || require('./pterrain');

  var Vec3 = THREE.Vector3;
  
  var catmullRom = function(pm1, p0, p1, p2, x) {
    var x2 = x * x;
    return 0.5 * (
      pm1 * x * ((2 - x) * x - 1) +
      p0 * (x2 * (3 * x - 5) + 2) +
      p1 * x * ((4 - 3 * x) * x + 1) +
      p2 * (x - 1) * x2
    );
  };

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
    this.trackPts = new hash2d.Hash2D(10);
    var radius = Math.sqrt(100 + 80);  // where probability == 1
    for (var i = 0; i < track.checkpoints.length - 1; ++i) {
      var cp = [
        track.checkpoints[i - 1] || track.checkpoints[i + 0],
        track.checkpoints[i + 0],
        track.checkpoints[i + 1],
        track.checkpoints[i + 2] || track.checkpoints[i + 1]
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

  exports.Layer = function(config, scenery) {
    this.config = config;
    this.scenery = scenery;
    // TODO: Purge LRU cache entries.
    this.cache = {};
    this.tileSize = 20;
  };
  
  // TODO: Pass in a rectangle.
  exports.Layer.prototype.getObjects = function() {
    return this.cache['0,0'];
  };

  exports.Layer.prototype.getTile = function(tx, ty) {
    var key = tx + ',' + ty;
    if (key in this.cache) {
      return this.cache[key];
    } else {
      return this.cache[key] = this.createTile(tx, ty, key);
    }
  };
  
  exports.Layer.prototype.createTile = function(tx, ty) {
    var terrain = this.scenery.track.terrain;
    var objects = [];
    var i, j, k, leng;
    var tmpVec1 = new Vec3(), tmpVec2 = new Vec2();
    var randomseed = 1;
    var key = tx + ',' + ty;
    var random = LFIB4.LFIB4(randomseed, key, this.config.id);
    var tileSize = this.tileSize;
    var baseX = tx * tileSize, baseY = ty * tileSize;
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
            objects: layer.getObjects(),
            distanceSq: avoid.distance * avoid.distance
          });
        }
      }
    }
    var trackPts = this.scenery.trackPts.getPotentialObjects(
        baseX, baseY, baseX + tileSize, baseY + tileSize);
    for (i = 0; i < maxObjects; ++i) {
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
        leng = tmpVec2.lengthSq();
        var probTp = (leng - 80) / 100;
        probability *= Math.min(probTp, 1);
        if (probability <= 0) break;
      }

      if (probability <= 0 ||
          probability < random()) continue;

      object.scale = (random() * 0.3 + 0.3) * probability;

/*
      for (j = 0; j < objects.length; ++j) {
        tmpVec1.sub(object.position, objects[j].position);
        leng = tmpVec1.lengthSq();
        if (leng < 25) {
          drop = true;
          break;
        }
      }
      if (drop) continue;*/
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

      object.rotation = new Vec3(0, random() * 2 * Math.PI, 0);
      objects.push(object);
    }
    return objects;
  };

  exports.Track = function() {
    this.config = {};
    this.checkpoints = [];
    // TODO: Convert trees into some more generic object type.
    this.trees = [];
  };

  exports.Track.prototype.loadWithConfig = function(config, callback) {
    this.config = config;
    this.setup();

    if (config.terrain) {
      var source = new pterrain.ImageSource(config.terrain.heightmap);
      source.load(config.terrain.heightmap);
      var terrain = new pterrain.Terrain(source);
      terrain.scaleHz = config.terrain.horizontalscale;
      terrain.scaleVt = config.terrain.verticalscale;
      this.terrain = terrain;

      terrain.loadTile(0, 0, function() {
        var course = config.course;
        var cpts = course.checkpoints;
        // TODO: Move this change to config.
        course.coordscale[1] *= -1;
        for (i = 0; i < cpts.length; ++i) {
          var checkpoint = new Vec3(
              cpts[i].pos[0] * course.coordscale[0],
              cpts[i].pos[1] * course.coordscale[1],
              -Infinity);
          var contact = this.terrain.getContact(checkpoint);
          checkpoint.z = contact.surfacePos.z + 2;
          this.checkpoints.push(checkpoint);
        }

        // TODO: Move this dummy config into the track config.
        var sc_config = {
          "layers": [
            {
              "id": "trees",
              "density": {
                "base": 0.02,
                "gradient": { "min": 0.95, "full": 1.0 }
              },
              "render": {
                "scene": "/a/meshes/tree1a_lod2-scene.js"
              }
            },
            {
              "id": "grass2",
              "density": {
                "base": 2,
                "gradient": { "min": 0.7, "full": 0.9 },
                "avoidLayers": [
                  { "layer": "trees", "distance": 2 }
                ]
              },
              "render": {
                "scene": "/a/meshes/grass-triangle.js",
                "scale": 0.7
              }
            }
          ]
        };
        this.scenery = new exports.Scenery(sc_config, this);

        if (callback) callback();
      }.bind(this));
    }
  };

  exports.Track.prototype.setup = function() {
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
