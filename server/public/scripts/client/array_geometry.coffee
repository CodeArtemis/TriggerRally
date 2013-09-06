###
# Copyright (C) 2012 jareiko / http://www.jareiko.net/
###

define [
  'THREE'
], (THREE) ->
  ArrayGeometry: class ArrayGeometry extends THREE.BufferGeometry
    constructor: ->
      super()
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
      addOffset = =>
        offset.index = minIndexFound
        for i in [offset.start...elem]
          indices[i] -= minIndexFound
        @offsets.push offset
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
          addOffset()
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
      addOffset() if offset.count > 0
      #if @offsets.length > 1
      #  console.log 'ArrayGeometry with ' + indices.length/3 + ' triangles split into ' + @offsets.length + ' DrawElements calls.'

      for key, attrib of @attributes
        type = if key is "index" then Uint16Array else Float32Array
        attrib.array = new type(attrib.array)
      return

    addGeometry: (geom) ->
      @attributes["index"] ?= { array: [] }
      @attributes["position"] ?= { array: [], itemSize: 3 }
      @attributes["normal"] ?= { array: [], itemSize: 3 }
      @attributes["uv"] ?= { array: [], itemSize: 2 }

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
      @attributes["index"] ?= { array: [] }
      @attributes["position"] ?= { array: [], itemSize: 3 }
      @attributes["normal"] ?= { array: [], itemSize: 3 }
      @attributes["uv"] ?= { array: [], itemSize: 2 }

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
      positionArray = @attributes["position"].array
      normalArray = @attributes["normal"].array
      hasNorms = norms? and norms.length == posns.length
      while i < posns.length
        tmpVec3.set posns[i + 0], posns[i + 1], posns[i + 2]
        matrix.multiplyVector3 tmpVec3
        positionArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        if hasNorms
          tmpVec3.set norms[i + 0], norms[i + 1], norms[i + 2]
          matrixRotation.multiplyVector3 tmpVec3
          normalArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        i += 3
      @attributes["uv"].array = @attributes["uv"].array.concat geom2.attributes["uv"].array

      # Copy indices.
      indexArray = @attributes["index"].array
      for idx in geom2.attributes["index"].array
        indexArray.push idx + vertexOffset
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
