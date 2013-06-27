define [
  'backbone-full'
  'underscore'
  'cs!views/view'
  'cs!views/statusbar'
  'cs!client/client'
  'jade!templates/unified'
  'cs!util/popup'
], (
  Backbone
  _
  View
  StatusBarView
  TriggerClient
  template
  popup
) ->
  $ = Backbone.$

  class UnifiedView extends View
    el: '#unified-container'
    template: template

    constructor: (@app) ->
      super()
      # We maintain 2 view references, one for 3D and one for DOM.
      # They may be the same or different.
      # This is fragile, requiring careful bookkeeping in setView* methods.
      # TODO: Find a better solution.
      @currentView3D = null     # Controls 3D rendering.
      @currentViewChild = null  # Controls DOM.

    afterRender: ->
      statusBarView = new StatusBarView @app
      statusBarView.render()

      $window = $(window)
      $document = $(document)
      $view3d = @$('#view3d')
      $child = @$('#unified-child')
      $statusMessage = @$('#status-message')

      client = @client = new TriggerClient $view3d[0], @app.root
      client.camera.eulerOrder = 'ZYX'

      $document.on 'keyup', (event) =>
        client.onKeyUp event
        @currentView3D?.onKeyUp? event
      $document.on 'keydown', (event) =>
        client.onKeyDown event
        @currentView3D?.onKeyDown? event
      $view3d.on 'mousedown', (event) =>
        @currentView3D?.onMouseDown? event
      $view3d.on 'mousemove', (event) =>
        @currentView3D?.onMouseMove? event
      $view3d.on 'mouseout', (event) =>
        @currentView3D?.onMouseOut? event
      $view3d.on 'mouseup', (event) =>
        @currentView3D?.onMouseUp? event
      $view3d.on 'mousewheel', (event) =>
        @currentView3D?.onMouseWheel? event

      do layout = ->
        statusbarHeight = statusBarView.height()
        $view3d.css 'top', statusbarHeight
        $child.css 'top', statusbarHeight
        width = $view3d.width()
        height = $window.height() - statusbarHeight
        $view3d.height height
        client.setSize width, height

        cx = 32
        cy = 18
        targetAspect = cx / cy
        aspect = width / height
        fontSize = if aspect >= targetAspect then height / cy else width / cx
        $child.css "font-size", "#{fontSize}px"
      $window.on 'resize', layout

      $document.on 'click', 'a.route', (event) ->
        # TODO: Find a way to handle 404s.
        Backbone.history.navigate @pathname, trigger: yes
        no

      doLogin = ->
        popup.create "/login?popup=1", "Login", ->
          Backbone.trigger 'app:checklogin'

      Backbone.on 'app:dologin', doLogin
      $document.on 'click', 'a.login', (event) -> not doLogin()

      $document.on 'click', 'a.logout', (event) ->
        $.ajax('/v1/auth/logout')
        .done (data) ->
          Backbone.trigger 'app:logout'
        false

      Backbone.on 'app:status', (msg) ->
        $statusMessage.text msg
        $statusMessage.removeClass 'fadeout'
        _.defer -> $statusMessage.addClass 'fadeout'

      requestAnimationFrame @update

    lastTime = null
    update: (time) =>
      lastTime or= time
      deltaTime = Math.max 0, Math.min 0.1, (time - lastTime) * 0.001
      lastTime = time

      @currentView3D?.update? deltaTime, time
      if @currentViewChild isnt @currentView3D
        @currentViewChild?.update? deltaTime, time

      @client.update deltaTime
      try
        @client.render()
      catch e
        Backbone.trigger 'app:webglerror'

      requestAnimationFrame @update

    getView3D: -> @currentView3D
    getViewChild: -> @currentViewChild

    setView3D: (view) ->
      $child = $('#unified-child')
      if @currentView3D
        @currentView3D.destroy()
      if @currentView3D is @currentViewChild
        @currentViewChild = null
        $child.empty()
      @currentView3D = view
      return

    setViewChild: (view) ->
      $child = $('#unified-child')
      if @currentViewChild
        @currentViewChild.destroy()
        $child.empty()
        @currentView3D = null if @currentView3D is @currentViewChild
      @currentViewChild = view
      $child.append view.el if view
      return

    setViewBoth: (view) ->
      $child = $('#unified-child')
      if @currentViewChild
        @currentViewChild.destroy()
        @currentView3D = null if @currentView3D is @currentViewChild
      if @currentView3D
        @currentView3D.destroy()
      $child.empty().append view.el if view
      @currentViewChild = @currentView3D = view
      return
