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
      root = @app.root

      # This approach might be better, but doesn't fire events deeper than one layer.
      track = models.Track.findOrCreate trackId
      track.fetch
        success: ->
          root.track.set track.attributes

      # So instead we just reassign the track and fetch it in place.
      # root.track = models.Track.findOrCreate trackId
      # root.track.fetch
      #   dontSave: yes

  class RootModel extends models.Model
    models.buildProps @, [ 'track', 'user' ]
    bubbleAttribs: [ 'track', 'user' ]
    initialize: ->
      super
      @on 'all', (event) ->
        # debugger if event is 'change:track.config.'
        console.log "RootModel: \"#{event}\""

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

        ## DELETE ME ##

        delete json.user.tracks

        ## DELETE ME ##

        @root.user.set @root.user.parse json.user if json.user
      xhr.send()

      Backbone.history.start pushState: yes

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view?.show()
      return
