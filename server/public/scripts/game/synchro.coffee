###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'util/pubsub'
], (utilPubsub) ->
  filterObject = (obj, keys) ->
    if _.isArray keys
      subKeys = keys[0]
      for el in obj
        filterObject el, subKeys
    else if typeof keys is 'object'
      result = {}
      for key, val of keys
        result[key] = filterObject obj[key], val
      result
    else
      # Assume number.
      # TODO: Experiment with rounding methods.
      obj.toFixed keys

  # Returns only values in a that differ from those in b.
  # a and b must have the same attributes.
  # Arrays may (currently) only contain objects.
  objDiff = (a, b) ->
    diff = {}
    for k, aVal of a
      bVal = b[k]
      if _.isArray aVal
        changed = false
        c = []
        for el, index in aVal
          r = objDiff el, bVal[index]
          changed = true unless _.isEmpty r
          c.push r
        diff[k] = c if changed
      else if typeof aVal is 'object'
        c = objDiff aVal, bVal
        diff[k] = c unless _.isEmpty c
      else
        diff[k] = aVal unless aVal is bVal
    diff

  applyDiff = (obj, diff, keyMap) ->
    if _.isArray diff
      for el, index in diff
        # No remapping for array indices.
        obj[index] = applyDiff obj[index], el, keyMap
      obj
    else if typeof diff is 'object'
      if keyMap
        for key, val of diff
          obj[keyMap[key]] = applyDiff obj[keyMap[key]], val, keyMap
      else
        for key, val of diff
          obj[key] = applyDiff obj[key], val
      obj
    else
      parseFloat diff

  KEYS = {
    nextCpIndex: 0,
    vehicle: {
      body: {
        pos: {x:3,y:3,z:3},
        ori: {x:3,y:3,z:3,w:3},
        linVel: {x:3,y:3,z:3},
        angMom: {x:3,y:3,z:3}
      },
      wheels: [{
        spinVel: 1
      }],
      engineAngVel: 3,
      controller: {
        input: {
          forward: 0,
          back: 0,
          left: 0,
          right: 0,
          handbrake: 0
        }
      }
    }
  }

  # TODO: Remap keys (a la recorder.js) to reduce wire bandwidth.

  Synchro: class Synchro
    constructor: (@game) ->
      @socket = io.connect '/'

      pubsub = new utilPubsub.PubSub()
      @on = pubsub.subscribe.bind pubsub

      game.on 'addvehicle', (vehicle, progress) =>
        unless vehicle.cfg.isRemote
          @_sendVehicleUpdates vehicle, progress
        return

      progresses = {}

      @socket.on 'addcar', (data) ->
        { wireId, config } = data
        if config? and not progresses[wireId]?
          game.addCarConfig config, (progress) ->
            progresses[wireId] = progress

      @socket.on 'deletecar', (data) ->
        { wireId } = data
        if progresses[wireId]?
          game.deleteCar progresses[wireId]
          delete progresses[wireId]

      @socket.on 's2c', (data) ->
        { wireId, carstate } = data
        progress = progresses[wireId]
        # TODO: Blend in new state.
        applyDiff progress, carstate if progress?
        return

    _sendVehicleUpdates: (vehicle, progress) ->
      # We will send updates about this car to the server.
      @socket.emit 'c2s',
        config: vehicle.cfg
      lastState = null
      setInterval =>
        state = filterObject progress, KEYS
        if lastState?
          diff = objDiff state, lastState
          lastState = state
          unless _.isEmpty diff
            @socket.emit 'c2s',
              carstate: diff
        else
          lastState = state
      , 200
      return
