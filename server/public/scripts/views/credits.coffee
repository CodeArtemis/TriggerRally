define [
  'underscore'
  'cs!views/view'
  'jade!templates/credits'
], (
  _
  View
  template
) ->
  class CreditsView extends View
    el: '#credits'
    template: template
    constructor: (@app, @client) -> super()

    initialize: ->
      @listenTo @app.root, 'change:user', => @render()

    afterRender: ->
      $creditsBox = @$('.credits-box')
      $userCredits = @$('.usercredits')

      prevCredits = null

      do updateCredits = =>
        credits = @app.root.user?.credits
        if credits?
          $userCredits.text credits
          if prevCredits? and credits > prevCredits
            @client.playSound 'kaching'
            $creditsBox.addClass 'flash'
            _.defer -> $creditsBox.removeClass 'flash'
        $creditsBox.toggleClass 'hidden', not credits?
        prevCredits = credits
      @listenTo @app.root, 'change:user.credits', updateCredits

      $userCredits = @$('.ca-credit.usercredits')
      @listenTo @app.root, 'change:user.credits', =>
        $userCredits.text @app.root.user?.credits

      # $creditsBox.on 'click', (event) =>
      #   @app.showCreditPurchaseDialog()
      #   false

      return
