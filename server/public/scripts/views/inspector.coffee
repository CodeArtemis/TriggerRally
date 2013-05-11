###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'cs!editor/ops'
  'cs!views/view'
  'cs!views/tracklist'
  'cs!views/user'
  'cs!models/index'
], (
  Ops
  View
  TrackListView
  UserView
  models
) ->
  deepClone = (obj) -> JSON.parse JSON.stringify obj

  # Utility for manipulating objects in models.
  manipulate = (model, attrib, fn) ->
    fn obj = deepClone model.get(attrib)
    model.set attrib, obj

  class InspectorView extends View
    # TODO: Give inspector its own template, separate from editor.
    constructor: ($el, @app, @selection) -> super { el: $el }

    afterRender: ->
      app = @app
      selection = @selection
      $ = @$.bind @

      $inspector = @$el
      $inspectorAttribs = $inspector.find('.attrib')

      attrib = (selector) ->
        $el = $inspector.find selector
        $root: $el
        $content: $el.find '.content'

      selType         = attrib '#sel-type'
      selTitle        = attrib '#title'
      selScale        = attrib '#scale'
      selDispRadius   = attrib '#disp-radius'
      selDispHardness = attrib '#disp-hardness'
      selDispStrength = attrib '#disp-strength'
      selSurfRadius   = attrib '#surf-radius'
      selSurfHardness = attrib '#surf-hardness'
      selSurfStrength = attrib '#surf-strength'
      sceneryType     = attrib '#scenery-type'
      cmdAdd          = attrib '#cmd-add'
      cmdCopy         = attrib '#cmd-copy'
      cmdDelete       = attrib '#cmd-delete'
      cmdCopyTrack    = attrib '#cmd-copy-track'
      cmdDeleteTrack  = attrib '#cmd-delete-track'
      $cmdDeleteTrack = $inspector.find '#cmd-delete-track'
      $flagPublish    = $inspector.find '#flag-publish input'
      $flagSnap       = $inspector.find '#flag-snap input'

      root = app.root

      trackListView = null
      do updateTrackListView = ->
        trackListView?.destroy()
        trackListView = root.user and new TrackListView
          collection: root.user.tracks
          root: root
        $('#track-list').append trackListView.el if trackListView?
      root.on 'change:user', updateTrackListView

      userView = null
      do updateUser = ->
        return if root.track?.user is userView?.model
        userView?.destroy()
        if root.track.user?
          userView = new UserView
            model: root.track.user
          $('#user-track-owner .content').append userView.el
      root.on 'change:track.user', updateUser

      do compareUser = ->
        isOwnTrack = root.track?.user is root.user
        $cmdDeleteTrack.toggleClass 'hidden', not isOwnTrack
        $("#track-ownership-warning").toggleClass 'hidden', isOwnTrack
        $("#copy-login-prompt").toggleClass 'hidden', !! root.user
      root.on 'change:track.user', compareUser
      root.on 'change:user', compareUser

      do onChangeEnv = ->
        return unless root.track?.env?.scenery?.layers
        sceneryType.$content.empty()
        for layer, idx in root.track.env.scenery.layers
          sceneryType.$content.append new Option layer.id, idx
      root.on 'change:track.env', onChangeEnv

      do updateName = ->
        return unless root.track?
        return if selTitle.$content.val() is root.track.name
        selTitle.$content.val root.track.name
      root.on 'change:track.name', updateName
      selTitle.$content.on 'input', ->
        root.track.name = selTitle.$content.val()

      do updatePublished = ->
        return unless root.track?
        $flagPublish[0].checked = root.track.published
      root.on 'change:track.published', updatePublished
      $flagPublish.on 'change', ->
        root.track.published = $flagPublish[0].checked

      bindSlider = (type, slider, eachSel) ->
        $content = slider.$content
        $content.change ->
          val = parseFloat $content.val()
          for selModel in selection.models
            sel = selModel.get 'sel'
            eachSel sel, val if sel.type is type

      bindSlider 'checkpoint', selDispRadius,   (sel, val) -> manipulate sel.object, 'disp', (o) -> o.radius   = val
      bindSlider 'checkpoint', selDispHardness, (sel, val) -> manipulate sel.object, 'disp', (o) -> o.hardness = val
      bindSlider 'checkpoint', selDispStrength, (sel, val) -> manipulate sel.object, 'disp', (o) -> o.strength = val
      bindSlider 'checkpoint', selSurfRadius,   (sel, val) -> manipulate sel.object, 'surf', (o) -> o.radius   = val
      bindSlider 'checkpoint', selSurfHardness, (sel, val) -> manipulate sel.object, 'surf', (o) -> o.hardness = val
      bindSlider 'checkpoint', selSurfStrength, (sel, val) -> manipulate sel.object, 'surf', (o) -> o.strength = val

      bindSlider 'scenery', selScale, (sel, val) ->
        scenery = deepClone root.track.config.scenery
        scenery[sel.layer].add[sel.idx].scale = Math.exp(val)
        root.track.config.scenery = scenery

      cmdAdd.$content.click ->
        $sceneryType = sceneryType.$content.find(":selected")
        layerIdx = $sceneryType.val()
        layer = $sceneryType.text()
        Ops.addScenery root.track, layer, layerIdx, selection

      cmdCopy.$content.click ->
        Ops.copy root.track, selection

      cmdDelete.$content.click ->
        Ops.delete root.track, selection

      cmdCopyTrack.$content.click ->
        newTrack = new models.Track
          parent: root.track
        newTrack.save null,
          success: ->
            root.user.tracks.add newTrack
            Backbone.trigger "app:settrack", newTrack
          error: (model, xhr) ->
            data = JSON.parse xhr.responseText
            msg = data?.error ? xhr.statusText
            Backbone.trigger "app:status", "Copy failed: #{msg} (#{xhr.status})"

      cmdDeleteTrack.$content.click ->
        return unless window.confirm "Are you sure you want to DELETE this track? This can't be undone!"
        root.track.destroy
          success: ->
            Backbone.history.navigate "/track/v3-base-1/edit", trigger: yes
          error: (model, xhr) ->
            Backbone.trigger "app:status", "Delete failed: #{xhr.statusText} (#{xhr.status})"

      do updateSnap = => @snapToGround = $flagSnap[0].checked
      $flagSnap.on 'change', updateSnap

      checkpointSliderSet = (slider, val) ->
        slider.$content.val val
        slider.$root.addClass 'visible'

      do onChange = ->
        # Hide and reset all controls first.
        $inspectorAttribs.removeClass 'visible'

        selType.$content.text switch selection.length
          when 0 then 'none'
          when 1
            sel = selection.first().get('sel')
            if sel.type is 'scenery'
              sel.layer
            else
              sel.type
          else '[multiple]'

        for selModel in selection.models
          sel = selModel.get 'sel'
          switch sel.type
            when 'checkpoint'
              checkpointSliderSet selDispRadius,   sel.object.disp.radius
              checkpointSliderSet selDispHardness, sel.object.disp.hardness
              checkpointSliderSet selDispStrength, sel.object.disp.strength
              checkpointSliderSet selSurfRadius,   sel.object.surf.radius
              checkpointSliderSet selSurfHardness, sel.object.surf.hardness
              checkpointSliderSet selSurfStrength, sel.object.surf.strength
              cmdDelete.$root.addClass 'visible'
              cmdCopy.$root.addClass 'visible'
            when 'scenery'
              selScale.$content.val Math.log sel.object.scale
              selScale.$root.addClass 'visible'
              cmdDelete.$root.addClass 'visible'
              cmdCopy.$root.addClass 'visible'
            when 'terrain'
              # Terrain selection acts as marker for adding scenery.
              sceneryType.$root.addClass 'visible'
              cmdAdd.$root.addClass 'visible'
        return

      selection.on 'add', onChange
      selection.on 'remove', onChange
      selection.on 'reset', onChange
      return
