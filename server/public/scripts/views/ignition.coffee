define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/ignition'
  'cs!util/popup'
], (
  Backbone
  View
  template
  popup
) ->
  class IgnitionView extends View
    # className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()

    afterRender: ->
      @$('a.paypal-checkout').on 'click', (event) ->
        not popup.create @href, "Checkout", ->
          alert 'done! TODO: reload page?'
