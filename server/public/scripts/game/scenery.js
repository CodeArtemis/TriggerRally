/**
 * @author jareiko / http://www.jareiko.net/
 */

define([
  'util/LFIB4',
  'util/collision',
  'util/hash2d',
  'util/util',
  'THREE'
],
function(LFIB4, collision, hash2d, util, THREE) {
  var exports = {};

  var Vec2 = THREE.Vector2;
  var Vec3 = THREE.Vector3;
  var catmullRom = util.catmullRom;

  var COLLISION_HASH_SIZE = 5;

  exports.Scenery = function(track) {
    this.track = track;
    this.layers = [];
    this.layersById = {};
    this.root = track.root;
    this.root.on([
        'change:track.config.scenery',
        'change:track.env.scenery'
      ].join(' '), this.refresh, this);
  };

  exports.Scenery.prototype.getLayer = function(id) {
    return this.layers[this.layersById[id]];
  };

  exports.Scenery.prototype.collideSphere = function(sphere) {
    var result = [];
    this.layers.forEach(function(layer) {
      if (layer.config.collision) {
        result.push(layer.collideSphere(sphere));
      }
    });
    return [].concat.apply([], result);
  };

  exports.Scenery.prototype.collideSphereList = function(sphereList) {
    var result = [];
    this.layers.forEach(function(layer) {
      if (layer.config.collision) {
        result.push(layer.collideSphereList(sphereList));
      }
    });
    return [].concat.apply([], result);
  };

  exports.Scenery.prototype.intersectRay = function(ray) {
    var isect = [], i, l;
    for (i = 0, l = this.layers.length; i < l; ++i) {
      isect.push(this.layers[i].intersectRay(ray));
    }
    return [].concat.apply([], isect);
  };

  exports.Scenery.prototype.refresh = function() {
    this.layers = [];
    this.layersById = {};
    var config = this.root.track.config.scenery;
    if (!config) return;
    var env = this.root.track.env;
    if (!env) return;
    var envConfig = env.scenery;
    if (!envConfig) return;
    var layers = envConfig.layers;
    for (var i = 0; i < layers.length; ++i) {
      var layerId = layers[i].id;
      var trackScenery = config[layerId];
      var layer = new exports.Layer(layers[i], this, trackScenery);
      this.layers.push(layer);
      this.layersById[layer.config.id] = i;
    }
  };

  exports.Scenery.prototype.invalidateLayer = function(id) {
    if (id in this.layersById) {
      var i = this.layersById[id];
      this.layers[i] = new exports.Layer(this.envConfig.layers[i], this, this.config[id]);
    }
  };

  exports.Layer = function(config, scenery, trackScenery) {
    this.config = config;
    this.scenery = scenery;
    this.trackScenery = trackScenery;
    this.cache = new hash2d.Hash2D(config['tileSize']);
    this.add = null;
    this.sub = null;
    var addObjects = [];
    if (config.density.add) addObjects = addObjects.concat(config.density.add);
    if (trackScenery && trackScenery.add) addObjects = addObjects.concat(trackScenery.add);
    if (addObjects.length > 0) {
      this.add = new hash2d.Hash2D(config['tileSize']);
      addObjects.forEach(function(obj) {
        var object = {
          position: new Vec3(obj.pos[0], obj.pos[1], obj.pos[2]),
          rotation: new THREE.Euler(obj.rot[0], obj.rot[1], obj.rot[2]),
          scale: obj.scale || 1
        };
        this.add.addObject(object.position.x, object.position.y, object);
      }, this);
    }
    this.sphereList = null;
    if (config.collision) {
      if (config.collision.spheres) {
        var pts = [];
        config.collision.spheres.forEach(function (sphere) {
          var pt = new Vec3(sphere.pos[0], sphere.pos[1], sphere.pos[2]);
          pt.radius = sphere.radius;
          pts.push(pt);
        })
        this.sphereList = new collision.SphereList(pts);
      }
    }
  };

  // TODO: Factor out common code between collideSphere{,List}.
  exports.Layer.prototype.collideSphere = function(sphere) {
    var thisSphereList = this.sphereList;
    // TODO: This algorithm seems more efficient than IndirectHash2D. Replace it?
    var maxScale = 2.8;  // TODO: Compute the true maxScale is for this layer.
    var radius = sphere.radius + thisSphereList.bounds.radius * maxScale;
    var center = sphere;
    var objects = this.getObjects(
        center.x - radius, center.y - radius,
        center.x + radius, center.y + radius);
    var contactArrays = [];
    var mat4 = new THREE.Matrix4();
    var sl = thisSphereList.clone();
    var i, numpts = sl.points.length;
    var scale = new Vec3(), pt;
    objects.forEach(function(object) {
      var objScale = object.scale;
      mat4.makeRotationFromEuler(object.rotation);
      mat4.scale(scale.set(objScale, objScale, objScale));
      for (i = 0; i < numpts; ++i) {
        pt = sl.points[i];
        pt.copy(thisSphereList.points[i]);
        pt.applyMatrix4(mat4);
        pt.radius = thisSphereList.points[i].radius * objScale;
      }
      sl.bounds.center.copy(thisSphereList.bounds.center);
      sl.bounds.center.applyMatrix4(mat4);
      sl.bounds.center.add(object.position);
      sl.bounds.radius = thisSphereList.bounds.radius * objScale;
      contactArrays.push(sl.collideSphere(sphere));
    });
    return [].concat.apply([], contactArrays);
  };

  exports.Layer.prototype.collideSphereList = function(sphereList) {
    var thisSphereList = this.sphereList;
    // TODO: This algorithm seems more efficient than IndirectHash2D. Replace it?
    var maxScale = 2.8;  // TODO: Compute the true maxScale is for this layer.
    var radius = sphereList.bounds.radius + thisSphereList.bounds.radius * maxScale;
    var center = sphereList.bounds.center;
    var objects = this.getObjects(
        center.x - radius, center.y - radius,
        center.x + radius, center.y + radius);
    var contactArrays = [];
    var mat4 = new THREE.Matrix4();
    var sl = thisSphereList.clone();
    var i, numpts = sl.points.length;
    var scale = new Vec3(), pt;
    objects.forEach(function(object) {
      var objScale = object.scale;
      mat4.makeRotationFromEuler(object.rotation);
      mat4.scale(scale.set(objScale, objScale, objScale));
      for (i = 0; i < numpts; ++i) {
        pt = sl.points[i];
        pt.copy(thisSphereList.points[i]);
        pt.applyMatrix4(mat4);
        pt.radius = thisSphereList.points[i].radius * objScale;
      }
      sl.bounds.center.copy(thisSphereList.bounds.center);
      sl.bounds.center.applyMatrix4(mat4);
      sl.bounds.center.add(object.position);
      sl.bounds.radius = thisSphereList.bounds.radius * objScale;
      contactArrays.push(sl.collideSphereList(sphereList));
    });
    return [].concat.apply([], contactArrays);
  };

  exports.Layer.prototype.intersectRay = function(ray) {
    // We currently only intersect with allocated tiles.
    var radiusSq = 4;
    var isect = [];
    if (!this.trackScenery) return isect;
    var add = this.trackScenery.add;
    add && add.forEach(function(obj, idx) {
      var vec = new Vec3(obj.pos[0], obj.pos[1], obj.pos[2]);
      vec.sub(ray.origin);
      var a = 1;//ray.direction.dot(ray.direction);
      var along = ray.direction.dot(vec);
      var b = -2 * along;
      var c = vec.dot(vec) - radiusSq;
      var discrim = b * b - 4 * a * c;
      if (discrim >= 0) {
        isect.push({
          distance: along,
          type: 'scenery',
          layer: this.config.id,
          object: this.scenery.root.track.config.scenery[this.config.id].add[idx],
          idx: idx
        });
      }
    }, this);
    return isect;
  };

  exports.Layer.prototype.getObjects = function(minX, minY, maxX, maxY) {
    // TODO: Filter results again for better precision.
    return this.cache.getObjects(minX, minY, maxX, maxY);
  };

  exports.Layer.prototype.getTile = function(tX, tY) {
    if (!this.scenery.track.ready) return null;
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
      if (contact) {
        var gradient = density && density.gradient;
        if (gradient) {
          var gradProb = (contact.normal.z - gradient.min) /
                         (gradient.full - gradient.min);
          if (gradProb <= 0) continue;
          probability *= Math.min(gradProb, 1);
        }

        var typeProb = 1 - 0.2 * Math.abs(contact.surfaceType - 25);
        if (typeProb <= 0) continue;
        probability *= Math.min(typeProb, 1);
      }

      object.scale = (random() * 0.18 * probability + 0.9);

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

      object.rotation = new THREE.Euler(0, 0, random() * 2 * Math.PI);
      objects.push(object);
    }
    return objects;
  };

  return exports;
});
