define [
  'backbone-full'
  'jade!templates/user'
  'jade!templates/userstatus'
], (
  Backbone
  templateBasic
  templateWithStatus
) ->
  class UserView extends Backbone.View
    initialize: ->
      super
      @model.on 'change', =>
        @render()

    render: ->
      template = if @options.showStatus then templateWithStatus else templateBasic
      @$el.html template
        user: @model
        randomSmiley: @randomSmiley
      @

    randomSmiley: ->
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
      url = "http://triggerrally.com/emojis/#{smileys[idx]}"
      encodeURIComponent url
