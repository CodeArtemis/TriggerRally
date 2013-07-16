define [
  'backbone-full'
  'underscore'
  'cs!views/view'
  'jade!templates/packa'
  'cs!util/popup'
], (
  Backbone
  _
  View
  template
  popup
) ->
  productId = 'packa'

  priceMessages =
    a: 'For <b>5.99 USD</b> you get:'
    # b: 'For just <b>5.99 USD</b> you get:'

  defaultPrice = '5'

  class MayhemView extends View
    # className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()

    initialize: ->
      @listenTo @app.root, 'change:user', => @render()
      @listenTo @app.root, 'change:user.products', => @render()

    viewModel: ->
      pmkeys = (key for key of priceMessages)
      pmkey = @pmkey = pmkeys[Math.floor Math.random() * pmkeys.length]
      products = @app.root.user?.products ? []
      purchased: productId in products
      user: @app.root.user
      pmkey: pmkey
      priceHtml: priceMessages[pmkey]
      checkedPrice: defaultPrice

    nullUrl: ->
      "javascript:;"
    checkoutUrl: (amt) ->
      "/checkout?pmkey=#{@pmkey}&method=paypal&cur=USD&amt=#{amt}&pack=full"

    afterRender: ->
      root = @app.root

      $customprice    = @$ '.checkout-box .customprice'
      $messageminimum = @$ '.checkout-box .message.minimum'
      $messagepaypal  = @$ '.checkout-box .message.paypal'
      $checkout       = @$ '.checkout-box a.checkout'

      $customPriceRadio = @$ '.checkout-box input:radio[value=\"custom\"]'

      clearMessages = ->
        $messageminimum.addClass 'zeroalpha'
        $messagepaypal.addClass 'zeroalpha'

      price = defaultPrice
      checkoutUrl = =>
        "/checkout?pmkey=#{@pmkey}&method=paypal&cur=USD&amt=#{price}&pack=full"

      @$(".checkout-box input:radio[value=\"#{defaultPrice}\"]").prop 'checked', yes

      updateCustomPrice = (event) ->
        $customPriceRadio.prop 'checked', yes
        inp = $customprice.val()
        inp = inp.slice 1 while inp[0] in [ '$', '-' ]
        inp = inp.replace ',', '.'
        inp = parseFloat inp
        clearMessages()
        if Number.isNaN inp
          $messageminimum.removeClass 'zeroalpha'
          price = null
        else
          val = inp.toFixed 2
          $customprice.val "$#{val}"
          if inp <= 0.31
            $messagepaypal.removeClass 'zeroalpha'
          if inp < 0.01
            $messageminimum.removeClass 'zeroalpha'
            price = null
          else
            val = inp.toFixed 2
            price = val

      @$('.checkout-box input:radio').on 'change', (event) ->
        if @value is 'custom'
          $customprice.removeClass 'zeroalpha'
          updateCustomPrice()
        else
          price = @value

      $customprice.on 'change', updateCustomPrice

      @$('.checkout').on 'click', ->
        return false unless price
        result = popup.create checkoutUrl(), "Checkout", ->
          root.user.fetch
            force: yes
        alert 'Popup window was blocked!' unless result
        return false

      return
