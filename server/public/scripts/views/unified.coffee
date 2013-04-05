define [
  'backbone-full'
  'cs!views/view'
  'cs!views/statusbar'
  'cs!client/client'
], (
  Backbone
  View
  StatusBarView
  TriggerClient
) ->
  $ = Backbone.$

  class UnifiedView extends View
    # el: document.body

    constructor: (@app) -> super()

    afterRender: ->
      statusBarView = new StatusBarView @app
      statusBarView.render()

      $window = $(window)
      $view3d = $('#view3d')

      client = @client = new TriggerClient $view3d[0], @app.root

      do layout = ->
        statusbarHeight = statusBarView.height()
        $view3d.height $window.height() - statusbarHeight
        $view3d.css 'top', statusbarHeight
        client.setSize $view3d.width(), $view3d.height()
      $window.on 'resize', layout

      @currentView = null

    setView: (view) ->
      if @currentView isnt view
        @currentView?.hide?()
        container = $('#unified-child')
        container.empty()
        @currentView = view
        if view
          container.append view.el
          view.show?()
      return
