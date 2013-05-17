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
  'jade!templates/drive'
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

  keys1 =
    brake: 1
    handbrake: 1
    throttle: 1
    turn: 2
  keys2 =
    nextCpIndex: 0
    vehicle:
      body:
        pos: { x: 3, y: 3, z: 3 }
        ori: { x: 3, y: 3, z: 3, w: 3 }
        linVel: { x: 3, y: 3, z: 3 }
        angVel: { x: 3, y: 3, z: 3 }
      wheels: [
        spinVel: 1
      ]
      engineAngVel: 3

  formatRunTime = (time) ->
    mins = Math.floor(time / 60)
    time -= mins * 60
    secs = Math.floor(time)
    time -= secs
    cents = Math.floor(time * 100)
    mins + ':' + padZero(secs, 2) + '.' + padZero(cents, 2)

  # randomChoice = (arr) -> arr[Math.floor Math.random() * arr.length]

  # checkpointMessage = -> randomChoice [
  #   'Yes!'
  #   'Great!'
  #   'Awesome!'
  #   'Excellent!'
  # ]

  class Drive extends View
    template: template
    constructor: (@app, @client) -> super()

    destroy: ->
      @socket?.disconnect()
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
      client.updateCamera()

      @$countdown = @$ '#countdown'
      @$runTimer = @$ '#timer'
      @$checkpoints = @$ '#checkpoints'

      @game = null

      @socket = io.connect '/drive'

      root = @app.root

      @lastRaceTime = 0
      @updateTimer = yes

      do createGame = =>
        return unless root.track?
        @carId = carId = root.getCarId() ? 'ArbusuG'
        carModel = models.Car.findOrCreate carId
        carModel.fetch
          success: =>
            @game = new gameGame.Game @client.track
            @client.setGame @game

            @game.addCarConfig carModel.config, (@progress) =>
              progress.on 'advance', =>
                cpNext = progress.nextCpIndex
                cpTotal = root.track.config.course.checkpoints.length
                @$checkpoints.text "#{cpNext} / #{cpTotal}"

                if cpNext > 1
                  message = if cpNext is cpTotal
                    'Win!'
                  else if cpNext is cpTotal - 1
                    'Nearly there!'
                  else
                    'Checkpoint'
                  @$countdown.text message
                  @$countdown.removeClass 'fadeout'
                  _.defer => @$countdown.addClass 'fadeout'

                return if progress.nextCheckpoint(0)

                # Race complete.
                @updateTimer = no
                @$runTimer.removeClass 'running'

              obj1 = progress.vehicle.controller.input
              obj2 = progress
              @rec1 = new recorder.StateSampler obj1, keys1, 20,  @record_i
              @rec1buffer = []
              @rec2 = new recorder.StateSampler obj2, keys2, 40, @record_p
              @game.sim.pubsub.on 'step', =>
                @rec1.observe()
                @rec2.observe()

              @restartGame()

      @listenTo root, 'change:track', createGame
      # Also recreate game if user or car changes.
      @listenTo root, 'change:user', createGame
      @listenTo root, 'change:user.products', createGame
      @listenTo root, 'change:prefs.car', createGame

    restartGame: ->
      @updateTimer = yes
      @$runTimer.addClass 'running'
      @game.restart()
      # The vehicle controller is recreated after restarting the game.
      @rec1.object = @progress.vehicle.controller.input
      @rec1.restart()
      @rec1buffer = []
      @rec2.restart()

      @socket.emit 'start',
        car: @carId
        track: @app.root.track.id
        keyMap_i: @rec1.toJSON().keyMap
        keyMap_p: @rec2.toJSON().keyMap

    record_i: (offset, state) =>
      # @rec1buffer.push [ offset, state ]
      # if yes #@rec1buffer.length >= 20
      #   @socket.emit 'record_i', samples: @rec1buffer
      #   @rec1buffer = []

    record_p: (offset, state) =>
      # @socket.emit 'record_p', samples: [ [ offset, state ] ]

    setTrackId: (trackId) ->
      track = models.Track.findOrCreate trackId
      track.fetch
        success: =>
          track.env.fetch
            success: =>
              Backbone.trigger 'app:settrack', track
              Backbone.trigger 'app:settitle', track.name
        error: ->
          Backbone.trigger 'app:notfound'

    update: (delta) ->
      if @updateTimer and @game
        raceTime = @game.interpolatedRaceTime()
        if raceTime >= 0
          if @lastRaceTime < 0
            @$countdown.text 'Go!'
            @$countdown.addClass 'fadeout'
          @$runTimer.text formatRunTime raceTime
        else
          num = Math.ceil -raceTime
          lastNum = Math.ceil -@lastRaceTime
          if num != lastNum
            @$runTimer.text ""
            @$countdown.text '' + num
            @$countdown.removeClass 'fadeout'
        @lastRaceTime = raceTime
