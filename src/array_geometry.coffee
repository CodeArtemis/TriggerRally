###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

array_geometry = exports? and @ or @array_geometry = {}

class array_geometry.ArrayGeometry extends THREE.BufferGeometry
  constructor: ->
    super()
    @vertexIndexArray = []
    @vertexPositionArray = []
    @vertexNormalArray = []
    @vertexUvArray = []  # Supports only one channel of UVs.
    @customAttribs = {}

  addCustomAttrib: (name, attrib) ->
    attrib.size ?= 4
    @customAttribs[name] = attrib
    return attrib.array ?= []

  updateOffsets: ->
    # Chop up index array to fit UNSIGNED_SHORT limit.
    # Destructively modifies @vertexIndexArray.
    # TODO: Add OES_element_index_uint support.
    @offsets = []
    offset =
      count: 0
      start: 0
      index: 0
    elem = 0
    maxIndexFound = 0
    PRIMITIVE_SIZE = 3
    MAX_INDEX = 65535
    indices = @vertexIndexArray
    while elem < @vertexIndexArray.length
      maxIndexFound = Math.max maxIndexFound, indices[elem + 0]
      maxIndexFound = Math.max maxIndexFound, indices[elem + 1]
      maxIndexFound = Math.max maxIndexFound, indices[elem + 2]
      if maxIndexFound > offset.index + MAX_INDEX
        # Save this offset and start a new one.
        @offsets.push offset
        minIndex =                    indices[elem + 0]
        minIndex = Math.min minIndex, indices[elem + 1]
        minIndex = Math.min minIndex, indices[elem + 2]
        offset =
          count: 0
          start: elem
          index: minIndex
      indices[elem + 0] -= offset.index
      indices[elem + 1] -= offset.index
      indices[elem + 2] -= offset.index
      elem += PRIMITIVE_SIZE
      offset.count += PRIMITIVE_SIZE
    # Save final offset.
    offset.maxIndexFound = maxIndexFound
    if offset.count > 0 then @offsets.push offset
    if @offsets.length > 1
      console.log 'ArrayGeometry with ' + indices.length/3 + ' triangles split into ' + @offsets.length + ' DrawElements calls.'
    return

  addGeometry: (geom) ->
    pts = [ 'a', 'b', 'c', 'd' ]
    offsetPosition = @vertexPositionArray.length

    for v in geom.vertices
      @vertexPositionArray.push v.x, v.y, v.z

    for face, faceIndex in geom.faces
      if face.d?
        @vertexIndexArray.push face.a, face.b, face.d
        @vertexIndexArray.push face.b, face.c, face.d
      else
        @vertexIndexArray.push face.a, face.b, face.c

      for norm, pt in face.vertexNormals
        @vertexNormalArray[face[pts[pt]] * 3 + 0] = norm.x
        @vertexNormalArray[face[pts[pt]] * 3 + 1] = norm.y
        @vertexNormalArray[face[pts[pt]] * 3 + 2] = norm.z

      # We support only one channel of UVs.
      uvs = geom.faceVertexUvs[0][faceIndex]
      for uv, pt in uvs
        @vertexUvArray[face[pts[pt]] * 2 + 0] = uv.u
        @vertexUvArray[face[pts[pt]] * 2 + 1] = uv.v

    @updateOffsets()
    return

  mergeMesh: (mesh) ->
    vertexOffset = @vertexPositionArray.length / 3
    geom2 = mesh.geometry
    tmpVec3 = new THREE.Vector3

    if mesh.matrixAutoUpdate then mesh.updateMatrix()

    matrix = mesh.matrix
    matrixRotation = new THREE.Matrix4()
    matrixRotation.extractRotation matrix, mesh.scale

    # Copy vertex data.
    i = 0
    posns = geom2.vertexPositionArray
    norms = geom2.vertexNormalArray
    hasNorms = norms? and norms.length == posns.length
    while i < posns.length
      tmpVec3.set posns[i + 0], posns[i + 1], posns[i + 2]
      matrix.multiplyVector3 tmpVec3
      @vertexPositionArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
      if hasNorms
        tmpVec3.set norms[i + 0], norms[i + 1], norms[i + 2]
        matrixRotation.multiplyVector3 tmpVec3
        @vertexNormalArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
      i += 3
    @vertexUvArray = @vertexUvArray.concat geom2.vertexUvArray

    # Copy indices.
    for idx in geom2.vertexIndexArray
      @vertexIndexArray.push idx + vertexOffset

    @updateOffsets()
    return

  computeBoundingSphere: -> @computeBounds()
  computeBoundingBox: -> @computeBounds()
  computeBounds: ->
    bb =
      min: new THREE.Vector3(Infinity, Infinity, Infinity)
      max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    maxRadius = 0
    i = 0
    posns = @vertexPositionArray
    numVerts = posns.length
    while i < numVerts
      x = posns[i + 0]
      y = posns[i + 1]
      z = posns[i + 2]
      bb.min.x = Math.min bb.min.x, x
      bb.max.x = Math.max bb.max.x, x
      bb.min.y = Math.min bb.min.y, y
      bb.max.y = Math.max bb.max.y, y
      bb.min.z = Math.min bb.min.z, z
      bb.max.z = Math.max bb.max.z, z
      radius = Math.sqrt x * x + y * y + z * z
      maxRadius = Math.max maxRadius, radius
      i += 3

    @boundingBox = bb
    @boundingSphere =
      radius: maxRadius
    return

  createBuffers: (gl) ->
    # Indices.
    if @vertexIndexArray? and @vertexIndexArray.length > 0
      @vertexIndexBuffer = gl.createBuffer()
      gl.bindBuffer gl.ELEMENT_ARRAY_BUFFER, @vertexIndexBuffer
      gl.bufferData gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(@vertexIndexArray), gl.STATIC_DRAW
      @vertexIndexBuffer.itemSize = 1
      @vertexIndexBuffer.numItems = @vertexIndexArray.length
      # delete @vertexIndexArray

    @vertexPositionBuffer = gl.createBuffer()
    gl.bindBuffer gl.ARRAY_BUFFER, @vertexPositionBuffer
    gl.bufferData gl.ARRAY_BUFFER, new Float32Array(@vertexPositionArray), gl.STATIC_DRAW
    # Are these itemSize, numItems values really necessary?
    @vertexPositionBuffer.itemSize = 3
    @vertexPositionBuffer.numItems = @vertexPositionArray.length

    if @vertexNormalArray? and @vertexNormalArray.length > 0
      @vertexNormalBuffer = gl.createBuffer()
      gl.bindBuffer gl.ARRAY_BUFFER, @vertexNormalBuffer
      gl.bufferData gl.ARRAY_BUFFER, new Float32Array(@vertexNormalArray), gl.STATIC_DRAW
      @vertexNormalBuffer.itemSize = 3
      @vertexNormalBuffer.numItems = @vertexNormalArray.length

    if @vertexUvArray? and @vertexUvArray.length > 0
      @vertexUvBuffer = gl.createBuffer()
      gl.bindBuffer gl.ARRAY_BUFFER, @vertexUvBuffer
      gl.bufferData gl.ARRAY_BUFFER, new Float32Array(@vertexUvArray), gl.STATIC_DRAW
      @vertexUvBuffer.itemSize = 2
      @vertexUvBuffer.numItems = @vertexUvArray.length

    for name, attrib of @customAttribs
      attrib.buffer = gl.createBuffer()
      gl.bindBuffer gl.ARRAY_BUFFER, attrib.buffer
      gl.bufferData gl.ARRAY_BUFFER, new Float32Array(attrib.array), gl.STATIC_DRAW
      attrib.buffer.itemSize = attrib.size
      attrib.buffer.numItems = attrib.array.length
    return

  render: (program, gl) ->
    if @vertexIndexBuffer? and @vertexIndexBuffer.numItems > 0
      gl.bindBuffer gl.ELEMENT_ARRAY_BUFFER, @vertexIndexBuffer
      ELEMENT_TYPE = gl.UNSIGNED_SHORT
      ELEMENT_SIZE = 2
      for offset in @offsets
        @setupBuffers program, gl, offset.index
        gl.drawElements gl.LINES, offset.count, ELEMENT_TYPE, offset.start * ELEMENT_SIZE
    else
      @setupBuffers program, gl, 0
      gl.drawArrays gl.TRIANGLES, 0, vertexPositionBuffer.numItems / 3
    return

  setupBuffers: (program, gl, offset) ->
    gl.bindBuffer gl.ARRAY_BUFFER, @vertexPositionBuffer
    gl.vertexAttribPointer program.attributes.position, 3, gl.FLOAT, false, 0, offset * 4 * 3

    if @vertexNormalArray? and @vertexNormalArray.length > 0
      gl.bindBuffer gl.ARRAY_BUFFER, @vertexNormalBuffer
      gl.vertexAttribPointer program.attributes.normal, 3, gl.FLOAT, false, 0, offset * 4 * 3

    if @vertexUvArray? and @vertexUvArray.length > 0
      gl.bindBuffer gl.ARRAY_BUFFER, @vertexUvBuffer
      gl.vertexAttribPointer program.attributes.uv, 2, gl.FLOAT, false, 0, offset * 4 * 2

    for name, attrib of @customAttribs
      gl.bindBuffer gl.ARRAY_BUFFER, attrib.buffer
      gl.vertexAttribPointer program.attributes[name], attrib.size, gl.FLOAT, false, 0, offset * 4 * attrib.size
    return
