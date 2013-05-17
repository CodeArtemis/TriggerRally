define [
  'THREE'
], (
  THREE
) ->
  MB =
    LEFT: 1
    MIDDLE: 2
    RIGHT: 4

  Vec3 = THREE.Vector3

  tmpVec3 = new Vec3
  tmpVec3b = new Vec3
  plusZVec3 = new Vec3 0, 0, 1

  intersectZLine = (ray, pos) ->
    sideways = tmpVec3.cross ray.direction, plusZVec3
    normal = tmpVec3b.cross tmpVec3, plusZVec3
    normal.normalize()
    dot = normal.dot ray.direction
    return null if Math.abs(dot) < 1e-10
    tmpVec3.sub pos, ray.origin
    lambda = tmpVec3.dot(normal) / dot
    return null if lambda < ray.near
    isect = ray.direction.clone()
    isect.multiplyScalar(lambda).addSelf(ray.origin)
    isect.x = pos.x
    isect.y = pos.y
    pos: isect
    distance: lambda

  intersectZPlane = (ray, pos) ->
    return null if Math.abs(ray.direction.z) < 1e-10
    lambda = (pos.z - ray.origin.z) / ray.direction.z
    return null if lambda < ray.near
    isect = ray.direction.clone()
    isect.multiplyScalar(lambda).addSelf(ray.origin)
    isect.z = pos.z  # Make sure no arithmetic error creeps in.
    diff = isect.clone().subSelf pos
    #if diff.length() > 20
    #  debugger
    pos: isect
    distance: lambda

  {
    MB
    intersectZLine
    intersectZPlane
  }
