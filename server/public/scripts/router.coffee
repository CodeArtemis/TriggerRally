define [
  'backbone-full'
  'cs!models/index'
  'cs!views/about'
  'cs!views/drive'
  'cs!views/editor'
  'cs!views/home'
  'cs!views/ignition'
  'cs!views/license'
  'cs!views/profile'
  'cs!views/spin'
  'cs!views/trackset'
], (
  Backbone
  models
  AboutView
  DriveView
  EditorView
  HomeView
  IgnitionView
  LicenseView
  ProfileView
  SpinView
  TrackSetView
) ->
  class Router extends Backbone.Router
    constructor: (@app) ->
      @uni = @app.unifiedView
      super()

    routes:
      "": "home"
      "about": "about"
      "tracklist/:setId": "trackset"
      "ignition": "ignition"
      "license": "license"
      "track/:trackId/edit": "editor"
      "track/:trackId/drive": "drive"
      "user/:userId": "profile"
      # "user/:userId/tracks": "usertracks"

    setSpin: ->
      unless @uni.getView3D() instanceof SpinView
        @uni.setView3D (new SpinView @app, @uni.client).render()

    about: ->
      Backbone.trigger 'app:settitle', 'About'
      @setSpin()
      @uni.setViewChild (new AboutView @app, @uni.client).render()

    drive: (trackId) ->
      view = @uni.getView3D()
      unless view instanceof DriveView and
             view is @uni.getViewChild()
        view = new DriveView @app, @uni.client
        @uni.setView3D view
        @uni.setViewChild view
        view.render()
      root = @app.root
      view.setTrackId trackId

    editor: (trackId) ->
      unless @uni.getView3D() instanceof EditorView and
             @uni.getView3D() is @uni.getViewChild()
        view = new EditorView @app, @uni.client
        @uni.setView3D view
        @uni.setViewChild view
        view.render()
      root = @app.root

      # TODO: Let the editor do this itself.
      track = models.Track.findOrCreate trackId
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger "app:settrack", track, yes

    home: ->
      Backbone.trigger 'app:settitle', null
      @setSpin()
      @uni.setViewChild (new HomeView @app, @uni.client).render()

    ignition: ->
      Backbone.trigger 'app:settitle', 'Ignition Pack'
      # TODO: Show Ignition car?
      @setSpin()
      @uni.setViewChild (new IgnitionView @app, @uni.client).render()

    license: ->
      Backbone.trigger 'app:settitle', 'License and Terms of Use'
      @setSpin()
      view = new LicenseView @app, @uni.client
      @uni.setViewChild view.render()

    profile: (userId) ->
      @setSpin()
      user = models.User.findOrCreate userId
      view = new ProfileView user, @app, @uni.client
      @uni.setViewChild view.render()

    trackset: (setId) ->
      trackSet = models.TrackSet.findOrCreate setId
      @setSpin()
      view = new TrackSetView trackSet, @app, @uni.client
      @uni.setViewChild view.render()

    # TODO: Implement this.
    # usertracks: (userId) ->
    #   @setSpin()
    #   user = models.User.findOrCreate userId
    #   @setSpin()
    #   view = new TrackSetView trackSet, @app, @uni.client
    #   @uni.setViewChild view.render()
