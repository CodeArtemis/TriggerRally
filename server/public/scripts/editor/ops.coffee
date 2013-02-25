
define [], ->
  TWOPI = Math.PI * 2

  deepClone = (obj) -> JSON.parse JSON.stringify obj

  addScenery: (track, layer, layerIdx, selection) ->
    scenery = deepClone track.config.scenery
    newSel = []
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

  copy: (track, selection) ->
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
          if idx < checkpoints.length - 1
            otherCp = checkpoints.at idx + 1
            newPos = [
              (selCp.pos[0] + otherCp.pos[0]) * 0.5
              (selCp.pos[1] + otherCp.pos[1]) * 0.5
              (selCp.pos[2] + otherCp.pos[2]) * 0.5
            ]
          else
            otherCp = checkpoints.at idx - 1
            newPos = [
              selCp.pos[0] * 2 - otherCp.pos[0]
              selCp.pos[1] * 2 - otherCp.pos[1]
              selCp.pos[2] * 2 - otherCp.pos[2]
            ]
          newCp = selCp.clone()
          newCp.pos = newPos
          selection.reset()
          checkpoints.add newCp, at: idx + 1
        when 'scenery'
          newObj = deepClone track.config.scenery[sel.layer].add[sel.idx]
          newObj.pos[2] += 5 + 10 * Math.random()
          scenery[sel.layer].add.push newObj
    track.config.scenery = scenery
    return

  delete: (track, selection) ->
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
              checkpoints.length - checkpointsToRemove.length >= 2)
        when 'scenery'
          sceneryToRemove.push scenery[sel.layer].add[sel.idx]
    selection.reset()
    checkpoints.remove checkpointsToRemove
    for name, layer of scenery
      layer.add = _.difference layer.add, sceneryToRemove
    track.config.scenery = scenery
    return
