/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'views/view',
  'jade!templates/favorite'
], function(
  View,
  template
) {
  let FavoriteView;
  return FavoriteView = (function() {
    FavoriteView = class FavoriteView extends View {
      static initClass() {
        this.prototype.tagName = 'span';
        this.prototype.template = template;
      }

      constructor(model, root) {
        super({ model }, root);
      }

      initialize(options, root) {
        this.root = root;
        super.initialize(...arguments);
        this.render();
        this.listenTo(this.root, 'change:user', () => this.updateChecked());
        this.listenTo(this.root, 'change:user.favorite_tracks', () => this.updateChecked());
        return this.listenTo(this.model, 'change:id', () => this.updateChecked());
      }
        // @model.fetch()

      viewModel() {
        return {checked: (this.root.user != null ? this.root.user.isFavoriteTrack(this.model) : undefined)};
      }

      updateChecked() {
        const $favorite = this.$('.favorite input');
        return $favorite[0].checked = this.root.user != null ? this.root.user.isFavoriteTrack(this.model) : undefined;
      }

      afterRender() {
        const $favorite = this.$('.favorite input');
        return $favorite.click(event => {
          if (this.root.user) {
            this.root.user.setFavoriteTrack(this.model, $favorite[0].checked);
            this.root.user.save();
          } else {
            Backbone.trigger('app:dologin');
            event.preventDefault();
            false;
          }
        });
      }
    };
    FavoriteView.initClass();
    return FavoriteView;
  })();
});
