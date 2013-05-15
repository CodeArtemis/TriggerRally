define [
  'backbone-full'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/trackset'
  'jade!templates/tracksetentry'
  'cs!views/user'
], (
  Backbone
  View
  ViewCollection
  template
  templateEntry
  UserView
) ->
  class TrackSetEntryView extends View
    template: templateEntry
    tagName: 'tr'

    initialize: ->
      @model.fetch()
      @root = @options.parent.options.root
      @listenTo @model, 'change', @render, @
      @listenTo @root, 'change:user', @render, @

    viewModel: ->
      data = super
      loading = '...'
      data.name ?= loading
      data.modified_ago ?= loading
      data.count_drive ?= loading
      data.count_copy ?= loading
      data.user ?= null
      data.favorite = @root.user?.isFavoriteTrack data.id
      data

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

      $favorite = @$('.favorite input')
      $favorite.on 'change', (event) =>
        if @root.user
          @root.user.setFavoriteTrack track.id, $favorite[0].checked
          @root.user.save()
        else
          Backbone.trigger 'app:dologin'
          event.preventDefault()

      @listenTo @root, 'change:user.favorite_tracks', =>
        $favorite[0].checked = @root.user?.isFavoriteTrack track.id

    destroy: ->
      @userView.destroy()
      super

  class TrackListView extends ViewCollection
    view: TrackSetEntryView
    childOffset: 1  # Ignore header <tr>.

  class TrackSetView extends View
    className: 'overlay'
    template: template
    constructor: (model, @app, @client) -> super { model }

    afterRender: ->
      trackListView = new TrackListView
        collection: @model.tracks
        el: @$('table.tracklist')
        root: @app.root
      trackListView.render()

      @listenTo @model, 'change:name', (m, name) =>
        @$('.tracksetname').text name
        Backbone.trigger 'app:settitle', name
