define [
  'cs!./view'
  'cs!./view_collection'
  'jade!templates/tracklistentry'
], (
  View
  ViewCollection
  templateTrackListEntry
) ->
  class TrackListEntryView extends View
    tagName: 'div'
    className: 'track'
    template: templateTrackListEntry

    initialize: ->
      @model.on 'change:name', =>
        @render()
      return

    viewModel: ->
      name: @model.name or 'Loading...'
      url: "../#{@model.id}/edit"

  class TrackListView extends ViewCollection
    view: TrackListEntryView

    # Expects @el and @collection.
    initialize: ->
      super
      #console.log 'tracklistview init'
      #console.log @collection
      #@render()

      #@collection.on 'all', ->
      #  console.log 'track collection event:'
      #  console.log arguments

    render: ->
      return super
      @views = for model in @collection.models
        view = new TrackListEntryView {model}
        @el.appendChild view.render().el
        view
