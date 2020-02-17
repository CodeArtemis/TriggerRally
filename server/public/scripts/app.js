/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'jquery',
  'underscore',
  'backbone-full',
  'models/index',
  'router',
  'views/notfound',
  'views/purchase',
  'views/unified',
  'util/popup'
], function(
  $,
  _,
  Backbone,
  models,
  Router,
  NotFoundView,
  PurchaseView,
  UnifiedView,
  popup
) {
  let App;
  const jsonClone = obj => JSON.parse(JSON.stringify(obj));

  const syncLocalStorage = function(method, model, options) {
    const key = model.constructor.name;
    switch (method) {
      case 'read':
        var data = JSON.parse(localStorage.getItem(key));
        if (data == null) { data = { id: 1 }; }
        model.set(model.parse(data));
        break;
      case 'update':
        localStorage.setItem(key, JSON.stringify(model));
        break;
    }
  };

  class RootModel extends models.Model {
    static initClass() {
      models.buildProps(this, [ 'track', 'user', 'prefs', 'xp' ]);
      this.prototype.bubbleAttribs = [ 'track', 'user', 'prefs' ];
    }
    // initialize: ->
    //   super
    //   @on 'all', (event) ->
    //     return unless event.startsWith 'change:track.config'
    //     console.log "RootModel: \"#{event}\""
    //     # console.log "RootModel: " + JSON.stringify arguments
    getCarId() {
      const cars = this.user != null ? this.user.cars() : undefined;
      if ((cars == null) || !Array.from(cars).includes(this.prefs.car)) { return null; }
      return this.prefs.car;
    }
  }
  RootModel.initClass();

  // Should this be extending BackboneModel instead?
  class PrefsModel extends models.Model {
    static initClass() {
      this.prototype.sync = syncLocalStorage;
      models.buildProps(this, [
        'antialias',
        'audio',
        'car',
        'challenge',
        'musicplay',
        'musicvolume',
        'pixeldensity',
        'shadows',
        'terrainhq',
        'volume'
      ]);
    }
    defaults() {
      return {
        antialias: true,
        audio: true,
        car: 'ArbusuG',
        challenge: 'world',  // none, clock, world  # TODO: Add an experiment for this!
        musicplay: false,
        musicvolume: 0.5,
        pixeldensity: 1,
        shadows: true,
        terrainhq: true,
        volume: 0.8
      };
    }
  }
  PrefsModel.initClass();

  const randRange = range => Math.floor(Math.random() * range);
  const probability = prob => Math.floor(Math.random() + prob);

  // Experiments in this class need to match up with Google Analytics Custom Dimensions.
  class ExperimentsModel extends models.BackboneModel {
    static initClass() {
      this.prototype.sync = syncLocalStorage;
      models.buildProps(this, ([2, 3].map((n) => `dimension${n}`)));
    }
    initialize() {
      this.fetch();
      return this.save();
    }
      // ga 'set', _.omit @attributes, 'id'
    defaults() {
      // 'dimension1'                  # RESERVED as User Type: 'Visitor' or 'Registered'
      return {
        'dimension2': 0,                 // Twitter promo: 0 old, 1 new. Ended 20131104
        'dimension3': 0
      };
    }
  }
  ExperimentsModel.initClass();                 // End of race revamp. Ended 20131113

  return (App = class App {
    constructor() {
      this.root = new RootModel({
        user: null,
        track: null,
        prefs: new PrefsModel,
        xp: new ExperimentsModel
      });

      this.root.prefs.fetch();  // Assume sync because it's localStorage.
      this.root.prefs.on('change', () => this.root.prefs.save());

      this.unifiedView = (new UnifiedView(this)).render();

      this.router = new Router(this);

      this.router.on('route', function() {});
        // window._gaq.push ['_trackPageview']
        // ga 'send', 'pageview'

      Backbone.on('app:settrack', this.setTrack, this);
      Backbone.on('app:settrackid', this.setTrackId, this);
      Backbone.on('app:checklogin', this.checkUserLogin, this);
      Backbone.on('app:logout', this.logout, this);
      Backbone.on('app:settitle', this.setTitle, this);
      Backbone.on('app:webglerror', function() {
        console.error('WEBGL ERROR');
        return Backbone.history.navigate('/about', {trigger: true});
      });
      Backbone.on('app:notfound', this.notFound, this);

      this.checkUserLogin();
      const found = Backbone.history.start({pushState: true});
      if (!found) {
        console.error('app:route not found');
        Backbone.trigger('app:notfound');
      }

      if (!this.unifiedView.client.renderer) {
        // WebGL failed to initialize.
        if (location.pathname !== '/about') {
          Backbone.trigger('app:webglerror');
        }
      }
    }

    notFound() {
      this.router.setSpin();
      return this.router.uni.setViewChild((new NotFoundView).render());
    }

    setTrack(track, fromRouter) {
      console.log('setting track', track, fromRouter);
      const lastTrack = this.root.track;
      if (track === lastTrack) {
        // Just notify that track has been reset.
        track.trigger('change');
        return;
      }
      this.root.track = track;
      // TODO: Deep comparison with lastTrack to find out which events to fire.
      if (track.env !== (lastTrack != null ? lastTrack.env : undefined)) { track.trigger('change:env'); }
      track.trigger('change:id');
      track.trigger('change:name');
      track.trigger('change:published');
      track.trigger('change:user');
      track.trigger('change:config.course.checkpoints.');
      track.trigger('change:config.course.startposition.');
      track.trigger('change:config.scenery.');
      return track.trigger('change');
    }

    setTrackId(trackId) {
      this.trackId = trackId;
      console.log('setting track by id', trackId);
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
          console.error('setTrackId loading error');
          return Backbone.trigger('app:notfound');
        }
      });
    }

    checkUserLogin() {
      return $.ajax('/v1/auth/me')
      .done(data => {
        if (data.user) {
          // _gaq.push ['_setCustomVar', 1, 'User Type', 'Registered', 2]
          // ga 'set', 'dimension1', 'Registered'
          // ga 'send', 'event', 'login', 'Log In'
          const user = models.User.findOrCreate(data.user.id);
          user.set(user.parse(data.user));
          this.root.user = user;
          return Backbone.trigger('app:status', 'Logged in');
          // user.root.tracks.each (track) ->
          //   track.fetch()
          // @listenTo root, 'add:user.tracks.', (track) ->
          //   track.fetch()
        } else {
          return this.logout();
        }
      });
    }

    logout() {
      // _gaq.push ['_setCustomVar', 1, 'User Type', 'Visitor', 2]
      // ga 'set', 'dimension1', 'Visitor'
      // ga 'send', 'event', 'login', 'Log Out'
      this.root.user = null;
      return Backbone.trigger('app:status', 'Logged out');
    }

    setTitle(title) {
      const main = "Trigger Rally";
      return document.title = title ? `${title} - ${main}` : main;
    }

    showCreditPurchaseDialog() {
      if (this.root.user) {
        alert("Not enough credits");
        // purchaseView = new PurchaseView @root.user, @, @unifiedView.client
        // @unifiedView.setDialog purchaseView
        // purchaseView.render()
      } else {
        popup.create("/login?popup=1", "Login", () => Backbone.trigger('app:checklogin'));
      }
    }
  });
});
