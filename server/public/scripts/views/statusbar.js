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
  'backbone-full',
  'jade!templates/statusbar',
  'jade!templates/statusbarcar',
  'views/favorite',
  'views/music',
  'views/user',
  'views/view',
  'models/index'
], function(
  Backbone,
  template,
  templateCar,
  FavoriteView,
  MusicView,
  UserView,
  View,
  models
) {
  let StatusBarView;
  return StatusBarView = (function() {
    StatusBarView = class StatusBarView extends View {
      static initClass() {
        this.prototype.el = '#statusbar';
        this.prototype.template = template;
      }

      constructor(app) {
        super({}, app);
      }

      initialize(options, app) {
        this.app = app;
      }

      viewModel() {
        const { prefs } = this.app.root;
        const { user } = this.app.root;
        const pixdens = [
          { value: 2, label: '2:1' },
          { value: 1, label: '1:1' },
          { value: 0.8, label: '1:1.5' },
          { value: 0.5, label: '1:2' },
          { value: 0.25, label: '1:4' },
          { value: 0.125, label: '1:8' }
        ];
        for (let pd of Array.from(pixdens)) {
          pd.checked = ((`${pd.value}`) === prefs.pixeldensity);
        }
        return {
          prefs,
          pixdens,
          user
        };
      }

      afterRender() {
        let addCars, updateChallenge, updateMyFavorites, updateMyTracks, updateUserView;
        const { root } = this.app;

        const musicView = new MusicView(this.app);
        this.$('td.navigation').append(musicView.render().el);

        let userView = null;
        (updateUserView = () => {
          if (userView != null) {
            userView.destroy();
          }
          userView = new UserView({
            model: root.user,
            showStatus: true
          });
          return this.$('.userinfo').append(userView.el);
        })();
        this.listenTo(root, 'change:user', updateUserView);

        const $prefAudio = this.$('#pref-audio');
        const $prefVolume = this.$('#pref-volume');
        const $prefShadows = this.$('#pref-shadows');
        const $prefTerrainhq = this.$('#pref-terrainhq');
        const $prefAntialias = this.$('#pref-antialias');

        const { prefs } = root;

        $prefAudio.on('change', () => prefs.audio = $prefAudio[0].checked);
        $prefVolume.on('change', () => prefs.volume = $prefVolume.val());
        $prefShadows.on('change', () => prefs.shadows = $prefShadows[0].checked);
        $prefTerrainhq.on('change', () => prefs.terrainhq = $prefTerrainhq[0].checked);
        $prefAntialias.on('change', () => prefs.antialias = $prefAntialias[0].checked);

        this.listenTo(root, 'change:prefs.', function() {
          $prefAudio[0].checked = prefs.audio;
          $prefVolume.val(prefs.volume);
          $prefShadows[0].checked = prefs.shadows;
          $prefTerrainhq[0].checked = prefs.terrainhq;
          return $prefAntialias[0].checked = prefs.antialias;
        });

        this.$el.on('change', '.statusbarcar input:radio', function(event) {
          let left;
          prefs.car = this.value;
          const available = (left = (root.user != null ? root.user.cars() : undefined)) != null ? left : [ 'ArbusuG' ];
          if (!Array.from(available).includes(prefs.car)) {
            const purchaseUrl = {
              'Icarus': '/ignition',
              'Mayhem': '/mayhem'
            };
            Backbone.history.navigate(purchaseUrl[prefs.car], {trigger: true});
          }
        });

        this.$el.on('change', '.pixeldensity input:radio', function(event) {
          return prefs.pixeldensity = this.value;
        });

        (updateChallenge = () => {
          return this.$(`input[type=radio][name=challenge][value=${prefs.challenge}]`).prop('checked', true);
        })();
        this.listenTo(root, 'change:prefs.challenge', updateChallenge);

        this.$("input[type=radio][name=challenge]").on('change', function() {
          return prefs.challenge = $(this).val();
        });

        const $carSection = this.$('.car-section');
        (addCars = () => {
          const cars = [ 'ArbusuG', 'Mayhem', 'Icarus' ];
          // cars = (models.Car.findOrCreate car for car in cars)
          this.$('.statusbarcar').remove();
          // if cars.length >= 2
          return (() => {
            const result = [];
            for (let car of Array.from(cars.reverse())) {
              const checked = prefs.car === car;
              const $li = $(templateCar({ car, checked }));
              result.push($li.insertAfter($carSection));
            }
            return result;
          })();
        })();
          // $('<hr class="statusbarcar">').insertAfter $carSection
        this.listenTo(root, 'change:user', addCars);

        const $trackInfo = this.$('.trackinfo');
        const $trackName = $trackInfo.find('.name');
        const $trackAuthor = $trackInfo.find('.author');
        const $trackLinkDrive = $trackInfo.find('.drive');
        const $trackLinkEdit = $trackInfo.find('.edit');
        const $trackLinkInfo = $trackInfo.find('.info');

        const $favorite = this.$('.favorite');
        this.favoriteView = null;
        if (root.track) {
          this.favoriteView = new FavoriteView(root.track, root);
          $favorite.html(this.favoriteView.el);
        }

        this.listenTo(root, 'change:track', () => {
          if (this.favoriteView != null) {
            this.favoriteView.destroy();
          }
          this.favoriteView = new FavoriteView(root.track, root);
          return $favorite.html(this.favoriteView.el);
        });
        this.listenTo(root, 'change:track.id', function() {
          const { id } = root.track;
          $trackName.attr('href', `/track/${id}`);
          $trackLinkDrive.attr('href', `/track/${id}/drive`);
          $trackLinkEdit.attr('href', `/track/${id}/edit`);
          return $trackLinkInfo.attr('href', `/track/${id}`);
        });
        this.listenTo(root, 'change:track.name', () => $trackName.text(root.track.name));
        let trackUserView = null;
        this.listenTo(root, 'change:track.user', function() {
          if (root.track.user === (trackUserView != null ? trackUserView.model : undefined)) { return; }
          if (trackUserView != null) {
            trackUserView.destroy();
          }
          if (root.track.user != null) {
            trackUserView = new UserView({
              model: root.track.user});
            $trackAuthor.empty();
            return $trackAuthor.append(trackUserView.el);
          }
        });

        const $myTracks = this.$('.mytracks');
        (updateMyTracks = function() {
          $myTracks.toggleClass('hidden', !root.user);
          if (root.user) { return $myTracks.attr('href', `/user/${root.user.id}/tracks`); }
        })();
        this.listenTo(root, 'change:user', updateMyTracks);

        const $myFavorites = this.$('.myfavorites');
        (updateMyFavorites = function() {
          $myFavorites.toggleClass('hidden', !root.user);
          if (root.user) { return $myFavorites.attr('href', `/user/${root.user.id}/favorites`); }
        })();
        this.listenTo(root, 'change:user', updateMyFavorites);

        this.listenTo(Backbone, 'statusbar:showchallenge', () => {
          return this.$('.challenge').removeClass('hidden');
        });
        return this.listenTo(Backbone, 'statusbar:hidechallenge', () => {
          return this.$('.challenge').addClass('hidden');
        });
      }

      height() { return this.$el.height(); }

      destroy() {
        // This shouldn't ever get called for StatusBar, really.
        return this.favoriteView.destroy();
      }
    };
    StatusBarView.initClass();
    return StatusBarView;
  })();
});
