/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'underscore',
  'backbone-full',
  'THREE',
  'util/util',
  'util/util2',
  'client/misc',
  'client/editor_camera',
  'client/car',
  'models/index',
  'views/inspector',
  'views/view',
  'jade!templates/editor'
], function(
  _,
  Backbone,
  THREE,
  util,
  util2,
  clientMisc,
  EditorCameraControl,
  clientCar,
  models,
  InspectorView,
  View,
  template
) {
  let EditorView;
  const { MB } = util2;
  const { KEYCODE, Vec3FromArray } = util;
  const Vec2 = THREE.Vector2;
  const Vec3 = THREE.Vector3;
  const TWOPI = Math.PI * 2;

  const tmpVec3 = new THREE.Vector3;
  const tmpVec3b = new THREE.Vector3;

  const deepClone = obj => JSON.parse(JSON.stringify(obj));

  const Sel = Backbone.Model.extend({});
  const Selection = Backbone.Collection.extend({
    model: Sel,
    contains(sel) {
      return this.some(element => element.get('sel').object === sel.object);
    }
  });

  return EditorView = (function() {
    EditorView = class EditorView extends View {
      static initClass() {
        this.prototype.template = template;
      }

      constructor(app, client) {
        super({}, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;
      }

      afterRender() {
        let editorObjects, onChangeStartPosition, onChangeTrackId, onChangeTrackName, updateCar;
        const { app } = this;
        const { client } = this;
        const { root } = this.app;
        const $ = this.$.bind(this);

        this.objs = [];

        client.camera.idealFov = 75;
        client.updateCamera();

        const camControl = new EditorCameraControl(client.camera);

        const selection = new Selection();

        this.editorObjects = (editorObjects = new THREE.Object3D);
        client.scene.add(editorObjects);

        const startPos = new THREE.Object3D();
        editorObjects.add(startPos);

        this.objs.push(client.addEditorCheckpoints(editorObjects));

        const doSave = _.debounce(function() {
          if ((root.user !== root.track.user) || root.track.published) {
            return Backbone.trigger('app:status', 'Read only');
          }
          Backbone.trigger('app:status', 'Saving...');
          const result = root.track.save(null, {
            success(model, response, options) {
              return Backbone.trigger('app:status', 'OK');
            },
            error(model, xhr, options) {
              return Backbone.trigger('app:status', `ERROR: ${xhr.statusText} (${xhr.status})`);
            }
          }
          );
          if (!result) {
            return Backbone.trigger('app:status', 'ERROR: save failed');
          }
        }
        , 1000);

        this.listenTo(root, 'all', function(event) {
          const options = arguments[arguments.length - 1];
          if (!event.startsWith('change:track')) { return; }
          // console.log "Saving due to event: #{event}"

          if (options != null ? options.dontSave : undefined) {
            return Backbone.trigger('app:status', 'OK');
          } else {
            Backbone.trigger('app:status', 'Changed');
            return doSave();
          }
        });

        (onChangeTrackId = function() {
          if (!root.track) { return; }
          selection.reset();

          const { startposition } = root.track.config.course;
          return camControl.autoTo(startposition.pos, startposition.rot);
        })();
        this.listenTo(root, 'change:track.id', onChangeTrackId);

        (onChangeTrackName = function() {
          if (!root.track) { return; }
          return document.title = `${root.track.name} - Trigger Rally`;
        })();
        this.listenTo(root, 'change:track.name', () => onChangeTrackName);

        (onChangeStartPosition = function() {
          const startposition = __guard__(root.track != null ? root.track.config : undefined, x => x.course.startposition);
          if (!startposition) { return; }
          startPos.position.set(...Array.from(startposition.pos || []));
          return startPos.rotation.set(...Array.from(startposition.rot || []));
        })();
        this.listenTo(root, 'change:track.config.course.startposition.', onChangeStartPosition);

        const mockVehicle = {
          cfg: null,
          body: {
            interp: {
              pos: new Vec3(0,0,0),
              ori: (new THREE.Quaternion(1,1,1,1)).normalize()
            }
          }
        };

        let renderCar = null;
        (updateCar = () => {
          let left;
          const carId = (left = root.getCarId()) != null ? left : 'ArbusuG';
          const carModel = models.Car.findOrCreate(carId);
          return carModel.fetch({
            success: () => {
              mockVehicle.cfg = carModel.config;
              if (renderCar != null) {
                renderCar.destroy();
              }
              renderCar = new clientCar.RenderCar(startPos, mockVehicle, null);
              return renderCar.update();
            }
          });
        })();

        this.listenTo(root, 'change:user', updateCar);
        this.listenTo(root, 'change:user.products', updateCar);
        this.listenTo(root, 'change:prefs.car', updateCar);

        this.inspectorView = new InspectorView(this.$('#editor-inspector'), app, selection);
        this.inspectorView.render();

        // Hide the help window.
        _.delay(() => $('#editor-helpbox-wrapper').removeClass('visible')
        , 1000);
        $('#editor-helpbox-wrapper .close-tab').click(() => $('#editor-helpbox-wrapper').toggleClass('visible'));

        const requestId = 0;

        let objSpinVel = 0;
        const lastTime = 0;
        this.update = function(delta) {
          let terrainHeight = 0;
          if (client.track != null) {
            terrainHeight = (client.track.terrain.getContactRayZ(camControl.pos.x, camControl.pos.y)).surfacePos.z;
          }
          const { keyDown } = client;
          camControl.update(delta, keyDown, terrainHeight);

          if (keyDown[188]) {
            objSpinVel += 5 * delta;
          } else if (keyDown[190]) {
            objSpinVel -= 5 * delta;
          } else {
            objSpinVel = 0;
          }

          if (objSpinVel !== 0) {
            return (() => {
              const result = [];
              for (let selModel of Array.from(selection.models)) {
                const sel = selModel.get('sel');
                if (sel.object.rot == null) { continue; }
                const rot = deepClone(sel.object.rot);
                rot[2] += objSpinVel * delta;
                rot[2] -= Math.floor(rot[2] / TWOPI) * TWOPI;
                switch (sel.type) {
                  case 'scenery':
                    var scenery = deepClone(root.track.config.scenery);
                    var obj = scenery[sel.layer].add[sel.idx];
                    obj.rot = rot;
                    root.track.config.scenery = scenery;
                    result.push(sel.object = obj);
                    break;
                  default:
                    result.push(sel.object.rot = rot);
                }
              }
              return result;
            })();
          }
        };

        const addSelection = sel => selection.add({sel});

        const handleSelAdd = function(selModel) {
          const sel = selModel.get('sel');
          sel.mesh = clientMisc.selectionMesh();
          const { pos } = sel.object;
          let radius = 2;
          switch (sel.type) {
            case 'checkpoint':
              radius = 4;
              break;
          }
          sel.mesh.scale.multiplyScalar(radius);
          sel.mesh.position.set(pos[0], pos[1], pos[2]);
          return editorObjects.add(sel.mesh);
        };

        const handleSelRemove = function(selModel) {
          const { mesh } = selModel.get('sel');
          return editorObjects.remove(mesh);
        };

        selection.on('add', handleSelAdd);
        selection.on('remove', handleSelRemove);
        selection.on('reset', function(collection, options) {
          let selModel;
          for (selModel of Array.from(options.previousModels)) { handleSelRemove(selModel); }
          return (() => {
            const result = [];
            for (selModel of Array.from(selection.models)) {               result.push(handleSelAdd(selModel));
            }
            return result;
          })();
        });

        // TODO: encapsulate mouse event handling
        let mouseX = 0;
        let mouseY = 0;
        let cursor = null;
        const cursorMesh = clientMisc.selectionMesh();
        editorObjects.add(cursorMesh);
        let buttons = 0;
        let hasMoved = false;

        const findObject = function(mouseX, mouseY) {
          const isect = client.findObject(mouseX, mouseY);
          for (let obj of Array.from(isect)) { if (obj.type === 'terrain') { obj.distance += 10; } }
          isect.sort((a, b) => a.distance > b.distance);
          return isect[0];
        };

        const updateCursor = function(newCursor) {
          cursor = newCursor;
          if (cursor != null) {
            Vec3.prototype.set.apply(cursorMesh.position, cursor.object.pos);
          }
        };

        this.onMouseDown = function(event) {
          buttons |= 1 << event.button;
          hasMoved = false;
          event.preventDefault();
          return false;
        };

        this.onMouseUp = function(event) {
          buttons &= ~(1 << event.button);
          if ((event.button === 0) && !hasMoved) {
            if (!event.shiftKey) { selection.reset(); }
            if (cursor) {
              if ((root.user === root.track.user) && !root.track.published) {
                if (!selection.contains(cursor)) {
                  addSelection(cursor);
                }
              } else {
                Backbone.trigger('app:status', 'Read only');
              }
            }
          }
        };

        this.onMouseOut = event =>
          // If the cursor leaves the view, we have to disable drag because we don't
          // know what buttons the user is holding when the cursor re-enters.
          buttons = 0
        ;

        this.onMouseMove = function(event) {
          hasMoved = true;
          const motionX = event.offsetX - mouseX;
          const motionY = event.offsetY - mouseY;
          const angX = motionY * 0.01;
          const angZ = motionX * 0.01;
          mouseX = event.offsetX;
          mouseY = event.offsetY;
          if (!(buttons & (MB.LEFT | MB.MIDDLE)) || !cursor) {
            updateCursor(findObject(mouseX, mouseY));
          } else {
            const rotateMode = (event.altKey && (buttons & MB.LEFT)) || (buttons & MB.MIDDLE);
            const viewRay = client.viewRay(mouseX, mouseY);
            const cursorPos = cursorMesh.position;
            const planeHit = event.shiftKey ?
              util2.intersectZLine(viewRay, cursorPos)
            :
              util2.intersectZPlane(viewRay, cursorPos);
            if (!planeHit) { return; }
            const relMotion = planeHit.pos.clone().sub(cursorPos);
            if (selection.contains(cursor)) {
              cursorPos.copy(planeHit.pos);
              for (let selModel of Array.from(selection.models)) {
                var obj, scenery;
                const sel = selModel.get('sel');
                if (sel.type === 'terrain') { continue; }
                if (rotateMode) {
                  const rot = deepClone(sel.object.rot);
                  rot[2] += angZ;
                  rot[2] -= Math.floor(rot[2] / TWOPI) * TWOPI;
                  switch (sel.type) {
                    case 'scenery':
                      // DUPLICATE CODE ALERT
                      scenery = deepClone(root.track.config.scenery);
                      obj = scenery[sel.layer].add[sel.idx];
                      obj.rot = rot;
                      root.track.config.scenery = scenery;
                      if (cursor.object === sel.object) { cursor.object = obj; }
                      sel.object = obj;
                      break;
                    default:
                      sel.object.rot = rot;
                  }
                } else {
                  const pos = deepClone(sel.object.pos);
                  pos[0] += relMotion.x;
                  pos[1] += relMotion.y;
                  pos[2] += relMotion.z;
                  if (sel.type !== 'checkpoint') {
                    if (this.inspectorView.snapToGround) {
                      const tmp = new Vec3(pos[0], pos[1], -Infinity);
                      const contact = client.track.terrain.getContact(tmp);
                      pos[2] = contact.surfacePos.z;
                      if (sel.type === 'startpos') { pos[2] += 1; }
                    }
                  }
                  switch (sel.type) {
                    case 'scenery':
                      // DUPLICATE CODE ALERT
                      scenery = deepClone(root.track.config.scenery);
                      obj = scenery[sel.layer].add[sel.idx];
                      obj.pos = pos;
                      root.track.config.scenery = scenery;
                      if (cursor.object === sel.object) { cursor.object = obj; }
                      sel.object = obj;
                      break;
                    default:
                      sel.object.pos = pos;
                  }
                  sel.mesh.position.set(pos[0], pos[1], pos[2]);
                }
              }
            } else {
              if (rotateMode) {
                camControl.rotate(cursorPos, angX, angZ);
              } else {
                relMotion.multiplyScalar(-1);
                camControl.translate(relMotion);
              }
            }
          }
        };

        const scroll = function(scrollY, event) {
          if (!cursor) { return; }
          const vec = camControl.pos.clone().sub(cursorMesh.position);
          vec.multiplyScalar(Math.exp(scrollY * -0.002) - 1);
          camControl.translate(vec);
          event.preventDefault();
        };

        return this.onMouseWheel = function(event) {
          const origEvent = event.originalEvent;
          const deltaY = origEvent.wheelDeltaY != null ? origEvent.wheelDeltaY : origEvent.deltaY;
          return scroll(deltaY, event);
        };
      }

      destroy() {
        this.inspectorView.destroy();
        this.client.scene.remove(this.editorObjects);
        return this.client.destroyObjects(this.objs);
      }
    };
    EditorView.initClass();
    return EditorView;
  })();
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}