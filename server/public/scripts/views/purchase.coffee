define [
  'jquery'
  'backbone-full'
  'cs!views/view'
  'jade!templates/purchase'
  'cs!util/popup'
], (
  $
  Backbone
  View
  template
  popup
) ->
  class PurchaseView extends View
    className: 'overlay'
    template: template
    constructor: (user, @app, @client) ->
      super { model: user }

    pricing =
      80: '0.99'
      200: '1.99'
      550: '4.99'
      1200: '9.99'
      2000: '15.99'

    viewModel: ->
      credits: @model.credits
      options: ({credits, price} for credits, price of pricing)

    afterRender: ->
      root = @app.root

      @$('.modal-blocker').on 'click', (event) =>
        @destroy()

      @$('.purchasecredits input:radio[value=\"550\"]').prop 'checked', yes

      # $displayAmount = @$('.display-amount')
      # $displayAmount.text 'default'
      # @$('.purchasecredits input:radio').on 'change', (event) ->
      #   opt = pricing[@value]
      #   $displayAmount.text '$' + opt

      checkoutUrl = =>
        credits = @$('input[name=credits]:checked').val()
        "/checkout?method=paypal&cur=USD&pack=credits#{credits}&popup=1"

      @$('.checkout').on 'click', =>
        result = popup.create checkoutUrl(), "Checkout", =>
          @destroy()
          root.user.fetch
            force: yes
        alert 'Popup window was blocked!' unless result
        return false
      return
