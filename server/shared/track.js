/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'track';

(function(exports) {
  var LFIB4 = this.LFIB4 || require('./LFIB4');
  var THREE = this.THREE || require('../THREE');
  var pterrain = this.pterrain || require('./pterrain');

  var Vec3 = THREE.Vector3;

  exports.Scenery = function(config, terrain) {
    this.config = config;
    this.terrain = terrain;
    this.layers = [];
    this.layersById = {};
    for (var i = 0; i < config.layers.length; ++i) {
      var layer = new exports.Layer(config.layers[i], this);
      this.layers.push(layer);
      this.layersById[layer.config.id] = layer;
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
  };
  
  // TODO: Pass in a rectangle.
  exports.Layer.prototype.getObjects = function() {
    return this.cache['0,0'];
  };

  exports.Layer.prototype.getTile = function(tx, ty) {
    var key = tx + ',' + ty;
    console.log(key);
    if (key in this.cache) {
      return this.cache[key];
    } else {
      var terrain = this.scenery.terrain;
      var objects = [];
      var i, j, k, leng;
      var tmpVec1 = new Vec3(), tmpVec2 = new Vec3();
      var randomseed = 1;
      var random = LFIB4.LFIB4(randomseed, key);
      var width = 40;
      var maxObjects = 1;
      var avoids = [];
      var density = this.config.density;
      if (density) {
        maxObjects = density.base * width * width;
        if ('avoid' in density) {
          var layer = this.scenery.getLayer(density.avoid.layer);
          avoids.push({
            objects: layer.getObjects(),
            distanceSq: density.avoid.distance * density.avoid.distance
          });
        }
      }
      for (i = 0; i < maxObjects; ++i) {
        var drop = false;
        var object = {};
        object.position = new Vec3(
            100 + random() * width,
            0,
            -100 - random() * width);
        var contact = terrain.getContact(object.position);
        object.position.y = contact.surfacePos.y;
        object.scale = random() * 0.3 + 0.3;

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
      console.log(objects.length);
      this.cache[key] = objects;
      return objects;
    }
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
        // TODO: Move this dummy config into the track config.
        var sc_config = {
          "layers": [
            {
              "id": "trees",
              "density": {
                "base": 0.02
              },
              "render": {
                "scene": "/a/meshes/tree1a_lod2-scene.js"
              }
            },
            {
              "id": "grass",
              "density": {
                "base": 2,
                "avoid": { "layer": "trees", "distance": 2 }
              },
              "render": {
                "scene": "/a/meshes/grass-triangle.js"
              }
            }
          ]
        };
        this.scenery = new exports.Scenery(sc_config, terrain);

        var course = config.course;
        var cpts = course.checkpoints;
        for (i = 0; i < cpts.length; ++i) {
          var checkpoint = new Vec3(
              cpts[i].pos[0] * course.coordscale[0],
              0,
              cpts[i].pos[1] * course.coordscale[1]);
          var contact = this.terrain.getContact(checkpoint);
          checkpoint.y = contact.surfacePos.y + 2;
          this.checkpoints.push(checkpoint);
        }

        if (callback) callback();
      }.bind(this));
    }
  };

  exports.Track.prototype.setup = function() {
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
