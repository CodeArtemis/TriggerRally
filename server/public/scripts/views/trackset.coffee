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

      $trackuser = @$ '.trackuser'
      @userView = null
      do updateUserView = =>
        @userView?.destroy()
        @userView = track.user and new UserView
          model: track.user
        $trackuser.empty()
        $trackuser.append @userView.el if @userView
      @listenTo track, 'change:user', updateUserView

    destroy: ->
      @userView.destroy()
      super

  class TrackSetCollectionView extends ViewCollection
    view: TrackSetEntryView
    childOffset: 1  # Ignore header <tr>.

  class TrackSetView extends View
    className: 'overlay'
    template: template
    constructor: (model, @app, @client) -> super { model }

    afterRender: ->
      trackSetCollectionView = new TrackSetCollectionView
        collection: @model.tracks
        el: @$('table.tracksetcollection')
      trackSetCollectionView.render()

      @listenTo @model, 'change:name', (m, name) =>
        @$('.tracksetname').text name
        Backbone.trigger 'app:settitle', name
