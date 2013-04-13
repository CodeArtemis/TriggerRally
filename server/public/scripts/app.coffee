define [
  'jquery'
  'backbone-full'
  'cs!models/index'
  'cs!views/about'
  'cs!views/drive'
  'cs!views/editor'
  'cs!views/home'
  'cs!views/ignition'
  'cs!views/spin'
  'cs!views/unified'
], (
  $
  Backbone
  models
  AboutView
  DriveView
  EditorView
  HomeView
  IgnitionView
  SpinView
  UnifiedView
) ->
  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  class Router extends Backbone.Router
    constructor: (@app) ->
      @uni = @app.unifiedView
      super()

    routes:
      "": "home"
      "about": "about"
      "ignition": "ignition"
      "track/:trackId/edit": "trackEdit"
      "track/:trackId/drive": "trackDrive"

    setSpin: ->
      unless @uni.getView3D() instanceof SpinView
        @uni.setView3D (new SpinView @app, @uni.client).render()

    home: ->
      @setSpin()
      @uni.setViewChild (new HomeView @app, @uni.client).render()

    about: ->
      @setSpin()
      @uni.setViewChild (new AboutView @app, @uni.client).render()

    ignition: ->
      # TODO: Show Ignition car?
      @setSpin()
      @uni.setViewChild (new IgnitionView @app, @uni.client).render()

    trackEdit: (trackId) ->
      unless @uni.getView3D() instanceof EditorView and
             @uni.getView3D() is @uni.getViewChild()
        view = (new EditorView @app, @uni.client).render()
        @uni.setView3D view
        @uni.setViewChild view
      root = @app.root

      # TODO: Let the editor do this itself.
      track = models.Track.findOrCreate trackId
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger "app:settrack", track, yes

    trackDrive: (trackId) ->
      view = @uni.getView3D()
      unless view instanceof DriveView and
             view is @uni.getViewChild()
        view = (new DriveView @app, @uni.client).render()
        @uni.setView3D view
        @uni.setViewChild view
      root = @app.root
      view.setTrackId trackId

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

      @unifiedView = (new UnifiedView @).render()

      @router = new Router @

      Backbone.on 'app:settrack', @setTrack, @
      Backbone.on 'app:checklogin', @checkUserLogin, @
      Backbone.on 'app:logout', @logout, @

      @checkUserLogin()
      Backbone.history.start pushState: yes

      Backbone.history.navigate '/about', trigger: yes unless @unifiedView.client.renderer

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
