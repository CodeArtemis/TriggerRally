/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'views/view'
], function(
  View
) {
  class ViewCollection extends View {
    static initClass() {
      //collection: new Backbone.Collection()
      //view: View  # The type of child views to create.

      // The number of fixed (non-model) child elements to ignore.
      // This could be used to ignore a header <tr> in a table, for example.
      this.prototype.childOffset = 0;
    }

    initialize() {
      this.onAdd = this.onAdd.bind(this);
      this.onRemove = this.onRemove.bind(this);
      this.onReset = this.onReset.bind(this);
      this.onSort = this.onSort.bind(this);

      super.initialize(...arguments);
      this.views = {};  // keyed by model.cid

      this.addAll();

      this.listenTo(this.collection, 'add', this.onAdd);
      this.listenTo(this.collection, 'remove', this.onRemove);
      this.listenTo(this.collection, 'reset', this.onReset);
      this.listenTo(this.collection, 'sort', this.onSort);
    }

    destroy() {
      this.destroyAll();
      return super.destroy(...arguments);
    }

    onAdd(model, collection, options) {
      return this.addModel(model, collection.indexOf(model));
    }

    addModel(model, index) {
      const view = this.createView(model);
      view.render();
      const $target = this.$el.children().children().eq(index + this.childOffset);
      if ($target.length > 0) {
        $target.before(view.el);
      } else {
        this.$el.append(view.el);
      }
      return this.views[model.cid] = view;
    }

    onRemove(model, collection, options) {
      return (this.views[model.cid] != null ? this.views[model.cid].destroy() : undefined);
    }

    onReset(collection, options) {
      this.destroyAll();
      return this.addAll();
    }

    onSort(collection, options) {
      // TODO: Only touch views that have moved?
      this.$el.children().slice(this.childOffset).detach();
      return (() => {
        const result = [];
        for (let model of Array.from(collection.models)) {
          const view = this.views[model.cid];
          result.push(this.$el.append(view.$el));
        }
        return result;
      })();
    }
      // removed = {}
      // $children = @$el.children()
      // for model, index in collection.models
      //   $child = $children.eq index
      //   view = @views[model.cid]
      //   if $child[0] isnt view.el
      //     $child.detach()
      //     removed.push $child

    createView(model) { return new this.view({ model, parent: this }); }

    addAll() {
      this.collection.each(this.addModel, this);
      return this;
    }

    destroyAll() {
      for (let cid in this.views) { const view = this.views[cid]; view.destroy(); }
      this.views = {};
      return this;
    }
  }
  ViewCollection.initClass();

  return ViewCollection;
});
