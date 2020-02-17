/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'jquery',
  'backbone-full',
  'models/index',
  'views/comments',
  'views/favorite',
  'views/user',
  'views/view',
  'views/view_collection',
  'jade!templates/track',
  'jade!templates/trackrun',
  'util/popup'
], function(
  $,
  Backbone,
  models,
  CommentsView,
  FavoriteView,
  UserView,
  View,
  ViewCollection,
  template,
  templateRun,
  popup
) {
  let TrackView;
  const loadingText = '...';

  class TrackRunView extends View {
    static initClass() {
      this.prototype.template = templateRun;
      this.prototype.tagName = 'tr';
    }

    initialize() {
      return this.model.fetch();
    }

    viewModel() {
      const data = super.viewModel(...arguments);
      if (data.name == null) { data.name = loadingText; }
      if (data.modified_ago == null) { data.modified_ago = loadingText; }
      if (data.user == null) { data.user = null; }
      return data;
    }

    beforeRender() {
      return (this.userView != null ? this.userView.destroy() : undefined);
    }

    afterRender() {
      let updateUserView;
      const run = this.model;
      // @listenTo run, 'change', @render, @

      const $runuser = this.$('.runuser');
      this.userView = null;
      (updateUserView = () => {
        if (this.userView != null) {
          this.userView.destroy();
        }
        this.userView = run.user && new UserView({
          model: run.user});
        $runuser.empty();
        if (this.userView) { return $runuser.append(this.userView.el); }
      })();
      return this.listenTo(run, 'change:user', updateUserView);
    }

    destroy() {
      this.userView.destroy();
      return super.destroy(...arguments);
    }
  }
  TrackRunView.initClass();

  class TrackRunsView extends ViewCollection {
    static initClass() {
      this.prototype.view = TrackRunView;
      this.prototype.childOffset = 1;
        // Ignore header <tr>.
    }
    initialize() {
      super.initialize(...arguments);
      return this.listenTo(this.collection, 'change', () => this.render());
    }
  }
  TrackRunsView.initClass();

  return TrackView = (function() {
    TrackView = class TrackView extends View {
      static initClass() {
        // className: 'overlay'
        this.prototype.template = template;
      }
      constructor(model, app, client) {
        super({ model }, app, client);
      }

      initialize(options, app, client) {
        this.app = app;
        this.client = client;

        Backbone.trigger('app:settitle', this.model.name);
        this.listenTo(this.model, 'change:name', () => Backbone.trigger('app:settitle', this.model.name));
        this.listenTo(this.model, 'change:id', () => this.render());
        const track = this.model;
        return track.fetch({
          success() {
            return track.env.fetch({
              success() {
                return Backbone.trigger('app:settrack', track);
              }
            });
          },
          error() {
            console.error('track:initialize loading error');
            return Backbone.trigger('app:notfound');
          }
        });
      }

      viewModel() {
        const data = super.viewModel(...arguments);
        if (data.name == null) { data.name = loadingText; }
        if (data.count_drive == null) { data.count_drive = loadingText; }
        if (data.count_copy == null) { data.count_copy = loadingText; }
        if (data.count_fav == null) { data.count_fav = loadingText; }
        data.loggedIn = (this.app.root.user != null);
        // data.loggedInUser = @app.root.user
        return data;
      }

      afterRender() {
        let updateUserView;
        const track = this.model;
        const trackRuns = models.TrackRuns.findOrCreate(track.id);
        const trackRunsView = new TrackRunsView({
          collection: trackRuns.runs,
          el: this.$('table.runlist')
        });
        trackRunsView.render();
        trackRuns.fetch();

        const $author = this.$('.author');
        this.userView = null;
        (updateUserView = () => {
          if (this.userView != null) {
            this.userView.destroy();
          }
          this.userView = track.user && new UserView({
            model: track.user});
          $author.empty();
          if (this.userView) { return $author.append(this.userView.el); }
        })();
        this.listenTo(track, 'change:user', updateUserView);

        const $favorite = this.$('.favorite');
        this.favoriteView = new FavoriteView(track, this.app.root);
        $favorite.html(this.favoriteView.el);

        const $name = this.$('.name');
        this.listenTo(this.model, 'change:name', (model, value) => {
          return $name.text(value);
        });

        const $count_drive = this.$('.count_drive');
        this.listenTo(this.model, 'change:count_drive', (model, value) => {
          return $count_drive.text(value);
        });

        const $count_copy = this.$('.count_copy');
        this.listenTo(this.model, 'change:count_copy', (model, value) => {
          return $count_copy.text(value);
        });

        const $count_fav = this.$('.count_fav');
        this.listenTo(this.model, 'change:count_fav', (model, value) => {
          return $count_fav.text(value);
        });

        const comments = models.CommentSet.findOrCreate(`track-${track.id}`);
        this.commentsView = new CommentsView(comments, this.app);
        this.commentsView.render();
        const $commentsView = this.$('.comments-view');
        return $commentsView.html(this.commentsView.el);
      }
    };
    TrackView.initClass();
    return TrackView;
  })();
});
