define [
  'cs!./view'
], (
  View
) ->
  class ViewCollection extends View
    #collection: new Backbone.Collection()
    #view: View  # The type of child views to create.

    initialize: (options) ->
      super
      @views = []

      @collection.on 'add', (model, collection, options) =>
        #console.log 'add view'
        # TODO: Add new view in the right place using options.index.
        @renderOne model

      @collection.on 'remove', (model, collection, options) =>
        #console.log 'remove view'
        view = @find (view) -> view.model.cid is model.cid
        @destroyView view if view

      #@collection.on 'reset', (collection, options) =>
      #  console.log 'reset view'
      #  @reset collection.map (model) => new @view { model }

      # TODO: Fix this.
      #@collection.on 'sort', (collection, options) =>
      #  @sort collection

      return

    length: ->
      @views.length

    sort: (collection) ->
      console.log 'sorting'
      console.log @el
      @$el.children().sort (a, b) -> Math.floor(Math.random() * 3) - 1
      return
      oldViews = @views
      view.$el.detach() for view in oldViews
      oldModels = _.pluck oldViews, 'model'
      @views = for model in collection.models
        i = oldModels.indexOf model
        console.log "sort index #{i}"
        newView = if i is -1
          @createView model
        else
          oldViews[i]
        @$el.append newView.el
        newView
      @destroyView view for view in oldViews when view not in @views
      @

    add: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      for view in views
        unless @get view.cid
          @views.push view
          #@trigger('add', view, @) unless options.silent
      @

    get: (cid) ->
      @find((view) -> view.cid is cid) or null

    destroyViews: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      for view in views
        @destroy(view)
        #@trigger('remove', view, @) unless options.silent
      @

    destroyView: (view = @, options = {}) ->
      _views = @filter (_view) -> view.cid isnt _view.cid
      @views = _views
      view.undelegateEvents()
      view.$el.removeData().unbind()
      view.remove()
      #@trigger('remove', view, @) unless options.silent
      @

    reset: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      @destroyViews @views, options
      if views.length isnt 0
        @add views, options
        #@trigger('reset', view, @) unless options.silent
      @

    createView: (model) ->
      new @view { model, parent: @ }

    renderOne: (model) =>
      view = @createView model
      @$el.append view.render().el
      @add view
      @

    renderAll: ->
      @collection.each @renderOne
      @

  # Underscore methods that we want to implement on the Collection.
  methods = ['forEach', 'each', 'map', 'reduce', 'reduceRight', 'find',
    'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any',
    'include', 'contains', 'invoke', 'max', 'min', 'sortBy', 'sortedIndex',
    'toArray', 'size', 'first', 'initial', 'rest', 'last', 'without', 'indexOf',
    'shuffle', 'lastIndexOf', 'isEmpty', 'groupBy']

  # Mix in each Underscore method as a proxy to `ViewCollection#views`.
  _.each methods, (method) ->
    ViewCollection::[method] = ->
      _[method] @views, arguments...

  ViewCollection
