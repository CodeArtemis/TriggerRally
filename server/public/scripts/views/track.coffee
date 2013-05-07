define [
  'jquery'
  'backbone-full'
  'cs!views/user'
  'cs!views/view'
  'cs!views/view_collection'
  'cs!models/index'
  'jade!templates/track'
  'jade!templates/trackrun'
  'cs!util/popup'
], (
  $
  Backbone
  UserView
  View
  ViewCollection
  models
  template
  templateRun
  popup
) ->
  class TrackRunView extends View
    template: templateRun
    tagName: 'tr'

    initialize: ->
      @model.fetch()

    viewModel: ->
      data = super
      loading = '...'
      data.name ?= loading
      data.modified_ago ?= loading
      data.count_drive ?= loading
      data.count_copy ?= loading
      data.user ?= null
      data

    afterRender: ->
      track = @model
      @listenTo track, 'change', @render, @

    destroy: ->
      @userView.destroy()
      super

  class TrackRunsView extends ViewCollection
    view: TrackRunView
    childOffset: 1  # Ignore header <tr>.

  class TrackView extends View
    # className: 'overlay'
    template: template
    constructor: (model, @app, @client) ->
      super { model }

    initialize: ->
      Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:name', => Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:id', => @render()
      @model.fetch
        error: ->
          Backbone.trigger 'app:notfound'

    loadingText = '...'

    viewModel: ->
      data = super
      data.name ?= loadingText
      data

    afterRender: ->
      track = @model
      trackRuns = new models.TrackRuns
      trackRunsView = new TrackRunsView
        collection: trackRuns
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
