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

  # Modify a game to make it track gameMaster and run.
  # Injects a new update method into the game.
  syncReplayGame = (game, progress, gameMaster, run) ->
    obj1 = progress.vehicle.controller.input
    obj2 = progress
    play1 = new recorder.StatePlayback obj1, run.record_i
    play2 = new recorder.StatePlayback obj2, run.record_p

    game.sim.pubsub.on 'step', ->
      play1.step()
      play2.step()

    originalUpdate = game.update

    game.update = (deltaIgnored) ->
      masterTime = gameMaster.sim.interpolatedTime()
      delta = masterTime - game.sim.interpolatedTime()
      if delta > 0
        originalUpdate.call game, delta
      else if delta < 0
        game.restart()
        # The vehicle controller is recreated after restarting the game.
        play1.object = progress.vehicle.controller.input
        play1.restart()
        play2.restart()
        originalUpdate.call game, masterTime
      return
    return

  class Drive extends View
    template: template
    constructor: (@app, @client) -> super()

    initialize: ->
      @replayRun = null
      @replayGame = null

    destroy: ->
      Backbone.trigger 'statusbar:hidechallenge'

      @socket?.disconnect()
      @game.destroy()
      @replayGame?.destroy()
      super

    onKeyDown: (event) ->
      return if event.shiftKey or event.metaKey or event.ctrlKey or event.altKey
      switch event.keyCode
        when KEYCODE['C']
          @client.camControl?.nextMode()
        when KEYCODE['R']
          @restartGame() if @game

    afterRender: ->
      root = @app.root

      Backbone.trigger 'statusbar:showchallenge'

      client = @client
      client.camera.idealFov = 75
      client.updateCamera()

      @$countdown = @$ '.countdown'
      @$runTimer = @$ '.timer'
      @$checkpoints = @$ '.checkpoints'
      @$splitTime = @$ '.split-time'

      do updateChallenge = =>
        @$runTimer.toggleClass 'hidden', root.prefs.challenge is 'none'
        @$splitTime.toggleClass 'hidden', root.prefs.challenge in [ 'none', 'clock' ]
      @listenTo root, 'change:prefs.challenge', updateChallenge
      @listenTo root, 'change:prefs.challenge', =>
        # This isn't triggered at startup, only on changes.
        @useChallengeRun()

      @game = null

      @socket = io.connect '/drive'
      @socket.on 'connect_failed', -> Backbone.trigger 'app:status', 'Socket connect failed'
      @socket.on 'disconnect', -> Backbone.trigger 'app:status', 'Socket disconnected'
      @socket.on 'error', -> Backbone.trigger 'app:status', 'Socket error'
      @socket.on 'reconnect', -> Backbone.trigger 'app:status', 'Socket reconnected'
      @socket.on 'reconnect_failed', -> Backbone.trigger 'app:status', 'Socket reconnect failed'

      @lastRaceTime = 0
      @updateTimer = yes

      do createGame = =>
        return unless root.track?
        @trackId = root.track.id
        @setRun null if @replayRun and @replayRun.track.id isnt root.track.id
        @carId = carId = root.getCarId() ? 'ArbusuG'
        carModel = models.Car.findOrCreate carId
        carModel.fetch
          success: =>
            return if @destroyed
            @game.destroy() if @game
            @game = new gameGame.Game @client.track
            @client.addGame @game
            @createReplayGame()

            @game.addCarConfig carModel.config, (@progress) =>
              progress.on 'advance', => @advance()

              obj1 = progress.vehicle.controller.input
              obj2 = progress
              @rec1 = new recorder.StateSampler obj1, keys1, 20, @record_i
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

    updateSplit: ->
      idx = @progress?.cpTimes.length - 1
      if @replayRun and idx >= 0
        diff = @progress.cpTimes[idx] - @replayRun.times[idx] - @game.startTime
        minus = diff < 0
        text = if minus
          '-' + formatRunTime -diff
        else
          '+' + formatRunTime diff
        @$splitTime.text text
        @$splitTime.removeClass 'hidden'
        @$splitTime.toggleClass 'minus', minus
        if minus and not @app.root.user
          Backbone.trigger 'app:status', 'You\'re leading! Log in to save your score!'
      else
        @$splitTime.addClass 'hidden'

    restartGame: ->
      @updateTimer = yes
      @$runTimer.addClass 'running'
      @splitTimes = []
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
      @rec1buffer.push [ offset, state ]
      if yes #@rec1buffer.length >= 20
        @socket.emit 'record_i', samples: @rec1buffer
        @rec1buffer = []

    record_p: (offset, state) =>
      @socket.emit 'record_p', samples: [ [ offset, state ] ]

    advance: ->
      cpNext = @progress.nextCpIndex
      cpTotal = @app.root.track.config.course.checkpoints.length
      @$checkpoints.text "#{cpNext} / #{cpTotal}"

      @updateSplit()

      # if cpNext > 0
      #   cp = cpNext - 1
      #   data = { cp, time: @progress.cpTimes[cp] }
      #   @socket.emit 'advance', data

      if cpNext > 1
        message = if cpNext is cpTotal
          'Finished!'
        else if cpNext is cpTotal - 1
          'Nearly there!'
        else
          'Checkpoint'
        @$countdown.text message
        @$countdown.removeClass 'fadeout'
        _.defer => @$countdown.addClass 'fadeout'

      return if @progress.nextCheckpoint(0)

      # Race complete.
      @updateTimer = no
      @$runTimer.removeClass 'running'

      startTime = @game.startTime
      times = (time - startTime for time in @progress.cpTimes)
      @socket.emit 'times', { times }

    setTrackId: (@trackId) ->
      track = models.Track.findOrCreate trackId
      track.fetch
        success: =>
          track.env.fetch
            success: =>
              return if @destroyed
              Backbone.trigger 'app:settrack', track
              Backbone.trigger 'app:settitle', track.name
        error: ->
          Backbone.trigger 'app:notfound'

    setRunId: (runId) ->
      @setRun models.Run.findOrCreate runId

    useChallengeRun: ->
      @setRun null
      challenge = @app.root.prefs.challenge
      switch challenge
        when 'world'
          trackRuns = models.TrackRuns.findOrCreate @trackId
          trackRuns.fetch
            success: =>
              @setRun trackRuns.runs.at(0)
      # type = switch challenge
      #   when 'world' then 'runs'
      #   when 'personal' then 'personalruns'
      # return unless type
      # url = "/v1/tracks/#{@trackId}/#{type}"
      # $.ajax(url)
      # .done (data) =>
      #   return unless data.run
      #   run = models.Run.findOrCreate data.run.id
      #   run.set run.parse data.run
      #   @setRun run

    cleanUrl: ->
      Backbone.history.navigate "/track/#{@trackId}/drive"

    setRun: (run) ->
      # TODO: Clean up old run?
      @replayRun = null
      @replayGame?.destroy()
      @replayGame = null

      return @cleanUrl() unless run

      if run.record_p
        @setRunInternal run
      else
        run.fetch
          force: yes
          success: => @setRunInternal run
          error: => @cleanUrl()

    setRunInternal: (run) ->
      @replayRun = run
      @createReplayGame()

    createReplayGame: ->
      # TODO: Check that replayGame matches replayRun?
      return if @replayGame
      return unless @replayRun and @game
      car = models.Car.findOrCreate @replayRun.car.id
      car.fetch success: =>
        return if @destroyed
        @replayGame = new gameGame.Game @client.track
        @replayGame.addCarConfig car.config, (progress) =>
          syncReplayGame @replayGame, progress, @game, @replayRun
        @client.addGame @replayGame, isGhost: yes

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
