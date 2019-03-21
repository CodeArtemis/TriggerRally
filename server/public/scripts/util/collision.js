/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

/*
 * Contact convention:
 *   normal: points from obj1 to obj2, and from pos2 to pos1
 *   pos1: contact point on surface of obj1
 *   pos2: contact point on surface of obj2
 *   depth: distance between pos1 and pos2
 *   surfacePos is deprecated, equivalent to pos2
 */

define([
  'THREE'
], function(THREE) {
  let SphereList;
  return {
    SphereList: (SphereList = (function() {
      let Vec3 = undefined;
      let tmpVec3a = undefined;
      let tmpPt2Vec = undefined;
      SphereList = class SphereList {
        static initClass() {
  
          Vec3 = THREE.Vector3;
          tmpVec3a = new Vec3();
  
          tmpPt2Vec = new Vec3();
        }

        // Points passed in will be modified (center will be subtracted).
        constructor(points) {
          this.points = points;
          if (points) { this._centerPoints(); }
        }

        clone() {
          const sl = new SphereList;
          sl.points = (() => {
            const result = [];
            for (let pt of Array.from(this.points)) {
              const p = pt.clone();
              p.radius = pt.radius;
              result.push(p);
            }
            return result;
          })();
          sl.bounds = {
            center: this.bounds.center.clone(),
            min: this.bounds.min.clone(),
            max: this.bounds.max.clone(),
            radius: this.bounds.radius
          };
          return sl;
        }

        _centerPoints() {
          let pt;
          const min = new Vec3(Infinity, Infinity, Infinity);
          const max = new Vec3(-Infinity, -Infinity, -Infinity);
          for (pt of Array.from(this.points)) {
            const rad = pt.radius;
            min.x = Math.min(min.x, pt.x - rad);
            min.y = Math.min(min.y, pt.y - rad);
            min.z = Math.min(min.z, pt.z - rad);
            max.x = Math.max(max.x, pt.x + rad);
            max.y = Math.max(max.y, pt.y + rad);
            max.z = Math.max(max.z, pt.z + rad);
          }
          const center = min.clone().add(max).multiplyScalar(0.5);
          let radius = 0;
          // TODO: Stop subtracting center from all pts? It adds a lot of overhead later.
          for (pt of Array.from(this.points)) {
            pt.sub(center);
            radius = Math.max(radius, pt.length() + pt.radius);
          }
          return this.bounds = {
            center,
            min,
            max,
            radius
          };
        }

        collideSphere(sphere) {
          const sl1 = this;
          const contacts = [];
          const center1 = sl1.bounds.center;
          tmpVec3a.subVectors(sphere, center1);
          if (!(tmpVec3a.length() < (sl1.bounds.radius + sphere.radius))) { return contacts; }
          for (let pt1 of Array.from(sl1.points)) {
            tmpVec3a.subVectors(sphere, pt1);
            tmpVec3a.sub(center1);
            const dist = tmpVec3a.length();
            const bothRadius = pt1.radius + sphere.radius;
            if (!(dist < bothRadius)) { continue; }
            tmpVec3a.multiplyScalar(1 / dist);
            const contact = {
              normal: tmpVec3a.clone(),
              depth: bothRadius - dist,
              pos1: tmpVec3a.clone().multiplyScalar(pt1.radius).add(pt1).add(center1),
              pos2: tmpVec3a.clone().multiplyScalar(-sphere.radius).add(sphere)
            };
            contacts.push(contact);
          }
          return contacts;
        }
        collideSphereList(sl2) {
          const sl1 = this;
          const contacts = [];
          const center1 = sl1.bounds.center;
          const center2 = sl2.bounds.center;
          tmpVec3a.subVectors(center2, center1);
          if (!(tmpVec3a.length() < (sl1.bounds.radius + sl2.bounds.radius))) { return contacts; }
          // Collide MxN sphere to sphere.
          for (let pt2 of Array.from(sl2.points)) {
            tmpPt2Vec.copy(pt2);
            tmpPt2Vec.add(center2);
            tmpPt2Vec.radius = pt2.radius;
            Array.prototype.push.apply(contacts, this.collideSphere(tmpPt2Vec));
          }
          return contacts;
        }
      };
      SphereList.initClass();
      return SphereList;
    })())
  };
});
