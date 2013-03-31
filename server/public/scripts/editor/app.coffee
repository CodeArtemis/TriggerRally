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
  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  class Router extends Backbone.Router
    constructor: (@app) ->
      super()

    routes:
      "track/:trackId/edit": "trackEdit"

    trackEdit: (trackId) ->
      @app.setCurrent @app.editorView
      root = @app.root

      track = models.Track.findOrCreate trackId
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              trackData = jsonClone track
              #trackData.env = jsonClone track.env
              root.track.set root.track.parse trackData

      # TODO: Ideally, we should maintain just one instance of the track
      # instead of copying it. But we currently depend on change events within
      # the track to update the client.

  class RootModel extends models.Model
    models.buildProps @, [ 'track', 'user' ]
    bubbleAttribs: [ 'track', 'user' ]
    initialize: ->
      super
      # @on 'all', (event) ->
      #   console.log "RootModel: \"#{event}\""

  class App
    constructor: ->
      @root = new RootModel
        user: new models.User
        track: new models.Track

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
        @root.user.set @root.user.parse json.user if json.user
      xhr.send()

      Backbone.history.start pushState: yes

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view?.show()
      return
