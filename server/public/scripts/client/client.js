/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'THREE',
  'underscore',
  'client/audio',
  'client/car',
  'client/misc',
  'client/scenery',
  'client/terrain',
  'game/track',
  'game/synchro',
  'util/pubsub',
  'util/quiver',
  'util/util',
  'THREE-scene-loader'
], function(
  THREE,
  _,
  clientAudio,
  clientCar,
  clientMisc,
  clientScenery,
  clientTerrain,
  gameTrack,
  synchro,
  pubsub,
  quiver,
  util,
  THREESceneLoader
) {
  let TriggerClient;
  const Vec2 = THREE.Vector2;
  const Vec3 = THREE.Vector3;
  const Vec4 = THREE.Vector4;
  const { PULLTOWARD } = util;
  const { MAP_RANGE } = util;
  const { KEYCODE } = util;
  const { deadZone } = util;

  const tmpVec3a = new Vec3;

  class RenderCheckpointsEditor {
    constructor(scene, root) {
      let reset;
      let meshes = [];

      (reset = function() {
        let mesh;
        for (mesh of Array.from(meshes)) {
          scene.remove(mesh);
        }
        const checkpoints = __guard__(root.track != null ? root.track.config : undefined, x => x.course.checkpoints.models);
        if (!checkpoints) { return; }
        return meshes = (() => {
          const result = [];
          for (let cp of Array.from(checkpoints)) {
            mesh = clientMisc.checkpointMesh();
            Vec3.prototype.set.apply(mesh.position, cp.pos);
            scene.add(mesh);
            result.push(mesh);
          }
          return result;
        })();
      })();

      root.on('change:track.config.course.checkpoints.', reset);
      root.on('add:track.config.course.checkpoints.', reset);
      root.on('remove:track.config.course.checkpoints.', reset);
      root.on('reset:track.config.course.checkpoints.', reset);

      this.destroy = () =>
        Array.from(meshes).map((mesh) =>
          scene.remove(mesh))
      ;
    }

    update(camera, delta) {}
  }

  class RenderCheckpointsDrive {
    constructor(scene, root) {
      this.root = root;
      this.ang = 0;
      this.mesh = clientMisc.checkpointMesh();
      this.initPos = this.mesh.position.clone();
      this.current = 0;
      scene.add(this.mesh);
    }

    destroy() {
      return this.mesh.parent.remove(this.mesh);
    }

    update(camera, delta) {
      const targetCp = this.root.track.config.course.checkpoints.at(this.current);
      if (targetCp == null) { return; }
      this.mesh.rotation.z += delta * 3;
      const meshPos = this.mesh.position;
      let pull = delta * 2;
      if (this.current === 0) { pull = 1; }
      meshPos.x = PULLTOWARD(meshPos.x, targetCp.pos[0] + this.initPos.x, pull);
      meshPos.y = PULLTOWARD(meshPos.y, targetCp.pos[1] + this.initPos.y, pull);
      return meshPos.z = PULLTOWARD(meshPos.z, targetCp.pos[2] + this.initPos.z, pull);
    }

    highlightCheckpoint(i) {
      return this.current = i;
    }
  }

  class RenderDials {
    constructor(scene, vehic) {
      this.vehic = vehic;
      const geom = new THREE.Geometry();
      geom.vertices.push(new Vec3(1, 0, 0));
      geom.vertices.push(new Vec3(-0.1, 0.02, 0));
      geom.vertices.push(new Vec3(-0.1, -0.02, 0));
      geom.faces.push(new THREE.Face3(0, 1, 2));
      // geom.computeCentroids()
      const mat = new THREE.MeshBasicMaterial({
        color: 0x206020,
        blending: THREE.AdditiveBlending,
        transparent: 1,
        depthTest: false
      });
      this.revMeter = new THREE.Mesh(geom, mat);
      this.revMeter.position.x = -1.3;
      this.revMeter.position.y = -0.2;
      this.revMeter.scale.multiplyScalar(0.4);
      scene.add(this.revMeter);
      this.speedMeter = new THREE.Mesh(geom, mat);
      this.speedMeter.position.x = -1.3;
      this.speedMeter.position.y = -0.7;
      this.speedMeter.scale.multiplyScalar(0.4);
      scene.add(this.speedMeter);

      this.$digital = $(".speedo");
    }

    destroy() {
      this.revMeter.parent.remove(this.revMeter);
      return this.speedMeter.parent.remove(this.speedMeter);
    }

    update(camera, delta) {
      const { vehic } = this;
      const convertKMH = 3.6;
      this.revMeter.rotation.z = -2.5 - (4.5 *
          ((vehic.engineAngVelSmoothed - vehic.engineIdle) /
              (vehic.engineRedline - vehic.engineIdle)));
      let speed = Math.abs(vehic.differentialAngVel) * vehic.avgDriveWheelRadius * convertKMH;
      this.speedMeter.rotation.z = -2.5 - (4.5 * speed * 0.004);
      // Use actual speed for the digital indicator.
      speed = vehic.body.getLinearVel().length() * convertKMH;
      this.$digital.text(speed.toFixed(0) + " km/h");
    }

    highlightCheckpoint(i) {
      this.current = i;
    }
  }

  class RenderCheckpointArrows {
    constructor(scene, progress) {
      this.scene = scene;
      this.progress = progress;
      const mat = new THREE.MeshBasicMaterial({
        color: 0x206020,
        blending: THREE.AdditiveBlending,
        transparent: 1,
        depthTest: false
      });
      const mat2 = new THREE.MeshBasicMaterial({
        color: 0x051005,
        blending: THREE.AdditiveBlending,
        transparent: 1,
        depthTest: false
      });
      // TODO: Use an ArrayGeometry.
      const geom = new THREE.Geometry();
      geom.vertices.push(new Vec3(0, 0, 0.6));
      geom.vertices.push(new Vec3(0.1, 0, 0.3));
      geom.vertices.push(new Vec3(-0.1, 0, 0.3));
      geom.vertices.push(new Vec3(0.1, 0, -0.2));
      geom.vertices.push(new Vec3(-0.1, 0, -0.2));
      geom.faces.push(new THREE.Face3(0, 2, 1));
      geom.faces.push(new THREE.Face3(1, 2, 3));
      geom.faces.push(new THREE.Face3(2, 4, 3));
      this.meshArrow = new THREE.Mesh(geom, mat);
      this.meshArrow.position.set(0, 1, -2);
      this.meshArrow2 = new THREE.Mesh(geom, mat2);
      this.meshArrow2.position.set(0, 0, 0.8);
      scene.add(this.meshArrow);
      this.meshArrow.add(this.meshArrow2);
    }

    destroy() {
      return this.meshArrow.parent.remove(this.meshArrow);
    }

    update(camera, delta) {
      let cpVec, cpVecCamSpace;
      const nextCp = this.progress.nextCheckpoint(0);
      const nextCp2 = this.progress.nextCheckpoint(1);
      const carPos = this.progress.vehicle.body.pos;
      const camMatrixEl = camera.matrixWorld.elements;
      this.meshArrow.visible = (nextCp != null);
      if (nextCp) {
        cpVec = new Vec2(nextCp.pos[0] - carPos.x,
                         nextCp.pos[1] - carPos.y);
        cpVecCamSpace = new Vec2(
            (cpVec.x * camMatrixEl[1]) + (cpVec.y * camMatrixEl[9]),
            (cpVec.x * camMatrixEl[0]) + (cpVec.y * camMatrixEl[8]));
        this.meshArrow.rotation.y = Math.atan2(cpVecCamSpace.y, cpVecCamSpace.x);
      }
      this.meshArrow2.visible = (nextCp2 != null);
      if (nextCp2) {
        cpVec = new Vec2(nextCp2.pos[0] - carPos.x,
                         nextCp2.pos[1] - carPos.y);
        cpVecCamSpace = new Vec2(
            (cpVec.x * camMatrixEl[1]) + (cpVec.y * camMatrixEl[9]),
            (cpVec.x * camMatrixEl[0]) + (cpVec.y * camMatrixEl[8]));
        return this.meshArrow2.rotation.y = Math.atan2(cpVecCamSpace.y, cpVecCamSpace.x) - this.meshArrow.rotation.y;
      }
    }
  }

  class CamControl {
    constructor(camera, car) {
      // Note that CamControl controls the camera it's given at construction,
      // not the one passed into update().
      this.camera = camera;
      this.car = car;
      this.mode = 0;

      const pullTransformedQuat = function(quat, quatTarget, amount) {
        quat.x = PULLTOWARD(quat.x, -quatTarget.z, amount);
        quat.y = PULLTOWARD(quat.y,  quatTarget.w, amount);
        quat.z = PULLTOWARD(quat.z,  quatTarget.x, amount);
        quat.w = PULLTOWARD(quat.w, -quatTarget.y, amount);
        return quat.normalize();
      };

      const translate = function(pos, matrix, x, y, z) {
        const el = matrix.elements;
        pos.x += (el[0] * x) + (el[4] * y) + (el[8] * z);
        pos.y += (el[1] * x) + (el[5] * y) + (el[9] * z);
        return pos.z += (el[2] * x) + (el[6] * y) + (el[10] * z);
      };

      const pullCameraQuat = function(cam, car, amount) {
        pullTransformedQuat(cam.quaternion, car.root.quaternion, amount);
        return cam.updateMatrix();
      };

      const translateCam = function(cam, car, x, y, z) {
        cam.position.copy(car.root.position);
        translate(cam.position, cam.matrix, x, y, z);
        return cam.matrix.setPosition(cam.position);
      };

      const chaseCam = {
        update(cam, car, delta) {
          if (car.bodyMesh != null) {
            car.bodyMesh.visible = true;
          }
          const targetPos = car.root.position.clone();
          targetPos.add(car.vehic.body.linVel.clone().multiplyScalar(.17));
          const offset = car.config.chaseCamOffset || [ 0, 1.2, -3 ];
          const { matrix } = car.root;

          targetPos.x += matrix.elements[0] * offset[0];
          targetPos.y += matrix.elements[1] * offset[0];
          targetPos.z += matrix.elements[2] * offset[0];

          targetPos.x += matrix.elements[4] * offset[1];
          targetPos.y += matrix.elements[5] * offset[1];
          targetPos.z += matrix.elements[6] * offset[1];

          targetPos.x += matrix.elements[8] * offset[2];
          targetPos.y += matrix.elements[9] * offset[2];
          targetPos.z += matrix.elements[10] * offset[2];

          const camDelta = delta * 5;
          cam.position.x = PULLTOWARD(cam.position.x, targetPos.x, camDelta);
          cam.position.y = PULLTOWARD(cam.position.y, targetPos.y, camDelta);
          cam.position.z = PULLTOWARD(cam.position.z, targetPos.z, camDelta);

          pullTransformedQuat(cam.quaternion, car.root.quaternion, 1);
          const lookPos = car.root.position.clone();
          translate(lookPos, car.root.matrix, 0, 0.7, 0);
          cam.lookAt(lookPos);
        }
      };

      const insideCam = {
        update(cam, car, delta) {
          if (car.bodyMesh != null) {
            car.bodyMesh.visible = true;
          }
          pullCameraQuat(cam, car, delta * 30);
          translateCam(cam, car, 0, 0.7, -1);
        }
      };

      const insideCam2 = {
        update(cam, car, delta) {
          if (car.bodyMesh != null) {
            car.bodyMesh.visible = false;
          }
          pullCameraQuat(cam, car, 1);
          translateCam(cam, car, 0, 0.7, -1);
        }
      };

      const wheelCam = {
        update(cam, car, delta) {
          if (car.bodyMesh != null) {
            car.bodyMesh.visible = true;
          }
          pullCameraQuat(cam, car, delta * 100);
          translateCam(cam, car, 1, 0, -0.4);
        }
      };

      this.modes = [
        chaseCam,
        insideCam,
        insideCam2,
        wheelCam
      ];
    }

    getMode() { return this.modes[this.mode]; }

    update(camera, delta) {
      if (this.car.root != null) {
        this.getMode().update(this.camera, this.car, delta);
      }
    }

    nextMode() {
      return this.mode = (this.mode + 1) % this.modes.length;
    }
  }

  class CamTerrainClipping {
    constructor(camera, terrain) {
      this.camera = camera;
      this.terrain = terrain;
    }

    update(camera, delta) {
      const camPos = this.camera.position;
      const contact = this.terrain.getContactRayZ(camPos.x, camPos.y);
      const terrainHeight = contact.surfacePos.z;
      camPos.z = Math.max(camPos.z, terrainHeight + 0.2);
    }
  }

  var KeyboardController = (function() {
    let THROTTLE_RESPONSE = undefined;
    let BRAKE_RESPONSE = undefined;
    let HANDBRAKE_RESPONSE = undefined;
    let TURN_RESPONSE = undefined;
    KeyboardController = class KeyboardController {
      static initClass() {
        THROTTLE_RESPONSE = 8;
        BRAKE_RESPONSE = 5;
        HANDBRAKE_RESPONSE = 20;
        TURN_RESPONSE = 5;
      }

      constructor(vehic, client) {
        this.vehic = vehic;
        this.client = client;
        this.controls = util.deepClone(this.vehic.controller.input);
      }

      update(delta) {
        const { keyDown } = this.client;
        const throttle = keyDown[KEYCODE['UP']] || keyDown[KEYCODE['W']] ? 1 : 0;
        const brake = keyDown[KEYCODE['DOWN']] || keyDown[KEYCODE['S']] ? 1 : 0;
        const left = keyDown[KEYCODE['LEFT']] || keyDown[KEYCODE['A']] ? 1 : 0;
        const right = keyDown[KEYCODE['RIGHT']] || keyDown[KEYCODE['D']] ? 1 : 0;
        const handbrake = keyDown[KEYCODE['SPACE']] ? 1 : 0;

        const { controls } = this;
        controls.throttle = PULLTOWARD(controls.throttle, throttle, THROTTLE_RESPONSE * delta);
        controls.brake = PULLTOWARD(controls.brake, brake, BRAKE_RESPONSE * delta);
        controls.handbrake = PULLTOWARD(controls.handbrake, handbrake, HANDBRAKE_RESPONSE * delta);
        return controls.turn = PULLTOWARD(controls.turn, left - right, TURN_RESPONSE * delta);
      }
    };
    KeyboardController.initClass();
    return KeyboardController;
  })();

  class GamepadController {
    constructor(vehic, gamepad) {
      this.vehic = vehic;
      this.gamepad = gamepad;
      this.controls = util.deepClone(this.vehic.controller.input);
    }

    update(delta) {
      const { controls } = this;
      const { axes } = this.gamepad;
      const { buttons } = this.gamepad;
      const axes0 = deadZone(axes[0], 0.05);
      const axes3 = deadZone(axes[3], 0.05);
      controls.throttle = Math.max(0, -axes3, buttons[0] || 0, buttons[5] || 0, buttons[7] || 0);
      controls.brake = Math.max(0, axes3, buttons[4] || 0, buttons[6] || 0);
      controls.handbrake = buttons[2] || 0;
      return controls.turn = (-axes0 - (buttons[15] || 0)) + (buttons[14] || 0);
    }
  }

  class WheelController {
    constructor(vehic, gamepad) {
      this.vehic = vehic;
      this.gamepad = gamepad;
      this.controls = util.deepClone(this.vehic.controller.input);
    }

    update(delta) {
      const { controls } = this;
      const { axes } = this.gamepad;
      const { buttons } = this.gamepad;
      const axes0 = deadZone(axes[0], 0.01);
      const axes1 = deadZone(axes[1], 0.01);
      controls.throttle = Math.max(0, -axes1);
      controls.brake = Math.max(0, axes1);
      controls.handbrake = Math.max(buttons[6] || 0, buttons[7] || 0);
      return controls.turn = -axes0;
    }
  }

  const getGamepads = function() {
    const nav = navigator;
    return (typeof nav.getGamepads === 'function' ? nav.getGamepads() : undefined) || nav.gamepads ||
    (typeof nav.mozGetGamepads === 'function' ? nav.mozGetGamepads() : undefined) || nav.mozGamepads ||
    (typeof nav.webkitGetGamepads === 'function' ? nav.webkitGetGamepads() : undefined) || nav.webkitGamepads ||
    [];
  };

  const gamepadType = function(id) {
    if (/Racing Wheel/.test(id)) {
      return WheelController;
    } else {
      return GamepadController;
    }
  };

  class CarControl {
    constructor(vehic, client) {
      this.vehic = vehic;
      this.client = client;
      this.controllers = [];
      this.gamepadMap = {};
      this.controllers.push(new KeyboardController(vehic, client));
    }

    update(camera, delta) {
      let key;
      const iterable = getGamepads();
      for (let i = 0; i < iterable.length; i++) {
        const gamepad = iterable[i];
        if ((gamepad != null) && !(i in this.gamepadMap)) {
          this.gamepadMap[i] = true;
          const type = gamepadType(gamepad.id);
          this.controllers.push(new type(this.vehic, gamepad));
        }
      }

      const controls = this.vehic.controller.input;
      for (key in controls) {
        controls[key] = 0;
      }
      for (let controller of Array.from(this.controllers)) {
        controller.update(delta);
        for (key in controls) {
          controls[key] += controller.controls[key];
        }
      }
    }
  }

  class SunLight {
    constructor(scene) {
      const sunLight = (this.sunLight = new THREE.DirectionalLight( 0xffe0bb ));
      sunLight.intensity = 1.3;
      this.sunLightPos = new Vec3(-6, 7, 10);
      sunLight.position.copy(this.sunLightPos);

      sunLight.castShadow = true;

      // sunLight.shadowCascade = yes
      // sunLight.shadowCascadeCount = 3
      // sunLight.shadowCascadeOffset = 10

      sunLight.shadow.camera.near = -20;
      sunLight.shadow.camera.far = 60;
      sunLight.shadow.camera.left = -24;
      sunLight.shadow.camera.right = 24;
      sunLight.shadow.camera.top = 24;
      sunLight.shadow.camera.bottom = -24;

      //sunLight.shadow.camera.visible = true

      // sunLight.shadowBias = -0.001
      // sunLight.shadowDarkness = 0.3

      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;

      scene.add(sunLight);
    }

    update(camera, delta) {
      this.sunLight.target.position.copy(camera.position);
      this.sunLight.position.copy(camera.position).add(this.sunLightPos);
      this.sunLight.updateMatrixWorld();
      this.sunLight.target.updateMatrixWorld();
    }
  }

  var Dust = (function() {
    let varying = undefined;
    let vertexShader = undefined;
    let fragmentShader = undefined;
    Dust = class Dust {
      static initClass() {
        varying = `\
varying vec4 vColor;
varying mat2 vRotation;
  \
`;
        vertexShader = varying + `\
uniform float fScale;
attribute vec4 aColor;
attribute vec2 aAngSize;
  
void main() {
  vColor = aColor;
  float angle = aAngSize.x;
  vec2 right = vec2(cos(angle), sin(angle));
  vRotation = mat2(right.x, right.y, -right.y, right.x);
  float size = aAngSize.y;
  //vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  // Vertices are already in world space.
  vec4 mvPosition = viewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = fScale * size / gl_Position.w;
}\
`;
        fragmentShader = varying + `\
uniform sampler2D tMap;
  
void main() {
  vec2 uv = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y);
  vec2 uvRotated = vRotation * uv + vec2(0.5, 0.5);
  vec4 map = texture2D(tMap, uvRotated);
  gl_FragColor = vColor * map;
}\
`;
      }
      constructor(scene) {
        this.length = 200;
        this.geom = new THREE.BufferGeometry();
        this.geom.addAttribute('position', new THREE.BufferAttribute(new Float32Array(this.length * 3), 3).setDynamic(true));
        this.geom.addAttribute('aColor', new THREE.BufferAttribute(new Float32Array(this.length * 4), 4).setDynamic(true));
        this.geom.addAttribute('aAngSize', new THREE.BufferAttribute(new Float32Array(this.length * 2), 2).setDynamic(true));

        this.aColor = this.geom.attributes.aColor;
        this.aAngSize = this.geom.attributes.aAngSize;
        this.other = [];
        for (let i = 0, end = this.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
          this.other.push({
            angVel: 0,
            linVel: new Vec3
          });
        }

        this.uniforms = {
          fScale: {
            value: 1000
          },
          tMap: {
            value: THREE.ImageUtils.loadTexture(window.BASE_PATH + '/a/textures/dust.png')
          }
        };
        const params = { uniforms: this.uniforms, vertexShader, fragmentShader };
        params.transparent = true;
        params.depthWrite = false;

        const mat = new THREE.ShaderMaterial(params);
        this.particleSystem = new THREE.Points(this.geom, mat);
        scene.add(this.particleSystem);
        this.idx = 0;
      }

      spawnDust(pos, vel) {
        const verts = this.geom.attributes.position.array;
        const { idx } = this;

        const vertexOffset = idx * 3;
        verts[vertexOffset] = pos.x;
        verts[vertexOffset + 1] = pos.y;
        verts[vertexOffset + 2] = pos.z;

        const aColorOffset = idx * 4;
        this.aColor.array[aColorOffset] = 0.75 + (0.2 * Math.random());
        this.aColor.array[aColorOffset + 1] = 0.55 + (0.2 * Math.random());
        this.aColor.array[aColorOffset + 2] = 0.35 + (0.2 * Math.random());
        this.aColor.array[aColorOffset + 3] = 1;

        const aAngSizeOffset = idx * 2;
        this.aAngSize.array[aAngSizeOffset] = Math.random() * Math.PI * 2;
        this.aAngSize.array[aAngSizeOffset + 1] = 0.2;

        const other = this.other[idx];
        other.angVel = Math.random() - 0.5;
        other.linVel.copy(vel);
        other.linVel.z += 0.5;
        return this.idx = (idx + 1) % (verts.length / 3);
      }

      spawnContrail(pos, vel) {
        const verts = this.geom.attributes.position.array;
        const { idx } = this;

        const vertexOffset = idx * 3;
        verts[vertexOffset] = pos.x;
        verts[vertexOffset + 1] = pos.y;
        verts[vertexOffset + 2] = pos.z;

        const intensity = 1 - (Math.random() * 0.05);
        const aColorOffset = idx * 4;
        this.aColor.array[aColorOffset] = intensity;
        this.aColor.array[aColorOffset + 1] = intensity;
        this.aColor.array[aColorOffset + 2] = intensity;
        this.aColor.array[aColorOffset + 3] = 0.3;

        const aAngSizeOffset = idx * 2;
        this.aAngSize.array[aAngSizeOffset] = Math.random() * Math.PI * 2;
        this.aAngSize.array[aAngSizeOffset + 1] = 0;

        const other = this.other[idx];
        other.angVel = 0;
        other.linVel.copy(vel);
        // other.linVel.z += 0.5
        return this.idx = (idx + 1) % (verts.length / 3);
      }

      update(camera, delta) {
        this.uniforms.fScale.value = 1000 / camera.degreesPerPixel;
        this.particleSystem.position.copy(camera.position);
        const vertices = this.geom.attributes.position.array;
        const aColor = this.aColor.array;
        const aAngSize = this.aAngSize.array;
        const { other } = this;
        const linVelScale = 1 / (1 + (delta * 1));
        let idx = 0;
        const { length } = this;
        while (idx < length) {
          const { linVel } = other[idx];
          linVel.multiplyScalar(linVelScale);
          tmpVec3a.copy(linVel).multiplyScalar(delta);
          vertices[idx * 3] = tmpVec3a.x;
          vertices[(idx * 3) + 1] = tmpVec3a.y;
          vertices[(idx * 3) + 2] =tmpVec3a.z;
          aColor[(idx * 4) + 3] -= delta * 1;
          aAngSize[idx * 2] += other[idx].angVel * delta;
          if (aColor[(idx * 4) + 3] <= 0) {
            aAngSize[(idx * 2) + 1] = 0;
          } else {
            aAngSize[(idx * 2) + 1] += delta * 0.5;
          }
          idx++;
        }

        this.geom.attributes.position.updateRange.offset = 0;
        this.aColor.updateRange.offset = 0;
        this.aAngSize.updateRange.offset = 0;

        this.geom.attributes.position.updateRange.count = -1;
        this.aColor.updateRange.count = -1;
        this.aAngSize.updateRange.count = -1;

        this.geom.attributes.position.needsUpdate = true;
        this.aColor.needsUpdate = true;
        return this.aAngSize.needsUpdate = true;
      }
    };
    Dust.initClass();
    return Dust;
  })();

  const keyWeCareAbout = event => event.keyCode <= 255;
  const isModifierKey = event => event.ctrlKey || event.altKey || event.metaKey;

  return TriggerClient = (function() {
    TriggerClient = class TriggerClient {
      static initClass() {
  
        this.prototype.debouncedMuteAudio = _.debounce(audio => audio.setGain(0)
        , 500);
      }
      constructor(containerEl, root, options) {
        // TODO: Add Detector support.
        this.containerEl = containerEl;
        this.root = root;
        if (options == null) { options = {}; }
        this.options = options;
        this.objects = {};
        this.pubsub = new pubsub.PubSub();

        const { prefs } = root;

        this.renderer = this.createRenderer(prefs);
        if (this.renderer) { this.containerEl.appendChild(this.renderer.domElement); }

        prefs.on('change:pixeldensity', () => {
          if (this.renderer != null) {
            this.renderer.devicePixelRatio = prefs.pixeldensity;
          }
          return this.setSize(this.width, this.height);
        });

        this.sceneHUD = new THREE.Scene();
        this.cameraHUD = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, -1);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000000);
        this.camera.idealFov = 75;
        this.camera.degreesPerPixel = 1;
        this.camera.up.set(0, 0, 1);
        this.camera.position.set(0, 0, 500);
        this.scene.add(this.camera);  // Required so that we can attach stuff to camera.
        this.camControl = null;
        this.scene.fog = new THREE.FogExp2(0xddeeff, 0.0002);

        this.scene.add(new THREE.AmbientLight(0x446680));
        // @scene.add new THREE.AmbientLight 0x6699C0
        this.scene.add(this.cubeMesh());

        this.add(new SunLight(this.scene));

        this.add(this.dust = new Dust(this.scene));

        this.audio = new clientAudio.Audio();
        if (!prefs.audio) { this.audio.mute(); }
        this.checkpointBuffer = null;
        this.audio.loadBuffer('/a/sounds/checkpoint.ogg', buffer => { return this.checkpointBuffer = buffer; });
        this.kachingBuffer = null;
        this.audio.loadBuffer('/a/sounds/kaching.ogg', buffer => { return this.kachingBuffer = buffer; });
        this.voiceBuffer = null;
        this.audio.loadBuffer('/a/sounds/voice.ogg', buffer => {
          return this.voiceBuffer = buffer;
        });
          // @speak 'welcome'
        this.audio.setGain(prefs.volume);
        prefs.on('change:audio', (prefs, audio) => {
          if (audio) { return this.audio.unmute(); } else { return this.audio.mute(); }
        });
        prefs.on('change:volume', (prefs, volume) => {
          return this.audio.setGain(volume);
        });

        this.track = new gameTrack.Track(this.root);

        const sceneLoader = new THREE.SceneLoader();
        const loadFunc = (url, callback) => sceneLoader.load(window.BASE_PATH + url, callback);
        if (this.renderer) {
          this.add(new clientTerrain.RenderTerrain(
              this.scene, this.track.terrain, this.renderer.context, prefs.terrainhq)
          );
          this.add(new clientScenery.RenderScenery(this.scene, this.track.scenery, loadFunc, this.renderer));
        }
        this.add(new CamTerrainClipping(this.camera, this.track.terrain), 20);

        this.keyDown = [];
      }

      onKeyDown(event) {
        if (keyWeCareAbout(event) && !isModifierKey(event)) {
          this.keyDown[event.keyCode] = true;
          this.pubsub.publish('keydown', event);
          if (this.options.blockKeys && [
            KEYCODE.UP,
            KEYCODE.DOWN,
            KEYCODE.LEFT,
            KEYCODE.RIGHT,
            KEYCODE.SPACE
          ].includes(event.keyCode)) { event.preventDefault(); }
        }
      }

      onKeyUp(event) {
        if (keyWeCareAbout(event)) {
          this.keyDown[event.keyCode] = false;
        }
          //event.preventDefault()
      }

      speak(msg) {
        if (!this.voiceBuffer) { return; }
        const [ offset, duration, random ] = Array.from({
          '3': [ 0, 0.621, 0.03 ],
          '2': [ 1.131, 0.531, 0.03 ],
          '1': [ 2.153, 0.690, 0.03 ],
          'go': [ 3.291, 0.351, 0.03 ],
          'checkpoint': [ 4.257, 0.702, 0.03 ],
          'complete': [ 5.575, 4.4, 0.03 ]
          // 'complete': [ 5.575, 0.975, 0.03 ]
          // 'welcome': [ 7.354, 1.378, 0 ]
        }[msg]);
        const rate = 1 + ((Math.random() - 0.3) * random);
        return this.audio.playRange(this.voiceBuffer, offset, duration, 1.5, rate);
      }

      playSound(name) {
        switch (name) {
          case 'kaching':
            if (this.kachingBuffer) { this.audio.playSound(this.kachingBuffer, false, 0.3, 1); }
            break;
        }
      }

      addGame(game, options) {
        if (options == null) { options = {}; }
        if (game == null) { throw new Error('Added null game'); }
        const objs = [];

        const priority = options.isGhost ? 2 : 1;

        objs.push(this.add({ update(cam, delta) { return game.update(delta); } }, priority));

        const onAddVehicle = (car, progress) => {
          // TODO: Use spatialized audio for ghosts.
          let renderCheckpoints;
          const audio = options.isGhost ? null : this.audio;
          const dust = options.isGhost ? null : this.dust;
          const renderCar = new clientCar.RenderCar(this.scene, car, audio, dust, options.isGhost);
          // progress._renderCar = renderCar
          objs.push(this.add(renderCar));
          if (options.isGhost) { return; }
          objs.push(this.add(new RenderDials(this.sceneHUD, car)));
          objs.push(this.add(renderCheckpoints = new RenderCheckpointsDrive(this.scene, this.root)));
          progress.on('advance', () => {
            renderCheckpoints.highlightCheckpoint(progress.nextCpIndex);
            if (this.checkpointBuffer != null) { return (this.audio != null ? this.audio.playSound(this.checkpointBuffer, false, 1, 1) : undefined); }
          });
          // TODO: Migrate isReplay out of cfg to a method argument like isGhost.
          if (car.cfg.isReplay) { return; }
          objs.push(this.add(this.camControl = new CamControl(this.camera, renderCar)));
          objs.push(this.add(new RenderCheckpointArrows(this.camera, progress)));
          objs.push(this.add(new CarControl(car, this)));
        };
        for (let prog of Array.from(game.progs)) { onAddVehicle(prog.vehicle, prog); }
        game.on('addvehicle', onAddVehicle);

        // game.on 'deletevehicle', (progress) =>
        //   renderCar = progress._renderCar
        //   progress._renderCar = null
        //   for layer in @objects
        //     idx = layer.indexOf renderCar
        //     if idx isnt -1
        //       layer.splice idx, 1
        //   renderCar.destroy()

        game.on('destroy', () => this.destroyObjects(objs));
      }

      destroyObjects(objs) {
        // Remove the objects from all update layers...
        for (let k in this.objects) {
          const layer = this.objects[k];
          this.objects[k] = _.without(layer, ...Array.from(objs));
        }
        // ...then destroy the objects.
        for (let obj of Array.from(objs)) {
          if (typeof obj.destroy === 'function') {
            obj.destroy();
          }
        }
      }

      add(obj, priority) {
        if (priority == null) { priority = 10; }
        const layer = this.objects[priority] != null ? this.objects[priority] : (this.objects[priority] = []);
        layer.push(obj);
        return obj;
      }

      createRenderer(prefs) {
        try {
          const r = new THREE.WebGLRenderer({
            alpha: false,
            antialias: prefs.antialias,
            premultipliedAlpha: false,
            clearColor: 0xffffff
          });
          r.devicePixelRatio = prefs.pixeldensity;
          r.shadowMap.enabled = prefs.shadows;
          // r.shadowMapCullFrontFaces = false
          // r.shadowMapCullFace = THREE.CullFaceBack
          r.autoClear = false;
          return r;
        } catch (e) {
          return console.error(e);
        }
      }

      updateCamera() {
        const aspect = this.height > 0 ? this.width / this.height : 1;
        this.camera.aspect = aspect;
        this.camera.fov = this.camera.idealFov / Math.max(1, aspect / 1.777);
        if (this.renderer) {
          this.camera.degreesPerPixel = this.camera.fov / (this.height * this.renderer.devicePixelRatio);
        }
        this.camera.updateProjectionMatrix();
        this.cameraHUD.left = -aspect;
        this.cameraHUD.right = aspect;
        return this.cameraHUD.updateProjectionMatrix();
      }

      setSize(width, height) {
        this.width = width;
        this.height = height;
        if (this.renderer != null) {
          this.renderer.setSize(this.width, this.height);
        }
        return this.updateCamera();
      }

      addEditorCheckpoints(parent) {
        return this.add(this.renderCheckpoints = new RenderCheckpointsEditor(parent, this.root));
      }

      muteAudioIfStopped() {
        if (this.audio != null) {
          this.audio.setGain(this.root.prefs.volume);
          return this.debouncedMuteAudio(this.audio);
        }
      }

      update(delta) {
        for (let priority in this.objects) {
          const layer = this.objects[priority];
          for (let object of Array.from(layer)) {
            object.update(this.camera, delta);
          }
        }
        return this.muteAudioIfStopped();
      }

      render() {
        if (!this.renderer) { return; }
        this.renderer.clear(false, true);
        this.renderer.render(this.scene, this.camera);
        return this.renderer.render(this.sceneHUD, this.cameraHUD);
      }

      cubeMesh() {
        const path = window.BASE_PATH + "/a/textures/miramar-z-512/miramar_";
        const format = '.jpg';
        const urls = (['rt','lf','ft','bk','up','dn'].map((part) => path + part + format));
        const textureCube = THREE.ImageUtils.loadTextureCube(urls);
        const cubeShader = THREE.ShaderLib["cube"];
        cubeShader.uniforms["tCube"].value = textureCube;
        // cubeMaterial = new THREE.MeshBasicMaterial
        //   color: 0x0000FF
        //   side: THREE.BackSide
        const cubeMaterial = new THREE.ShaderMaterial({
          fog: true,
          side: THREE.BackSide,
          uniforms: _.extend(THREE.UniformsLib['fog'], cubeShader.uniforms),
          vertexShader: cubeShader.vertexShader,
          fragmentShader:
            THREE.ShaderChunk.fog_pars_fragment +
            `\

uniform samplerCube tCube;
uniform float tFlip;
varying vec3 vWorldDirection;
vec3 worldVec;
void main() {
  gl_FragColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
  worldVec = normalize(vWorldDirection);
  gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.05, 0.15, worldVec.z));
}
\
`
        });
        cubeMaterial.transparent = false;
        const cubeMesh = new THREE.Mesh(
            new THREE.CubeGeometry(5000000, 5000000, 5000000), cubeMaterial);
        cubeMesh.flipSided = false;
        cubeMesh.position.set(0, 0, 2000);
        return cubeMesh;
      }

      viewToEye(vec) {
        vec.x = ((vec.x / this.width) * 2) - 1;
        vec.y = 1 - ((vec.y / this.height) * 2);
        return vec;
      }

      viewToEyeRel(vec) {
        vec.x = (vec.x / this.height) * 2;
        vec.y = - (vec.y / this.height) * 2;
        return vec;
      }

      viewRay(viewX, viewY) {
        const vec = this.viewToEye(new Vec3(viewX, viewY, 0.9));
        vec.unproject(this.camera);
        vec.sub(this.camera.position);
        vec.normalize();
        return new THREE.Ray(this.camera.position, vec);
      }

      findObject(viewX, viewY) {
        return this.intersectRay(this.viewRay(viewX, viewY));
      }

      // TODO: Does this intersection stuff belong in client?
      intersectRay(ray) {
        let isect = [];
        isect = isect.concat(this.track.scenery.intersectRay(ray));
        isect = isect.concat(this.intersectCheckpoints(ray));
        isect = isect.concat(this.intersectTerrain(ray));
        isect = isect.concat(this.intersectStartPosition(ray));
        return [].concat.apply([], isect);
      }

      intersectTerrain(ray) {

        var zeroCrossing = function(fn, lower, upper, iterations) {
          if (iterations == null) { iterations = 4; }
          const fnLower = fn(lower);
          const fnUpper = fn(upper);
          // Approximate the function as a line.
          const gradient = (fnUpper - fnLower) / (upper - lower);
          const constant = fnLower - (gradient * lower);
          const crossing = -constant / gradient;
          if (iterations <= 1) { return crossing; }
          const fnCrossing = fn(crossing);
          if (fnCrossing < 0) {
            return zeroCrossing(fn, crossing, upper, iterations - 1);
          } else {
            return zeroCrossing(fn, lower, crossing, iterations - 1);
          }
        };

        const terrainContact = lambda => {
          const test = ray.direction.clone().multiplyScalar(lambda);
          test.add(ray.origin);
          return {
            test,
            contact: this.track.terrain.getContact(test)
          };
        };

        const terrainFunc = lambda => {
          const tc = terrainContact(lambda);
          return tc.contact.surfacePos.z - tc.test.z;
        };

        let lambda = 0;
        let step = 0.2;
        let count = 0;
        while (lambda < 50000) {
          const nextLambda = lambda + step;
          if (terrainFunc(nextLambda) > 0) {
            lambda = zeroCrossing(terrainFunc, lambda, nextLambda);
            const { contact } = terrainContact(lambda);
            return [{
              type: 'terrain',
              distance: lambda,
              object: {
                pos: [
                  contact.surfacePos.x,
                  contact.surfacePos.y,
                  contact.surfacePos.z
                ]
              }
            }
            ];
          }
          lambda = nextLambda;
          step *= 1.1;
          count++;
        }
        return [];
      }

      intersectStartPosition(ray) {
        if ((this.root.track != null ? this.root.track.config : undefined) == null) { return []; }
        const startpos = this.root.track.config.course.startposition;
        const { pos } = startpos;
        if (pos == null) { return []; }
        const hit = this.intersectSphere(ray, new Vec3(pos[0], pos[1], pos[2]), 4);
        if (hit) {
          hit.type = 'startpos';
          hit.object = startpos;
          return [hit];
        } else {
          return [];
        }
      }

      intersectSphere(ray, center, radiusSq) {
        // Destructive to center.
        center.sub(ray.origin);
        // We assume unit length ray direction.
        const a = 1;  // ray.direction.dot(ray.direction)
        const along = ray.direction.dot(center);
        const b = -2 * along;
        const c = center.dot(center) - radiusSq;
        const discrim = (b * b) - (4 * a * c);
        if (!(discrim >= 0)) { return null; }
        return {distance: along};
      }

      intersectCheckpoints(ray) {
        if ((this.root.track != null ? this.root.track.config : undefined) == null) { return []; }
        const radiusSq = 16;
        const isect = [];
        for (let idx = 0; idx < this.root.track.config.course.checkpoints.models.length; idx++) {
          const cp = this.root.track.config.course.checkpoints.models[idx];
          const hit = this.intersectSphere(ray, new Vec3(cp.pos[0], cp.pos[1], cp.pos[2]), radiusSq);
          if (hit) {
            hit.type = 'checkpoint';
            hit.object = cp;
            hit.idx = idx;
            isect.push(hit);
          }
        }
        return isect;
      }
    };
    TriggerClient.initClass();
    return TriggerClient;
  })();
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}