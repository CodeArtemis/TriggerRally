/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'THREE'
], function(THREE) {
  const checkpointGeom = new THREE.Geometry();
  const checkpointMat = new THREE.MeshBasicMaterial({
    color: 0x103010,
    blending: THREE.AdditiveBlending,
    transparent: 1,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  (function() {
    const ringGeom = new THREE.CylinderGeometry(16, 16, 1, 32, 1, true);
    const ringMesh = new THREE.Mesh(ringGeom, checkpointMat);
    ringMesh.rotation.order = 'ZYX';
    ringMesh.rotation.x = 1.1;
    ringMesh.updateMatrix();
    let { matrix } = ringMesh;
    checkpointGeom.merge(ringMesh.geometry, matrix);

    ringMesh.rotation.z = (Math.PI * 2) / 3;
    ringMesh.updateMatrix();
    ({ matrix } = ringMesh);
    checkpointGeom.merge(ringMesh.geometry, matrix);

    ringMesh.rotation.z = (Math.PI * 4) / 3;
    ringMesh.updateMatrix();
    ({ matrix } = ringMesh);
    return checkpointGeom.merge(ringMesh.geometry, matrix);
  })();

  const selectionGeom = new THREE.IcosahedronGeometry(1, 2);
  const selectionMat = new THREE.MeshBasicMaterial({
    color: 0x101070,
    blending: THREE.AdditiveBlending,
    transparent: 1,
    depthWrite: false
  });

  return {
    checkpointMaterial() { return checkpointMat; },

    checkpointMesh() {
      const mesh = new THREE.Mesh(checkpointGeom, checkpointMat);
      mesh.position.z = 2;
      //mesh.rotation.x = Math.PI / 2
      mesh.castShadow = true;
      const wrapper = new THREE.Object3D;
      wrapper.add(mesh);
      return wrapper;
    },

    selectionMesh() {
      return new THREE.Mesh(selectionGeom, selectionMat);
    }
  };
});
