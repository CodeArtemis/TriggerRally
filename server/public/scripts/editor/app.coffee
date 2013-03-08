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
      console.log 'setting id'
      model = @app.model
      model.track = models.Track.findOrCreate id: trackId
      model.track.fetch()

  class AppModel extends models.RelModel
    models.buildProps @, [
      'track'
      'user'
    ]
    initialize: ->
      super
      @on 'all', -> console.log arguments

  class App
    constructor: ->
      @model = new AppModel
        user: new models.User
        track: new models.Track

      @currentView = null
      #@editorView = new Editor @

      @router = new Router @

    run: ->
      xhr = new XMLHttpRequest()
      xhr.open 'GET', '/v1/auth/me'
      xhr.onload = =>
        return unless xhr.readyState is 4
        return unless xhr.status is 200
        json = JSON.parse xhr.response
        @model.user.set json.user if json.user
      xhr.send()

      Backbone.history.start pushState: yes

    currentTrack: -> @model.tracks.get @model.trackid

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view?.show()
      return
