define [
  'cs!views/view'
  'jade!templates/credits'
], (
  View
  template
) ->
  class CreditsView extends View
    el: '#credits'
    template: template
    constructor: (@app) -> super()

    initialize: ->
      @listenTo @app.root, 'change:user', => @render()

    afterRender: ->
      $creditsBox = @$('.credits-box')
      $userCredits = @$('.usercredits')
      do updateCredits = =>
        credits = @app.root.user?.credits
        # TODO: Animate credit gains.
        $userCredits.text credits if credits?
        $creditsBox.toggleClass 'hidden', not credits?
      @listenTo @app.root, 'change:user.credits', updateCredits

      $userCredits = @$('.ca-credit.usercredits')
      @listenTo @app.root, 'change:user.credits', =>
        $userCredits.text @app.root.user?.credits

      @$('.purchasebutton a').on 'click', (event) =>
        @app.showCreditPurchaseDialog()
        false

      return
