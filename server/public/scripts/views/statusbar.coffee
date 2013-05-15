define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/statusbar'
  'jade!templates/statusbarcar'
  'cs!views/user'
  'cs!models/index'
], (
  Backbone
  View
  template
  templateCar
  UserView
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
      $status = @$('#status')
      @listenTo Backbone, 'app:status', (msg) -> $status.text msg

      userView = null
      do updateUserView = =>
        userView?.destroy()
        userView = new UserView
          model: root.user
          showStatus: yes
        @$('.userinfo').append userView.el
      @listenTo root, 'change:user', updateUserView

      $prefAudio = @$('#pref-audio')
      $prefShadows = @$('#pref-shadows')
      $prefTerrainhq = @$('#pref-terrainhq')
      $prefAntialias = @$('#pref-antialias')

      prefs = root.prefs

      $prefAudio.on 'change', ->
        prefs.audio = $prefAudio[0].checked
      $prefShadows.on 'change', ->
        prefs.shadows = $prefShadows[0].checked
      $prefTerrainhq.on 'change', ->
        prefs.terrainhq = $prefTerrainhq[0].checked
      $prefAntialias.on 'change', ->
        prefs.antialias = $prefAntialias[0].checked

      @listenTo root, 'change:prefs.', ->
        $prefAudio[0].checked = prefs.audio
        $prefShadows[0].checked = prefs.shadows
        $prefTerrainhq[0].checked = prefs.terrainhq
        $prefAntialias[0].checked = prefs.antialias

      @$el.on 'change', '.statusbarcar input:radio', (event) ->
        prefs.car = @value

      @$el.on 'change', '.pixeldensity input:radio', (event) ->
        prefs.pixeldensity = @value

      $carSection = @$('.car-section')
      do addCars = =>
        cars = root.user?.cars() or [ 'ArbusuG' ]
        # cars = (models.Car.findOrCreate car for car in cars)
        @$('.statusbarcar').remove()
        if cars.length >= 2
          for car in cars.reverse()
            checked = prefs.car is car
            $li = $ templateCar { car, checked }
            $li.insertAfter $carSection
          $('<hr class="statusbarcar">').insertAfter $carSection
      @listenTo root, 'change:user', addCars

      $trackInfo = @$ '.trackinfo'
      $trackName = $trackInfo.find '.name'
      $trackAuthor = $trackInfo.find '.author'
      $trackLinkDrive = $trackInfo.find '.drive'
      $trackLinkEdit = $trackInfo.find '.edit'
      $trackLinkInfo = $trackInfo.find '.info'

      @listenTo root, 'change:track.id', ->
        id = root.track.id
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

      $favorite = @$('.favorite input')
      $myFavorites = @$('.myfavorites')

      $favorite.on 'change', (event) =>
        if root.user
          favorite = $favorite[0].checked
          root.user.setFavoriteTrack track.id, favorite
          root.user.save()
        else
          Backbone.trigger 'app:dologin'
          event.preventDefault()
      do updateFavorites = ->
        $favorite[0].checked = root.track and root.user?.isFavoriteTrack root.track.id
        $myFavorites.toggleClass 'hidden', not root.user
        $myFavorites.attr 'href', "/user/#{root.user.id}/favorites" if root.user
      @listenTo root, 'change:user change:track.id', updateFavorites

    height: -> @$el.height()
