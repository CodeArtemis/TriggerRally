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

  Vec3 = THREE.Vector3
  _tmpVec3a = new Vec3()

  # Points passed in will be modified (center will be subtracted).
  constructor: (points, radius) ->
    @points = points or []
    @radius = radius or 0
    @_centerPoints()

  _centerPoints: ->
    min = new Vec3 Infinity, Infinity, Infinity
    max = new Vec3 -Infinity, -Infinity, -Infinity
    radSq = 0
    for pt in @points
      min.x = Math.min min.x, pt.x
      min.y = Math.min min.y, pt.y
      min.z = Math.min min.z, pt.z
      max.x = Math.max max.x, pt.x
      max.y = Math.max max.y, pt.y
      max.z = Math.max max.z, pt.z
    center = min.clone().addSelf(max).multiplyScalar(0.5)
    for pt in @points
      pt.subSelf center
      radSq = Math.max radSq, pt.lengthSq()
    @bounds =
      center: center
      min: min
      max: max
      radius: Math.sqrt radSq

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
    contacts
