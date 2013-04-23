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
      $target = @$el.children().eq index + @childOffset
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
      throw new Error 'implement onSort'
      #   @sort collection

    # sort: (collection) ->
    #   console.log 'sorting'
    #   console.log @el
    #   @$el.children().sort (a, b) -> Math.floor(Math.random() * 3) - 1
    #   return
    #   oldViews = @views
    #   view.$el.detach() for cid, view of oldViews
    #   oldModels = _.pluck oldViews, 'model'
    #   @views = for model in collection.models
    #     i = oldModels.indexOf model
    #     console.log "sort index #{i}"
    #     newView = if i is -1
    #       @createView model
    #     else
    #       oldViews[i]
    #     @$el.append newView.el
    #     newView
    #   @destroyView view for view in oldViews when view not in @views
    #   @

    createView: (model) -> new @view { model, parent: @ }

    addAll: ->
      @collection.each @addModel, @
      @

    destroyAll: ->
      view.destroy() for cid, view of @views
      @views = {}
      @

  ViewCollection
