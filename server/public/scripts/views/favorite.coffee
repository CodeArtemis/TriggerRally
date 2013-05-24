define [
  'cs!views/view'
  'jade!templates/favorite'
], (
  View
  template
) ->
  class FavoriteView extends View
    tagName: 'span'
    template: template

    constructor: (model, @root) ->
      super { model }

    initialize: ->
      super
      @render()
      @listenTo @root, 'change:user', => @updateChecked()
      @listenTo @root, 'change:user.favorite_tracks', => @updateChecked()
      @listenTo @model, 'change:id', => @updateChecked()
      # @model.fetch()

    viewModel: ->
      checked: @root.user?.isFavoriteTrack @model

    updateChecked: ->
      $favorite = @$('.favorite input')
      $favorite[0].checked = @root.user?.isFavoriteTrack @model

    afterRender: ->
      $favorite = @$('.favorite input')
      $favorite.click (event) =>
        if @root.user
          @root.user.setFavoriteTrack @model, $favorite[0].checked
          @root.user.save()
        else
          Backbone.trigger 'app:dologin'
          event.preventDefault()
          false
        return
