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

    constructor: (@app) -> super

    afterRender: ->
      $status = @$('#status')
      Backbone.on 'app:status', (msg) -> $status.text msg

      userView = null
      do updateUserView = =>
        userView?.destroy()
        userView = new UserView
          model: @app.root.user
          showStatus: yes
        @$('.userinfo').append userView.el
      @app.root.on 'change:user', updateUserView

    height: -> @$.height()
