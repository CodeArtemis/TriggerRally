define [
  'backbone-full'
], (
  Backbone
) ->
  class View extends Backbone.View
    viewModel: ->
      @model?.toJSON()

    render: ->
      @beforeRender()
      @$el.html @template @viewModel() if @template?
      @afterRender()
      @

    beforeRender: ->

    afterRender: ->

    destroy: ->
      @stopListening()
      @undelegateEvents()
      @$el.removeData().unbind()
      @remove()
