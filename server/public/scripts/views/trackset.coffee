define [
  'backbone-full'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/trackset'
  'jade!templates/tracksetentry'
], (
  Backbone
  View
  ViewCollection
  template
  templateEntry
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
      @listenTo @model, 'change', @render, @

  class TrackSetCollectionView extends ViewCollection
    view: TrackSetEntryView

  class TrackSetView extends View
    className: 'overlay'
    template: template
    constructor: (model, @app, @client) -> super { model }

    initialize: ->
      @model.fetch()

    afterRender: ->
      trackSetCollectionView = new TrackSetCollectionView
        collection: @model.tracks
        el: @$('table.tracksetcollection')
      trackSetCollectionView.render()

      @listenTo @model, 'change:name', (m, name) =>
        @$('.tracksetname').text name
