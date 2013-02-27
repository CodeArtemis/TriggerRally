describe "session-mongoose direct", ->
  assert = require('assert')
  should = require('should')
  SessionStore = require('..')(require('connect'))
  store = undefined

  store = new SessionStore
    url: "mongodb://localhost/session-mongoose-test"
    interval: 1000 # ms

  reset = ->
    store.clear()

  it "should return what was set", (done) ->
    should.exist store

    reset()
    store.set '123',
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"

      store.get '123', (err, data) ->
        assert.ifError err
        assert.deepEqual data,
          cookie:
            maxAge: 2000 # ms
          name: 'don'
          value: '456'
        reset()
        done()

  it "should return nothing after destroy", (done) ->
    reset()
    store.set '123',
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      store.destroy '123', (err) ->
        store.get '123', (err, data) ->
          assert.ifError err
          assert.equal data, null
          done()

  it "should return nothing after clear", (done) ->
    reset()
    store.set '123',
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      reset()
      store.get '123', (err, data) ->
        assert.ifError err
        assert.equal data, null
        done()

  it "all should return 1 sid after one is set", (done) ->
    reset()
    store.set '123',
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      store.all (err, sids) ->
        assert.ifError err
        assert.ok sids and sids.length is 1
        reset()
        done()

  it "all should return 2 sids after two is set", (done) ->
    reset()
    store.set '123',
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      store.set 'abc',
        cookie:
          maxAge: 2000 # ms
        name: 'don'
        value: '456'
      , (err, ok) ->
        assert.ifError err
        assert.equal ok, 1, "SessionStore.set should return 1"
        store.all (err, sids) ->
          assert.ifError err
          assert.ok sids and sids.length is 2
          reset()
          done()

  it "all should return empty array after expired one is set", (done) ->
    reset()
    store.set '123',
      cookie:
        expires: new Date(Date.now() - 1000)
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      store.all (err, sids) ->
        assert.ifError err
        assert.ok sids and sids.length is 0
        reset()
        done()

  it "should remove expired session within sweeper interval", (done) ->
    reset()
    store.set '123',
      cookie:
        expires: new Date(Date.now() - 1000)
      name: 'don'
      value: '456'
    , (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"
      setTimeout ->
        store.length (err, length) ->
          assert.equal length, 0
          reset()
          done()
      , 1200

  it "should support complex session data", (done) ->
    should.exist store

    expected = 
      cookie:
        maxAge: 2000 # ms
      name: 'don'
      value: '456'
      array: [
        "123"
        "456"
        {
          test: "789"
          nested: 123
          object: true
        }
      ]

    reset()
    store.set '123', expected, (err, ok) ->
      assert.ifError err
      assert.equal ok, 1, "SessionStore.set should return 1"

      store.get '123', (err, data) ->
        assert.ifError err
        assert.deepEqual data, expected
        reset()
        done()
