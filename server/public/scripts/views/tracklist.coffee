define [
  'backbone-full'
  'cs!views/view'
  'cs!views/view_collection'
  'jade!templates/tracklistentry'
], (
  Backbone
  View
  ViewCollection
  templateTrackListEntry
) ->
  class TrackListEntryView extends View
    tagName: 'div'
    className: 'track'
    template: templateTrackListEntry

    initialize: (options) ->
      super
      @root = options.parent.options.root
      @model.on 'change:name', => @render()
      @root.on 'change:track.id', => @updateSelected()
      @model.fetch()

    viewModel: ->
      name: @model.name or 'Loading...'
      url: "/track/#{@model.id}/edit"

    updateSelected: ->
      @$el.toggleClass 'selected', @model.id is @root.track?.id

    afterRender: ->
      @updateSelected()

      $a = @$el.find('a')
      $a.click ->
        Backbone.history.navigate $a.attr('href'), trigger: yes
        false

  class TrackListView extends ViewCollection
    view: TrackListEntryView
    initialize: ->
      super
      @collection.sort()
      @listenTo @collection, 'change:name', => @collection.sort()
