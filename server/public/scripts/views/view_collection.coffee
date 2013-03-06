define [
  'cs!./view'
], (
  View
) ->
  class ViewCollection extends View
    #collection: new Backbone.Collection()
    #view: View  # The type of child views to create.

    initialize: ->
      super
      @views = []

      @collection.on 'add', (model, collection, options) =>
        console.log 'add view'
        @renderOne model

      @collection.on 'remove', (model, collection, options) =>
        console.log 'remove view'
        view = @find (view) -> view.model.cid is model.cid
        @destroy view if view

      #@collection.on 'reset', (collection, options) =>
      #  console.log 'reset view'
      #  @reset collection.map (model) => new @view { model }

      @collection.on 'sort', (collection, options) =>
        throw 'sort not implemented'

      return

    length: ->
      @views.length

    add: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      for view in views
        unless @get view.cid
          @views.push view
          #@trigger('add', view, @) unless options.silent
      @

    get: (cid) ->
      @find((view) -> view.cid is cid) or null

    # TODO: Rename this method, it conflicts with Backbone.View.
    remove: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      for view in views
        @destroy(view)
        #@trigger('remove', view, @) unless options.silent
      @

    destroy: (view = @, options = {}) ->
      _views = @filter (_view) -> view.cid isnt _view.cid
      @views = _views
      view.undelegateEvents()
      view.$el.removeData().unbind()
      #view.remove()
      Backbone.View::remove.call view
      #@trigger('remove', view, @) unless options.silent
      @

    reset: (views, options = {}) ->
      views = if _.isArray(views) then views.slice() else [views]
      @remove @views, options
      if views.length isnt 0
        @add views, options
        #@trigger('reset', view, @) unless options.silent
      @

    renderOne: (model) =>
      view = new @view { model }
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
      _[method].apply _, [@views].concat(_.toArray(arguments))

  ViewCollection
