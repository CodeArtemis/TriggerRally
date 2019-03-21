/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'THREE'
], function(
  THREE
) {
  const MB = {
    LEFT: 1,
    MIDDLE: 2,
    RIGHT: 4
  };

  const Vec3 = THREE.Vector3;

  const tmpVec3 = new Vec3;
  const tmpVec3b = new Vec3;
  const plusZVec3 = new Vec3(0, 0, 1);

  const intersectZLine = function(ray, pos) {
    const sideways = tmpVec3.cross(ray.direction, plusZVec3);
    const normal = tmpVec3b.cross(tmpVec3, plusZVec3);
    normal.normalize();
    const dot = normal.dot(ray.direction);
    if (Math.abs(dot) < 1e-10) { return null; }
    tmpVec3.sub(pos, ray.origin);
    const lambda = tmpVec3.dot(normal) / dot;
    if (lambda < ray.near) { return null; }
    const isect = ray.direction.clone();
    isect.multiplyScalar(lambda).add(ray.origin);
    isect.x = pos.x;
    isect.y = pos.y;
    return {
      pos: isect,
      distance: lambda
    };
  };

  const intersectZPlane = function(ray, pos) {
    if (Math.abs(ray.direction.z) < 1e-10) { return null; }
    const lambda = (pos.z - ray.origin.z) / ray.direction.z;
    if (lambda < ray.near) { return null; }
    const isect = ray.direction.clone();
    isect.multiplyScalar(lambda).add(ray.origin);
    isect.z = pos.z;  // Make sure no arithmetic error creeps in.
    const diff = isect.clone().sub(pos);
    //if diff.length() > 20
    //  debugger
    return {
      pos: isect,
      distance: lambda
    };
  };

  return {
    MB,
    intersectZLine,
    intersectZPlane
  };
});
