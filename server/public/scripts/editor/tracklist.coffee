
define [
  'backbone-full'
], (
  Backbone
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

  class TrackListView extends Backbone.View
    # Expects @el and @collection.
    initialize: ->
      @views = for model in @collection.models
        view = new TrackListEntryView {model}
        @el.appendChild view.render().el
        view

  View: TrackListView
