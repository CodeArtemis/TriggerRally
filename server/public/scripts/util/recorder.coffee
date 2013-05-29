moduleDef = (require, exports, module) ->
  _ = require 'underscore'

  # Observes and records object state in an efficient format.

  class exports.StateSampler
    constructor: (@object, @keys, @freq = 1, @changeHandler) ->
      @keyMap = generateKeyMap keys
      @restart()

    restart: ->
      @lastState = null
      @counter = -1

    observe: ->
      ++@counter
      return if @counter % @freq isnt 0
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
      @changeHandler @counter, remapped
      @counter = 0

    toJSON: ->
      # freq: @freq  # No longer necessary to record this value.
      keyMap: _.invert @keyMap

  class exports.StateRecorder
    constructor: (@object, @keys, @freq) ->
      @restart()

    restart: ->
      @timeline = timeline = []
      changeHandler = (offset, state) ->
        timeline.push [offset, state]
      @sampler = new exports.StateSampler @object, @keys, @freq, changeHandler

    observe: -> @sampler.observe()

    toJSON: ->
      keyMap: @sampler.toJSON().keyMap
      timeline: @timeline

  # # Records into a Backbone Collection.
  # class exports.CollectionRecorder
  #   constructor: (@collection, @object, @keys, @freq) ->
  #     @restart()
  #   restart: ->
  #     collection = @collection.reset()
  #     changeHandler = (offset, state) ->
  #       collection.add { offset, state }
  #     @sampler = new exports.StateSampler @object, @keys, @freq, changeHandler
  #   observe: -> @sampler.observe()

  class exports.StatePlayback
    constructor: (@object, @saved) ->
      @restart()

    restart: ->
      # Set to -1 so that we advance to 0 and update object on first step.
      @counter = -1
      @currentSeg = -1

    step: ->
      timeline = @saved.timeline
      ++@counter
      while (seg = timeline[@currentSeg + 1]) and (duration = seg[0]) <= @counter
        ++@currentSeg
        applyDiff @object, timeline[@currentSeg][1], @saved.keyMap
        @counter -= duration
      return

    complete: -> timeline[@currentSeg + 1]?

  class exports.StatePlaybackInterpolated
    constructor: (@object, @saved) ->
      @restart()

    restart: ->
      # Set to -1 so that we advance to 0 on first step.
      @counter = -1
      @currentSeg = -1
      @cache = {}

    step: ->
      timeline = @saved.timeline
      ++@counter
      keyMap = @saved.keyMap
      while (nextSeg = timeline[@currentSeg + 1]) and (duration = nextSeg[0]) <= @counter
        applyDiff @cache, nextSeg[1], keyMap
        ++@currentSeg
        @counter -= duration
      return if @currentSeg < 0
      factor = @counter / duration
      if nextSeg
        blendDiff @object, @cache, nextSeg[1], keyMap, factor
      else
        applyDiff @object, timeline[@currentSeg][1], keyMap
      return

    complete: -> timeline[@currentSeg + 1]?

  # Returns only values in a that differ from those in b.
  # a and b must have the same attributes.
  objDiff = (a, b) ->
    changed = {}
    for k of a
      aVal = a[k]
      if _.isArray aVal
        # Always pass through arrays.
        # TODO: Actually diff arrays. _.isEqual?
        changed[k] = aVal
      else if typeof aVal is 'object'
        c = objDiff aVal, b[k]
        changed[k] = c unless _.isEmpty c
      else
        changed[k] = aVal if aVal isnt b[k]
    changed

  applyDiff = (obj, diff, keyMap) ->
    if _.isArray diff
      obj ?= []
      for el, index in diff
        # No remapping for array indices.
        obj[index] = applyDiff obj[index], el, keyMap
    else if _.isObject diff
      obj ?= {}
      for key, val of diff
        mapped = keyMap[key]
        obj[mapped] = applyDiff obj[mapped], val, keyMap
    else
      obj = parseFloat diff
    obj

  blendDiff = (obj, lastState, diff, keyMap, factor) ->
    if _.isArray diff
      for el, index in diff
        # No remapping for array indices.
        obj[index] = blendDiff obj[index], lastState[index], el, keyMap, factor
    else if _.isObject diff
      for key, val of diff
        mapped = keyMap[key]
        obj[mapped] = blendDiff obj[mapped], lastState[mapped], val, keyMap, factor
    else
      target = parseFloat diff
      obj = lastState + (target - lastState) * factor
    obj

  generateKeyMap = (keys) ->
    keyMap = {}
    nextKey = 0

    do process = (keys) ->
      for key, val of keys
        keyMap[key] = (nextKey++).toString(36) unless key of keyMap
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
