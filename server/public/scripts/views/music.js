/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'views/view',
  'jade!templates/music'
], function(
  View,
  template
) {
  let artist, MusicView, src, title, val;
  const baseUrl = '/radio/';
  const tracksSrc = {
    'Alex Beroza': {
      'Art Now': 'AlexBeroza_-_Art_Now.ogg',
      'Brake Dance': 'AlexBeroza_-_Brake_Dance.ogg',
      'Could Be': 'AlexBeroza_-_Could_Be.ogg',
      'Emerge In Love': 'AlexBeroza_-_Emerge_In_Love.ogg',  // 5
      'In Peace': 'AlexBeroza_-_In_Peace.ogg'
    },
    'Carl and the Saganauts': {
      // 'Trigger Theme 1': 'saganauts-tr1.ogg'
      // 'Theme 2': 'saganauts-tr2.ogg'
      'Trigger Rally Theme': 'saganauts-tr4.ogg'
    },
    'Citizen X0': {
      'Art is Born': 'Citizen_X0_-_Art_is_Born.ogg'
    },
    'DoKashiteru': {
      '2025': 'DoKashiteru_-_2025.ogg'
    },
    'Dubslate': {
      'Nervous Refix': 'dubslate_-_nervous_refix.ogg'
    },
    'J.Lang': {
      'Love Will Open Your Heart Dance Mix': 'djlang59_-_Love_Will_Open_Your_Heart_Dance_Mix.ogg'
    },
    'Sawtooth': {
      'Carcinogens': 'Sawtooth_-_Carcinogens.ogg'
    },
    'SpinningMerkaba': {
      '260809 Funky Nurykabe': 'jlbrock44_-_260809_Funky_Nurykabe.ogg'
    },
    'Super Sigil': {
      'Thunderlizard at the Art War': 'Super_Sigil_-_Thunderlizard_at_the_Art_War.ogg'
    },
    'Travis Morgan': {
      'pROgraM vs. Us3R': 'morgantj_-_pROgraM_vs._Us3R.ogg'
    }
  };
  const tracks = [];
  for (artist in tracksSrc) {
    val = tracksSrc[artist];
    for (title in val) {
      src = val[title];
      tracks.push({ artist, title, src });
    }
  }

  return MusicView = (function() {
    MusicView = class MusicView extends View {
      static initClass() {
        this.prototype.tagName = 'span';
        this.prototype.className = 'dropdownmenu';
        this.prototype.template = template;
      }

      constructor(app) {
        super({}, app);
      }

      initialize(options, app) {
        this.app = app;
      }

      afterRender() {
        let updatePlay, updateVolume;
        const { prefs } = this.app.root;

        const $audio = this.$('audio');
        const $title = this.$('.title');
        const $artist = this.$('.artist');
        const $status = this.$('.status');
        const $volume = this.$('input.volume');
        const $playpause = this.$('.musiccontrol.playpause');
        const $next = this.$('.musiccontrol.next');

        $audio.on('all');

        let track = null;

        const updateStatus = function() {
          if (prefs.musicplay) {
            return $status.text(`(${track.title} by ${track.artist})`);
          } else {
            return $status.text("(paused)");
          }
        };

        let idx = -1;
        let recent = [];
        const playNext = function() {
          prefs.musicplay = true;
          const pickRandom = () => Math.floor(Math.random() * tracks.length);
          while (true) {
            idx = pickRandom();
            if (!Array.from(recent).includes(idx)) { break; }
          }
          recent = recent.slice(-5);
          recent.push(idx);
          track = tracks[idx];
          $audio.attr('src', baseUrl + track.src);
          $artist.text(track.artist);
          $title.text(track.title);
          return updateStatus();
        };

        // $audio.prop 'autoplay', yes  # Done in template.
        $audio[0].volume = 0.5;

        $audio.on('ended', playNext);
        $next.on('click', playNext);

        (updatePlay = function() {
          $playpause.toggleClass('play', !prefs.musicplay);
          $playpause.toggleClass('pause', prefs.musicplay);
          if (prefs.musicplay) {
            if (track) {
              updateStatus();
              return $audio[0].play();
            } else {
              return playNext();
            }
          } else {
            updateStatus();
            return $audio[0].pause();
          }
        })();
        $playpause.on('click', () => prefs.musicplay = !prefs.musicplay);
        prefs.on('change:musicplay', updatePlay);

        (updateVolume = function() {
          $volume.val(prefs.musicvolume);
          return $audio[0].volume = prefs.musicvolume;
        })();
        $volume.on('change', () => prefs.musicvolume = $volume.val());
        return prefs.on('change:musicvolume', updateVolume);
      }
    };
    MusicView.initClass();
    return MusicView;
  })();
});
