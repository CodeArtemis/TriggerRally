define [
  'jquery'
  'backbone-full'
  'cs!editor/editor'
  'cs!models/index'
], (
  $
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
      @tracks = new models.TrackCollection

      @currentView = null
      @editorView = new Editor @

      @router = new Router @

    run: ->
      xhr = new XMLHttpRequest()
      xhr.open 'GET', '/v1/auth/me'
      xhr.onload = =>
        return unless xhr.readyState is 4
        return unless xhr.status is 200
        json = JSON.parse xhr.response
        @user.set json.user if json.user
      xhr.send()

      Backbone.history.start pushState: yes

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view.show()
      return
