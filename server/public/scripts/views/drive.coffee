define [
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

    afterRender: ->
      client = @client
      client.camera.idealFov = 75
      client.updateCamera()

      @$countdown = $('#countdown')
      @$runTimer = $('#timer')
      @$checkpoints = $('#checkpoints')

      @game = null

      @app.root.on 'change:track.id', =>

        # TODO: Delete any old game / progress / cars.

        @lastRaceTime = 0
        @updateTimer = yes
        followProgress = null
        @game = new gameGame.Game @client.track

        @client.setGame @game

        car = @app.root.track.env.cars.at(0)
        car.fetch
          success: =>
            @game.addCarConfig car.config, (progress) =>
              console.log 'fetched car config'
              followProgress = progress
              followProgress.on 'advance', =>
                cpNext = followProgress.nextCpIndex
                cpTotal = @app.root.track.config.course.checkpoints.length
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

      $(document).on 'keydown', (event) -> client.onKeyDown event
      $(document).on 'keyup', (event) -> client.onKeyUp event
      client.on 'keydown', (event) =>
        switch event.keyCode
          when KEYCODE['C']
            client.camControl?.nextMode()
          when KEYCODE['R']
            @updateTimer = yes
            @$runTimer.addClass 'running'
            @game.restart()

      return

    setTrackId: (trackId) ->
      track = models.Track.findOrCreate 'ac74h5uA'
      track.fetch
        success: =>
          track.env.fetch
            success: =>
              Backbone.trigger 'app:settrack', track

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
