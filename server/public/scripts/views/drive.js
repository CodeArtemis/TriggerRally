/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'jquery',
  'backbone-full',
  'underscore',
  'THREE',
  'util/util',
  'client/car',
  'game/game',
  'game/track',
  'models/index',
  'views/view',
  'jade!templates/drive',
  'util/recorder'
], function(
  $,
  Backbone,
  _,
  THREE,
  util,
  clientCar,
  gameGame,
  gameTrack,
  models,
  View,
  template,
  recorder
) {
  let Drive;
  const { KEYCODE } = util;
  const Vec3 = THREE.Vector3;

  const padZero = (val, digits) => (1e15 + val + '').slice(-digits);

  const keys1 = {
    brake: 1,
    handbrake: 1,
    throttle: 1,
    turn: 2
  };
  const keys2 = {
    nextCpIndex: 0,
    vehicle: {
      body: {
        pos: { x: 3, y: 3, z: 3 },
        ori: { x: 3, y: 3, z: 3, w: 3 },
        linVel: { x: 3, y: 3, z: 3 },
        angMom: { x: 3, y: 3, z: 3 }
      },
      wheels: [
        {spinVel: 1}
      ],
      engineAngVel: 3
    }
  };

  const formatRunTime = function(time) {
    const mins = Math.floor(time / 60);
    time -= mins * 60;
    const secs = Math.floor(time);
    time -= secs;
    const cents = Math.floor(time * 100);
    return mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2);
  };

  // randomChoice = (arr) -> arr[Math.floor Math.random() * arr.length]

  // checkpointMessage = -> randomChoice [
  //   'Yes!'
  //   'Great!'
  //   'Awesome!'
  //   'Excellent!'
  // ]

  return Drive = (function() {
    Drive = class Drive extends View {
      static initClass() {
        this.prototype.template = template;
      }

      constructor(app, client) {
        super({}, app, client);
      }

      initialize(options, app, client) {
        this.record_i = this.record_i.bind(this);
        this.record_p = this.record_p.bind(this);
        this.app = app;
        this.client = client;
        this.replayRun = null;
        return this.replayGame = null;
      }

      destroy() {
        Backbone.trigger('statusbar:hidechallenge');

        if (this.socket != null) {
          this.socket.disconnect();
        }
        if (this.game != null) {
          this.game.destroy();
        }
        if (this.replayGame != null) {
          this.replayGame.destroy();
        }
        return super.destroy(...arguments);
      }

      viewModel() {
        return {xpEndRace: this.xpEndRace};
      }

      onKeyDown(event) {
        if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) { return; }
        switch (event.keyCode) {
          case KEYCODE['C']:
            return (this.client.camControl != null ? this.client.camControl.nextMode() : undefined);
          case KEYCODE['R']:
            if (this.game) { return this.restartGame(); }
            break;
        }
      }

      afterRender() {
        let createGame, updateChallenge;
        const { root } = this.app;

        Backbone.trigger('statusbar:showchallenge');

        const { client } = this;
        client.camera.idealFov = 75;
        client.updateCamera();

        this.$countdown = this.$('.countdown');
        this.$runTimer = this.$('.timer');
        this.$checkpoints = this.$('.checkpoints');
        this.$splitTime = this.$('.split-time');
        this.$restartButton = this.$('.restartbutton');
        this.$nextButton = this.$('.nextbutton');

        this.$restartButton.on('click', () => {
          if (this.game) { return this.restartGame(); }
        });

        (updateChallenge = () => {
          this.$runTimer.toggleClass('hidden', root.prefs.challenge === 'none');
          return this.$splitTime.toggleClass('hidden', [ 'none', 'clock' ].includes(root.prefs.challenge));
        })();
        this.listenTo(root, 'change:prefs.challenge', updateChallenge);
        this.listenTo(root, 'change:prefs.challenge', () => {
          // This isn't triggered at startup, only on changes.
          return this.useChallengeRun();
        });

        this.game = null;

        this.socket = io.connect('/drive');
        // TODO: Just display a simple red/green online indicator?
        // @socket.on 'connect_failed', -> Backbone.trigger 'app:status', 'Socket connect failed'
        // @socket.on 'disconnect', -> Backbone.trigger 'app:status', 'Socket disconnected'
        // @socket.on 'error', -> Backbone.trigger 'app:status', 'Socket error'
        // @socket.on 'reconnect', -> Backbone.trigger 'app:status', 'Socket reconnected'
        // @socket.on 'reconnect_failed', -> Backbone.trigger 'app:status', 'Socket reconnect failed'

        this.socket.on('updateuser', function(data) {
          if (data.id !== root.user.id) { return; }
          return root.user.credits = data.credits;
        });

        this.lastRaceTime = 0;
        this.updateTimer = true;

        (createGame = () => {
          let carId, left;
          if (root.track == null) { return; }
          const products = (root.user != null ? root.user.products : undefined) || [];
          // if not root.track.demo and 'packa' not in products
          //   _.defer ->
          //     Backbone.history.navigate '/purchase', trigger: yes
          //   return
          this.trackId = root.track.id;
          const nextTrackId = root.track.next_track != null ? root.track.next_track.id : undefined;
          this.$nextButton.toggleClass('hidden', !nextTrackId);
          this.$nextButton.attr('href', `/track/${nextTrackId}/drive`);
          if (this.replayRun && (this.replayRun.track.id !== root.track.id)) { this.setRun(null); }
          this.carId = (carId = (left = root.getCarId()) != null ? left : 'ArbusuG');
          const carModel = models.Car.findOrCreate(carId);
          return carModel.fetch({
            success: () => {
              if (this.destroyed) { return; }
              if (this.game != null) {
                this.game.destroy();
              }
              this.game = new gameGame.Game(this.client.track);
              this.client.addGame(this.game);
              this.createReplayGame();

              return this.game.addCarConfig(carModel.config, progress => {
                this.progress = progress;
                progress.on('advance', () => this.advance());

                const obj1 = progress.vehicle.controller.input;
                const obj2 = progress;
                this.rec1 = new recorder.StateSampler(obj1, keys1, 20, this.record_i);
                this.rec2 = new recorder.StateSampler(obj2, keys2, 40, this.record_p);
                this.game.sim.pubsub.on('step', () => {
                  this.rec1.observe();
                  return this.rec2.observe();
                });

                return this.restartGame();
              });
            }
          });
        })();

        this.listenTo(root, 'change:track', createGame);
        // Also recreate game if user or car changes.
        this.listenTo(root, 'change:user', createGame);
        this.listenTo(root, 'change:user.products', createGame);
        return this.listenTo(root, 'change:prefs.car', createGame);
      }

      updateSplit() {
        const idx = (this.progress != null ? this.progress.cpTimes.length : undefined) - 1;
        if (this.replayRun && (idx >= 0)) {
          const diff = this.progress.cpTimes[idx] - this.replayRun.times[idx] - this.game.startTime;
          const minus = diff < 0;
          const text = minus ?
            `-${formatRunTime(-diff)}`
          :
            `+${formatRunTime(diff)}`;
          this.$splitTime.text(text);
          this.$splitTime.removeClass('hidden');
          this.$splitTime.toggleClass('minus', minus);
          if (minus && !this.app.root.user) {
            return Backbone.trigger('app:status', 'You\'re leading! Log in to save your score!');
          }
        } else {
          return this.$splitTime.addClass('hidden');
        }
      }

      restartGame() {
        this.updateTimer = true;
        this.$runTimer.addClass('running');
        this.$('.racecomplete').addClass('hidden');
        this.splitTimes = [];
        this.game.restart();
        // The vehicle controller is recreated after restarting the game.
        this.rec1.object = this.progress.vehicle.controller.input;
        this.rec1.restart();
        this.rec2.restart();

        return this.socket.emit('start', {
          car: this.carId,
          track: this.app.root.track.id,
          keyMap_i: this.rec1.toJSON().keyMap,
          keyMap_p: this.rec2.toJSON().keyMap
        }
        );
      }

      record_i(offset, state) {
        return this.socket.emit('record_i', {samples: [ [ offset, state ] ]});
      }

      record_p(offset, state) {
        return this.socket.emit('record_p', {samples: [ [ offset, state ] ]});
      }

      advance() {
        let time;
        const cpNext = this.progress.nextCpIndex;
        const cpTotal = this.app.root.track.config.course.checkpoints.length;
        const text = `${cpNext} / ${cpTotal}`;
        this.$checkpoints.text(text);

        this.updateSplit();

        if (cpNext > 0) {
          const cp = cpNext - 1;
          const data = { cp, time: this.progress.cpTimes[cp] };
          this.socket.emit('advance', data);
        }

        if ((cpNext > 1) || (this.game.interpolatedRaceTime() > 1)) {
          let message, speak;
          let fade = true;
          if (cpNext === cpTotal) {
            if (!this.xpEndRace) {
              message = 'Race complete';
              fade = false;
            }
            speak = 'complete';
            // products = @app.root.user?.products ? []
            this.$('.racecomplete').removeClass('hidden'); // unless 'packa' in products
          } else if (cpNext === (cpTotal - 1)) {
            message = 'Nearly there!';
          }
            // speak = 'checkpoint'
          else {}
            // message = 'Checkpoint'
            // speak = 'checkpoint'
          if (speak) { this.client.speak(speak); }
          if (message) {
            this.$countdown.text(message);
            this.$countdown.removeClass('fadeout');
            if (fade) { _.defer(() => this.$countdown.addClass('fadeout')); }
          }
        }

        // window._gaq.push ['_trackEvent', 'Tracks', 'Drive Advance', "#{@app.root.track.id}: #{text}"]
        // ga 'send', 'event', 'Drive', 'Checkpoint', "#{@app.root.track.id}: #{text}", cpNext

        if (!this.progress.isFinished()) { return; }
        if (!(this.progress.nextCpIndex > 0)) { throw new Error('Simulation error'); }  // Just a sanity check.

        // Race complete.
        this.updateTimer = false;
        this.$runTimer.removeClass('running');
        const finishTime = this.$runTimer.text();
        this.$('.finishtime').text(finishTime);

        const targetUrl = encodeURIComponent(`https://triggerrally.com/track/${this.app.root.track.id}`);
        const shareText = encodeURIComponent(`I finished \"${this.app.root.track.name}\" in ${finishTime}. Can you beat that?`);

        const $sharefacebook = this.$('.sharebutton.facebook');
        $sharefacebook.attr('href', `https://www.facebook.com/sharer/sharer.php?u=${targetUrl}`);
        $sharefacebook.on('click', function() {
          window.open(this.href, 'facebook-share-dialog', 'width=626,height=436');
          ga('send', 'social', 'Facebook', 'SharePrompt', targetUrl);
          ga('send', 'event', 'Social', 'SharePrompt', 'Facebook');
          return false;
        });

        const $sharetwitter = this.$('.sharebutton.twitter');
        $sharetwitter.attr('href', `https://twitter.com/share?url=${targetUrl}&via=TriggerRally&text=${shareText}&related=jareiko`);
        $sharetwitter.on('click', function() {
          window.open(this.href, 'twitter-share-dialog', 'width=626,height=436');
          ga('send', 'social', 'Twitter', 'TweetPrompt', targetUrl);
          ga('send', 'event', 'Social', 'SharePrompt', 'Twitter');
          return false;
        });

        const { startTime } = this.game;
        const times = ((() => {
          const result = [];
          for (time of Array.from(this.progress.cpTimes)) {             result.push(time - startTime);
          }
          return result;
        })());
        return this.socket.emit('times', { times });
      }

      setTrackId(trackId) {
        this.trackId = trackId;
        const track = models.Track.findOrCreate(trackId);
        return track.fetch({
          success: () => {
            return track.env.fetch({
              success: () => {
                if (this.destroyed) { return; }
                Backbone.trigger('app:settrack', track);
                return Backbone.trigger('app:settitle', track.name);
              }
            });
          },
          error() {
            console.error('drive: loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      setRunId(runId) {
        return this.setRun(models.Run.findOrCreate(runId));
      }

      useChallengeRun() {
        this.setRun(null);
        const { challenge } = this.app.root.prefs;
        switch (challenge) {
          case 'world':
            var trackRuns = models.TrackRuns.findOrCreate(this.trackId);
            return trackRuns.fetch({
              success: () => {
                return this.setRun(trackRuns.runs.at(0));
              }
            });
        }
      }
        // type = switch challenge
        //   when 'world' then 'runs'
        //   when 'personal' then 'personalruns'
        // return unless type
        // url = "/v1/tracks/#{@trackId}/#{type}"
        // $.ajax(url)
        // .done (data) =>
        //   return unless data.run
        //   run = models.Run.findOrCreate data.run.id
        //   run.set run.parse data.run
        //   @setRun run

      cleanUrl() {
        return Backbone.history.navigate(`/track/${this.trackId}/drive`);
      }

      setRun(run) {
        // TODO: Clean up old run?
        this.replayRun = null;
        if (this.replayGame != null) {
          this.replayGame.destroy();
        }
        this.replayGame = null;

        if (!run) { return this.cleanUrl(); }

        if (run.record_p) {
          return this.setRunInternal(run);
        } else {
          return run.fetch({
            force: true,
            success: () => this.setRunInternal(run),
            error: () => this.cleanUrl()
          });
        }
      }

      setRunInternal(run) {
        this.replayRun = run;
        return this.createReplayGame();
      }

      createReplayGame() {
        // TODO: Check that replayGame matches replayRun?
        if (this.replayGame) { return; }
        if (!this.replayRun || !this.game) { return; }
        const car = models.Car.findOrCreate(this.replayRun.car.id);
        return car.fetch({success: () => {
          if (this.destroyed) { return; }
          this.replayGame = new gameGame.Game(this.client.track);
          this.replayGame.addCarConfig(car.config, progress => {
            return this.syncReplayGame(progress);
          });
          return this.client.addGame(this.replayGame, {isGhost: true});
        }
        });
      }

      update(delta) {
        if (!this.game) { return; }
        if (this.updateTimer) {
          const raceTime = this.game.interpolatedRaceTime();
          if (raceTime >= 0) {
            if (this.lastRaceTime < 0) {
              this.client.speak('go');
              this.$countdown.text('Go!');
              this.$countdown.addClass('fadeout');
            }
            this.$runTimer.text(formatRunTime(raceTime));
          } else {
            const num = Math.ceil(-raceTime);
            const lastNum = Math.ceil(-this.lastRaceTime);
            if (num !== lastNum) {
              this.$runTimer.text("");
              const text = `${num}`;
              this.client.speak(text);
              this.$countdown.text(text);
              this.$countdown.removeClass('fadeout');
            }
          }
          this.lastRaceTime = raceTime;
        }
        // else
        //   @game.simRate = 0.5 #/= 1 + delta * 0.3
      }

      // Makes @replayGame track @game.
      syncReplayGame(progress) {
        const run = this.replayRun;
        const { replayGame } = this;

        const obj1 = progress.vehicle.controller.input;
        const obj2 = progress;
        const play1 = new recorder.StatePlaybackInterpolated(obj1, run.record_i);
        const play2 = new recorder.StatePlaybackInterpolated(obj2, run.record_p);

        replayGame.sim.pubsub.on('step', function() {
          play1.step();
          return play2.step();
        });

        const originalUpdate = replayGame.update;

        replayGame.update = deltaIgnored => {
          const masterTime = this.game.sim.interpolatedTime();
          const delta = masterTime - replayGame.sim.interpolatedTime();
          if (delta > 0) {
            // if delta > 1
            //   # Fast forward to 1 sec before present.
            //   # Broken: playback sync relies on 'step' events.
            //   replayGame.sim.time += delta - 1
            //   delta = 1
            originalUpdate.call(replayGame, delta);
          } else if (delta < 0) {
            replayGame.restart();
            // The vehicle controller is recreated after restarting the game.
            play1.object = progress.vehicle.controller.input;
            play1.restart();
            play2.restart();
            originalUpdate.call(replayGame, masterTime);
          }
        };
      }
    };
    Drive.initClass();
    return Drive;
  })();
});
