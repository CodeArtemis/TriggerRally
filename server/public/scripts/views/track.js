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
  'util/util',
  'util/popup',
  'util/localDB'
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
  util,
  popup,
  localDB
) {
  let TrackView;
  const loadingText = '.-.';

  class TrackRunView extends View {
    static initClass() {
      this.prototype.template = templateRun;
      this.prototype.tagName = 'tr';
    }

    initialize() {
      //return this.model.fetch();
    }

    viewModel() {
      const data = super.viewModel(...arguments);
      if (data.name == null) { data.name = loadingText; }
      data.created_ago = util.formatDateAgo(data.created);
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
      $runuser.text(run.get('user'))
      this.userView = null;

      // download run
      this.$('.download a').on('click', (e) => {
        e.preventDefault();
    
        const json = JSON.stringify(run.toJSON());
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
    
        const a = document.createElement('a');
        a.href = url;
        localDB.getTrack(run.get("track"), track =>{
          a.download = `${run.get("user")} - ${track.name} - ${run.get("time_readable")}.json`;
          a.click();
          URL.revokeObjectURL(url);
        })
      });
    
      // delete run
      this.$('.delete a').on('click', (e) => {
        e.preventDefault();
        localDB.deleteRun(run.id)
        run.destroy();
      });
    }

    destroy() {
      if (this.userView) {
        this.userView.destroy();
      }
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
        this.runs_data = []

        if (this.model.id != app.root.track.id) {
          Backbone.trigger('app:settitle', this.model.name);
          this.listenTo(this.model, 'change:name', () => Backbone.trigger('app:settitle', this.model.name));
          //this.listenTo(this.model, 'change:id', () => this.render());
          const track = this.model;
          Backbone.trigger('app:settrack', track);
        }
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
        const trackId = track.get('id');

        this.runs = new models.RunCollection();

        this.trackRunsView = new TrackRunsView({
          collection: this.runs,
          el: this.$('table.runlist')
        });
        this.trackRunsView.render();

        localDB.getRuns(trackId, runs => {
          this.runs_data = runs
          this.resetRunsList()
        });

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

        
        // why are the events triggering twice?
        const $radio_all_times = this.$('.radioAllTimes');
        $radio_all_times.on('click', event => {
          localStorage.setItem("runsListOptions", "allTimes")
          this.resetRunsList()
        })

        const $radio_my_times = this.$('.radioMyTimes');
        $radio_my_times.on('click', event => {
          localStorage.setItem("runsListOptions", "myTimes")
          this.resetRunsList()
        })

        const $radio_leaderboard = this.$('.radioLeaderboard');
        $radio_leaderboard.on('click', event => {
          localStorage.setItem("runsListOptions", "leaderboard")
          this.resetRunsList()
        })

        switch (localStorage.getItem("runsListOptions")) {
          case "allTimes":
            $radio_all_times.click()
            break;
          case "myTimes":
              $radio_my_times.click()
              break;
          case "leaderboard":
              $radio_leaderboard.click()
              break;
          default:
            $radio_all_times.click()
            break;
        }


        const comments = models.CommentSet.findOrCreate(`track-${track.id}`);
        this.commentsView = new CommentsView(comments, this.app);
        this.commentsView.render();
        const $commentsView = this.$('.comments-view');
        return $commentsView.html(this.commentsView.el);
      }

      resetRunsList(){

        // filter data
        let displayRuns = [];
        switch (localStorage.getItem('runsListOptions')) {

          case 'allTimes':
            displayRuns = this.runs_data
            break;
          
          case 'myTimes':
            displayRuns = this.runs_data.filter(run => run.user == this.app.root.user.get('id'))
            break;

          case 'leaderboard':
            const usersBestRun = {}
            for (let run of this.runs_data){
              if (!usersBestRun[run.user] || usersBestRun[run.user].time > run.time){
                usersBestRun[run.user] = run
              }
            }
            displayRuns = Object.values(usersBestRun)
            break;
          
          default:
            displayRuns = this.runs_data
        }
        
        // sort and rank
        displayRuns.sort((a, b) => a.time - b.time)
        for (let i=0; i<displayRuns.length; i++){
          displayRuns[i].rank = i+1
        }
        
        this.runs.reset(displayRuns);

      }
    };
    TrackView.initClass();
    return TrackView;
  })();
});
