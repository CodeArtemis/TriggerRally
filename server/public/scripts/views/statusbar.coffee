define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/statusbar'
  'cs!views/user'
], (
  Backbone
  View
  template
  UserView
) ->
  class StatusBarView extends View
    el: '#statusbar'
    template: template

    constructor: (@app) -> super()

    viewModel: ->
      prefs: @app.root.prefs

    afterRender: ->
      $status = @$('#status')
      @listenTo Backbone, 'app:status', (msg) -> $status.text msg

      userView = null
      do updateUserView = =>
        userView?.destroy()
        userView = new UserView
          model: @app.root.user
          showStatus: yes
        @$('.userinfo').append userView.el
      @listenTo @app.root, 'change:user', updateUserView

      $prefAudio = @$('#pref-audio')
      $prefShadows = @$('#pref-shadows')
      $prefTerrainhq = @$('#pref-terrainhq')

      prefs = @app.root.prefs

      $prefAudio.on 'change', ->
        prefs.audio = $prefAudio[0].checked
      $prefShadows.on 'change', ->
        prefs.shadows = $prefShadows[0].checked
      $prefTerrainhq.on 'change', ->
        prefs.terrainhq = $prefTerrainhq[0].checked

      @listenTo @app.root, 'change:prefs.', ->
        $prefAudio[0].checked = prefs.audio
        $prefShadows[0].checked = prefs.shadows
        $prefTerrainhq[0].checked = prefs.terrainhq

    height: -> @$el.height()
