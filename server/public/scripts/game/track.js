/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/LFIB4',
  'THREE',
  'game/scenery',
  'game/terrain',
  'cs!util/quiver',
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
        if (config.gameversion <= 1) course.coordscale[1] *= -1;

        var maps = this.terrain.source.maps;

        var drawTrack = function(ins, outs, callback) {
          var dispMap = ins[0];  // === outs[0]
          var checkpointsXY = ins[0];
          var checkpoints = outs[1];

          checkpoints.length = 0;
          var numCheckpoints = checkpointsXY.length;
          for (var i = 0; i < numCheckpoints; ++i) {
            checkpoints.push(
                new Vec3(checkpointsXY[i].pos[0], checkpointsXY[i].pos[1], 0));
          }

          var adjustCheckpointHeights = function() {
            checkpoints.forEach(function (cpWithZ) {
              var contact = this.terrain.getContact(cpWithZ);
              cpWithZ.z = contact.surfacePos.z + 20;
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

          // Track curve.
          var pts = checkpoints;

          // First we compute the chord length of the curve.
          var totalLength = 0;
          var chords = [];
          var numChords = pts.length - 1;
          var i;
          for (i = 0; i < numChords; ++i) {
            var chordLength = new Vec2().sub(pts[i+1], pts[i]).length();
            chords.push(chordLength);
            totalLength += chordLength;
          }

          var radius = 240;
          var calls = [];
          var tStep = radius / 2;  // too small?
          var t = 0;
          for (i = 0; i < numChords; ++i) {
            // TODO: try different start point positions?
            var cp = [ pts[i-1] || pts[i], pts[i], pts[i+1], pts[i+2] || pts[i+1] ];
            for (; t < chords[i]; t += tStep) {
              var u = t / chords[i];
              var pX = catmullRom(cp[0].x, cp[1].x, cp[2].x, cp[3].x, u);
              var pY = catmullRom(cp[0].y, cp[1].y, cp[2].y, cp[3].y, u);
              var pZ = catmullRom(cp[0].z, cp[1].z, cp[2].z, cp[3].z, u);

              drawCircleDisplacement(dispMap, pX, pY, pZ, radius, 0.2, 1);
              //drawCircle(maps.surface, maps.surface.packed, 4, 2, pX, pY, 255, 100, 0.4, 1);
            }
            t -= chords[i];
          }
          // Stagger the drawCircle calls.
          /*var samples = [0, 2, 4, 1, 5, 3], jump = samples.length, j;
          for (j = 0; j < jump; ++j) {
            for (i = samples[j]; i < calls.length; i += jump) {
              calls[i]();
            }
          }*/
          adjustCheckpointHeights();
          callback();
        };

        var heightNode = maps.height._quiverNode;
        var sourceNode = heightNode.inputs[0];  // TODO: Verify which output.
        var drawTrackNode = new quiver.Node(drawTrack.bind(this));
        //quiver.inject(...) or
        //quiver.disconnect(...)
        heightNode.inputs.shift();
        sourceNode.outputs.shift();
        quiver.connect(sourceNode,
                       {},  // Create an intermediate buffer to store clean height.
                       drawTrackNode,
                       heightNode);

        quiver.connect(this.config.course.checkpoints,
                       drawTrackNode,
                       this.checkpoints);

        //this.scenery = new gameScenery.Scenery(config.scenery, this);

        if (callback) callback();
      }.bind(this));
    }
  };

  return exports;
});
