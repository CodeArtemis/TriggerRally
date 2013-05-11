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

  jsonClone = (obj) -> JSON.parse JSON.stringify obj

  describe 'StateSampler', ->
    it 'maps keys correctly', ->
      samp = new recorder.StateSampler data1, keys1, 1
      expect(samp.keyMap).toEqual { aa : '0', ab : '1' }

    it 'does one observation', (done) ->
      changeHandler = (index, data) ->
        expect(index).toBe 0
        expect(data).toEqual { 0 : '1', 1 : '2' }
        done()
      samp = new recorder.StateSampler data1, keys1, 1, changeHandler
      samp.observe()

  describe 'StateRecorder', ->
    it 'records correctly', ->
      obj = jsonClone data1
      rec = new recorder.StateRecorder obj, keys1, 1
      rec.observe()
      rec.observe()
      obj.ab = 5
      rec.observe()
      rec.observe()
      result = jsonClone rec
      expected =
        sampler: { freq : 1, keyMap : { 0 : 'aa', 1 : 'ab' } }
        timeline: [
          [ 0, { 0 : '1', 1 : '2' } ]
          [ 2, { 1 : '5' } ]
        ]
      expect(result).toEqual expected
