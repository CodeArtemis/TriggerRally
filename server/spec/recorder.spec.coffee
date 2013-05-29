describe 'recorder', ->

  # TODO test:
  # key mapping
  # freq (record skipping)
  # playback

  recorder = require '../public/scripts/util/recorder'

  data1 =
    aa: 1
    ab: 2
    ac: 3

  keys1 =
    aa: 2
    ab: 1

  data2 =
    x: 0

  keys2 =
    x: 1

  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  describe 'StateSampler', ->
    it 'maps keys', ->
      samp = new recorder.StateSampler data1, keys1, 1
      expect(samp.keyMap).toEqual { aa: '0', ab: '1' }
      expect(jsonClone samp).toEqual { keyMap: { 0: 'aa', 1: 'ab' } }

    it 'does one observation', (done) ->
      changeHandler = (index, data) ->
        expect(index).toBe 0
        expect(data).toEqual { 0: '1', 1: '2' }
        done()
      samp = new recorder.StateSampler data1, keys1, 1, changeHandler
      samp.observe()

  describe 'StateRecorder', ->
    it 'has the right overall format', ->
      rec = new recorder.StateRecorder data1, keys1, 1
      expect(jsonClone rec).toEqual
        keyMap: { 0: 'aa', 1: 'ab' }
        timeline: []

    it 'records', ->
      obj = jsonClone data2
      rec = new recorder.StateRecorder obj, keys2, 1
      obj.x = 1
      rec.observe()
      rec.observe()
      obj.x = 2
      rec.observe()
      obj.x = 2
      rec.observe()
      obj.x = 3
      rec.observe()
      rec.observe()
      expect(jsonClone(rec).timeline).toEqual [
        [ 0, { 0: '1' } ]
        [ 2, { 0: '2' } ]
        [ 2, { 0: '3' } ]
      ]

    it 'records with freq 2', ->
      obj = jsonClone data2
      rec = new recorder.StateRecorder obj, keys2, 2
      obj.x = 1
      rec.observe()
      obj.x = 2
      rec.observe()
      obj.x = 3
      rec.observe()
      obj.x = 4
      rec.observe()
      rec.observe()
      expect(jsonClone(rec).timeline).toEqual [
        [ 0, { 0: '1' } ]
        [ 2, { 0: '3' } ]
        [ 2, { 0: '4' } ]
      ]

  describe 'StatePlayback', ->

    saved = do ->
      obj = jsonClone data2
      rec = new recorder.StateRecorder obj, keys2, 1
      obj.x = 1
      rec.observe()
      obj.x = 2
      rec.observe()
      obj.x = 3
      rec.observe()
      jsonClone rec

    it 'has the expected test data', ->
      expect(saved).toEqual
        keyMap: { 0: 'x' }
        timeline: [
          [ 0, { 0: '1' } ]
          [ 1, { 0: '2' } ]
          [ 1, { 0: '3' } ]
        ]

    it 'works', ->
      obj = {}
      play = new recorder.StatePlayback obj, saved
      expect(obj).toEqual {}
      play.step()
      expect(obj).toEqual { x: 1 }
      play.step()
      expect(obj).toEqual { x: 2 }
      play.step()
      expect(obj).toEqual { x: 3 }
      play.step()
      expect(obj).toEqual { x: 3 }

    it 'has correct timing', ->
      obj = jsonClone data2
      rec = new recorder.StateRecorder obj, keys2, 2
      obj.x = 1
      rec.observe()
      obj.x = 2
      rec.observe()
      obj.x = 3
      rec.observe()
      saved2 = jsonClone rec

      obj = {}
      play = new recorder.StatePlayback obj, saved2
      expect(obj).toEqual {}
      play.step()
      expect(obj).toEqual { x: 1 }
      play.step()
      expect(obj).toEqual { x: 1 }
      play.step()
      expect(obj).toEqual { x: 3 }
