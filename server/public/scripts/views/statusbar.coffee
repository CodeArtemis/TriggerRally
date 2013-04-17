define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/statusbar'
  'jade!templates/partial/statusbarcar'
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
      prefs: @app.root.prefs

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

      prefs = root.prefs

      $prefAudio.on 'change', ->
        prefs.audio = $prefAudio[0].checked
      $prefShadows.on 'change', ->
        prefs.shadows = $prefShadows[0].checked
      $prefTerrainhq.on 'change', ->
        prefs.terrainhq = $prefTerrainhq[0].checked

      @listenTo root, 'change:prefs.', ->
        $prefAudio[0].checked = prefs.audio
        $prefShadows[0].checked = prefs.shadows
        $prefTerrainhq[0].checked = prefs.terrainhq

      @$el.on 'change', '.statusbarcar input:radio', (event) ->
        prefs.car = @value

      $carSection = @$('hr.car-section')
      do addCars = =>
        cars = root.user?.cars() or [ 'ArbusuG' ]
        # cars = (models.Car.findOrCreate car for car in cars)
        @$('li.statusbarcar').remove()
        if cars.length >= 2
          for car in cars.reverse()
            checked = prefs.car is car
            $li = $ templateCar { car, checked }
            $li.insertAfter $carSection
      @listenTo root, 'change:user', addCars

    height: -> @$el.height()
