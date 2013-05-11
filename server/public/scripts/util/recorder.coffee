moduleDef = (require, exports, module) ->
  _ = require 'underscore'

  # Observes and records object state in an efficient format.

  class exports.StateSampler
    constructor: (@object, @keys, @freq = 1, @changeHandler) ->
      @keyMap = generateKeyMap keys
      @lastState = null
      @observations = 0

    observe: ->
      index = @observations
      return if @observations++ % @freq isnt 0
      @freqCount = 0
      newState = filterObject @object, @keys
      if @lastState
        # Store state difference for repeat observations.
        stateDiff = objDiff newState, @lastState
        return if _.isEmpty stateDiff
        @lastState = newState
      else
        # First observation.
        @lastState = stateDiff = newState
      remapped = remapKeys stateDiff, @keyMap
      @changeHandler index, remapped

    toJSON: ->
      freq: @freq
      keyMap: _.invert @keyMap

  class exports.StateRecorder
    constructor: (object, keys, freq) ->
      @timeline = timeline = []
      changeHandler = (index, state) ->
        timeline.push [index, state]
      @sampler = new exports.StateSampler object, keys, freq, changeHandler

    observe: ->
      @sampler.observe()

    toJSON: -> { @sampler, @timeline }

  class exports.StatePlayback
    constructor: (@object, @serialized) ->
      @index = 0
      @freq = serialized.freq
      @freqCount = 0
      @nextSeg = 0

    step: ->
      if @freq
        return if ++@freqCount isnt @freq
        @freqCount = 0
      seg = @serialized.timeline[@nextSeg]
      if seg
        applyDiff(@object, seg[1], @serialized.keyMap)
        if ++@index >= seg[0]
          @index = 0
          # if ++@nextSeg >= @serialized.timeline.length
          #   @pubsub.publish('complete')
      return

  # Returns only values in a that differ from those in b.
  # a and b must have the same attributes.
  objDiff = (a, b) ->
    changed = {}
    for k of a
      aVal = a[k]
      if _.isArray aVal
        # Always pass through arrays.
        # TODO: Actually diff arrays. _.isEqual?
        changed[k] = a[k]
      else if typeof aVal is 'object'
        c = objDiff aVal, b[k]
        changed[k] = c unless _.isEmpty c
      else
        changed[k] = aVal if aVal isnt b[k]
    changed

  applyDiff = (obj, diff, keyMap) ->
    if _.isArray(diff)
      for el, index in diff
        # No remapping for array indices.
        obj[index] = applyDiff obj[index], el, keyMap
      obj
    else if typeof diff is 'object'
      for key, val of diff
        obj[keyMap[key]] = applyDiff obj[keyMap[key]], val, keyMap
      obj
    else
      parseFloat diff

  generateKeyMap = (keys) ->
    keyMap = {}
    nextKey = 0

    for key, val of keys
      throw new Error('repeated key') if key of keyMap
      keyMap[key] = (nextKey++).toString(36)
      if _.isArray val
        process val[0]
      else if typeof val is 'object'
        process val

    keyMap

  remapKeys = (object, keyMap) ->
    if _.isArray object
      remapKeys el, keyMap for el in object
    else if _.isObject object
      remapped = {}
      for objKey, val of object
        remapped[keyMap[objKey]] = remapKeys val, keyMap
      remapped
    else
      object

  filterObject = (obj, keys) ->
    if _.isArray keys
      subKeys = keys[0]
      filterObject el, subKeys for el in obj
    else if _.isObject keys
      result = {}
      for key, val of keys
        result[key] = filterObject obj[key], val
      result
    else
      # keys is the precision value.
      # TODO: Experiment with rounding methods.
      # Also strip trailing .0s
      obj.toFixed(keys).replace(/\.0*$/, '')

  return exports

if define?
  define moduleDef
else if exports?
  moduleDef require, exports, module
