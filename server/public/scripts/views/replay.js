/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'jquery',
  'backbone-full',
  'THREE',
  'util/util',
  'util/util2',
  'client/car',
  'client/editor_camera',
  'game/game',
  'game/track',
  'models/index',
  'views/view',
  'jade!templates/drive',  // Yes, we use the drive template.
  'util/recorder'
], function(
  $,
  Backbone,
  THREE,
  util,
  util2,
  clientCar,
  EditorCameraControl,
  gameGame,
  gameTrack,
  models,
  View,
  template,
  recorder
) {
  let Replay;
  const { MB } = util2;
  const { KEYCODE } = util;
  const Vec3 = THREE.Vector3;

  const padZero = (val, digits) => (1e15 + val + '').slice(-digits);

  const formatRunTime = function(time) {
    const mins = Math.floor(time / 60);
    time -= mins * 60;
    const secs = Math.floor(time);
    time -= secs;
    const cents = Math.floor(time * 100);
    return mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2);
  };

  return Replay = (function() {
    Replay = class Replay extends View {
      static initClass() {
        this.prototype.template = template;
        this.prototype.className = 'no-pointer-events';
      }
      constructor(app, client, run) {
        super({}, app, client, run);
      }

      initialize(options, app, client, run) {
        this.app = app;
        this.client = client;
        this.run = run;
      }

      destroy() {
        if (this.game != null) {
          this.game.destroy();
        }
        return super.destroy(...arguments);
      }

      onKeyDown(event) {
        switch (event.keyCode) {
          case KEYCODE['C']:
            return (this.client.camControl != null ? this.client.camControl.nextMode() : undefined);
          case KEYCODE['R']:
            if (this.game) { return this.restartGame(); }
            break;
        }
      }

      afterRender() {
        const { client } = this;
        client.camera.idealFov = 75;
        client.updateCamera();

        this.camControl = new EditorCameraControl(client.camera);
        this.cursor = {
          hit: null,
          pos: new Vec3
        };
        this.buttons = (this.mouseX = (this.mouseY = 0));

        this.$countdown = this.$('#countdown');
        this.$runTimer = this.$('#timer');
        this.$checkpoints = this.$('#checkpoints');

        this.game = null;

        const { root } = this.app;

        this.lastRaceTime = 0;
        this.updateTimer = true;

        const { run } = this;
        return run.fetch({
          success: () => {
            const done = _.after(2, () => {
              if (this.game != null) {
                this.game.destroy();
              }
              this.game = new gameGame.Game(this.client.track);
              this.client.addGame(this.game);

              return this.game.addCarConfig(car.config, progress => {
                this.progress = progress;
                progress.vehicle.cfg.isReplay = true;
                progress.on('advance', () => {
                  const cpNext = progress.nextCpIndex;
                  const cpTotal = root.track.config.course.checkpoints.length;
                  this.$checkpoints.html(`${cpNext} / ${cpTotal}`);

                  if (progress.nextCheckpoint(0)) { return; }

                  // Race complete.
                  this.updateTimer = false;
                  return this.$runTimer.removeClass('running');
                });

                const obj1 = progress.vehicle.controller.input;
                const obj2 = progress;
                this.play1 = new recorder.StatePlaybackInterpolated(obj1, run.record_i);
                this.play2 = new recorder.StatePlaybackInterpolated(obj2, run.record_p);
                this.game.sim.pubsub.on('step', () => {
                  this.play1.step();
                  return this.play2.step();
                });
                  // TODO: check if .complete()

                return this.restartGame();
              });
            });

            const track = models.Track.findOrCreate(run.track.id);
            track.fetch({
              success: () => {
                const { startposition } = track.config.course;
                this.camControl.autoTo(startposition.pos, startposition.rot);
                return track.env.fetch({
                  success() {
                    Backbone.trigger('app:settrack', track);
                    Backbone.trigger('app:settitle', track.name);
                    return done();
                  }
                });
              }
            });
            var car = models.Car.findOrCreate(run.car.id);
            return car.fetch({success: done});
          },
          error() {
            console.error('replay after render loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      restartGame() {
        this.updateTimer = true;
        this.$runTimer.addClass('running');
        this.game.restart();
        // The vehicle controller is recreated after restarting the game.
        this.play1.object = this.progress.vehicle.controller.input;
        this.play1.restart();
        return this.play2.restart();
      }

      update(delta) {
        let terrainHeight = 0;
        if (this.client.track != null) {
          terrainHeight = (this.client.track.terrain.getContactRayZ(this.camControl.pos.x, this.camControl.pos.y)).surfacePos.z;
        }
        this.camControl.update(delta, this.client.keyDown, terrainHeight);

        if (this.updateTimer && this.game) {
          const raceTime = this.game.interpolatedRaceTime();
          if (raceTime >= 0) {
            if (this.lastRaceTime < 0) {
              this.$countdown.html('Go!');
              this.$countdown.addClass('fadeout');
            }
            this.$runTimer.html(formatRunTime(raceTime));
          } else {
            const num = Math.ceil(-raceTime);
            const lastNum = Math.ceil(-this.lastRaceTime);
            if (num !== lastNum) {
              this.$runTimer.html("");
              this.$countdown.html(`${num}`);
              this.$countdown.removeClass('fadeout');
            }
          }
          return this.lastRaceTime = raceTime;
        }
      }

      onMouseDown(event) {
        this.buttons |= 1 << event.button;
        event.preventDefault();
        return false;
      }

      onMouseUp(event) {
        this.buttons &= ~(1 << event.button);
        event.preventDefault();
        return false;
      }

      findObject(mouseX, mouseY) {
        const isect = this.client.findObject(mouseX, mouseY);
        for (let obj of Array.from(isect)) { if (obj.type === 'terrain') { obj.distance += 10; } }
        isect.sort((a, b) => a.distance > b.distance);
        return isect[0];
      }

      onMouseMove(event) {
        const motionX = event.offsetX - this.mouseX;
        const motionY = event.offsetY - this.mouseY;
        const angX = motionY * 0.01;
        const angZ = motionX * 0.01;
        this.mouseX = event.offsetX;
        this.mouseY = event.offsetY;
        if (!(this.buttons & (MB.LEFT | MB.MIDDLE)) || !this.cursor.hit) {
          this.cursor.hit = this.findObject(this.mouseX, this.mouseY);
          if (this.cursor.hit) { Vec3.prototype.set.apply(this.cursor.pos, this.cursor.hit.object.pos); }
        } else {
          const rotateMode = (event.altKey && (this.buttons & MB.LEFT)) || (this.buttons & MB.MIDDLE);
          const viewRay = this.client.viewRay(this.mouseX, this.mouseY);
          const cursorPos = this.cursor.pos;
          const planeHit = event.shiftKey ?
            util2.intersectZLine(viewRay, cursorPos)
          :
            util2.intersectZPlane(viewRay, cursorPos);
          if (!planeHit) { return; }
          const relMotion = planeHit.pos.clone().sub(cursorPos);

          if (rotateMode) {
            this.camControl.rotate(cursorPos, angX, angZ);
          } else {
            relMotion.multiplyScalar(-1);
            this.camControl.translate(relMotion);
          }
        }
      }

      scroll(scrollY, event) {
        if (!this.cursor.hit) { return; }
        const vec = this.camControl.pos.clone().sub(this.cursor.pos);
        vec.multiplyScalar(Math.exp(scrollY * -0.002) - 1);
        this.camControl.translate(vec);
        event.preventDefault();
      }

      onMouseWheel(event) {
        const origEvent = event.originalEvent;
        const deltaY = origEvent.wheelDeltaY != null ? origEvent.wheelDeltaY : origEvent.deltaY;
        return this.scroll(deltaY, event);
      }
    };
    Replay.initClass();
    return Replay;
  })();
});
