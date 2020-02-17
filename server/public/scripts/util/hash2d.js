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
], function() {
  const exports = {};
  exports.Hash2D = class Hash2D {
    // Hashes objects into a grid of square tiles.
    constructor(gridSize) {
      this.gridSize = gridSize;
      this.tiles = {};
    }

    hasTile(tX, tY) {
      const key = tX + ',' + tY;
      return Array.from(this.tiles).includes(key);
    }

    getTile(tX, tY) {
      const key = tX + ',' + tY;
      return this.tiles[key];
    }

    setTile(tX, tY, tile) {
      const key = tX + ',' + tY;
      return this.tiles[key] = tile;
    }

    addObject(x, y, object) {
      const tX = Math.floor(x / this.gridSize);
      const tY = Math.floor(y / this.gridSize);
      const key = tX + ',' + tY;
      // tile = @tiles[key] ?= []
      const tile = this.tiles[key] || (this.tiles[key] = []);
      tile.push(object);
    }

    getObjects(minX, minY, maxX, maxY) {
      const tMinX = Math.floor(minX / this.gridSize);
      const tMaxX = Math.ceil(maxX / this.gridSize);
      const tMinY = Math.floor(minY / this.gridSize);
      const tMaxY = Math.ceil(maxY / this.gridSize);
      const tiles = [];
      for (let tY = tMinY, end = tMaxY, asc = tMinY <= end; asc ? tY < end : tY > end; asc ? tY++ : tY--) {
        for (let tX = tMinX, end1 = tMaxX, asc1 = tMinX <= end1; asc1 ? tX < end1 : tX > end1; asc1 ? tX++ : tX--) {
          const key = tX + ',' + tY;
          const tile = this.tiles[key];
          if (tile != null) { tiles.push(tile); }
        }
      }
      return [].concat.apply([], tiles);
    }
  };

  // Hashes references to objects. When querying a region, returns each object
  // only once even if it appears in multiple tiles.
  exports.IndirectHash2D = class IndirectHash2D extends exports.Hash2D {
    constructor(gridSize) {
      super(gridSize);
      this.objects = [];
      this.nextId = 0;
    }

    // Add an object to all tiles touched by a circle.
    addCircle(x, y, radius, object) {
      const tCenterX = x / this.gridSize;
      const tCenterY = y / this.gridSize;
      const tRad = radius / this.gridSize;
      const tMinX = Math.floor(tCenterX - tRad);
      const tMaxX = Math.ceil(tCenterX + tRad);
      const tMinY = Math.floor(tCenterY - tRad);
      const tMaxY = Math.ceil(tCenterY + tRad);
      for (let tY = tMinY, end = tMaxY, asc = tMinY <= end; asc ? tY < end : tY > end; asc ? tY++ : tY--) {
        for (let tX = tMinX, end1 = tMaxX, asc1 = tMinX <= end1; asc1 ? tX < end1 : tX > end1; asc1 ? tX++ : tX--) {
          // TODO: Check that this tile actually touches the circle.
          const key = tX + ',' + tY;
          const tile = this.tiles[key] || (this.tiles[key] = []);
          tile.push(this.nextId);
        }
      }
      this.objects[this.nextId++] = object;
    }

    getObjects(minX, minY, maxX, maxY) {
      let id;
      const ids = super.getObjects(minX, minY, maxX, maxY);
      const idSet = [];
      for (id of Array.from(ids)) {
        idSet[id] = true;
      }
      return ((() => {
        const result = [];
        for (id in idSet) {
          result.push(this.objects[id]);
        }
        return result;
      })());
    }
  };

  return exports;
});
