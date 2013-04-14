define [
  'jquery'
  'backbone-full'
  'cs!views/view'
  'jade!templates/profile'
  'cs!util/popup'
], (
  $
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
      @model.fetch()

    viewModel: ->
      data = super
      loading = '...'
      data.name ?= loading
      data.bio ?= loading
      data.location ?= loading
      data.website ?= loading
      data

    afterRender: ->
      $name = @$('div.user-name')
      $name.click (event) =>
        name = $name.text()
        $name.replaceWith "<input class=\"user-name\" type=\"text\", value=\"#{name}\"></input>"
        $name = @$('.user-name')
        $name.focus()
        $name.blur =>
          @render()
