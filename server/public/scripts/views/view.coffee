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
      if @template
        viewModel = @viewModel()
        rendered = @template viewModel
        @$el.html rendered
      @afterRender()
      @

    beforeRender: ->

    afterRender: ->

    destroy: ->
      # @stopListening()  # done by remove()
      @undelegateEvents()
      @$el.removeData().unbind()
      @remove()
