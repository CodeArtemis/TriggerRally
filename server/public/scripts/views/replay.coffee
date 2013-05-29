define [
  'jquery'
  'backbone-full'
  'THREE'
  'util/util'
  'cs!util/util2'
  'client/car'
  'cs!client/editor_camera'
  'game/game'
  'game/track'
  'cs!models/index'
  'cs!views/view'
  'jade!templates/drive'  # Yes, we use the drive template.
  'cs!util/recorder'
], (
  $
  Backbone
  THREE
  util
  util2
  clientCar
  EditorCameraControl
  gameGame
  gameTrack
  models
  View
  template
  recorder
) ->
  { MB } = util2
  { KEYCODE } = util
  Vec3 = THREE.Vector3

  padZero = (val, digits) ->
    (1e15 + val + '').slice(-digits)

  formatRunTime = (time) ->
    mins = Math.floor(time / 60)
    time -= mins * 60
    secs = Math.floor(time)
    time -= secs
    cents = Math.floor(time * 100)
    mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2)

  class Replay extends View
    template: template
    className: 'no-pointer-events'
    constructor: (@app, @client, @run) -> super()

    destroy: ->
      @game?.destroy()
      super

    onKeyDown: (event) ->
      switch event.keyCode
        when KEYCODE['C']
          @client.camControl?.nextMode()
        when KEYCODE['R']
          @restartGame() if @game

    afterRender: ->
      client = @client
      client.camera.idealFov = 75
      client.camera.useQuaternion = no
      client.updateCamera()

      @camControl = new EditorCameraControl client.camera
      @cursor =
        hit: null
        pos: new Vec3
      @buttons = @mouseX = @mouseY = 0

      @$countdown = @$ '#countdown'
      @$runTimer = @$ '#timer'
      @$checkpoints = @$ '#checkpoints'

      @game = null

      root = @app.root

      @lastRaceTime = 0
      @updateTimer = yes

      run = @run
      run.fetch
        success: =>
          done = _.after 2, =>
            @game?.destroy()
            @game = new gameGame.Game @client.track
            @client.addGame @game

            @game.addCarConfig car.config, (@progress) =>
              progress.vehicle.cfg.isReplay = yes
              progress.on 'advance', =>
                cpNext = progress.nextCpIndex
                cpTotal = root.track.config.course.checkpoints.length
                @$checkpoints.html "#{cpNext} / #{cpTotal}"

                return if progress.nextCheckpoint(0)

                # Race complete.
                @updateTimer = no
                @$runTimer.removeClass 'running'

              obj1 = progress.vehicle.controller.input
              obj2 = progress
              @play1 = new recorder.StatePlaybackInterpolated obj1, run.record_i
              @play2 = new recorder.StatePlaybackInterpolated obj2, run.record_p
              @game.sim.pubsub.on 'step', =>
                @play1.step()
                @play2.step()
                # TODO: check if .complete()

              @restartGame()

          track = models.Track.findOrCreate run.track.id
          track.fetch
            success: =>
              startposition = track.config.course.startposition
              @camControl.autoTo startposition.pos, startposition.rot
              track.env.fetch
                success: ->
                  Backbone.trigger 'app:settrack', track
                  Backbone.trigger 'app:settitle', track.name
                  done()
          car = models.Car.findOrCreate run.car.id
          car.fetch success: done
        error: ->
          Backbone.trigger 'app:notfound'

    restartGame: ->
      @updateTimer = yes
      @$runTimer.addClass 'running'
      @game.restart()
      # The vehicle controller is recreated after restarting the game.
      @play1.object = @progress.vehicle.controller.input
      @play1.restart()
      @play2.restart()

    update: (delta) ->
      terrainHeight = 0
      if @client.track?
        terrainHeight = (@client.track.terrain.getContactRayZ @camControl.pos.x, @camControl.pos.y).surfacePos.z
      @camControl.update delta, @client.keyDown, terrainHeight

      if @updateTimer and @game
        raceTime = @game.interpolatedRaceTime()
        if raceTime >= 0
          if @lastRaceTime < 0
            @$countdown.html 'Go!'
            @$countdown.addClass 'fadeout'
          @$runTimer.html formatRunTime raceTime
        else
          num = Math.ceil -raceTime
          lastNum = Math.ceil -@lastRaceTime
          if num != lastNum
            @$runTimer.html ""
            @$countdown.html '' + num
            @$countdown.removeClass 'fadeout'
        @lastRaceTime = raceTime

    onMouseDown: (event) ->
      @buttons |= 1 << event.button
      event.preventDefault()
      false

    onMouseUp: (event) ->
      @buttons &= ~(1 << event.button)
      event.preventDefault()
      false

    findObject: (mouseX, mouseY) ->
      isect = @client.findObject mouseX, mouseY
      obj.distance += 10 for obj in isect when obj.type is 'terrain'
      isect.sort (a, b) -> a.distance > b.distance
      isect[0]

    onMouseMove: (event) ->
      motionX = event.offsetX - @mouseX
      motionY = event.offsetY - @mouseY
      angX = motionY * 0.01
      angZ = motionX * 0.01
      @mouseX = event.offsetX
      @mouseY = event.offsetY
      unless @buttons & (MB.LEFT | MB.MIDDLE) and @cursor.hit
        @cursor.hit = @findObject @mouseX, @mouseY
        Vec3::set.apply @cursor.pos, @cursor.hit.object.pos if @cursor.hit
      else
        rotateMode = (event.altKey and @buttons & MB.LEFT) or @buttons & MB.MIDDLE
        viewRay = @client.viewRay @mouseX, @mouseY
        cursorPos = @cursor.pos
        planeHit = if event.shiftKey
          util2.intersectZLine viewRay, cursorPos
        else
          util2.intersectZPlane viewRay, cursorPos
        return unless planeHit
        relMotion = planeHit.pos.clone().subSelf cursorPos

        if rotateMode
          @camControl.rotate cursorPos, angX, angZ
        else
          relMotion.multiplyScalar -1
          @camControl.translate relMotion
      return

    scroll: (scrollY, event) ->
      return unless @cursor.hit
      vec = @camControl.pos.clone().subSelf @cursor.pos
      vec.multiplyScalar Math.exp(scrollY * -0.002) - 1
      @camControl.translate vec
      event.preventDefault()
      return

    onMouseWheel: (event) ->
      origEvent = event.originalEvent
      deltaY = origEvent.wheelDeltaY ? origEvent.deltaY
      @scroll deltaY, event
