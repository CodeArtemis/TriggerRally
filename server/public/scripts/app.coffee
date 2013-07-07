define [
  'jquery'
  'backbone-full'
  'cs!models/index'
  'cs!router'
  'cs!views/notfound'
  'cs!views/unified'
], (
  $
  Backbone
  models
  Router
  NotFoundView
  UnifiedView
) ->
  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  syncLocalStorage = (method, model, options) ->
    key = model.constructor.name
    switch method
      when 'read'
        data = JSON.parse localStorage.getItem key
        data ?= { id: 1 }
        model.set model.parse data
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
    models.buildProps @, [
      'antialias'
      'audio'
      'car'
      'challenge'
      'musicplay'
      'musicvolume'
      'pixeldensity'
      'shadows'
      'terrainhq'
      'volume'
    ]
    defaults: ->
      antialias: yes
      audio: yes
      car: 'ArbusuG'
      challenge: 'world'
      musicplay: no
      musicvolume: 0.5
      pixeldensity: 1
      shadows: yes
      terrainhq: yes
      volume: 0.8
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
      Backbone.on 'app:notfound', @notFound, @

      @checkUserLogin()
      found = Backbone.history.start pushState: yes
      Backbone.trigger 'app:notfound' unless found

      unless @unifiedView.client.renderer
        # WebGL failed to initialize.
        if location.pathname isnt '/about'
          Backbone.trigger 'app:webglerror'

    notFound: ->
      @router.setSpin()
      @router.uni.setViewChild (new NotFoundView).render()

    setTrack: (track, fromRouter) ->
      lastTrack = @root.track
      if track is lastTrack
        # Just notify that track has been reset.
        track.trigger 'change'
        return
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
      track.trigger 'change'

    checkUserLogin: ->
      $.ajax('/v1/auth/me')
      .done (data) =>
        if data.user
          user = models.User.findOrCreate data.user.id
          user.set user.parse data.user
          @root.user = user
          Backbone.trigger 'app:status', 'Logged in'
          # user.tracks.each (track) ->
          #   track.fetch()
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
