###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

MODULE = 'recorder'

((exports) ->
  _ = @_ || require('underscore')
  pubsub = @pubsub || require('./pubsub')

  # Observes and records object state in an efficient format.
  class exports.StateRecorder
    constructor: (@object, @keys, @freq) ->
      @timeline = []
      @keyMap = generateKeyMap(keys)
      @freqCount = 0
      @index = 0
      @lastState = null
      @lastDiff = null

    observe: ->
      if @freq
        return if ++@freqCount isnt @freq
        @freqCount = 0
      newState = filterObject(@object, @keys)
      if not @lastState
        # Store the full state for the first observation.
        @lastDiff = @lastState = newState
      else
        # Store state difference for repeat observations.
        stateDiff = objDiff(newState, @lastState)
        unless _.isEmpty(stateDiff)
          # Push the LAST state onto the timeline.
          remapped = remapKeys(@lastDiff, @keyMap)
          @timeline.push([@index, remapped])
          # Store the diff for next time.
          @lastDiff = stateDiff
          @lastState = newState
          @index = 0
      ++@index
      return

    # Serializing adds an extra record to the timeline.
    serialize: ->
      reverseMap = {}
      reverseMap[@keyMap[k]] = k for k of @keyMap  ## CHECK
      remapped = remapKeys(@lastDiff, @keyMap)
      @timeline.push([@index, remapped])
      @lastDiff = {}
      @index = 0

      freq: @freq
      keyMap: reverseMap
      timeline: @timeline

  class exports.StatePlayback
    constructor: (@object, @serialized) ->
      @index = 0
      @freq = serialized.freq
      @freqCount = 0
      @nextSeg = 0
      @pubsub = new pubsub.PubSub()

    step: ->
      if @freq
        return if ++@freqCount isnt @freq
        @freqCount = 0
      seg = @serialized.timeline[@nextSeg]
      if seg
        applyDiff(@object, seg[1], @serialized.keyMap)
        if ++@index >= seg[0]
          @index = 0
          if ++@nextSeg >= @serialized.timeline.length
            @pubsub.publish('complete')
      return

  # Returns only values in a that differ from those in b.
  # a and b must have the same attributes.
  objDiff = (a, b) ->
    changed = {}
    for k of a
      aVal = a[k]
      if (_.isArray(aVal)) {
        # TODO: Actually diff arrays.
        changed[k] = a[k]
      else if (typeof aVal is 'object') {
        c = objDiff(aVal, b[k])
        if (!_.isEmpty(c)) {
          changed[k] = c
      else {
        if (aVal isnt b[k]) changed[k] = aVal
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
      parseFloat(diff)

  generateKeyMap = (keys) ->
    keyMap = {}
    nextKey = 0

    process = (keys) ->
      for key, val of keys
        unless key of keyMap
          keyMap[key] = (nextKey++).toString(36)
        if _.isArray val
          process val[0]
        else if typeof val is 'object'
          process val
      return
    process keys
    keyMap

  remapKeys = (object, keyMap) ->
    if _.isArray object
      remapKeys el, keyMap for el in object
    else if typeof object is 'object'
      remapped = {}
      for objKey, val of Object
        remapped[keyMap[objKey]] = remapKeys val, keyMap
      remapped
    else
      object

  # a and b must have the same attributes.
  objEqual = (a, b) ->
    for k of a
      if typeof a[k] is 'object'
        return false unless objEqual a[k], b[k])
      else
        return false unless a[k] is b[k]
    true

  filterObject = (obj, keys) ->
    if _.isArray keys
      subKeys = keys[0]
      filterObject el, subKeys for el in obj
    else if typeof keys is 'object'
      result = {}
      for key, val of keys
        result[key] = filterObject(obj[key], val)
      result
    else
      # TODO: Experiment with rounding methods.
      obj.toFixed keys
)(if typeof exports is 'undefined' then @[MODULE] = {} else exports)
