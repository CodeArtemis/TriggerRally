define [
  'backbone-full'
  'cs!./view_collection'
], (
  Backbone
  ViewCollection
) ->
  class TrackListEntryView extends Backbone.View
    tagName: 'div'
    className: 'track'

    initialize: ->
      @model.on 'change:name', ->
        @render()
      return

    template: (model) ->
      # TODO: Move this into a separate file.
      name = model.get 'name'
      "<a href=\"../#{model.id}/edit\">#{name}</a>"

    render: ->
      @$el.html @template @model
      @

  class TrackListView extends ViewCollection
    # Expects @el and @collection.
    initialize: ->
      console.log 'tracklistview init'
      console.log @collection
      @render()

      @collection.on 'all', ->
        console.log 'track collection event:'
        console.log arguments

    render: ->
      @views = for model in @collection.models
        view = new TrackListEntryView {model}
        @el.appendChild view.render().el
        view
