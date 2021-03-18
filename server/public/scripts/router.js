/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'models/index',
  'views/about',
  'views/drive',
  'views/editor',
  'views/home',
  'views/ignition',
  'views/license',
  'views/mayhem',
  'views/packa',
  'views/profile',
  'views/replay',
  'views/spin',
  'views/track',
  'views/trackset'
], function(
  Backbone,
  models,
  AboutView,
  DriveView,
  EditorView,
  HomeView,
  IgnitionView,
  LicenseView,
  MayhemView,
  PackAView,
  ProfileView,
  ReplayView,
  SpinView,
  TrackView,
  TrackSetView
) {
  let Router;
  return Router = (function() {
    Router = class Router extends Backbone.Router {
      static initClass() {
  
        const routes = {
          "": "home",
          "about": "about",
          "ignition": "ignition",
          "license": "license",
          "mayhem": "mayhem",
          "run/:runId/replay": "runReplay",
          "track/:trackId": "track",
          "track/:trackId/": "track",
          "track/:trackId/edit": "trackEdit",
          "track/:trackId/drive": "trackDrive",
          "track/:trackId/drive/vs/:runId": "trackDrive",
          "tracklist/:setId": "trackset",
          "user/:userId": "user",
          "user/:userId/": "user",
          "user/:userId/tracks": "userTracks",
          "user/:userId/favorites": "userFavTracks"
        };

        // Hack add the base path (includes addresses without base path too for internal links that don't contain it)
        const prefix = window.BASE_PATH.replace(/^\//, '') + '/'
        this.prototype.routes = {}
        Object.keys(routes).forEach(route => {
          this.prototype.routes[route] = routes[route]
          this.prototype.routes[prefix + route] = routes[route]
        })
      }

      constructor(app) {
        super({}, app);
      }

      initialize(options, app) {
        this.app = app;
        this.uni = this.app.unifiedView;
      }

      setSpin() {
        if (!(this.uni.getView3D() instanceof SpinView)) {
          const view = new SpinView(this.app, this.uni.client);
          this.uni.setView3D(view);
          return view.render();
        }
      }

      about() {
        Backbone.trigger('app:settitle', 'About');
        this.setSpin();
        const view = new AboutView(this.app, this.uni.client);
        this.uni.setViewChild(view);
        return view.render();
      }

      home() {
        Backbone.trigger('app:settitle', null);
        this.setSpin();
        const view = new HomeView(this.app, this.uni.client);
        this.uni.setViewChild(view);
        return view.render();
      }

      ignition() {
        Backbone.trigger('app:settitle', 'Ignition Pack');
        this.setSpin();
        const view = new IgnitionView(this.app, this.uni.client);
        this.uni.setViewChild(view);
        return view.render();
      }

      license() {
        Backbone.trigger('app:settitle', 'License and Terms of Use');
        this.setSpin();
        const view = new LicenseView(this.app, this.uni.client);
        return this.uni.setViewChild(view.render());
      }

      mayhem() {
        Backbone.trigger('app:settitle', 'Mayhem Pack');
        this.setSpin();
        const view = new MayhemView(this.app, this.uni.client);
        this.uni.setViewChild(view);
        return view.render();
      }

      packA() {
        Backbone.trigger('app:settitle', 'Purchase');
        this.setSpin();
        const view = new PackAView(this.app, this.uni.client);
        this.uni.setViewChild(view);
        return view.render();
      }

      runReplay(runId) {
        let view = this.uni.getView3D();
        if (!(view instanceof ReplayView) ||
               (view !== this.uni.getViewChild())) {
          const run = models.Run.findOrCreate(runId);
          view = new ReplayView(this.app, this.uni.client, run);
          this.uni.setViewBoth(view);
          return view.render();
        }
      }

      track(trackId) {
        this.setSpin();
        const track = models.Track.findOrCreate(trackId);
        const view = new TrackView(track, this.app, this.uni.client);
        return this.uni.setViewChild(view.render());
      }

      trackDrive(trackId, runId) {
        let view = this.uni.getView3D();
        if (!(view instanceof DriveView) ||
               (view !== this.uni.getViewChild())) {
          view = new DriveView(this.app, this.uni.client);
          this.uni.setViewBoth(view);
          view.render();
        }
        view.setTrackId(trackId);
        if (runId) {
          return view.setRunId(runId);
        } else {
          return view.useChallengeRun();
        }
      }

      trackEdit(trackId) {
        if (!(this.uni.getView3D() instanceof EditorView) ||
               (this.uni.getView3D() !== this.uni.getViewChild())) {
          const view = new EditorView(this.app, this.uni.client);
          this.uni.setViewBoth(view);
          view.render();
        }

        // TODO: Let the editor do this itself.
        const track = models.Track.findOrCreate(trackId);
        return track.fetch({
          success() {
            return track.env.fetch({
              success() {
                Backbone.trigger("app:settrack", track, true);
                return Backbone.trigger('app:settitle', `Edit ${track.name}`);
              },
              error() {
                console.error('trackEdit environment loading error');
                return Backbone.trigger('app:notfound');
              }
            });
          },
          error() {
            console.error('trackEdit loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      trackset(setId) {
        this.setSpin();
        const trackSet = models.TrackSet.findOrCreate(setId);
        trackSet.fetch();
        const view = new TrackSetView(trackSet, this.app, this.uni.client);
        return this.uni.setViewChild(view.render());
      }

      user(userId) {
        this.setSpin();
        const user = models.User.findOrCreate(userId);
        const view = new ProfileView(user, this.app, this.uni.client);
        return this.uni.setViewChild(view.render());
      }

      userFavTracks(userId) {
        this.setSpin();
        const user = models.User.findOrCreate(userId);
        return user.fetch({
          success: () => {
            const favTracks = (Array.from(user.favorite_tracks).map((trackId) => models.Track.findOrCreate(trackId)));
            const trackSet = new models.TrackSet({
              name: `${user.name}'s Favorites`,
              tracks: new models.TrackCollection(favTracks)
            });
            // trackSet.tracks.on 'change:modified', -> trackSet.tracks.sort()
            const view = new TrackSetView(trackSet, this.app, this.uni.client);
            return this.uni.setViewChild(view.render());
          },
          error() {
            console.error('userfav tracks loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      userTracks(userId) {
        this.setSpin();
        const user = models.User.findOrCreate(userId);
        return user.fetch({
          success: () => {
            const trackSet = new models.TrackSet({
              name: `${user.name}'s Tracks`,
              tracks: new models.TrackCollectionSortModified(user.tracks.models)
            });
            trackSet.tracks.on('change:modified', () => trackSet.tracks.sort());
            const view = new TrackSetView(trackSet, this.app, this.uni.client);
            return this.uni.setViewChild(view.render());
          },
          error() {
            console.error('userTrack loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }
    };
    Router.initClass();
    return Router;
  })();
});
