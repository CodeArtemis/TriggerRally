/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'views/view',
  'views/view_collection',
  'jade!templates/trackset',
  'jade!templates/tracksetentry',
  'views/favorite',
  'views/user'
], function(
  Backbone,
  View,
  ViewCollection,
  template,
  templateEntry,
  FavoriteView,
  UserView
) {
  let TrackSetView;
  class TrackSetEntryView extends View {
    static initClass() {
      this.prototype.template = templateEntry;
      this.prototype.tagName = 'tr';
    }

    initialize() {
      this.model.fetch();
      this.root = this.options.parent.options.root;
      return this.listenTo(this.model, 'change', this.render, this);
    }

    viewModel() {
      const data = super.viewModel(...arguments);
      const loading = '...';
      if (data.name == null) { data.name = loading; }
      if (data.modified_ago == null) { data.modified_ago = loading; }
      if (data.count_copy == null) { data.count_copy = loading; }
      if (data.count_drive == null) { data.count_drive = loading; }
      if (data.count_fav == null) { data.count_fav = loading; }
      if (data.user == null) { data.user = null; }
      return data;
    }

    beforeRender() {
      if (this.userView != null) {
        this.userView.destroy();
      }
      return (this.favoriteView != null ? this.favoriteView.destroy() : undefined);
    }

    afterRender() {
      let updateUserView;
      const track = this.model;

      const $trackuser = this.$('.trackuser');
      this.userView = null;
      (updateUserView = () => {
        if (this.userView != null) {
          this.userView.destroy();
        }
        this.userView = track.user && new UserView({
          model: track.user});
        $trackuser.empty();
        if (this.userView) { return $trackuser.append(this.userView.el); }
      })();
      this.listenTo(track, 'change:user', updateUserView);

      const $favorite = this.$('.favorite');
      this.favoriteView = new FavoriteView(track, this.options.parent.options.root);
      return $favorite.html(this.favoriteView.el);
    }

      // $count_fav = @$('count_fav')
      // @listenTo track, 'change:count_fav', ->
      //   $count_fav.text track.count_fav

    destroy() {
      this.beforeRender();
      return super.destroy(...arguments);
    }
  }
  TrackSetEntryView.initClass();

  class TrackListView extends ViewCollection {
    static initClass() {
      this.prototype.view = TrackSetEntryView;
      this.prototype.childOffset = 1;
    }
  }
  TrackListView.initClass();  // Ignore header <tr>.

  return TrackSetView = (function() {
    TrackSetView = class TrackSetView extends View {
      static initClass() {
        this.prototype.className = 'overlay';
        this.prototype.template = template;
      }
      constructor(model, app) {
        super({ model });
      }

      initialize(options, app) {
        this.app = app;
      }

      afterRender() {
        const trackListView = new TrackListView({
          collection: this.model.tracks,
          el: this.$('table.tracklist'),
          root: this.app.root
        });
        trackListView.render();

        return this.listenTo(this.model, 'change:name', (m, name) => {
          this.$('.tracksetname').text(name);
          return Backbone.trigger('app:settitle', name);
        });
      }
    };
    TrackSetView.initClass();
    return TrackSetView;
  })();
});
