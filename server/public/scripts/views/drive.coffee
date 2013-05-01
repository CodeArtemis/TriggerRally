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

  class Drive extends View
    template: template
    constructor: (@app, @client) -> super()

    destroy: ->
      @client.setGame null
      super

    notifyDrive: ->
      # TODO: Make Track model responsible for doing this.
      # Will require some kind of special sync code.
      $.ajax "/v1/tracks/#{@app.root.track.id}/drive", type: 'POST'

    onKeyDown: (event) ->
      switch event.keyCode
        when KEYCODE['C']
          @client.camControl?.nextMode()
        when KEYCODE['R']
          @updateTimer = yes
          @$runTimer.addClass 'running'
          @game?.restart()
          @notifyDrive()

    afterRender: ->
      client = @client
      client.camera.idealFov = 75
      client.updateCamera()

      @$countdown = @$('#countdown')
      @$runTimer = @$('#timer')
      @$checkpoints = @$('#checkpoints')

      @game = null

      root = @app.root

      # @startGame()
      # @listenTo root, 'change:track.id', => @startGame()

      @lastRaceTime = 0
      @updateTimer = yes
      followProgress = null

      do createGame = =>
        return unless root.track?
        carId = root.getCarId() ? 'ArbusuG'
        carModel = models.Car.findOrCreate carId
        carModel.fetch
          success: =>
            @game = new gameGame.Game @client.track
            @client.setGame @game
            @updateTimer = yes
            @$runTimer.addClass 'running'
            @notifyDrive()

            @game.addCarConfig carModel.config, (progress) =>
              followProgress = progress
              @listenTo followProgress, 'advance', =>
                cpNext = followProgress.nextCpIndex
                cpTotal = root.track.config.course.checkpoints.length
                @$checkpoints.html "#{cpNext} / #{cpTotal}"

                return if followProgress.nextCheckpoint(0)

                # Race complete.
                @updateTimer = no
                @$runTimer.removeClass 'running'
                #if !TRIGGER.RUN
                #  if TRIGGER.USER_LOGGED_IN
                #    _.delay(uploadRun, 1000)
                #  else
                #    # We can't save the run, but show a Twitter link.
                #    showTwitterLink()

      @listenTo root, 'change:track', createGame
      # Also recreate game if user or car changes.
      @listenTo root, 'change:user', createGame
      @listenTo root, 'change:user.products', createGame
      @listenTo root, 'change:prefs.car', createGame

    setTrackId: (trackId) ->
      track = models.Track.findOrCreate trackId
      track.fetch
        success: =>
          track.env.fetch
            success: =>
              Backbone.trigger 'app:settrack', track
              Backbone.trigger 'app:settitle', track.name

    update: (delta) ->
      if @updateTimer and @game
        raceTime = @game.interpolatedRaceTime()
        if raceTime >= 0
          if @lastRaceTime < 0
            @$countdown.html 'Go!'
            @$countdown.addClass 'fadeout'
            if followProgress?
              @$checkpoints.html followProgress.nextCpIndex + ' / ' + @game.track.checkpoints.length
          @$runTimer.html formatRunTime raceTime
        else
          num = Math.ceil -raceTime
          lastNum = Math.ceil -@lastRaceTime
          if num != lastNum
            @$runTimer.html ""
            @$countdown.html '' + num
            @$countdown.removeClass 'fadeout'
        @lastRaceTime = raceTime
