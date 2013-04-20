define [
  'jquery'
  'backbone-full'
  'cs!models/index'
  'cs!router'
  'cs!views/unified'
], (
  $
  Backbone
  models
  Router
  UnifiedView
) ->
  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  syncLocalStorage = (method, model, options) ->
    key = model.constructor.name
    switch method
      when 'read'
        data = JSON.parse localStorage.getItem key
        data ?= { id: 1 }
        model.set data
      when 'update'
        localStorage.setItem key, JSON.stringify model
    return

  class RootModel extends models.Model
    models.buildProps @, [ 'track', 'user', 'prefs' ]
    bubbleAttribs: [ 'track', 'user', 'prefs' ]
    # initialize: ->
    #   super
    #   @on 'all', (event) ->
    #     return unless event.startsWith 'change:track.config'
    #     console.log "RootModel: \"#{event}\""
    #     # console.log "RootModel: " + JSON.stringify arguments
    getCarId: ->
      cars = @user?.cars()
      return null unless cars? and @prefs.car in cars
      @prefs.car

  class PrefsModel extends models.Model
    models.buildProps @, [ 'audio', 'car', 'shadows', 'terrainhq' ]
    defaults:
      audio: yes
      car: 'Icarus'
      shadows: yes
      terrainhq: yes
    sync: syncLocalStorage

  class App
    constructor: ->
      @root = new RootModel
        user: null
        track: null
        prefs: new PrefsModel

      @root.prefs.fetch()  # Assume sync because it's localStorage.
      @root.prefs.on 'change', => @root.prefs.save()

      @unifiedView = (new UnifiedView @).render()

      @router = new Router @

      Backbone.on 'app:settrack', @setTrack, @
      Backbone.on 'app:checklogin', @checkUserLogin, @
      Backbone.on 'app:logout', @logout, @
      Backbone.on 'app:settitle', @setTitle, @
      Backbone.on 'app:webglerror', ->
        Backbone.history.navigate '/about', trigger: yes

      @checkUserLogin()
      Backbone.history.start pushState: yes

      unless @unifiedView.client.renderer
        # WebGL failed to initialize.
        if location.pathname isnt '/about'
          Backbone.trigger 'app:webglerror'

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
          user.tracks.each (track) ->
            track.fetch()
          # @listenTo root, 'add:user.tracks.', (track) ->
          #   track.fetch()
        else
          @logout()

    logout: ->
      @root.user = null
      Backbone.trigger 'app:status', 'Logged out'

    setTitle: (title) ->
      main = "Trigger Rally"
      document.title = if title then "#{title} - #{main}" else main
