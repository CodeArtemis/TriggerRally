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
      indices = @index.array
      newIndices = new Uint32Array(indices.length)
      i = 0
      while i < indices.length - 2
        newIndices.push indices[i+0], indices[i+1], indices[i+1]
        newIndices.push indices[i+2], indices[i+2], indices[i+0]
        i += 3
      @index.array = newIndices
      return

    removeIndices: ->
      indices = @index.array
      delete @index

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
      @groups = []
      offset =
        count: 0
        start: 0
      elem = 0
      PRIMITIVE_SIZE = if @wireframe then 2 else 3
      MAX_INDEX = 65535
      minIndexFound = Infinity
      maxIndexFound = 0
      indices = @index.array
      maxElem = indices.length - PRIMITIVE_SIZE + 1
      addOffset = =>
        offset.index = minIndexFound
        for i in [offset.start...elem]
          indices[i] -= minIndexFound
        @groups.push offset
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
      #if @groups.length > 1
      #  console.log 'ArrayGeometry with ' + indices.length/3 + ' triangles split into ' + @groups.length + ' DrawElements calls.'

      for key, attrib of @attributes
        type = if key is "index" then Uint16Array else Float32Array
        attrib.array = new type(attrib.array)
      return

    addGeometry: (geom) ->
      index = [];
      position = [];
      normal = [];
      uv = [];

      index = Array.prototype.slice(@index.array) if @index
      position = Array.prototype.slice(@attributes["position"].array) if @attributes["position"]
      normal = Array.prototype.slice(@attributes["normal"].array) if @attributes["normal"]
      uv = Array.prototype.slice(@attributes["uv"].array) if @attributes["uv"]

      pts = [ 'a', 'b', 'c', 'd' ]
      offsetPosition = position.length

      for v in geom.vertices
        position.push v.x, v.y, v.z

      for face, faceIndex in geom.faces
        if face.d?
          index.push face.a, face.b, face.d
          index.push face.b, face.c, face.d
        else
          index.push face.a, face.b, face.c

        for norm, pt in face.vertexNormals
          normal[face[pts[pt]] * 3 + 0] = norm.x
          normal[face[pts[pt]] * 3 + 1] = norm.y
          normal[face[pts[pt]] * 3 + 2] = norm.z

        # We support only one channel of UVs.
        uvs = geom.faceVertexUvs[0][faceIndex]
        for uv, pt in uvs
          uv[face[pts[pt]] * 2 + 0] = uv.x
          uv[face[pts[pt]] * 2 + 1] = uv.y

      @setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1))
      @addAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3))
      @addAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3))
      @addAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2))
      return

    mergeMesh: (mesh) ->
      index = [];
      position = [];
      normal = [];
      uv = [];

      index = Array.prototype.slice(@index.array) if @index
      position = Array.prototype.slice(@attributes["position"].array) if @attributes["position"]
      normal = Array.prototype.slice(@attributes["normal"].array) if @attributes["normal"]
      uv = Array.prototype.slice(@attributes["uv"].array) if @attributes["uv"]

      vertexOffset = position.length / 3
      geom2 = mesh.geometry
      tmpVec3 = new THREE.Vector3

      if mesh.matrixAutoUpdate then mesh.updateMatrix()

      matrix = mesh.matrix
      matrixRotation = new THREE.Matrix4()
      matrixRotation.extractRotation matrix, mesh.scale

      # Copy vertex data.
      i = 0
      positions2 = geom2.attributes["position"].array
      norms = geom2.attributes["normal"].array
      positionArray = position
      normalArray = normal
      hasNorms = norms? and norms.length == positions2.length
      while i < positions2.length
        tmpVec3.set positions2[i + 0], positions2[i + 1], positions2[i + 2]
        tmpVec3.applyMatrix4 matrix
        positionArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        if hasNorms
          tmpVec3.set norms[i + 0], norms[i + 1], norms[i + 2]
          tmpVec3.applyMatrix4 matrixRotation
          normalArray.push tmpVec3.x, tmpVec3.y, tmpVec3.z
        i += 3
      uv = uv.concat geom2.attributes["uv"].array

      # Copy indices.
      indexArray = index
      for idx in geom2.index.array
        indexArray.push idx + vertexOffset

      @setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1))
      @addAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3))
      @addAttribute("normal", new THREE.BufferAttribute(new Float32Array(normal), 3))
      @addAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2))

      return

    computeBoundingSphere: -> @computeBounds()
    computeBoundingBox: -> @computeBounds()
    computeBounds: ->
      bb =
        min: new THREE.Vector3(Infinity, Infinity, Infinity)
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      maxRadius = 0
      i = 0
      positions2 = @attributes["position"].array
      numVerts = positions2.length
      while i < numVerts
        x = positions2[i + 0]
        y = positions2[i + 1]
        z = positions2[i + 2]
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
        center: new THREE.Vector2()
      return
