###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  ArrayGeometry: class ArrayGeometry extends THREE.BufferGeometry
    constructor: ->
      super()
      @vertexIndexArray = []
      @vertexPositionArray = []
      @vertexNormalArray = []
      @vertexUvArray = []  # Supports only one channel of UVs.
      @customAttribs = {}
      @wireframe = false

    addCustomAttrib: (name, attrib) ->
      attrib.size ?= 4
      @customAttribs[name] = attrib
      return attrib.array ?= []

    doubleTriangles: () ->
      indices = @vertexIndexArray
      newIndices = []
      i = 0
      while i < indices.length - 2
        newIndices.push indices[i+0], indices[i+1], indices[i+1]
        newIndices.push indices[i+2], indices[i+2], indices[i+0]
        i += 3
      @vertexIndexArray = newIndices
      return

    updateOffsets: ->
      # Destrutively chop up index array to fit UNSIGNED_SHORT limit.
      # TODO: Add OES_element_index_uint support.
      if @wireframe then @doubleTriangles()
      @offsets = []
      offset =
        count: 0
        start: 0
      elem = 0
      PRIMITIVE_SIZE = if @wireframe then 2 else 3
      MAX_INDEX = 65535
      minIndexFound = Infinity
      maxIndexFound = 0
      indices = @vertexIndexArray
      maxElem = indices.length - PRIMITIVE_SIZE + 1
      while elem < maxElem
        primMinIndex = Infinity
        primMaxIndex = 0
        for i in [0...PRIMITIVE_SIZE]
          primMinIndex = Math.min primMinIndex, indices[elem + i]
          primMaxIndex = Math.max primMaxIndex, indices[elem + i]
        newMinIndexFound = Math.min minIndexFound, primMinIndex
        newMaxIndexFound = Math.max maxIndexFound, primMaxIndex
        if newMaxIndexFound - newMinIndexFound > MAX_INDEX
          # New primitive doesn't fit. Save this offset and start a new one.
          offset.index = minIndexFound
          for i in [offset.start...elem]
            indices[i] -= offset.index
          @offsets.push offset
          offset =
            count: 0
            start: elem
          minIndexFound = primMinIndex
          maxIndexFound = primMaxIndex
        else
          minIndexFound = newMinIndexFound
          maxIndexFound = newMaxIndexFound
        elem += PRIMITIVE_SIZE
        offset.count += PRIMITIVE_SIZE
      # Save final offset.
      if offset.count > 0
        offset.index = minIndexFound
        for i in [offset.start...elem]
          indices[i] -= offset.index
        @offsets.push offset
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
        PRIMITIVE = if @wireframe then gl.LINES else gl.TRIANGLES
        for offset in @offsets
          @setupBuffers program, gl, offset.index
          gl.drawElements PRIMITIVE, offset.count, ELEMENT_TYPE, offset.start * ELEMENT_SIZE
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
