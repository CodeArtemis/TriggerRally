define [
  'backbone-full'
  'cs!models/index'
  'cs!views/about'
  'cs!views/drive'
  'cs!views/editor'
  'cs!views/home'
  'cs!views/ignition'
  'cs!views/profile'
  'cs!views/spin'
], (
  Backbone
  models
  AboutView
  DriveView
  EditorView
  HomeView
  IgnitionView
  ProfileView
  SpinView
) ->
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
      "user/:userId": "profile"

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

    profile: (userId) ->
      @setSpin()
      user = models.User.findOrCreate userId
      view = (new ProfileView user, @app, @uni.client).render()
      @uni.setViewChild view
