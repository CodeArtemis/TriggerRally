/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
describe('recorder', function() {

  // TODO test:
  // key mapping
  // freq (record skipping)
  // playback

  const recorder = require('../public/scripts/util/recorder');

  const data1 = {
    aa: 1,
    ab: 2,
    ac: 3
  };

  const keys1 = {
    aa: 2,
    ab: 1
  };

  const data2 =
    {x: 0};

  const keys2 =
    {x: 1};

  const jsonClone = obj => JSON.parse(JSON.stringify(obj));

  describe('StateSampler', function() {
    it('maps keys', function() {
      const samp = new recorder.StateSampler(data1, keys1, 1);
      expect(samp.keyMap).toEqual({ aa: '0', ab: '1' });
      return expect(jsonClone(samp)).toEqual({ keyMap: { 0: 'aa', 1: 'ab' } });
  });

    return it('does one observation', function(done) {
      const changeHandler = function(index, data) {
        expect(index).toBe(0);
        expect(data).toEqual({ 0: '1', 1: '2' });
        return done();
      };
      const samp = new recorder.StateSampler(data1, keys1, 1, changeHandler);
      return samp.observe();
    });
  });

  describe('StateRecorder', function() {
    it('has the right overall format', function() {
      const rec = new recorder.StateRecorder(data1, keys1, 1);
      return expect(jsonClone(rec)).toEqual({
        keyMap: { 0: 'aa', 1: 'ab' },
        timeline: []});
  });

    it('records', function() {
      const obj = jsonClone(data2);
      const rec = new recorder.StateRecorder(obj, keys2, 1);
      obj.x = 1;
      rec.observe();
      rec.observe();
      obj.x = 2;
      rec.observe();
      obj.x = 2;
      rec.observe();
      obj.x = 3;
      rec.observe();
      rec.observe();
      return expect(jsonClone(rec).timeline).toEqual([
        [ 0, { 0: '1' } ],
        [ 2, { 0: '2' } ],
        [ 2, { 0: '3' } ]
      ]);
  });

    return it('records with freq 2', function() {
      const obj = jsonClone(data2);
      const rec = new recorder.StateRecorder(obj, keys2, 2);
      obj.x = 1;
      rec.observe();
      obj.x = 2;
      rec.observe();
      obj.x = 3;
      rec.observe();
      obj.x = 4;
      rec.observe();
      rec.observe();
      return expect(jsonClone(rec).timeline).toEqual([
        [ 0, { 0: '1' } ],
        [ 2, { 0: '3' } ],
        [ 2, { 0: '4' } ]
      ]);
  });
});

  return describe('StatePlayback', function() {

    const saved = (function() {
      const obj = jsonClone(data2);
      const rec = new recorder.StateRecorder(obj, keys2, 1);
      obj.x = 1;
      rec.observe();
      obj.x = 2;
      rec.observe();
      obj.x = 3;
      rec.observe();
      return jsonClone(rec);
    })();

    it('has the expected test data', () =>
      expect(saved).toEqual({
        keyMap: { 0: 'x' },
        timeline: [
          [ 0, { 0: '1' } ],
          [ 1, { 0: '2' } ],
          [ 1, { 0: '3' } ]
        ]})
  );

    it('works', function() {
      const obj = {};
      const play = new recorder.StatePlayback(obj, saved);
      expect(obj).toEqual({});
      play.step();
      expect(obj).toEqual({ x: 1 });
      play.step();
      expect(obj).toEqual({ x: 2 });
      play.step();
      expect(obj).toEqual({ x: 3 });
      play.step();
      return expect(obj).toEqual({ x: 3 });
  });

    return it('has correct timing', function() {
      let obj = jsonClone(data2);
      const rec = new recorder.StateRecorder(obj, keys2, 2);
      obj.x = 1;
      rec.observe();
      obj.x = 2;
      rec.observe();
      obj.x = 3;
      rec.observe();
      const saved2 = jsonClone(rec);

      obj = {};
      const play = new recorder.StatePlayback(obj, saved2);
      expect(obj).toEqual({});
      play.step();
      expect(obj).toEqual({ x: 1 });
      play.step();
      expect(obj).toEqual({ x: 1 });
      play.step();
      return expect(obj).toEqual({ x: 3 });
  });
});
});
