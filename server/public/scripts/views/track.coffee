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

      $name = @$ '.name'
      @listenTo @model, 'change:name', (model, value) =>
        $name.text value
