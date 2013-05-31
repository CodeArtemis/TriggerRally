define [
  'cs!views/view'
  'jade!templates/music'
], (
  View
  template
) ->
  baseUrl = '/radio/'
  tracksSrc =
    'Alex Beroza':
      'Art Now': 'AlexBeroza_-_Art_Now.ogg'
      'Brake Dance': 'AlexBeroza_-_Brake_Dance.ogg'
      'Could Be': 'AlexBeroza_-_Could_Be.ogg'
      'Emerge In Love': 'AlexBeroza_-_Emerge_In_Love.ogg'  # 5
      'In Peace': 'AlexBeroza_-_In_Peace.ogg'
    'Carl and the Saganauts':
      # 'Trigger Theme 1': 'saganauts-tr1.ogg'
      # 'Theme 2': 'saganauts-tr2.ogg'
      'Trigger Rally Theme': 'saganauts-tr4.ogg'
    'Citizen X0':
      'Art is Born': 'Citizen_X0_-_Art_is_Born.ogg'
    'DoKashiteru':
      '2025': 'DoKashiteru_-_2025.ogg'
    'Dubslate':
      'Nervous Refix': 'dubslate_-_nervous_refix.ogg'
    'J.Lang':
      'Love Will Open Your Heart Dance Mix': 'djlang59_-_Love_Will_Open_Your_Heart_Dance_Mix.ogg'
    'Sawtooth':
      'Carcinogens': 'Sawtooth_-_Carcinogens.ogg'
    'SpinningMerkaba':
      '260809 Funky Nurykabe': 'jlbrock44_-_260809_Funky_Nurykabe.ogg'
    'Super Sigil':
      'Thunderlizard at the Art War': 'Super_Sigil_-_Thunderlizard_at_the_Art_War.ogg'
    'Travis Morgan':
      'pROgraM vs. Us3R': 'morgantj_-_pROgraM_vs._Us3R.ogg'
  tracks = []
  for artist, val of tracksSrc
    for title, src of val
      tracks.push { artist, title, src }

  class MusicView extends View
    tagName: 'span'
    className: 'dropdownmenu'
    template: template

    constructor: (@app) -> super()

    afterRender: ->
      prefs = @app.root.prefs

      $audio = @$ 'audio'
      $title = @$ '.title'
      $artist = @$ '.artist'
      $status = @$ '.status'
      $volume = @$ 'input.volume'
      $playpause = @$ '.musiccontrol.playpause'
      $next = @$ '.musiccontrol.next'

      $audio.on 'all'

      track = null

      updateStatus = ->
        if prefs.musicplay
          $status.text "(#{track.title} by #{track.artist})"
        else
          $status.text "(paused)"

      idx = -1
      recent = []
      playNext = ->
        prefs.musicplay = yes
        pickRandom = -> Math.floor Math.random() * tracks.length
        while true
          idx = pickRandom()
          break if idx not in recent
        recent = recent.slice(-5)
        recent.push idx
        track = tracks[idx]
        $audio.attr 'src', baseUrl + track.src
        $artist.text track.artist
        $title.text track.title
        updateStatus()

      # $audio.prop 'autoplay', yes  # Done in template.
      $audio[0].volume = 0.5

      $audio.on 'ended', playNext
      $next.on 'click', playNext

      do updatePlay = ->
        $playpause.toggleClass 'play', not prefs.musicplay
        $playpause.toggleClass 'pause', prefs.musicplay
        if prefs.musicplay
          if track
            updateStatus()
            $audio[0].play()
          else
            playNext()
        else
          updateStatus()
          $audio[0].pause()
      $playpause.on 'click', -> prefs.musicplay = not prefs.musicplay
      prefs.on 'change:musicplay', updatePlay

      do updateVolume = ->
        $volume.val prefs.musicvolume
        $audio[0].volume = prefs.musicvolume
      $volume.on 'change', -> prefs.musicvolume = $volume.val()
      prefs.on 'change:musicvolume', updateVolume
