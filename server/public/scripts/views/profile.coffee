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
      Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:name', => Backbone.trigger 'app:settitle', @model.name
      @listenTo @model, 'change:id', => @render()
      @listenTo @model, 'change:products', => @render()
      @listenTo @app.root, 'change:user', => @render()
      @model.fetch
        error: ->
          Backbone.trigger 'app:notfound'

    editable: -> @model.id is @app.root.user?.id
    purchased: ->
      products = @model.products ? []
      'paid' in products or 'packa' in products or 'ignition' in products or 'mayhem' in products

    loadingText = '...'
    pictureSrc = (picture) ->
      picture ?= 'blank'
      "/images/profile/#{picture}.jpg"
    issueDate = (created) ->
      isoDate = (d) ->
        d = new Date d
        z = (n) -> (if n < 10 then "0" else "") + n
        # Note that this will use local time.
        "#{d.getFullYear()}-#{z d.getMonth()+1}-#{z d.getDate()}"
      if created? then isoDate(created) else loadingText

    viewModel: ->
      data = super
      data.loaded = data.name?
      data.issueDate = issueDate data.created
      data.name ?= loadingText
      data.noPicture = not data.picture?
      # data.pic_src = pictureSrc data.picture
      data.editable = @editable()
      data.purchased = @purchased()
      data.title = if data.purchased then 'Rally License' else 'Provisional License'
      data.badges = []
      products = data.products ? []
      if 'ignition' in products
        data.badges.push
          # href: '/ignition'
          href: '/purchase'
          img_src: '/images/packs/ignition.svg'
          img_title: 'Ignition Icarus'
      if 'mayhem' in products
        data.badges.push
          # href: '/mayhem'
          href: '/purchase'
          img_src: '/images/packs/mayhem.png'
          img_title: 'Mayhem Monster Truck'
      data

    afterRender: ->
      $created = @$('.issuedate')
      $name = @$('.user-name')
      $pic = @$('.picture')
      $nameError = @$('div.user-name-error')

      $pic.css 'background-image', "url(#{pictureSrc @model.picture})"

      @listenTo @model, 'change:name', (model, value) =>
        $name.text value

      @listenTo @model, 'change:picture', (model, value) =>
        $pic.css 'background-image', "url(#{pictureSrc @model.picture})"

      @listenTo @model, 'change:created', (model, value) =>
        $created.text issueDate value

      return unless @editable()

      $name.click (event) =>
        name = $name.text()
        $input = $ "<input class=\"user-name\" type=\"text\", value=\"#{name}\", maxlength=20></input>"

        @model.on 'invalid', (model, error, options) =>
          $input.addClass 'invalid'
          $nameError.text error
        $input.on 'input', =>
          @model.set { name: $input.val() }
          invalid = @model.validate()
          if invalid
            $input.addClass 'invalid'
            $nameError.text invalid
          else
            $input.removeClass 'invalid'
            $nameError.text ''
        $input.keydown (event) =>
          switch event.keyCode
            when 13
              return unless @model.isValid()
              @model.save null,
                success: => $input.remove()
                error: => $nameError.text 'Failed to save'
            when 27
              $input.remove()
        $input.blur => $input.remove()
        $name.parent().append $input
        $input.focus()

      if @purchased()
        $pic.click (event) =>
          picture = parseInt(@model.picture ? -1, 10)
          @model.save { picture: (picture + 1) % 6 }
