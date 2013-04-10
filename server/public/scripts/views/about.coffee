define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/about'
], (
  Backbone
  View
  template
) ->
  class AboutView extends View
    className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      @$('#webgl-warning').toggleClass 'hidden', no unless @client.renderer
