/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'THREE'
], function(THREE) {
  let ArrayGeometry;
  return {
    ArrayGeometry: (ArrayGeometry = class ArrayGeometry extends THREE.BufferGeometry {
      constructor() {
        super();
        this.wireframe = false;
      }

      doubleTriangles() {
        const indices = this.index.array;
        const newIndices = new Uint32Array(indices.length);
        let i = 0;
        while (i < (indices.length - 2)) {
          newIndices.push(indices[i+0], indices[i+1], indices[i+1]);
          newIndices.push(indices[i+2], indices[i+2], indices[i+0]);
          i += 3;
        }
        this.index.array = newIndices;
      }

      removeIndices() {
        const indices = this.index.array;
        delete this.index;

        for (let key in this.attributes) {
          const attrib = this.attributes[key];
          const { itemSize } = attrib;
          const oldArray = attrib.array;
          const newArray = (attrib.array = new Float32Array(indices.length * itemSize));
          for (let i = 0, end = indices.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            for (let j = 0, end1 = itemSize, asc1 = 0 <= end1; asc1 ? j < end1 : j > end1; asc1 ? j++ : j--) {
              newArray[(i * itemSize) + j] = oldArray[(indices[i] * itemSize) + j];
            }
          }
        }

        this.attributes['position'].numItems = indices.length * 3;
      }

      updateOffsets() {
        // Destrutively chop up index array to fit UNSIGNED_SHORT limit.
        // TODO: Add OES_element_index_uint support.
        if (this.wireframe) { this.doubleTriangles(); }
        this.groups = [];
        let offset = {
          count: 0,
          start: 0
        };
        let elem = 0;
        const PRIMITIVE_SIZE = this.wireframe ? 2 : 3;
        const MAX_INDEX = 65535;
        let minIndexFound = Infinity;
        let maxIndexFound = 0;
        const indices = this.index.array;
        const maxElem = (indices.length - PRIMITIVE_SIZE) + 1;
        const addOffset = () => {
          offset.index = minIndexFound;
          for (let i = offset.start, end = elem, asc = offset.start <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            indices[i] -= minIndexFound;
          }
          return this.groups.push(offset);
        };
        while (elem < maxElem) {
          let primMinIndex = Infinity;
          let primMaxIndex = 0;
          for (let i = 0, end = PRIMITIVE_SIZE, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            primMinIndex = Math.min(primMinIndex, indices[elem + i]);
            primMaxIndex = Math.max(primMaxIndex, indices[elem + i]);
          }
          const newMinIndexFound = Math.min(minIndexFound, primMinIndex);
          const newMaxIndexFound = Math.max(maxIndexFound, primMaxIndex);
          if ((newMaxIndexFound - newMinIndexFound) > MAX_INDEX) {
            // New primitive doesn't fit. Save this offset and start a new one.
            addOffset();
            offset = {
              count: 0,
              start: elem
            };
            minIndexFound = primMinIndex;
            maxIndexFound = primMaxIndex;
          } else {
            minIndexFound = newMinIndexFound;
            maxIndexFound = newMaxIndexFound;
          }
          elem += PRIMITIVE_SIZE;
          offset.count += PRIMITIVE_SIZE;
        }
        // Save final offset.
        if (offset.count > 0) { addOffset(); }
        //if @groups.length > 1
        //  console.log 'ArrayGeometry with ' + indices.length/3 + ' triangles split into ' + @groups.length + ' DrawElements calls.'

        for (let key in this.attributes) {
          const attrib = this.attributes[key];
          const type = key === "index" ? Uint16Array : Float32Array;
          attrib.array = new type(attrib.array);
        }
      }

      addGeometry(geom) {
        let index = [];
        let position = [];
        let normal = [];
        let uv = [];

        if (this.index) { index = Array.prototype.slice(this.index.array); }
        if (this.attributes["position"]) { position = Array.prototype.slice(this.attributes["position"].array); }
        if (this.attributes["normal"]) { normal = Array.prototype.slice(this.attributes["normal"].array); }
        if (this.attributes["uv"]) { uv = Array.prototype.slice(this.attributes["uv"].array); }

        const pts = [ 'a', 'b', 'c', 'd' ];
        const offsetPosition = position.length;

        for (let v of Array.from(geom.vertices)) {
          position.push(v.x, v.y, v.z);
        }

        for (let faceIndex = 0; faceIndex < geom.faces.length; faceIndex++) {
          var pt;
          const face = geom.faces[faceIndex];
          if (face.d != null) {
            index.push(face.a, face.b, face.d);
            index.push(face.b, face.c, face.d);
          } else {
            index.push(face.a, face.b, face.c);
          }

          for (pt = 0; pt < face.vertexNormals.length; pt++) {
            const norm = face.vertexNormals[pt];
            normal[(face[pts[pt]] * 3) + 0] = norm.x;
            normal[(face[pts[pt]] * 3) + 1] = norm.y;
            normal[(face[pts[pt]] * 3) + 2] = norm.z;
          }

          // We support only one channel of UVs.
          const uvs = geom.faceVertexUvs[0][faceIndex];
          for (pt = 0; pt < uvs.length; pt++) {
            uv = uvs[pt];
            uv[(face[pts[pt]] * 2) + 0] = uv.x;
            uv[(face[pts[pt]] * 2) + 1] = uv.y;
          }
        }

        this.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
        this.addAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
        this.addAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3));
        this.addAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
      }

      mergeMesh(mesh) {
        let index = [];
        let position = [];
        let normal = [];
        let uv = [];

        if (this.index) { index = Array.prototype.slice(this.index.array); }
        if (this.attributes["position"]) { position = Array.prototype.slice(this.attributes["position"].array); }
        if (this.attributes["normal"]) { normal = Array.prototype.slice(this.attributes["normal"].array); }
        if (this.attributes["uv"]) { uv = Array.prototype.slice(this.attributes["uv"].array); }

        const vertexOffset = position.length / 3;
        const geom2 = mesh.geometry;
        const tmpVec3 = new THREE.Vector3;

        if (mesh.matrixAutoUpdate) { mesh.updateMatrix(); }

        const { matrix } = mesh;
        const matrixRotation = new THREE.Matrix4();
        matrixRotation.extractRotation(matrix, mesh.scale);

        // Copy vertex data.
        let i = 0;
        const positions2 = geom2.attributes["position"].array;
        const norms = geom2.attributes["normal"].array;
        const positionArray = position;
        const normalArray = normal;
        const hasNorms = (norms != null) && (norms.length === positions2.length);
        while (i < positions2.length) {
          tmpVec3.set(positions2[i + 0], positions2[i + 1], positions2[i + 2]);
          tmpVec3.applyMatrix4(matrix);
          positionArray.push(tmpVec3.x, tmpVec3.y, tmpVec3.z);
          if (hasNorms) {
            tmpVec3.set(norms[i + 0], norms[i + 1], norms[i + 2]);
            tmpVec3.applyMatrix4(matrixRotation);
            normalArray.push(tmpVec3.x, tmpVec3.y, tmpVec3.z);
          }
          i += 3;
        }
        uv = uv.concat(geom2.attributes["uv"].array);

        // Copy indices.
        const indexArray = index;
        for (let idx of Array.from(geom2.index.array)) {
          indexArray.push(idx + vertexOffset);
        }

        this.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
        this.addAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
        this.addAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3));
        this.addAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));

      }

      computeBoundingSphere() { return this.computeBounds(); }
      computeBoundingBox() { return this.computeBounds(); }
      computeBounds() {
        let radius;
        const bb = {
          min: new THREE.Vector3(Infinity, Infinity, Infinity),
          max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
        };
        let maxRadius = 0;
        let i = 0;
        const positions2 = this.attributes["position"].array;
        const numVerts = positions2.length;
        while (i < numVerts) {
          const x = positions2[i + 0];
          const y = positions2[i + 1];
          const z = positions2[i + 2];
          bb.min.x = Math.min(bb.min.x, x);
          bb.max.x = Math.max(bb.max.x, x);
          bb.min.y = Math.min(bb.min.y, y);
          bb.max.y = Math.max(bb.max.y, y);
          bb.min.z = Math.min(bb.min.z, z);
          bb.max.z = Math.max(bb.max.z, z);
          radius = Math.sqrt((x * x) + (y * y) + (z * z));
          maxRadius = Math.max(maxRadius, radius);
          i += 3;
        }

        this.boundingBox = bb;
        this.boundingSphere = {
          radius: maxRadius,
          center: new THREE.Vector2()
        };
      }
    })
  };
});
