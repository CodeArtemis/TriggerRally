define [
  'backbone-full'
  'cs!./view'
  'cs!./view_collection'
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
      @selected = no
      @model.on 'change:name', => @render()
      @root.on 'change:track.id', => @renderSelected()

    viewModel: ->
      name: @model.name or 'Loading...'
      url: "/track/#{@model.id}/edit"

    renderSelected: ->
      @$el.toggleClass 'selected', @model.id is @root.track?.id

    afterRender: ->
      @renderSelected()

      $a = @$el.find('a')
      $a.click ->
        Backbone.history.navigate $a.attr('href'), trigger: yes
        false

  class TrackListView extends ViewCollection
    view: TrackListEntryView
