# Copyright (C) 2012 jareiko / http://www.jareiko.net/

moduleDef = (require, exports, module) ->
  _ = require('underscore')
  async = require("async")

  _getUniqueId = do ->
    nextId = 0
    -> ++nextId

  _pluck = (arr, property) ->
    x[property] for x in arr

  _callAll = (arr) ->
    x() for x in arr
    return

  exports.wrapSync = (fn) ->
    (args...) ->
      callback = args[-1]
      otherArgs = args[0...-1]
      err = fn otherArgs...
      callback err

  _coerceToNode = (value) ->
    if value instanceof exports.Node
      value
    else if value._quiverNode
      value._quiverNode
    else
      new exports.Node(value)

  class exports.Lock
    constructor: ->
      # The first callback in the queue is holding the lock.
      @queue = []

    # callback(release)
    acquire: (callback) ->
      q = @queue
      release = ->
        q.shift()
        # Call the next waiting callback.
        q[0] release if q.length > 0
      q.push callback
      callback(release) if q.length is 1
      return

    isLocked: ->
      @queue.length > 0

  LockedSet = class exports.LockedSet
    constructor: ->
      @nodes = {}

    # callback()
    acquireNode: (node, callback) ->
      if @nodes[node.id]
        callback()
      else
        node.lock.acquire (release) =>
          @nodes[node.id] =
            node: node
            release: release
          callback()
      return

    release: ->
      for nodeId, node of @nodes
        node.release()
      @nodes = {}
      return

  class exports.Node
    constructor: (@payload = {}) ->
      @inputs = []
      @outputs = []
      @updated = false
      @lock = new exports.Lock()
      @id = _getUniqueId()
      # It's probably not a good idea to attach multiple Nodes to the same
      # object, but if you do, the first one keeps the _quiverNode reference.
      @payload._quiverNode or= this

    pushInputs: (values...) ->
      for value in values
        @inputs.push _coerceToNode value
      return

    pushOutputs: (values...) ->
      for value in values
        @outputs.push _coerceToNode value
      return

    # Node, inputs and outputs should be locked before calling.
    execute: (callback) ->
      @updated = true
      if @payload instanceof Function
        inputPayloads = _pluck(@inputs, 'payload')
        outputPayloads = _pluck(@outputs, 'payload')
        @payload inputPayloads, outputPayloads, callback
      else
        callback()
      return

  # callback()
  _walk = exports._walk = (node, nodeInfo, lockedSet, callback, doIn, doOut) ->
    lockedSet.acquireNode node, ->
      nodeInfo[node.id] ?=
        node: node
        deps: []
      tasks = []
      tasks.push(doIn(inNode, tasks)) for inNode in node.inputs
      tasks.push(doOut(outNode, tasks)) for outNode in node.outputs
      async.parallel tasks, (err, results) ->
        if err then throw err
        callback()
    return

  # callback()
  _walkOut = exports._walkOut = (node, nodeInfo, lockedSet, callback) ->
    _walk node, nodeInfo, lockedSet, callback,
      (inNode) -> (cb) ->
        lockedSet.acquireNode inNode, cb
      (outNode) -> (cb) ->
        lockedSet.acquireNode outNode, ->
          done = ->
            nodeInfo[outNode.id].deps.push node.id + ""
            cb()
          if nodeInfo[outNode.id] then done() else
            _walkOut outNode, nodeInfo, lockedSet, done

  # callback()
  _walkIn = exports._walkIn = (node, nodeInfo, lockedSet, callback) ->
    _walk node, nodeInfo, lockedSet, callback,
      (inNode) ->(cb) ->
        lockedSet.acquireNode inNode, ->
          if inNode.updated
            cb()
          else
            nodeInfo[node.id].deps.push inNode.id + ""
            if nodeInfo[inNode.id] then cb() else
              _walkIn inNode, nodeInfo, lockedSet, cb
      (outNode) -> (cb) ->
        lockedSet.acquireNode outNode, cb

  exports.push = (node, callback) ->
    nodeInfo = {}
    releases = []
    lockedSet = new LockedSet()
    tasks = {}
    node = if node instanceof exports.Node then node else node._quiverNode
    _walkOut node, nodeInfo, lockedSet, ->
      for nodeId, info of nodeInfo
        do (info) ->
          tasks[nodeId] = info.deps.concat [
            (cb) ->
              _.defer ->
                info.node.execute cb
          ]
      async.auto tasks, (err, results) ->
        lockedSet.release()
        callback?()
    return

  exports.pull = (node, callback) ->
    nodeInfo = {}
    releases = []
    lockedSet = new LockedSet()
    tasks = {}
    node = if node instanceof exports.Node then node else node._quiverNode
    _walkIn node, nodeInfo, lockedSet, ->
      for nodeId, info of nodeInfo
        do (info) ->
          tasks[nodeId] = info.deps.concat [
            (cb) ->
              _.defer ->
                info.node.execute cb
          ]
      async.auto tasks, (err, results) ->
        lockedSet.release()
        callback?()
    return

  exports.connect = (args...) ->
    tasks = []
    prevNode = null
    ls = new LockedSet
    for arg in args
      node = _coerceToNode arg
      do (prevNode, node) ->
        tasks.push (cb) ->
          ls.acquireNode node, ->
            if prevNode
              prevNode.pushOutputs node
              node.pushInputs prevNode
            cb()
      prevNode = node
    async.parallel tasks, ->
      ls.release()
    return

  return exports

if define?
  define moduleDef
else if exports?
  moduleDef require, exports, module
