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
      @app.root.on 'change:user', => @render()
      @model.fetch()

    editable: -> @model.id is @app.root.user?.id

    viewModel: ->
      loading = '...'
      data = super
      data.created = if data.created?
        d = new Date data.created
        z = (n) -> (if n < 10 then "0" else "") + n
        "#{d.getFullYear()}-#{z d.getMonth()}-#{z d.getDay()}"
      else loading
      data.name ?= loading
      data.bio ?= loading
      data.location ?= loading
      data.website ?= loading
      data.editable = @editable()
      data

    afterRender: ->
      return unless @editable()
      $name = @$('div.user-name')
      $name.click (event) =>
        name = $name.text()
        $name.replaceWith "<input class=\"user-name\" type=\"text\", value=\"#{name}\"></input>"
        $name = @$('.user-name')
        $name.focus()

        $name.blur => @render()
        $name.keydown (event) =>
          switch event.keyCode
            when 13
              @model.save { name: $name.val() }
            when 27
              @render()
