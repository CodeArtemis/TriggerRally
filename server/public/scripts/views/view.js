/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'backbone-full'
], function(
  Backbone
) {
  let View;
  return (View = class View extends Backbone.View {
    viewModel() {
      return (this.model != null ? this.model.toJSON() : undefined);
    }

    render() {
      this.beforeRender();
      if (this.template) {
        const viewModel = this.viewModel();
        const rendered = this.template(viewModel);
        this.$el.html(rendered);
      }
      this.afterRender();
      return this;
    }

    beforeRender() {}

    afterRender() {}

    destroy() {
      this.destroyed = true;
      return this.remove();
    }
  });
});
