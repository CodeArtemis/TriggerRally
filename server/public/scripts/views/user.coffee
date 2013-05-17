define [
  'cs!views/view'
  'jade!templates/user'
  'jade!templates/userstatus'
], (
  View
  templateBasic
  templateWithStatus
) ->
  class UserView extends View
    tagName: 'span'

    initialize: ->
      super
      @render()
      if @model then @listenTo @model, 'change', => @render()
      @model?.fetch()

    template: (viewModel) ->
      template = if @options.showStatus then templateWithStatus else templateBasic
      template viewModel

    viewModel: ->
      img_src = "/images/profile/#{@model?.picture ? "blank"}.jpg"
      user: @model
      img_src: img_src
