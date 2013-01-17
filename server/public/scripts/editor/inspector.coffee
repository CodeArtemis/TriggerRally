###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'jquery'
], (
  $
) ->
  deepClone = (obj) -> JSON.parse JSON.stringify obj

  # Utility for manipulating objects in models.
  manipulate = (model, attrib, fn) ->
    fn obj = deepClone model.get(attrib)
    model.set attrib, obj

  Controller: (selection, track) ->
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
    flagPublish     = $inspector.find '#flag-publish input'
    flagSnap        = $inspector.find '#flag-snap input'

    for layer, idx in track.env.scenery.layers
      sceneryType.$content.append new Option layer.id, idx

    selTitle.$content.val track.name
    selTitle.$content.on 'input', ->
      track.name = selTitle.$content.val()

    flagPublish[0].checked = track.published
    flagPublish.on 'change', ->
      track.published = flagPublish[0].checked

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
      scenery = deepClone track.config.scenery
      scenery[sel.layer].add[sel.idx].scale = Math.exp(val)
      track.config.scenery = scenery

    cmdAdd.$content.click ->
      scenery = deepClone track.config.scenery
      newSel = []
      $sceneryType = sceneryType.$content.find(":selected")
      layerIdx = $sceneryType.val()
      layer = $sceneryType.text()
      for selModel in selection.models
        sel = selModel.get 'sel'
        continue unless sel.type is 'terrain'
        newScenery =
          scale: 1
          rot: [ 0, 0, Math.random() * TWOPI ]
          pos: sel.object.pos
        scenery[layer] ?= { add: [] }
        idx = scenery[layer].add.length
        scenery[layer].add.push newScenery
        newSel.push
          sel:
            type: 'scenery'
            distance: sel.distance
            layer: layer
            idx: idx
            object: newScenery
      track.config.scenery = scenery
      selection.reset newSel

    cmdCopy.$content.click ->
      doneCheckpoint = no
      scenery = deepClone track.config.scenery
      for selModel in selection.models
        sel = selModel.get 'sel'
        switch sel.type
          when 'checkpoint'
            continue if doneCheckpoint
            doneCheckpoint = yes
            checkpoints = track.config.course.checkpoints
            sel = selection.first().get 'sel'
            idx = sel.idx
            selCp = checkpoints.at idx
            otherCp = checkpoints.at (if idx < checkpoints.length - 1 then idx + 1 else idx - 1)
            interpPos = [
              (selCp.pos[0] + otherCp.pos[0]) * 0.5
              (selCp.pos[1] + otherCp.pos[1]) * 0.5
              (selCp.pos[2] + otherCp.pos[2]) * 0.5
            ]
            newCp = selCp.clone()
            newCp.pos = interpPos
            selection.reset()
            checkpoints.add newCp, at: idx + 1
          when 'scenery'
            newObj = deepClone track.config.scenery[sel.layer].add[sel.idx]
            newObj.pos[2] += 5 + 10 * Math.random()
            scenery[sel.layer].add.push newObj
      track.config.scenery = scenery
      return

    cmdDelete.$content.click ->
      checkpoints = track.config.course.checkpoints
      scenery = deepClone track.config.scenery
      checkpointsToRemove = []
      sceneryToRemove = []
      for selModel in selection.models
        sel = selModel.get 'sel'
        switch sel.type
          when 'checkpoint'
            checkpointsToRemove.push sel.object if (
                sel.type is 'checkpoint' and
                sel.idx > 0 and
                sel.idx < checkpoints.length - 1)
          when 'scenery'
            sceneryToRemove.push scenery[sel.layer].add[sel.idx]
      selection.reset()
      checkpoints.remove checkpointsToRemove
      for name, layer of scenery
        layer.add = _.difference layer.add, sceneryToRemove
      track.config.scenery = scenery
      return

    cmdCopyTrack.$content.click ->
      return unless window.confirm "Are you sure you want to create a copy of this track?"
      form = document.createElement 'form'
      form.action = 'copy'
      form.method = 'POST'
      form.submit()

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

    do updateSnap = => @snapToGround = flagSnap[0].checked
    flagSnap.on 'change', updateSnap

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
