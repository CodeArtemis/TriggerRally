define [
  'backbone-full'
  'jade!templates/statusbar'
  'jade!templates/statusbarcar'
  'cs!views/favorite'
  'cs!views/music'
  'cs!views/user'
  'cs!views/view'
  'cs!models/index'
], (
  Backbone
  template
  templateCar
  FavoriteView
  MusicView
  UserView
  View
  models
) ->
  class StatusBarView extends View
    el: '#statusbar'
    template: template

    constructor: (@app) -> super()

    viewModel: ->
      prefs = @app.root.prefs
      user = @app.root.user
      pixdens = [
        { value: 2, label: '2:1' }
        { value: 1, label: '1:1' }
        { value: 0.5, label: '1:2' }
        { value: 0.25, label: '1:4' }
        { value: 0.125, label: '1:8' }
      ]
      for pd in pixdens
        pd.checked = ('' + pd.value is prefs.pixeldensity)
      {
        prefs
        pixdens
        user
      }

    afterRender: ->
      root = @app.root

      musicView = new MusicView @app
      @$('td.navigation').append musicView.render().el

      userView = null
      do updateUserView = =>
        userView?.destroy()
        userView = new UserView
          model: root.user
          showStatus: yes
        @$('.userinfo').append userView.el
      @listenTo root, 'change:user', updateUserView

      $prefAudio = @$('#pref-audio')
      $prefVolume = @$('#pref-volume')
      $prefShadows = @$('#pref-shadows')
      $prefTerrainhq = @$('#pref-terrainhq')
      $prefAntialias = @$('#pref-antialias')

      prefs = root.prefs

      $prefAudio.on 'change', ->
        prefs.audio = $prefAudio[0].checked
      $prefVolume.on 'change', ->
        prefs.volume = $prefVolume.val()
      $prefShadows.on 'change', ->
        prefs.shadows = $prefShadows[0].checked
      $prefTerrainhq.on 'change', ->
        prefs.terrainhq = $prefTerrainhq[0].checked
      $prefAntialias.on 'change', ->
        prefs.antialias = $prefAntialias[0].checked

      @listenTo root, 'change:prefs.', ->
        $prefAudio[0].checked = prefs.audio
        $prefVolume.val prefs.volume
        $prefShadows[0].checked = prefs.shadows
        $prefTerrainhq[0].checked = prefs.terrainhq
        $prefAntialias[0].checked = prefs.antialias

      @$el.on 'change', '.statusbarcar input:radio', (event) ->
        prefs.car = @value
        available = root.user?.cars() ? [ 'ArbusuG' ]
        if prefs.car not in available
          purchaseUrl =
            'Icarus': '/ignition'
            'Mayhem': '/mayhem'
          Backbone.history.navigate purchaseUrl[prefs.car], trigger: yes
        return

      @$el.on 'change', '.pixeldensity input:radio', (event) ->
        prefs.pixeldensity = @value

      do updateChallenge = =>
        @$("input[type=radio][name=challenge][value=#{prefs.challenge}]").prop 'checked', yes
      @listenTo root, 'change:prefs.challenge', updateChallenge

      @$("input[type=radio][name=challenge]").on 'change', ->
        prefs.challenge = $(@).val()

      $carSection = @$('.car-section')
      do addCars = =>
        cars = [ 'ArbusuG', 'Mayhem', 'Icarus' ]
        # cars = (models.Car.findOrCreate car for car in cars)
        @$('.statusbarcar').remove()
        # if cars.length >= 2
        for car in cars.reverse()
          checked = prefs.car is car
          $li = $ templateCar { car, checked }
          $li.insertAfter $carSection
        # $('<hr class="statusbarcar">').insertAfter $carSection
      @listenTo root, 'change:user', addCars

      $trackInfo = @$ '.trackinfo'
      $trackName = $trackInfo.find '.name'
      $trackAuthor = $trackInfo.find '.author'
      $trackLinkDrive = $trackInfo.find '.drive'
      $trackLinkEdit = $trackInfo.find '.edit'
      $trackLinkInfo = $trackInfo.find '.info'

      $favorite = @$ '.favorite'
      @favoriteView = null
      if root.track
        @favoriteView = new FavoriteView root.track, root
        $favorite.html @favoriteView.el

      @listenTo root, 'change:track', =>
        @favoriteView?.destroy()
        @favoriteView = new FavoriteView root.track, root
        $favorite.html @favoriteView.el
      @listenTo root, 'change:track.id', ->
        id = root.track.id
        $trackName.attr 'href', "/track/#{id}"
        $trackLinkDrive.attr 'href', "/track/#{id}/drive"
        $trackLinkEdit.attr 'href', "/track/#{id}/edit"
        $trackLinkInfo.attr 'href', "/track/#{id}"
      @listenTo root, 'change:track.name', ->
        $trackName.text root.track.name
      trackUserView = null
      @listenTo root, 'change:track.user', ->
        return if root.track.user is trackUserView?.model
        trackUserView?.destroy()
        if root.track.user?
          trackUserView = new UserView
            model: root.track.user
          $trackAuthor.empty()
          $trackAuthor.append trackUserView.el

      $myTracks = @$('.mytracks')
      do updateMyTracks = ->
        $myTracks.toggleClass 'hidden', not root.user
        $myTracks.attr 'href', "/user/#{root.user.id}/tracks" if root.user
      @listenTo root, 'change:user', updateMyTracks

      $myFavorites = @$('.myfavorites')
      do updateMyFavorites = ->
        $myFavorites.toggleClass 'hidden', not root.user
        $myFavorites.attr 'href', "/user/#{root.user.id}/favorites" if root.user
      @listenTo root, 'change:user', updateMyFavorites

      @listenTo Backbone, 'statusbar:showchallenge', =>
        @$('.challenge').removeClass 'hidden'
      @listenTo Backbone, 'statusbar:hidechallenge', =>
        @$('.challenge').addClass 'hidden'

    height: -> @$el.height()

    destroy: ->
      # This shouldn't ever get called for StatusBar, really.
      @favoriteView.destroy()
