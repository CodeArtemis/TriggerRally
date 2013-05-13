define [
  'backbone-full'
  'cs!models/index'
  'cs!views/about'
  'cs!views/drive'
  'cs!views/editor'
  'cs!views/home'
  'cs!views/ignition'
  'cs!views/license'
  # 'cs!views/notfound'
  'cs!views/profile'
  'cs!views/replay'
  'cs!views/spin'
  'cs!views/track'
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
  # NotFoundView
  ProfileView
  ReplayView
  SpinView
  TrackView
  TrackSetView
) ->
  class Router extends Backbone.Router
    constructor: (@app) ->
      @uni = @app.unifiedView
      super()

    routes:
      "": "home"
      "about": "about"
      "ignition": "ignition"
      "license": "license"
      "run/:runId/replay": "runReplay"
      "track/:trackId": "track"
      "track/:trackId/edit": "trackEdit"
      "track/:trackId/drive": "trackDrive"
      "tracklist/:setId": "trackset"
      "user/:userId": "user"
      "user/:userId/tracks": "userTracks"

    setSpin: ->
      unless @uni.getView3D() instanceof SpinView
        view = new SpinView @app, @uni.client
        @uni.setView3D view
        view.render()

    about: ->
      Backbone.trigger 'app:settitle', 'About'
      @setSpin()
      view = new AboutView @app, @uni.client
      @uni.setViewChild view
      view.render()

    home: ->
      Backbone.trigger 'app:settitle', null
      @setSpin()
      view = new HomeView @app, @uni.client
      @uni.setViewChild view
      view.render()

    ignition: ->
      Backbone.trigger 'app:settitle', 'Ignition Pack'
      # TODO: Show Ignition car?
      @setSpin()
      view = new IgnitionView @app, @uni.client
      @uni.setViewChild view
      view.render()

    license: ->
      Backbone.trigger 'app:settitle', 'License and Terms of Use'
      @setSpin()
      view = new LicenseView @app, @uni.client
      @uni.setViewChild view.render()

    runReplay: (runId) ->
      view = @uni.getView3D()
      unless view instanceof ReplayView and
             view is @uni.getViewChild()
        run = models.Run.findOrCreate runId
        view = new ReplayView @app, @uni.client, run
        @uni.setViewBoth view
        view.render()

    track: (trackId) ->
      @setSpin()
      track = models.Track.findOrCreate trackId
      view = new TrackView track, @app, @uni.client
      @uni.setViewChild view.render()

    trackDrive: (trackId) ->
      view = @uni.getView3D()
      unless view instanceof DriveView and
             view is @uni.getViewChild()
        view = new DriveView @app, @uni.client
        @uni.setViewBoth view
        view.render()
      view.setTrackId trackId

    trackEdit: (trackId) ->
      unless @uni.getView3D() instanceof EditorView and
             @uni.getView3D() is @uni.getViewChild()
        view = new EditorView @app, @uni.client
        @uni.setViewBoth view
        view.render()

      # TODO: Let the editor do this itself.
      track = models.Track.findOrCreate trackId
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger "app:settrack", track, yes
              Backbone.trigger 'app:settitle', "Edit #{track.name}"
        error: ->
          Backbone.trigger 'app:notfound'

    trackset: (setId) ->
      @setSpin()
      trackSet = models.TrackSet.findOrCreate setId
      trackSet.fetch()
      view = new TrackSetView trackSet, @app, @uni.client
      @uni.setViewChild view.render()

    user: (userId) ->
      @setSpin()
      user = models.User.findOrCreate userId
      view = new ProfileView user, @app, @uni.client
      @uni.setViewChild view.render()

    userTracks: (userId) ->
      @setSpin()
      user = models.User.findOrCreate userId
      user.fetch
        success: =>
          trackSet = new models.TrackSet
            name: "Tracks by #{user.name}"
            tracks: new models.TrackCollectionSortModified user.tracks.models
          trackSet.tracks.on 'change:modified', -> trackSet.tracks.sort()
          view = new TrackSetView trackSet, @app, @uni.client
          @uni.setViewChild view.render()
        error: ->
          Backbone.trigger 'app:notfound'
