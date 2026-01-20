/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define([
  'editor/ops',
  'views/view',
  'views/tracklist',
  'views/user',
  'models/index',
  'util/util',
  'util/localDB'
], function(
  Ops,
  View,
  TrackListView,
  UserView,
  models,
  util,
  localDB
) {
  let InspectorView;
  const deepClone = obj => JSON.parse(JSON.stringify(obj));

  // Utility for manipulating objects in models.
  const manipulate = function(model, attrib, fn) {
    let obj;
    fn(obj = deepClone(model.get(attrib)));
    return model.set(attrib, obj);
  };

  return (InspectorView = class InspectorView extends View {
    // TODO: Give inspector its own template, separate from editor.
    constructor($el, app, selection) {
      super({ el: $el }, app, selection);
    }

    initialize(options, app, selection) {
      this.app = app;
      this.selection = selection;
    }

    destroy() {
      return (this.userView != null ? this.userView.destroy() : undefined);
    }

    afterRender() {
      let onChange, onChangeEnv, updateItemsEnabled, updateName, updateSnap, updateTrackListView, updateUser;
      const { app } = this;
      const { selection } = this;
      const $ = this.$.bind(this);

      const $inspector = this.$el;
      const $inspectorAttribs = $inspector.find('.attrib');

      const attrib = function(selector) {
        const $el = $inspector.find(selector);
        return {
          $root: $el,
          $content: $el.find('.content')
        };
      };

      const selType           = attrib('#sel-type');
      const selTitle          = attrib('#title');
      const selScale          = attrib('#scale');
      const selDispRadius     = attrib('#disp-radius');
      const selDispHardness   = attrib('#disp-hardness');
      const selDispStrength   = attrib('#disp-strength');
      const selSurfRadius     = attrib('#surf-radius');
      const selSurfHardness   = attrib('#surf-hardness');
      const selSurfStrength   = attrib('#surf-strength');
      const sceneryType       = attrib('#scenery-type');
      const cmdAdd            = attrib('#cmd-add');
      const cmdCopy           = attrib('#cmd-copy');
      const cmdDelete         = attrib('#cmd-delete');
      const cmdSaveTrack      = attrib('#cmd-save-track');
      const cmdCopyTrack      = attrib('#cmd-copy-track');
      const cmdDownloadTrack  = attrib('#cmd-download-track');
      const cmdPublishTrack   = attrib('#cmd-publish-track');
      const cmdClearRuns      = attrib('#cmd-clear-runs');
      const cmdDeleteTrack    = attrib('#cmd-delete-track');
      const $cmdSaveTrack     = $inspector.find('#cmd-save-track');
      const $cmdCopyTrack     = $inspector.find('#cmd-copy-track');
      const $cmdPublishTrack  = $inspector.find('#cmd-publish-track');
      const $cmdClearRuns     = $inspector.find('#cmd-clear-runs');
      const $cmdDeleteTrack   = $inspector.find('#cmd-delete-track');
      const $flagPreventCopy  = $inspector.find('#flag-prevent-copy input');
      const $flagSnap         = $inspector.find('#flag-snap input');

      const { root } = app;

      let trackListView = null;
      (updateTrackListView = function() {
        if (trackListView != null) {
          trackListView.destroy();
        }
        trackListView = root.user && new TrackListView({
          collection: root.user.tracks,
          root
        });
        if (trackListView != null) { return $('#track-list').append(trackListView.el); }
      })();
      this.listenTo(root, 'change:user', updateTrackListView);

      this.userView = null;
      (updateUser = () => {
        if ((root.track != null ? root.track.user : undefined) === (this.userView != null ? this.userView.model : undefined)) { return; }
        if (this.userView != null) {
          this.userView.destroy();
        }
        if (root.track.user != null) {
          this.userView = new UserView({
            model: root.track.user});
          return $('#user-track-owner .content').append(this.userView.el);
        }
      })();
      this.listenTo(root, 'change:track.user', updateUser);

      const enableItem = ($button, enabled) => $button.prop('disabled', !enabled);

      (updateItemsEnabled = function() {
        const isOwnTrack = (root.track != null ? root.track.user : undefined) === root.user;
        const published = isOwnTrack && root.track.published;
        const editable = isOwnTrack && !published;
        enableItem(selTitle.$content, editable);
        enableItem(cmdSaveTrack.$content, editable);
        enableItem(cmdCopyTrack.$content, isOwnTrack || ((root.track != null) && !root.track.prevent_copy));
        enableItem(cmdPublishTrack.$content, editable);
        enableItem(cmdClearRuns.$content, editable);
        enableItem(cmdDeleteTrack.$content, editable);
        $("#track-ownership-warning").toggleClass('hidden', isOwnTrack);
        $("#copy-login-prompt").toggleClass('hidden', !!root.user);
        return $("#track-published-warning").toggleClass('hidden', !(isOwnTrack && published));
      })();
      this.listenTo(root, 'change:track.', updateItemsEnabled);
      this.listenTo(root, 'change:user', updateItemsEnabled);

      (onChangeEnv = function() {
        if (!__guard__(__guard__(root.track != null ? root.track.env : undefined, x1 => x1.scenery), x => x.layers)) { return; }
        sceneryType.$content.empty();
        return Array.from(root.track.env.scenery.layers).map((layer, idx) =>
          sceneryType.$content.append(new Option(layer.id, idx)));
      })();
      this.listenTo(root, 'change:track.env', onChangeEnv);

      (updateName = function() {
        if (root.track == null) { return; }
        if (selTitle.$content.val() === root.track.name) { return; }
        return selTitle.$content.val(root.track.name);
      })();
      this.listenTo(root, 'change:track.name', updateName);
      
      selTitle.$content.on('input', () => {
        root.track.set('name', selTitle.$content.val())
        localDB.updateTrack(root.track)
      });
      selTitle.$content.on('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          selTitle.$content.blur();
        }
      });

      const bindSlider = function(type, slider, eachSel) {
        const { $content } = slider;
        return $content.change(function() {
          const val = parseFloat($content.val());
          return (() => {
            const result = [];
            for (let selModel of Array.from(selection.models)) {
              const sel = selModel.get('sel');
              if (sel.type === type) { result.push(eachSel(sel, val)); } else {
                result.push(undefined);
              }
            }
            return result;
          })();
        });
      };

      bindSlider('checkpoint', selDispRadius,   (sel, val) => manipulate(sel.object, 'disp', o => o.radius   = val));
      bindSlider('checkpoint', selDispHardness, (sel, val) => manipulate(sel.object, 'disp', o => o.hardness = val));
      bindSlider('checkpoint', selDispStrength, (sel, val) => manipulate(sel.object, 'disp', o => o.strength = val));
      bindSlider('checkpoint', selSurfRadius,   (sel, val) => manipulate(sel.object, 'surf', o => o.radius   = val));
      bindSlider('checkpoint', selSurfHardness, (sel, val) => manipulate(sel.object, 'surf', o => o.hardness = val));
      bindSlider('checkpoint', selSurfStrength, (sel, val) => manipulate(sel.object, 'surf', o => o.strength = val));

      bindSlider('scenery', selScale, function(sel, val) {
        const scenery = deepClone(root.track.config.scenery);
        scenery[sel.layer].add[sel.idx].scale = Math.exp(val);
        return root.track.config.scenery = scenery;
      });

      cmdAdd.$content.click(function() {
        const $sceneryType = sceneryType.$content.find(":selected");
        const layerIdx = $sceneryType.val();
        const layer = $sceneryType.text();
        return Ops.addScenery(root.track, layer, layerIdx, selection);
      });

      cmdCopy.$content.click(() => Ops.copy(root.track, selection));

      cmdDelete.$content.click(() => Ops.delete(root.track, selection));

      cmdDownloadTrack.$content.click(function() {
        const str = JSON.stringify(root.track.toJSON(), null, 2);
        const url = URL.createObjectURL(new Blob([str], {type: "application/json"}));
        Object.assign(document.createElement("a"), { href: url, download: `${root.track.name}.json` }).click();
      });

      cmdSaveTrack.$content.click(function() {
          root.track.set('modified', new Date().toISOString(), { silent: true, dontSave: true})
          localDB.updateTrack(root.track)
          // TODO: warn the user if saving failed
          //console.log("saving track")
      })

      cmdCopyTrack.$content.click(function() {

        const newRawTrack = root.track.toJSON()

        newRawTrack.id = util.randomId()
        newRawTrack.count_fav = 0,
        newRawTrack.demo = true,
        newRawTrack.modified = new Date().toISOString()
        newRawTrack.name = newRawTrack.name + " copy",
        newRawTrack.parent = root.track.id,
        newRawTrack.user = root.user.get('id'),
        newRawTrack.prevent_copy = false,
        newRawTrack.count_copy = 0,
        newRawTrack.count_drive = 0,
        newRawTrack.published = false,
        newRawTrack.modified_ago = "",
        newRawTrack.created_ago = "",
        newRawTrack.created = new Date().toISOString()

        const newTrack = new models.Track(newRawTrack, { parse: true }) 
        localDB.storeTrack(newTrack, root.user.get('id'))

        Backbone.trigger("app:settrack", newTrack);

        // clean url
        Backbone.history.navigate(`${window.BASE_PATH}/track/${root.track.id}/edit`);
      });

      cmdDeleteTrack.$content.click(function() {
        if (!window.confirm("Are you sure you want to DELETE this track? This can't be undone!")) { return; }
        return root.track.destroy({
          success() {
            return Backbone.history.navigate("/track/v3-base-1/edit", {trigger: true});
          },
          error(model, xhr) {
            return Backbone.trigger("app:status", `Delete failed: ${xhr.statusText} (${xhr.status})`);
          }
        });
      });

      cmdPublishTrack.$content.click(function() {
        if (!window.confirm("Publishing a track will lock it and allow players to start competing for top times. Are you sure?")) { return; }
        root.track.set({published: true});
        localDB.updateTrack(root.track);
      });

      (updateSnap = () => { return this.snapToGround = $flagSnap[0].checked; })();
      $flagSnap.on('change', updateSnap);

      const checkpointSliderSet = function(slider, val) {
        slider.$content.val(val);
        return slider.$root.addClass('visible');
      };

      (onChange = function() {
        // Hide and reset all controls first.
        let sel;
        $inspectorAttribs.removeClass('visible');

        selType.$content.text((() => { switch (selection.length) {
          case 0: return 'none';
          case 1:
            sel = selection.first().get('sel');
            if (sel.type === 'scenery') {
              return sel.layer;
            } else {
              return sel.type;
            }
          default: return '[multiple]';
        
        } })());

        for (let selModel of Array.from(selection.models)) {
          sel = selModel.get('sel');
          switch (sel.type) {
            case 'checkpoint':
              checkpointSliderSet(selDispRadius,   sel.object.disp.radius);
              checkpointSliderSet(selDispHardness, sel.object.disp.hardness);
              checkpointSliderSet(selDispStrength, sel.object.disp.strength);
              checkpointSliderSet(selSurfRadius,   sel.object.surf.radius);
              checkpointSliderSet(selSurfHardness, sel.object.surf.hardness);
              checkpointSliderSet(selSurfStrength, sel.object.surf.strength);
              cmdDelete.$root.addClass('visible');
              cmdCopy.$root.addClass('visible');
              break;
            case 'scenery':
              selScale.$content.val(Math.log(sel.object.scale));
              selScale.$root.addClass('visible');
              cmdDelete.$root.addClass('visible');
              cmdCopy.$root.addClass('visible');
              break;
            case 'terrain':
              // Terrain selection acts as marker for adding scenery.
              sceneryType.$root.addClass('visible');
              cmdAdd.$root.addClass('visible');
              break;
          }
        }
      })();

      selection.on('add', onChange);
      selection.on('remove', onChange);
      selection.on('reset', onChange);
    }
  });
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}