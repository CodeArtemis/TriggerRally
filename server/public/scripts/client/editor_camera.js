/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'THREE',
  'util/util'
], function(
  THREE,
  util
) {
  let EditorCameraControl;
  const { KEYCODE } = util;
  const Vec3 = THREE.Vector3;
  const TWOPI = Math.PI * 2;

  const tmpVec3 = new Vec3;

  return (EditorCameraControl = class EditorCameraControl {
    constructor(camera) {
      this.camera = camera;
      this.pos = camera.position;
      this.ang = camera.rotation;
      this.vel = new Vec3;
      this.velTarget = new Vec3;
      this.angVel = new Vec3;
      this.angVelTarget = new Vec3;
      this.autoTimer = -1;
      this.autoPos = new Vec3;
      this.autoAng = new Vec3;
    }

    autoTo(pos, rot) {
      Vec3.prototype.set.apply(this.autoPos, pos);
      this.autoAng.x = 0.9;
      this.autoAng.z = rot[2] - (Math.PI / 2);
      this.autoPos.x -= 20 * Math.cos(rot[2]);
      this.autoPos.y -= 20 * Math.sin(rot[2]);
      this.autoPos.z += 30;
      return this.autoTimer = 0;
    }

    rotate(origin, angX, angZ) {
      const rot = new THREE.Matrix4();
      rot.rotateZ(-angZ + this.ang.z + Math.PI);
      rot.rotateX(angX);
      rot.rotateZ(-this.ang.z - Math.PI);
      this.pos.sub(origin);
      this.pos.applyMatrix4(rot);
      this.pos.add(origin);
      this.ang.x -= angX;
      this.ang.z -= angZ;
      return this.updateMatrix();
    }

    translate(vec) {
      this.pos.add(vec);
      return this.updateMatrix();
    }

    updateMatrix() {
      // This seems to fix occasional glitches in THREE.Projector.
      return this.camera.updateMatrixWorld();
    }

    update(delta, keyDown, terrainHeight) {
      let SPEED = 30 + (0.8 * Math.max(0, this.pos.z - terrainHeight));
      const VISCOSITY = 20;

      this.velTarget.set(0, 0, 0);
      this.angVelTarget.set(0, 0, 0);
      if (keyDown[KEYCODE.SHIFT]) { SPEED *= 3; }
      if (keyDown[KEYCODE.RIGHT]) { this.velTarget.x += SPEED; }
      if (keyDown[KEYCODE.LEFT]) { this.velTarget.x -= SPEED; }
      if (keyDown[KEYCODE.UP]) { this.velTarget.y += SPEED; }
      if (keyDown[KEYCODE.DOWN]) { this.velTarget.y -= SPEED; }

      if (this.autoTimer !== -1) {
        this.autoTimer = Math.min(1, this.autoTimer + delta);
        if (this.autoTimer < 1) {
          this.velTarget.subVectors(this.autoPos, this.pos);
          this.velTarget.multiplyScalar(delta * 10 * this.autoTimer);
          this.pos.add(this.velTarget);

          this.ang.z -= Math.round((this.ang.z - this.autoAng.z) / TWOPI) * TWOPI;
          this.velTarget.subVectors(this.autoAng, this.ang);
          this.velTarget.multiplyScalar(delta * 10 * this.autoTimer);
          this.ang.x += this.velTarget.x;
          this.ang.y += this.velTarget.y;
          this.ang.z += this.velTarget.z;
        } else {
          this.pos.copy(this.autoPos);
          this.ang.copy(this.autoAng);
          this.autoTimer = -1;
        }
      } else {
        this.velTarget.set(
            (this.velTarget.x * Math.cos(this.ang.z)) - (this.velTarget.y * Math.sin(this.ang.z)),
            (this.velTarget.x * Math.sin(this.ang.z)) + (this.velTarget.y * Math.cos(this.ang.z)),
            this.velTarget.z);

        const mult = 1 / (1 + (delta * VISCOSITY));
        this.vel.x = this.velTarget.x + ((this.vel.x - this.velTarget.x) * mult);
        this.vel.y = this.velTarget.y + ((this.vel.y - this.velTarget.y) * mult);
        this.vel.z = this.velTarget.z + ((this.vel.z - this.velTarget.z) * mult);
        this.angVel.x = this.angVelTarget.x + ((this.angVel.x - this.angVelTarget.x) * mult);
        this.angVel.y = this.angVelTarget.y + ((this.angVel.y - this.angVelTarget.y) * mult);
        this.angVel.z = this.angVelTarget.z + ((this.angVel.z - this.angVelTarget.z) * mult);

        this.pos.add(tmpVec3.copy(this.vel).multiplyScalar(delta));

        tmpVec3.copy(this.angVel).multiplyScalar(delta);

        this.ang.x += tmpVec3.x;
        this.ang.y += tmpVec3.y;
        this.ang.z += tmpVec3.z;
      }

      return this.ang.x = Math.max(0, Math.min(2, this.ang.x));
    }
  });
});
