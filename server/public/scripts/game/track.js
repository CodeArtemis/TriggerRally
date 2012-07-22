/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/LFIB4',
  'THREE',
  'game/scenery',
  'game/terrain',
  'util/util'
],
function(LFIB4, THREE, gameScenery, gameTerrain, util) {
  var exports = {};
  var Vec3 = THREE.Vector3;
  var catmullRom = util.catmullRom;

  exports.Track = function() {
    this.config = {};
    this.checkpoints = [];
  };

  exports.Track.prototype.loadWithConfig = function(config, callback) {
    this.config = config;

    if (config.terrain) {
      var terrainConfig = config.terrain;
      if (!config.terrain) {
        // Fallback for older configs.
        terrainConfig = {
          height: {
            url: config.terrain.heightmap,
            scale: [
              config.terrain.horizontalscale,
              config.terrain.horizontalscale,
              config.terrain.verticalscale
            ]
          }
        };
      }

      var source = new gameTerrain.ImageSource();
      var terrain = new gameTerrain.Terrain(source);
      this.terrain = terrain;

      source.load(terrainConfig, function() {
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

        // Cut course into terrain.
        function drawCircle(map, x, y, radius) {
          var displacement = map.displacement;
        };

        var map = this.terrain.maps['height'];
        var radius = 10;
        var points = [ new Vec2(100, 100) ].concat(cpts);
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
            var pX = catmullRom(cp[0].x, cp[1].x, cp[2].x, cp[3].x, x);
            var pY = catmullRom(cp[0].y, cp[1].y, cp[2].y, cp[3].y, x);

            drawCircle(map, pX, pY, radius);
          }
        }

        this.scenery = new gameScenery.Scenery(config.scenery, this);

        if (callback) callback();
      }.bind(this));
    }
  };

  return exports;
});
