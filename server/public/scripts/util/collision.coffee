###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

###
# Contact convention:
#   normal: points from obj1 to obj2, and from pos2 to pos1
#   pos1: contact point on surface of obj1
#   pos2: contact point on surface of obj2
#   depth: distance between pos1 and pos2
#   surfacePos is deprecated, equivalent to pos2
###

define [
  'THREE'
], (THREE) ->
  SphereList: class SphereList

    Vec3 = THREE.Vector3
    _tmpVec3a = new Vec3()

    # Points passed in will be modified (center will be subtracted).
    constructor: (@points) ->
      @_centerPoints() if points

    clone: ->
      sl = new SphereList
      sl.points = for pt in @points
        p = pt.clone()
        p.radius = pt.radius
        p
      sl.bounds =
        center: @bounds.center.clone()
        min: @bounds.min.clone()
        max: @bounds.max.clone()
        radius: @bounds.radius
      sl

    _centerPoints: ->
      min = new Vec3 Infinity, Infinity, Infinity
      max = new Vec3 -Infinity, -Infinity, -Infinity
      for pt in @points
        rad = pt.radius
        min.x = Math.min min.x, pt.x - rad
        min.y = Math.min min.y, pt.y - rad
        min.z = Math.min min.z, pt.z - rad
        max.x = Math.max max.x, pt.x + rad
        max.y = Math.max max.y, pt.y + rad
        max.z = Math.max max.z, pt.z + rad
      center = min.clone().addSelf(max).multiplyScalar(0.5)
      radius = 0
      # TODO: Stop subtracting center from all pts? It adds a lot of overhead later.
      for pt in @points
        pt.subSelf center
        radius = Math.max radius, pt.length() + pt.radius
      @bounds =
        center: center
        min: min
        max: max
        radius: radius

    collideSphereList: (sl2) ->
      sl1 = @
      contacts = []
      center1 = sl1.bounds.center
      center2 = sl2.bounds.center
      _tmpVec3a.sub center2, center1
      if _tmpVec3a.length() < sl1.bounds.radius + sl2.bounds.radius
        # Collide MxN sphere to sphere.
        for pt1 in sl1.points
          for pt2 in sl2.points
            _tmpVec3a.sub pt2, pt1
            _tmpVec3a.addSelf center2
            _tmpVec3a.subSelf center1
            dist = _tmpVec3a.length()
            bothRadius = pt1.radius + pt2.radius
            continue unless dist < bothRadius
            _tmpVec3a.multiplyScalar 1 / dist
            contact =
              normal: _tmpVec3a.clone()
              depth: bothRadius - dist
              pos1: _tmpVec3a.clone().multiplyScalar(pt1.radius).addSelf(pt1).addSelf(center1)
              pos2: _tmpVec3a.clone().multiplyScalar(-pt2.radius).addSelf(pt2).addSelf(center2)
            contacts.push contact
      contacts
