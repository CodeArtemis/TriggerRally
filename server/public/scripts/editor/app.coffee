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
          # lastEnvId = track.env?.id
          track.env.fetch
            success: ->
              Backbone.trigger "app:settrack", track
              # if track.env.id isnt lastEnvId
              #   track.trigger 'change:env'

  class RootModel extends models.Model
    models.buildProps @, [ 'track', 'user' ]
    bubbleAttribs: [ 'track', 'user' ]
    # initialize: ->
    #   super
    #   @on 'all', (event) ->
    #     console.log "RootModel: \"#{event}\""

  class App
    constructor: ->
      @root = new RootModel
        user: null
        track: null

      @currentView = null
      @editorView = new Editor @

      @router = new Router @

      Backbone.on 'app:settrack', (track) =>
        lastTrack = @root.track
        return if track is lastTrack
        @root.track = track
        # TODO: Deep comparison with lastTrack to find out which events to fire.
        track.trigger 'change:env' if track.env isnt lastTrack?.env
        track.trigger 'change:id'
        track.trigger 'change:name'
        track.trigger 'change:user'
        track.trigger 'change:config.course.checkpoints.'
        track.trigger 'change:config.course.startposition.'
        track.trigger 'change:config.scenery.'

    run: ->
      xhr = new XMLHttpRequest()
      xhr.open 'GET', '/v1/auth/me'
      xhr.onload = =>
        return unless xhr.readyState is 4
        return unless xhr.status is 200
        json = JSON.parse xhr.response
        return unless json.user
        user = @root.user = models.User.findOrCreate json.user.id
        user.set user.parse json.user
      xhr.send()

      Backbone.history.start pushState: yes

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view?.show()
      return
