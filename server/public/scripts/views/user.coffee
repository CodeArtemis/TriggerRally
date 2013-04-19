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
      @model?.on 'change', @render, @
      @model?.fetch()

    destroy: ->
      @model?.off 'change', @render, @
      super

    template: (viewModel) ->
      template = if @options.showStatus then templateWithStatus else templateBasic
      template viewModel

    viewModel: ->
      user: @model
      randomSmiley: randomSmiley

    randomSmiley = ->
      smileys = [
        "smiley.png"
        "smile.png"
        "smirk.png"
        "relaxed.png"
        "grinning.png"
        "yum.png"
        "sunglasses.png"
        "satisfied.png"
        "stuck_out_tongue.png"
        "innocent.png"
      ]
      idx = Math.floor(Math.random() * smileys.length)
      url = "https://triggerrally.com/emojis/#{smileys[idx]}"
      encodeURIComponent url
