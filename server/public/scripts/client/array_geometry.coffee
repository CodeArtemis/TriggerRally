###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  ArrayGeometry: class ArrayGeometry extends THREE.BufferGeometry
    constructor: ->
      super()
      @attributes["index"] = { array: [] }
      @attributes["position"] = { array: [], itemSize: 3 }
      @attributes["normal"] = { array: [], itemSize: 3 }
      @attributes["uv"] = { array: [], itemSize: 2 }
      @wireframe = false

    doubleTriangles: () ->
      indices = @attributes["index"].array
      newIndices = []
      i = 0
      while i < indices.length - 2
        newIndices.push indices[i+0], indices[i+1], indices[i+1]
        newIndices.push indices[i+2], indices[i+2], indices[i+0]
        i += 3
      @attributes["index"].array = newIndices
      return

    removeIndices: ->
      indices = @attributes['index'].array
      delete @attributes['index']

      for key, attrib of @attributes
        itemSize = attrib.itemSize
        oldArray = attrib.array
        newArray = attrib.array = new Float32Array(indices.length * itemSize)
        for i in [0...indices.length]
          for j in [0...itemSize]
            newArray[i * itemSize + j] = oldArray[indices[i] * itemSize + j]

      @attributes['position'].numItems = indices.length * 3
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
      indices = @attributes["index"].array
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

      for key, attrib of @attributes
        type = if key is "index" then Uint16Array else Float32Array
        attrib.array = new type(attrib.array)
      return

    addGeometry: (geom) ->
      pts = [ 'a', 'b', 'c', 'd' ]
      offsetPosition = @attributes["position"].array.length

      for v in geom.vertices
        @attributes["position"].array.push v.x, v.y, v.z

      for face, faceIndex in geom.faces
        if face.d?
          @attributes["index"].array.push face.a, face.b, face.d
          @attributes["index"].array.push face.b, face.c, face.d
        else
          @attributes["index"].array.push face.a, face.b, face.c

        for norm, pt in face.vertexNormals
          @attributes["normal"].array[face[pts[pt]] * 3 + 0] = norm.x
          @attributes["normal"].array[face[pts[pt]] * 3 + 1] = norm.y
          @attributes["normal"].array[face[pts[pt]] * 3 + 2] = norm.z

        # We support only one channel of UVs.
        uvs = geom.faceVertexUvs[0][faceIndex]
        for uv, pt in uvs
          @attributes["uv"].array[face[pts[pt]] * 2 + 0] = uv.x
          @attributes["uv"].array[face[pts[pt]] * 2 + 1] = uv.y
      return

    mergeMesh: (mesh) ->
      vertexOffset = @attributes["position"].array.length / 3
      geom2 = mesh.geometry
      tmpVec3 = new THREE.Vector3

      if mesh.matrixAutoUpdate then mesh.updateMatrix()

      matrix = mesh.matrix
      matrixRotation = new THREE.Matrix4()
      matrixRotation.extractRotation matrix, mesh.scale

      # Copy vertex data.
      i = 0
      posns = geom2.attributes["position"].array
      norms = geom2.attributes["normal"].array
      hasNorms = norms? and norms.length == posns.length
      while i < posns.length
        tmpVec3.set posns[i + 0], posns[i + 1], posns[i + 2]
        matrix.multiplyVector3 tmpVec3
        @attributes["position"].array.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        if hasNorms
          tmpVec3.set norms[i + 0], norms[i + 1], norms[i + 2]
          matrixRotation.multiplyVector3 tmpVec3
          @attributes["normal"].array.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        i += 3
      @attributes["uv"].array = @attributes["uv"].array.concat geom2.attributes["uv"].array

      # Copy indices.
      for idx in geom2.attributes["index"].array
        @attributes["index"].array.push idx + vertexOffset
      return

    computeBoundingSphere: -> @computeBounds()
    computeBoundingBox: -> @computeBounds()
    computeBounds: ->
      bb =
        min: new THREE.Vector3(Infinity, Infinity, Infinity)
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      maxRadius = 0
      i = 0
      posns = @attributes["position"].array
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

    ###
    createBuffers: (gl) ->

      createBuffer = (array, dataType, itemSize, opt_isElementBuffer) ->
        if array? and array.length > 0
          buffer = gl.createBuffer()
          bufferType = if opt_isElementBuffer then gl.ELEMENT_ARRAY_BUFFER else gl.ARRAY_BUFFER
          gl.bindBuffer bufferType, buffer
          gl.bufferData bufferType, new dataType(array), gl.STATIC_DRAW
          # TODO: Check if itemSize & numItems are really necessary.
          buffer.itemSize = itemSize
          buffer.numItems = array.length
          buffer

      @attributes["index"].buffer = createBuffer @vertexIndexArray, Uint16Array, 1, true
      @attributes["position"].buffer = createBuffer @vertexPositionArray, Float32Array, 3
      @attributes["normal"].buffer = createBuffer @vertexNormalArray, Float32Array, 3
      @attributes["uv"].buffer = createBuffer @vertexUvArray, Float32Array, 2
      return

    render: (program, gl) ->
      if @attributes["index"]?.numItems > 0
        gl.bindBuffer gl.ELEMENT_ARRAY_BUFFER, @attributes["index"]
        ELEMENT_TYPE = gl.UNSIGNED_SHORT
        ELEMENT_SIZE = 2
        PRIMITIVE = if @wireframe then gl.LINES else gl.TRIANGLES
        for offset in @offsets
          @setupBuffers program, gl, offset.index
          gl.drawElements PRIMITIVE, offset.count, ELEMENT_TYPE, offset.start * ELEMENT_SIZE
      else if @attributes["position"].numItems > 0
        @setupBuffers program, gl, 0
        gl.drawArrays gl.TRIANGLES, 0, @attributes["position"].numItems / 3
      return

    setupBuffers: (program, gl, offset) ->
      gl.bindBuffer gl.ARRAY_BUFFER, @attributes["position"]
      gl.vertexAttribPointer program.attributes.position, 3, gl.FLOAT, false, 0, offset * 4 * 3

      if @attributes["normal"]?.length > 0
        gl.bindBuffer gl.ARRAY_BUFFER, @attributes["normal"]
        gl.vertexAttribPointer program.attributes.normal, 3, gl.FLOAT, false, 0, offset * 4 * 3

      if @vertexUvArray?.length > 0
        gl.bindBuffer gl.ARRAY_BUFFER, @attributes["uv"]
        gl.vertexAttribPointer program.attributes.uv, 2, gl.FLOAT, false, 0, offset * 4 * 2

      for name, attrib of @customAttribs
        gl.bindBuffer gl.ARRAY_BUFFER, attrib.buffer
        gl.vertexAttribPointer program.attributes[name], attrib.size, gl.FLOAT, false, 0, offset * 4 * attrib.size
      return
    ###
