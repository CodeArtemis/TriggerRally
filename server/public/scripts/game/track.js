/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/LFIB4',
  'THREE',
  'game/scenery',
  'game/terrain',
  'util/quiver',
  'util/util'
],
function(LFIB4, THREE, gameScenery, gameTerrain, quiver, util) {
  var exports = {};

  var Vec2 = THREE.Vector2;
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
        if (config.gameversion <= 1) course.coordscale[1] *= -1;
        for (i = 0; i < cpts.length; ++i) {
          this.checkpoints.push(new Vec3(
              cpts[i].pos[0] * course.coordscale[0],
              cpts[i].pos[1] * course.coordscale[1],
              0));
        }

        var maps = this.terrain.source.maps;

        var drawTrack = function(ins, outs, callback) {
          var dispMap = ins[0];

          var adjustCheckpointHeights = function() {
            this.checkpoints.forEach(function (checkpoint) {
              var contact = this.terrain.getContact(checkpoint);
              checkpoint.z = contact.surfacePos.z + 2;
            }, this);
          }.bind(this);
          adjustCheckpointHeights();

          // Cut course into terrain.
          // TODO: Move this to terrain module.
          function wrap(x, lim) { return x - Math.floor(x / lim) * lim; };
          function cubic(x) { return 3 * x*x - 2 * x*x*x; };
          function drawCircle(map, chan, x, y, value, radius, hardness, opacity) {
            var scaleX = map.scale.x, scaleY = map.scale.y;
            var img = map.data;
            var cx = map.width, cy = map.height;
            var numChan = img.length / cx / cy;
            var data = map.data;
            var mX = x / scaleX;
            var mY = y / scaleY;
            // The circle gets mapped to an ellipse in image space.
            var mRadX = radius / map.scale.x;
            var mRadY = radius / map.scale.y;
            var mMinX = Math.ceil(mX - mRadX), mMaxX = mX + mRadX;
            var mMinY = Math.ceil(mY - mRadY), mMaxY = mY + mRadY;
            var iX, iY, wX, wY, wR, i, weight;
            for (iY = mMinY; iY <= mMaxY; ++iY) {
              wY = iY * scaleY - y;
              wY *= wY;
              for (iX = mMinX; iX <= mMaxX; ++iX) {
                wX = iX * scaleX - x;
                wX *= wX;
                wR = Math.sqrt(wX + wY);
                if (wR < radius) {
                  wR /= radius;
                  if (wR <= hardness)
                    weight = 1;
                  else
                    weight = cubic((1 - wR) / (1 - hardness));
                  i = (wrap(iX, cx) + cx * wrap(iY, cy)) * numChan + chan;
                  data[i] += (value - data[i]) * weight * opacity;
                }
              }
            }
          };
          function drawCircleDisplacement(map, x, y, value, radius, hardness, opacity) {
            drawCircle(map, 0, x, y, value / map.scale.z, radius, hardness, opacity);
          }

          var radius = 60;
          var points = this.checkpoints;
          var calls = [];
          var i;
          for (i = 0; i < points.length - 1; ++i) {
            var cp = [
              points[i - 1] || points[i + 0],
              points[i + 0],
              points[i + 1],
              points[i + 2] || points[i + 1]
            ];
            var dist = new Vec2().sub(cp[1], cp[2]).length();
            var step = 1 / Math.ceil(20 * dist / radius);
            for (var x = 0; x < 0.9999; x += step) {
              var pX = catmullRom(cp[0].x, cp[1].x, cp[2].x, cp[3].x, x);
              var pY = catmullRom(cp[0].y, cp[1].y, cp[2].y, cp[3].y, x);
              var pZ = catmullRom(cp[0].z, cp[1].z, cp[2].z, cp[3].z, x);

              calls.push(drawCircleDisplacement.bind(null, dispMap, pX, pY, pZ, radius, 0.4, 0.1));
              //drawCircle(maps.surface, maps.surface.packed, 4, 2, pX, pY, 255, 100, 0.4, 1);
            }
          }
          // Stagger the drawCircle calls.
          var samples = [0, 2, 4, 1, 5, 3], jump = samples.length, j;
          for (j = 0; j < jump; ++j) {
            for (i = samples[j]; i < calls.length; i += jump) {
              calls[i]();
            }
          }
          adjustCheckpointHeights();
          callback();
        };

        var heightNode = maps.height._quiverNode;
        var sourceNode = heightNode.inputs[0];
        //quiver.inject(...) or
        //quiver.break(...)
        heightNode.inputs.shift();
        sourceNode.outputs.shift();  // TODO: Verify which output.
        quiver.connect(sourceNode,
                       new quiver.Node(maps.height),
                       drawTrack.bind(this),
                       heightNode);

        this.scenery = new gameScenery.Scenery(config.scenery, this);

        if (callback) callback();
      }.bind(this));
    }
  };

  return exports;
});
