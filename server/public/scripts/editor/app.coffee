define [
  'backbone-full'
  'cs!editor/editor'
  'cs!models/index'
], (
  Backbone
  Editor
  models
) ->
  class Router extends Backbone.Router
    constructor: (@app) ->
      super()

    routes:
      "track/:trackId/edit": "trackEdit"

    trackEdit: (trackId) ->
      @app.setCurrent @app.editorView
      @app.editorView.setTrack trackId

  class App
    constructor: ->
      @user = new models.User

      @currentView = null
      @editorView = new Editor @

      @router = new Router @

    run: ->
      Backbone.history.start pushState: yes

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view.show()
      return
