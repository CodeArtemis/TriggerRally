define [
  'THREE'
  'util/util'
], (
  THREE
  util
) ->
  KEYCODE = util.KEYCODE
  Vec3 = THREE.Vector3
  TWOPI = Math.PI * 2

  tmpVec3 = new Vec3

  class EditorCameraControl
    constructor: (@camera) ->
      @pos = camera.position
      @ang = camera.rotation
      @vel = new Vec3
      @velTarget = new Vec3
      @angVel = new Vec3
      @angVelTarget = new Vec3
      @autoTimer = -1
      @autoPos = new Vec3
      @autoAng = new Vec3

    autoTo: (pos, rot) ->
      Vec3::set.apply @autoPos, pos
      @autoAng.x = 0.9
      @autoAng.z = rot[2] - Math.PI / 2
      @autoPos.x -= 20 * Math.cos(rot[2])
      @autoPos.y -= 20 * Math.sin(rot[2])
      @autoPos.z += 30
      @autoTimer = 0

    rotate: (origin, angX, angZ) ->
      rot = new THREE.Matrix4()
      rot.rotateZ -angZ + @ang.z + Math.PI
      rot.rotateX angX
      rot.rotateZ -@ang.z - Math.PI
      @pos.subSelf origin
      rot.multiplyVector3 @pos
      @pos.addSelf origin
      @ang.x -= angX
      @ang.z -= angZ
      @updateMatrix()

    translate: (vec) ->
      @pos.addSelf vec
      @updateMatrix()

    updateMatrix: ->
      # This seems to fix occasional glitches in THREE.Projector.
      @camera.updateMatrixWorld()

    update: (delta, keyDown, terrainHeight) ->
      SPEED = 30 + 0.8 * Math.max 0, @pos.z - terrainHeight
      VISCOSITY = 20

      @velTarget.set 0, 0, 0
      @angVelTarget.set 0, 0, 0
      if keyDown[KEYCODE.SHIFT] then SPEED *= 3
      if keyDown[KEYCODE.RIGHT] then @velTarget.x += SPEED
      if keyDown[KEYCODE.LEFT] then @velTarget.x -= SPEED
      if keyDown[KEYCODE.UP] then @velTarget.y += SPEED
      if keyDown[KEYCODE.DOWN] then @velTarget.y -= SPEED

      if @autoTimer isnt -1
        @autoTimer = Math.min 1, @autoTimer + delta
        if @autoTimer < 1
          @velTarget.sub @autoPos, @pos
          @velTarget.multiplyScalar delta * 10 * @autoTimer
          @pos.addSelf @velTarget

          @ang.z -= Math.round((@ang.z - @autoAng.z) / TWOPI) * TWOPI
          @velTarget.sub @autoAng, @ang
          @velTarget.multiplyScalar delta * 10 * @autoTimer
          @ang.addSelf @velTarget
        else
          @pos.copy @autoPos
          @ang.copy @autoAng
          @autoTimer = -1
      else
        @velTarget.set(
            @velTarget.x * Math.cos(@ang.z) - @velTarget.y * Math.sin(@ang.z),
            @velTarget.x * Math.sin(@ang.z) + @velTarget.y * Math.cos(@ang.z),
            @velTarget.z)

        mult = 1 / (1 + delta * VISCOSITY)
        @vel.x = @velTarget.x + (@vel.x - @velTarget.x) * mult
        @vel.y = @velTarget.y + (@vel.y - @velTarget.y) * mult
        @vel.z = @velTarget.z + (@vel.z - @velTarget.z) * mult
        @angVel.x = @angVelTarget.x + (@angVel.x - @angVelTarget.x) * mult
        @angVel.y = @angVelTarget.y + (@angVel.y - @angVelTarget.y) * mult
        @angVel.z = @angVelTarget.z + (@angVel.z - @angVelTarget.z) * mult

        @pos.addSelf tmpVec3.copy(@vel).multiplyScalar delta

        @ang.addSelf tmpVec3.copy(@angVel).multiplyScalar delta

      @ang.x = Math.max 0, Math.min 2, @ang.x
