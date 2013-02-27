describe "session-mongoose express", ->
  assert = require('assert')
  express = require('express')
  request = require('supertest')

  SessionStore = require('..')(express)

  makeExpress = (connection) ->
    app = express()
    app.use express.bodyParser()
    app.use express.methodOverride()
    app.use express.cookieParser('1234')
    app.use express.session
      store: new SessionStore
        url: "mongodb://localhost/session-mongoose-test"
        interval: 1000
        connection: connection
      cookie:
        maxAge: 5000
    app.use app.router
    app

  testExpress = (done, connection, tester) ->
    [ connection, tester ] = [ undefined, connection ] if not tester
    app = makeExpress(connection)
    app.get '/', (req, res) ->
      tester(req, res)
    request(app).get('/').expect(200, done)

  it "should support simple string", (done) ->
    testExpress done, (req, res) ->
      req.session['123'] = '456'
      assert.equal req.session['123'], '456'
      res.end()

  it "should support string array", (done) ->
    testExpress done, (req, res) ->
      req.session['456'] = [ 4, 5, 6]
      assert.deepEqual req.session['456'], [ 4, 5, 6]
      res.end()

  it "should support object", (done) ->
    testExpress done, (req, res) ->
      req.session['789'] =
        a: 1
        b: "string"
        c: true
        d: [ 3, 2, 1]
      assert.deepEqual req.session['789'],
        a: 1
        b: "string"
        c: true
        d: [ 3, 2, 1]
      res.end()

  it "should support custom connection", (done) ->
    mongoose = require('mongoose')
    mongoose.connect "mongodb://localhost/session-mongoose-test"
    testExpress done, mongoose.connection, (req, res) ->
      req.session['123'] = '456'
      assert.equal req.session['123'], '456'
      res.end()
