###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'zepto',
  'cs!trigger-view',
  'game/track'
], ($, TriggerView, gameTrack) ->
  run: ->

    container = $(window)
    toolbox = $('#editor-toolbox')
    view3d = $('#view3d')

    tv = new TriggerView view3d[0]

    track = new gameTrack.Track()
    track.loadWithConfig TRIGGER.TRACK.CONFIG, ->
      tv.setTrack track

    layout = ->
      [toolbox, view3d].forEach (panel) ->
        panel.css 'position', 'absolute'
        panel.height container.height()
      TOOLBOX_WIDTH = 300
      toolbox.width TOOLBOX_WIDTH
      view3d.width container.width() - TOOLBOX_WIDTH
      view3d.css 'left', TOOLBOX_WIDTH
      tv.setSize view3d.width(), view3d.height()
      return

    layout()
    container.on 'resize', ->
      layout()

    toolbox.show()

    return
