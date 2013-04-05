define [
  'jquery'
  'backbone-full'
  'cs!models/index'
  'cs!views/unified'
  'cs!editor/editor'
], (
  $
  Backbone
  models
  UnifiedView
  EditorView
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
              Backbone.trigger "app:settrack", track, yes
              # if track.env.id isnt lastEnvId
              #   track.trigger 'change:env'

  class RootModel extends models.Model
    models.buildProps @, [ 'track', 'user' ]
    bubbleAttribs: [ 'track', 'user' ]
    # initialize: ->
    #   super
    #   @on 'all', (event) ->
    #     return unless event.startsWith 'change:track.config'
    #     console.log "RootModel: \"#{event}\""
    #     # console.log "RootModel: " + JSON.stringify arguments

  class App
    constructor: ->
      @root = new RootModel
        user: null
        track: null

      @unifiedView = new UnifiedView @
      @unifiedView.render()

      @currentView = null
      @editorView = new EditorView @, unifiedView.client

      @router = new Router @

      Backbone.on 'app:settrack', @setTrack, @
      Backbone.on 'app:checklogin', @checkUserLogin, @
      Backbone.on 'app:logout', @logout, @

      @checkUserLogin()
      Backbone.history.start pushState: yes

    setTrack: (track, fromRouter) ->
      lastTrack = @root.track
      return if track is lastTrack
      @root.track = track
      # TODO: Deep comparison with lastTrack to find out which events to fire.
      track.trigger 'change:env' if track.env isnt lastTrack?.env
      track.trigger 'change:id'
      track.trigger 'change:name'
      track.trigger 'change:published'
      track.trigger 'change:user'
      track.trigger 'change:config.course.checkpoints.'
      track.trigger 'change:config.course.startposition.'
      track.trigger 'change:config.scenery.'
      Backbone.history.navigate "/track/#{@root.track.id}/edit" unless fromRouter

    checkUserLogin: ->
      $.ajax('/v1/auth/me')
      .done (data) =>
        if data.user
          user = models.User.findOrCreate data.user.id
          user.set user.parse data.user
          @root.user = user
          Backbone.trigger 'app:status', 'Logged in'
        else
          @logout()

    logout: ->
      @root.user = null
      Backbone.trigger 'app:status', 'Logged out'

    setCurrent: (view) ->
      if @currentView isnt view
        @currentView?.hide()
        @currentView = view
        view?.show()
      return
