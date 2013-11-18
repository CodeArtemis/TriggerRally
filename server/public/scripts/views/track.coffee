define [
  'jquery'
  'backbone-full'
  'cs!models/index'
  'cs!views/comments'
  'cs!views/favorite'
  'cs!views/user'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/track'
  'jade!templates/trackrun'
  'cs!util/popup'
], (
  $
  Backbone
  models
  CommentsView
  FavoriteView
  UserView
  View
  ViewCollection
  template
  templateRun
  popup
) ->
  loadingText = '...'

  class TrackRunView extends View
    template: templateRun
    tagName: 'tr'

    initialize: ->
      @model.fetch()

    viewModel: ->
      data = super
      data.name ?= loadingText
      data.modified_ago ?= loadingText
      data.user ?= null
      data

    beforeRender: ->
      @userView?.destroy()

    afterRender: ->
      run = @model
      # @listenTo run, 'change', @render, @

      $runuser = @$ '.runuser'
      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        @userView = run.user and new UserView
          model: run.user
        $runuser.empty()
        $runuser.append @userView.el if @userView
      @listenTo run, 'change:user', updateUserView

    destroy: ->
      @userView.destroy()
      super

  class TrackRunsView extends ViewCollection
    view: TrackRunView
    childOffset: 1  # Ignore header <tr>.
    initialize: ->
      super
      @listenTo @collection, 'change', => @render()

  class TrackView extends View
    # className: 'overlay'
    template: template
    constructor: (model, @app, @client) ->
      super { model }

    initialize: ->
      Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:name', => Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:id', => @render()
      track = @model
      track.fetch
        success: ->
          track.env.fetch
            success: ->
              Backbone.trigger 'app:settrack', track
        error: ->
          Backbone.trigger 'app:notfound'

    viewModel: ->
      data = super
      data.name ?= loadingText
      data.count_drive ?= loadingText
      data.count_copy ?= loadingText
      data.count_fav ?= loadingText
      data.loggedIn = @app.root.user?
      # data.loggedInUser = @app.root.user
      data

    afterRender: ->
      track = @model
      trackRuns = models.TrackRuns.findOrCreate track.id
      trackRunsView = new TrackRunsView
        collection: trackRuns.runs
        el: @$('table.runlist')
      trackRunsView.render()
      trackRuns.fetch()

      $author = @$ '.author'
      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        @userView = track.user and new UserView
          model: track.user
        $author.empty()
        $author.append @userView.el if @userView
      @listenTo track, 'change:user', updateUserView

      $favorite = @$ '.favorite'
      @favoriteView = new FavoriteView track, @app.root
      $favorite.html @favoriteView.el

      $name = @$ '.name'
      @listenTo @model, 'change:name', (model, value) =>
        $name.text value

      $count_drive = @$ '.count_drive'
      @listenTo @model, 'change:count_drive', (model, value) =>
        $count_drive.text value

      $count_copy = @$ '.count_copy'
      @listenTo @model, 'change:count_copy', (model, value) =>
        $count_copy.text value

      $count_fav = @$ '.count_fav'
      @listenTo @model, 'change:count_fav', (model, value) =>
        $count_fav.text value

      comments = models.CommentSet.findOrCreate 'track-' + track.id
      @commentsView = new CommentsView comments, @app
      @commentsView.render()
      $commentsView = @$ '.comments-view'
      $commentsView.html @commentsView.el
