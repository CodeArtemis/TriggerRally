###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'jquery'
  'cs!./ops'
  'cs!views/tracklist'
  'cs!views/user'
], (
  $
  Ops
  TrackListView
  UserView
) ->
  deepClone = (obj) -> JSON.parse JSON.stringify obj

  # Utility for manipulating objects in models.
  manipulate = (model, attrib, fn) ->
    fn obj = deepClone model.get(attrib)
    model.set attrib, obj

  Controller: (app, selection) ->
    $inspector = $('#editor-inspector')
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

    trackListView = new TrackListView
      el: '#track-list'
      collection: root.user.tracks
      root: root

    userView = null
    root.on 'change:user', ->
      userView?.destroy()
      userView = new UserView
        el: '#user-track-owner .content'
        model: root.user

    onChangeEnv = ->
      return unless root.track.env.scenery?.layers
      sceneryType.$content.remove()
      for layer, idx in root.track.env.scenery.layers
        sceneryType.$content.append new Option layer.id, idx
    root.on 'change:track.env', onChangeEnv

    root.on 'change:track.name', ->
      selTitle.$content.val root.track.name
    selTitle.$content.on 'input', ->
      root.track.name = selTitle.$content.val()

    root.on 'change:track.published', ->
      $flagPublish[0].checked = root.track.published
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
      Ops.addScenery track, layer, layerIdx, selection

    cmdCopy.$content.click ->
      Ops.copy track, selection

    cmdDelete.$content.click ->
      Ops.delete track, selection

    cmdCopyTrack.$content.click ->
      return unless window.confirm "Are you sure you want to create a copy of this track?"
      form = document.createElement 'form'
      form.action = 'copy'
      form.method = 'POST'
      form.submit()

    compareUser = ->
      $cmdDeleteTrack.toggleClass 'hidden', (root.track.user isnt root.user)
    root.on 'change:track.owner', compareUser
    root.on 'change:user.id', compareUser

    cmdDeleteTrack.$content.click ->
      return unless window.confirm "Are you sure you want to DELETE this track?"
      xhr = new XMLHttpRequest()
      xhr.open "DELETE", "."
      xhr.onload = ->
        if xhr.status is 200
          window.location = "/"
        else
          window.alert "Delete failed with status #{xhr.status} (#{xhr.statusText})"
      xhr.onerror = ->
        window.alert "Error: #{xhr.status}"
      xhr.send()

    do updateSnap = => @snapToGround = $flagSnap[0].checked
    $flagSnap.on 'change', updateSnap

    checkpointSliderSet = (slider, val) ->
      slider.$content.val val
      slider.$root.addClass 'visible'

    onChange = ->
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

    onChange()
    selection.on 'add', onChange
    selection.on 'remove', onChange
    selection.on 'reset', onChange
    null
