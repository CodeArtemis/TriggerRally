define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/mayhem'
  'cs!util/popup'
], (
  Backbone
  View
  template
  popup
) ->
  productId = 'mayhem'
  carId = 'Mayhem'

  class MayhemView extends View
    # className: 'overlay'
    template: template
    constructor: (@app, @client) -> super()

    initialize: ->
      @listenTo @app.root, 'change:user', => @render()
      @listenTo @app.root, 'change:user.products', => @render()

    viewModel: ->
      products = @app.root.user?.products ? []
      purchased: productId in products
      user: @app.root.user

    afterRender: ->
      root = @app.root
      @$('a.checkout').on 'click', ->
        not popup.create @href, "Checkout", ->
          root.user.fetch
            force: yes
            success: ->
              newCar = carId
              root.prefs.car = newCar if newCar in root.user.cars()
