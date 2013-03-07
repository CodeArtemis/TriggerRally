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

    initialize: ->
      super
      @selected = no
      @model.on 'change:name', =>
        @render()

    viewModel: ->
      name: @model.name or 'Loading...'
      url: "/track/#{@model.id}/edit"

    afterRender: ->
      @$el.toggleClass 'selected', @model is @options.parent.options.selectedTrack

      $a = @$el.find('a')
      $a.click ->
        Backbone.history.navigate $a.attr('href'), trigger: yes
        false

  class TrackListView extends ViewCollection
    view: TrackListEntryView
