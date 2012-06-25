###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

collision = exports? and @ or @collision = {}

###
# Contact convention:
#   normal: points from obj1 to obj2, and from pos2 to pos1
#   pos1: contact point on surface of obj1
#   pos2: contact point on surface of obj2
#   depth: distance between pos1 and pos2
###


class collision.SphereHull

  _tmpVec3a = new THREE.Vector3()

  constructor: (points, radius) ->
    @points = points or []
    @radius = radius or 0

  collideSphereHull: (hull2) ->
    hull1 = @
    contacts = []
    bothRadius = hull1.radius + hull2.radius
    bothRadiusSq = bothRadius * bothRadius
    # Collide sphere-sphere.
    for pt1 in hull1.points
      for pt2 in hull2.points
        _tmpVec3a.sub pt2, pt1
        distSq = _tmpVec3a.lengthSq()
        unless distSq < bothRadiusSq then continue
        dist = Math.sqrt distSq
        _tmpVec3a.multiplyScalar 1/dist
        contact =
          normal: _tmpVec3a
          depth: bothRadius - dist
          pos1: _tmpVec3a.clone().multiplyScalar(hull1.radius).addSelf(pt1)
          pos2: _tmpVec3a.clone().multiplyScalar(-hull2.radius).addSelf(pt2)
        contacts.push contact
    return contacts
