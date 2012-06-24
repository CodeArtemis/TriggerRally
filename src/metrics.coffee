###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

metrics = exports? and @ or @metrics = {}

class metrics.MetricsRecorder
  constructor: () ->
    @clock = 0
    @slices = [ @_createSlice(0, 1) ]
    @duration = 0.5
    return

  _createSlice: (timeFrom, timeTo) ->
    timeFrom: timeFrom
    timeTo: timeTo
    histogram: {}

  record: (dt) ->
    return unless dt > 0

    @clock += dt

    slice = _.last @slices
    while @clock >= slice.timeTo
      @duration *= 2
      slice = @_createSlice slice.timeTo, slice.timeTo + @duration
      @slices.push slice

    dtMsRounded = Math.round(dt * 1000)
    slice = _.last @slices

    oldValue = slice.histogram[dtMsRounded] || 0
    slice.histogram[dtMsRounded] = oldValue + 1

  dump: ->
    timeSlices: @slices
