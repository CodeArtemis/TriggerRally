/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

define([
  'underscore'
], function(
  _
){
  const TWOPI = Math.PI * 2;

  const deepClone = obj => JSON.parse(JSON.stringify(obj));

  return {
    addScenery(track, layer, layerIdx, selection) {
      let sel;
      const scenery = deepClone(track.config.scenery);
      const newSel = [];
      let newScenery = null;
      let sels = (Array.from(selection.models).map((model) => model.get('sel')));
      sels = ((() => {
        const result = [];
        for (sel of Array.from(sels)) {           if (sel.type === 'terrain') {
            result.push(sel);
          }
        }
        return result;
      })());
      for (var i = 0; i < sels.length; i++) {
        sel = sels[i];
        const rotZ = (() => {
          if (sels.length === 1) {
          return Math.random() * TWOPI;
        } else {
          let a, b;
          if (i === 0) {
            a = sel.object.pos;
            b = sels[i+1].object.pos;
          } else {
            a = sels[i-1].object.pos;
            b = sel.object.pos;
          }
          return Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
        })();
        newScenery = {
          scale: 1,
          rot: [ 0, 0, rotZ ],
          pos: sel.object.pos
        };
        if (scenery[layer] == null) { scenery[layer] = { add: [] }; }
        const idx = scenery[layer].add.length;
        scenery[layer].add.push(newScenery);
        newSel.push({
          sel: {
            type: 'scenery',
            distance: sel.distance,
            layer,
            idx,
            object: newScenery
          }
        });
      }
      track.config.scenery = scenery;
      return selection.reset(newSel);
    },

    copy(track, selection) {
      let doneCheckpoint = false;
      const scenery = deepClone(track.config.scenery);
      for (let selModel of Array.from(selection.models)) {
        var newPos, otherCp;
        let sel = selModel.get('sel');
        switch (sel.type) {
          case 'checkpoint':
            if (doneCheckpoint) { continue; }
            doneCheckpoint = true;
            var { checkpoints } = track.config.course;
            sel = selection.first().get('sel');
            var { idx } = sel;
            var selCp = checkpoints.at(idx);
            if (idx < (checkpoints.length - 1)) {
              otherCp = checkpoints.at(idx + 1);
              newPos = [
                (selCp.pos[0] + otherCp.pos[0]) * 0.5,
                (selCp.pos[1] + otherCp.pos[1]) * 0.5,
                (selCp.pos[2] + otherCp.pos[2]) * 0.5
              ];
            } else {
              otherCp = checkpoints.at(idx - 1);
              newPos = [
                (selCp.pos[0] * 2) - otherCp.pos[0],
                (selCp.pos[1] * 2) - otherCp.pos[1],
                (selCp.pos[2] * 2) - otherCp.pos[2]
              ];
            }
            var newCp = selCp.clone();
            newCp.pos = newPos;
            selection.reset();
            checkpoints.add(newCp, {at: idx + 1});
            break;
          case 'scenery':
            var newObj = deepClone(track.config.scenery[sel.layer].add[sel.idx]);
            newObj.pos[2] += 5 + (10 * Math.random());
            scenery[sel.layer].add.push(newObj);
            break;
        }
      }
      track.config.scenery = scenery;
    },

    delete(track, selection) {
      const { checkpoints } = track.config.course;
      const scenery = deepClone(track.config.scenery);
      const checkpointsToRemove = [];
      const sceneryToRemove = [];
      for (let selModel of Array.from(selection.models)) {
        const sel = selModel.get('sel');
        switch (sel.type) {
          case 'checkpoint':
            if (
                (sel.type === 'checkpoint') &&
                ((checkpoints.length - checkpointsToRemove.length) >= 2)) { checkpointsToRemove.push(sel.object); }
            break;
          case 'scenery':
            sceneryToRemove.push(scenery[sel.layer].add[sel.idx]);
            break;
        }
      }
      selection.reset();
      checkpoints.remove(checkpointsToRemove);
      for (let name in scenery) {
        const layer = scenery[name];
        layer.add = _.difference(layer.add, sceneryToRemove);
      }
      track.config.scenery = scenery;
    }
  };
});
