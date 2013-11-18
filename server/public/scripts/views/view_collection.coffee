define [
  'cs!views/view'
], (
  View
) ->
  class ViewCollection extends View
    #collection: new Backbone.Collection()
    #view: View  # The type of child views to create.

    # The number of fixed (non-model) child elements to ignore.
    # This could be used to ignore a header <tr> in a table, for example.
    childOffset: 0

    initialize: (options) ->
      super
      @views = {}  # keyed by model.cid

      @addAll()

      @listenTo @collection, 'add', @onAdd
      @listenTo @collection, 'remove', @onRemove
      @listenTo @collection, 'reset', @onReset
      @listenTo @collection, 'sort', @onSort
      return

    destroy: ->
      @destroyAll()
      super

    onAdd: (model, collection, options) =>
      @addModel model, collection.indexOf model

    addModel: (model, index) ->
      view = @createView model
      view.render()
      $target = @$el.children().children().eq index + @childOffset
      if $target.length > 0
        $target.before view.el
      else
        @$el.append view.el
      @views[model.cid] = view

    onRemove: (model, collection, options) =>
      @views[model.cid]?.destroy()

    onReset: (collection, options) =>
      @destroyAll()
      @addAll()

    onSort: (collection, options) =>
      # TODO: Only touch views that have moved?
      @$el.children().slice(@childOffset).detach()
      for model in collection.models
        view = @views[model.cid]
        @$el.append view.$el
      # removed = {}
      # $children = @$el.children()
      # for model, index in collection.models
      #   $child = $children.eq index
      #   view = @views[model.cid]
      #   if $child[0] isnt view.el
      #     $child.detach()
      #     removed.push $child

    createView: (model) -> new @view { model, parent: @ }

    addAll: ->
      @collection.each @addModel, @
      @

    destroyAll: ->
      view.destroy() for cid, view of @views
      @views = {}
      @

  ViewCollection
