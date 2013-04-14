define [
  'backbone-full'
  'cs!views/view'
  'jade!templates/profile'
  'cs!util/popup'
], (
  Backbone
  View
  template
  popup
) ->
  class ProfileView extends View
    # className: 'overlay'
    template: template
    constructor: (model, @app, @client) ->
      super { model }

    initialize: ->
      @model.on 'change', => @render()
