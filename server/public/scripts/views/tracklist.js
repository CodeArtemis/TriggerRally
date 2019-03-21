/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full',
  'views/view',
  'views/view_collection',
  'jade!templates/tracklistentry'
], function(
  Backbone,
  View,
  ViewCollection,
  templateTrackListEntry
) {
  let TrackListView;
  class TrackListEntryView extends View {
    static initClass() {
      this.prototype.tagName = 'div';
      this.prototype.className = 'track';
      this.prototype.template = templateTrackListEntry;
    }

    initialize(options) {
      super.initialize(...arguments);
      this.root = options.parent.options.root;
      this.model.on('change:name', () => this.render());
      this.root.on('change:track.id', () => this.updateSelected());
      return this.model.fetch();
    }

    viewModel() {
      return {
        name: this.model.name || 'Loading...',
        url: `/track/${this.model.id}/edit`
      };
    }

    updateSelected() {
      return this.$el.toggleClass('selected', this.model.id === (this.root.track != null ? this.root.track.id : undefined));
    }

    afterRender() {
      this.updateSelected();

      const $a = this.$el.find('a');
      return $a.click(function() {
        Backbone.history.navigate($a.attr('href'), {trigger: true});
        return false;
      });
    }
  }
  TrackListEntryView.initClass();

  return TrackListView = (function() {
    TrackListView = class TrackListView extends ViewCollection {
      static initClass() {
        this.prototype.view = TrackListEntryView;
      }
      initialize() {
        super.initialize(...arguments);
        this.collection.sort();
        return this.listenTo(this.collection, 'change:name', () => this.collection.sort());
      }
    };
    TrackListView.initClass();
    return TrackListView;
  })();
});
