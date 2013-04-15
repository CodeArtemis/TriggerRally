define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/license'
], (
  Backbone
  View
  template
) ->
  class AboutView extends View
    className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()
