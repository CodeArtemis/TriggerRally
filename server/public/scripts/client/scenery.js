/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'client/array_geometry',
  'util/quiver'
], function(THREE, array_geometry, quiver) {

  let RenderScenery;
  const tmpVec3 = new THREE.Vector3();
  return {
    RenderScenery: (RenderScenery = class RenderScenery {
      constructor(scene, scenery, loadFunc) {
        this.scene = scene;
        this.scenery = scenery;
        this.loadFunc = loadFunc;
        this.fadeSpeed = 2;
        this.layers = (Array.from(this.scenery.layers).map((l) => this.createLayer(l)));
      }

      createLayer(src) {
        const meshes = [];
        const tiles = Object.create(null);
        const { render } = src.config;
        this.loadFunc(render["scene-r54"] || render["scene"], function(result) {
          for (let mesh of Array.from(result.scene.children)) {
            const geom = mesh.geometry;
            //geom.material = mesh.material
            mesh.geometry = geom;
            meshes.push(mesh);
          }
        });
        return { src, tiles, meshes };
      }

      createTile(layer, tx, ty, skipFadeIn) {
        const entities = layer.src.getTile(tx, ty);
        if (!entities) { return null; }
        const renderConfig = layer.src.config.render;
        const tile = new THREE.Object3D;
        tile.position.x = (tx + 0.5) * layer.src.cache.gridSize;
        tile.position.y = (ty + 0.5) * layer.src.cache.gridSize;
        tile.opacity = skipFadeIn ? 1 : 0;
        if (entities.length > 0) {
          for (let object of Array.from(layer.meshes)) {
            // We merge copies of each object into a single mesh.
            let mergedGeom = new THREE.Geometry();
            let mesh = new THREE.Mesh(object.geometry);
            for (let entity of Array.from(entities)) {
              mesh.scale.copy(object.scale);
              if (renderConfig.scale != null) { mesh.scale.multiplyScalar(renderConfig.scale); }
              mesh.scale.multiplyScalar(entity.scale);
              mesh.position.subVectors(entity.position, tile.position);
              tmpVec3.addVectors(object.rotation, entity.rotation);
              mesh.rotation.set(tmpVec3.x, tmpVec3.y, tmpVec3.z);
              mesh.updateMatrix();
              mergedGeom.merge(mesh.geometry, mesh.matrix);
            }

            mergedGeom = new THREE.BufferGeometry().fromGeometry(mergedGeom);
            // mergedGeom.updateOffsets()
            // Clone the material so that we can adjust opacity per tile.
            const material = object.material.clone();
            material.opacity = tile.opacity;
            // Force all objects to be transparent so we can fade them in and out.
            material.transparent = true;
            // material.blending = THREE.NormalBlending
            mesh = new THREE.Mesh(mergedGeom, material);
            mesh.doubleSided = object.doubleSided;
            mesh.castShadow = object.castShadow;
            mesh.receiveShadow = object.receiveShadow;
            tile.add(mesh);
          }
        }
        return tile;
      }

      removeTile(layer, key) {
        this.scene.remove(layer.tiles[key]);
        for (let mesh of Array.from(layer.tiles[key])) {
          mesh.dispose();
        }
        delete layer.tiles[key];
      }

      update(camera, delta) {
        let layer;
        let key;
        let added = false;
        let addAll = false;
        const fadeAmount = this.fadeSpeed * delta;

        // TODO: This shouldn't be done every frame. It should be notified of changes.
        for (var i = 0; i < this.scenery.layers.length; i++) {
          layer = this.scenery.layers[i];
          if (!this.layers[i]) { this.layers[i] = this.createLayer(layer); }
          if (this.layers[i].src === layer) { continue; }
          const keys = ((() => {
            const result = [];
            for (key in this.layers[i].tiles) {
              result.push(key);
            }
            return result;
          })());
          for (key of Array.from(keys)) { this.removeTile(this.layers[i], key); }
          this.layers[i].src = layer;
          addAll = true;
        }
        // TODO: Remove layers that have disappeared from @scenery.

        for (layer of Array.from(this.layers)) {
          var mesh, tile;
          if (!(layer.meshes.length > 0)) { continue; }  // Check that we have something to draw.
          var visibleTiles = {};
          const txCenter = Math.floor(camera.position.x / layer.src.cache.gridSize);
          const tyCenter = Math.floor(camera.position.y / layer.src.cache.gridSize);
          for (let start = tyCenter-3, ty = start, end = tyCenter+3, asc = start <= end; asc ? ty <= end : ty >= end; asc ? ty++ : ty--) {
            for (let start1 = txCenter-3, tx = start1, end1 = txCenter+3, asc1 = start1 <= end1; asc1 ? tx <= end1 : tx >= end1; asc1 ? tx++ : tx--) {
              key = tx + ',' + ty;
              visibleTiles[key] = true;
              tile = layer.tiles[key];
              if (!tile && (addAll || !added)) {
                tile = this.createTile(layer, tx, ty, addAll);
                added = true;
                if (tile) {
                  layer.tiles[key] = tile;
                  this.scene.add(tile);
                }
              }
              if (tile && (tile.opacity < 1)) {
                tile.opacity = Math.min(1, tile.opacity + fadeAmount);
                for (mesh of Array.from(tile.children)) {
                  mesh.material.opacity = tile.opacity;
                }
              }
            }
          }
          const toRemove = ((() => {
            const result1 = [];
            for (key in layer.tiles) {
              if (!visibleTiles[key]) {
                result1.push(key);
              }
            }
            return result1;
          })());
          for (key of Array.from(toRemove)) {
            tile = layer.tiles[key];
            tile.opacity -= fadeAmount;
            if (tile.opacity > 0) {
              for (mesh of Array.from(tile.children)) {
                mesh.material.opacity = tile.opacity;
              }
            } else {
              this.removeTile(layer, key);
            }
          }
        }
      }
    })
  };
});
