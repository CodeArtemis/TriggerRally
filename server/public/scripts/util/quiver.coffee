# Copyright (C) 2012 jareiko / http://www.jareiko.net/

# Node/CommonJS compatibility.
if typeof define is "undefined"
  define = (fn) ->
    fn require, exports, module

define (require, exports, module) ->
  async = require("async")
  _getUniqueId = (->
    nextId = 0
    ->
      ++nextId
  )()
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
      # The first callback in the queue is always the one currently holding the lock.
      @queue = []

    # callback(release)
    acquire: (callback) ->
      release = ->
        q.shift()
        # Call the next waiting callback.
        q[0] release if q.length > 0
      q = @queue
      q.push callback
      callback(release) if q.length is 1
      return

    isLocked: ->
      @queue.length > 0

  class exports.Node
    constructor: (opt_payload) ->
      @payload = opt_payload or {}
      @dirty = true
      @inputs = []
      @outputs = []
      @lock = new exports.Lock()
      @id = _getUniqueId()
      @payload._quiverNode or (@payload._quiverNode = this)

    pushInputs: (values...) ->
      for value in values
        @inputs.push _coerceToNode value
      return

    pushOutputs: (values...) ->
      for value in values
        @outputs.push _coerceToNode value
      return

    execute: (callback) ->
      if @payload instanceof Function
        inputPayloads = _pluck(@inputs, 'payload')
        outputPayloads = _pluck(@outputs, 'payload')
        @payload inputPayloads, outputPayloads, callback
      else
        callback()
      return

  exports.LockedSet = class LockedSet
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

  # callback()
  _walkOut = exports._walkOut = (node, nodeInfo, lockedSet, callback) ->
    # Lock the node itself.
    lockedSet.acquireNode node, ->
      nodeInfo[node.id] ?=
        node: node
        deps: []
      tasks = []
      # Lock its inputs.
      for inNode in node.inputs
        do (inNode) ->
          tasks.push (cb) ->
            lockedSet.acquireNode inNode, cb
      # Lock its outputs.
      for outNode in node.outputs
        do (outNode) ->
          tasks.push (cb) ->
            lockedSet.acquireNode outNode, ->
              _walkOut outNode, nodeInfo, lockedSet, ->
                # Add ourselves as a dependency.
                nodeInfo[outNode.id].deps.push node.id + ""
                cb()
      async.parallel tasks, (err, results) ->
        if err then throw err
        callback()
    return

  exports.trigger = (nodes...) ->
    nodeInfo = {}
    releases = []
    lockedSet = new LockedSet()
    tasks = {}
    for node in nodes
      _walkOut node, nodeInfo, lockedSet, ->
        tasks[node.id] = (callback) ->
          node.execute callback
      for nodeId, info of nodeInfo
        do (info) ->
          tasks[nodeId] = info.deps.concat [
            (callback) ->
              info.node.execute callback
          ]
      async.auto tasks, (err, results) ->
        lockedSet.release()
    return

  exports.connect = (args...) ->
    prevNode = null
    for arg in args
      node = _coerceToNode arg
      if prevNode
        prevNode.pushOutputs node
        node.pushInputs prevNode
      prevNode = node

  # Like connect, but array arguments will be treated as parallel nodes.
  exports.connectParallel = (args...) ->
    prevNodes = []
    coerceToNodeArray = (value) ->
      if value instanceof Array
        _coerceToNode(val) for val in value
      else
        [_coerceToNode(value)]

    connectNodes = (nodes) ->
      prevNodes.forEach (prevNode) ->
        prevNode.pushOutputs.apply prevNode, nodes

      nodes.forEach (node) ->
        node.pushInputs.apply node, prevNodes

      prevNodes = nodes

    for arg in args
      connectNodes coerceToNodeArray arg
    return
