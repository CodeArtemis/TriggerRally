define [
  'backbone-full'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/trackset'
  'jade!templates/tracksetentry'
  'cs!views/favorite'
  'cs!views/user'
], (
  Backbone
  View
  ViewCollection
  template
  templateEntry
  FavoriteView
  UserView
) ->
  class TrackSetEntryView extends View
    template: templateEntry
    tagName: 'tr'

    initialize: ->
      @model.fetch()
      @root = @options.parent.options.root
      @listenTo @model, 'change', @render, @

    viewModel: ->
      data = super
      loading = '...'
      data.name ?= loading
      data.modified_ago ?= loading
      data.count_copy ?= loading
      data.count_drive ?= loading
      data.count_fav ?= loading
      data.user ?= null
      data

    beforeRender: ->
      @userView?.destroy()
      @favoriteView?.destroy()

    afterRender: ->
      track = @model

      $trackuser = @$ '.trackuser'
      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        @userView = track.user and new UserView
          model: track.user
        $trackuser.empty()
        $trackuser.append @userView.el if @userView
      @listenTo track, 'change:user', updateUserView

      $favorite = @$ '.favorite'
      @favoriteView = new FavoriteView track, @options.parent.options.root
      $favorite.html @favoriteView.el

      # $count_fav = @$('count_fav')
      # @listenTo track, 'change:count_fav', ->
      #   $count_fav.text track.count_fav

    destroy: ->
      @beforeRender()
      super

  class TrackListView extends ViewCollection
    view: TrackSetEntryView
    childOffset: 1  # Ignore header <tr>.

  class TrackSetView extends View
    className: 'overlay'
    template: template
    constructor: (model, @app) -> super { model }

    afterRender: ->
      trackListView = new TrackListView
        collection: @model.tracks
        el: @$('table.tracklist')
        root: @app.root
      trackListView.render()

      @listenTo @model, 'change:name', (m, name) =>
        @$('.tracksetname').text name
        Backbone.trigger 'app:settitle', name
