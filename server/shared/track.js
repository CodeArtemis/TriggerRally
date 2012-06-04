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
    for (var i = 0; i < config.layers.length; ++i) {
      this.layers[i] = new exports.Layer(config.layers[i], this);
    }
  };

  exports.Layer = function(config, scenery) {
    this.config = config;
    this.scenery = scenery;
    // TODO: Purge LRU cache entries.
    this.cache = {};
  };

  exports.Layer.prototype.getTile = function(tx, ty) {
    var key = tx + ',' + ty;
    if (key in this.cache) {
      return this.cache[key];
    } else {
      var terrain = this.scenery.terrain;
      var objects = [];
      var i;
      var randomseed = 1;
      var random = LFIB4.LFIB4(randomseed, key);
      for (i = 0; i < 300; ++i) {
        var object = {};
        object.position = new Vec3(
            100 + random() * 40,
            0,
            -100 - random() * 40);
        var contact = terrain.getContact(object.position);
        object.position.y = contact.surfacePos.y;
        object.rotation = random() * 2 * Math.PI;
        object.scale = random() * 0.3 + 0.3;
        objects.push(object);
      }
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
              "render": {
                "meshes": [
                  {
                    "src": "/a/meshes/tree1a_lod2-scene.js"
                  }
                ]
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
