define [
  'jquery'
  'backbone-full'
  'THREE'
  'util/util'
  'client/car'
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
  clientCar
  gameGame
  gameTrack
  models
  View
  template
  recorder
) ->
  KEYCODE = util.KEYCODE
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
    constructor: (@app, @client, @run) -> super()

    destroy: ->
      @client.setGame null
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
            @game = new gameGame.Game @client.track
            @client.setGame @game

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
              @play1 = new recorder.StatePlayback obj1, run.record_i
              @play2 = new recorder.StatePlayback obj2, run.record_p
              @game.sim.pubsub.on 'step', =>
                @play1.step()
                @play2.step()
                # TODO: check if .complete()

              @restartGame()

          track = models.Track.findOrCreate run.track.id
          track.fetch
            success: ->
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
