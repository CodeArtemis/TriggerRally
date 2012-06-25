/**
 * @author jareiko / http://www.jareiko.net/
 */

var MODULE = 'track';

(function(exports) {
  var LFIB4 = this.LFIB4 || require('./LFIB4');
  var THREE = this.THREE || require('../THREE');
  var pterrain = this.pterrain || require('./pterrain');

  var Vec3 = THREE.Vector3;
  
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

        this.scenery = new exports.Scenery(config.scenery, this);

        if (callback) callback();
      }.bind(this));
    }
  };

  exports.Track.prototype.setup = function() {
  };
})(typeof exports === 'undefined' ? this[MODULE] = {} : exports);
