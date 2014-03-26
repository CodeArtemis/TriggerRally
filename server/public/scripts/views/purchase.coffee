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

    # TODO: Supply this data from the server in a centralized way.

    pricing =
      # 80: ['0.99', '0.29']
      # 200: ['1.99', '0.59']
      # 550: ['4.99', '1.49']
      # 1200: ['9.99', '2.99']
      # 2000: ['14.99', '4.99']

      200: ['1.99', '0.59']
      400: ['', '1.15']
      750: ['', '1.95']
      1150: ['', '2.95']
      2000: ['14.99', '4.49']

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

      creditsVal = =>
        parseInt @$('input[name=credits]:checked').val()

      checkoutUrl = =>
        "/checkout?method=paypal&cur=USD&pack=credits#{creditsVal()}&popup=1"

      @$('.checkout').on 'click', =>
        ga 'send', 'event', 'purchase', 'click', 'checkout', creditsVal()
        result = popup.create checkoutUrl(), "Checkout", (autoclosed) =>
          @destroy() if autoclosed
          root.user.fetch
            force: yes
        alert 'Popup window was blocked!' unless result
        return false

      ga 'send', 'pageview',
        page: '/purchase-credits'
        title: 'Purchase Credits Dialog'
      return
