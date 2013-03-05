define [
  'backbone-full'
  'jade!templates/user'
], (
  Backbone
  template
) ->
  class UserView extends Backbone.View
    tagName: 'span'
    className: 'user'
    template: template

    initialize: ->
      @model.on 'change', ->
        @render()
      return

    render: ->
      @$el.html @template @model
      @
