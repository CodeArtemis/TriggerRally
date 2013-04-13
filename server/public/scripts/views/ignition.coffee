define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/ignition'
], (
  Backbone
  View
  template
) ->
  class IgnitionView extends View
    # className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()
