# Copyright (c) 2012 jareiko. All rights reserved.

"use strict"

connect = require('connect')
cookie = require('cookie')
express = require('express')
http = require('http')
mongoose = require('mongoose')
session_mongoose = require('session-mongoose')
socketio = require('socket.io')
stylus = require('stylus')
passport = require('passport')
FacebookStrategy = require('passport-facebook').Strategy
GoogleStrategy = require('passport-google').Strategy
TwitterStrategy = require('passport-twitter').Strategy
LocalStrategy = require('passport-local').Strategy

config = require('./config')
routes = require('./routes')
objects = require('./objects')
SessionStore = session_mongoose(connect)
sessionStore = new SessionStore(
  url: 'mongodb://localhost/sessions'
  # Expiration check worker run interval in millisec (default: 60000)
  interval: 120000
)

User = mongoose.model('User')
UserPassport = mongoose.model('UserPassport')
Car = mongoose.model('Car')
Track = mongoose.model('Track')
Run = mongoose.model('Run')

console.log 'Base directory: ' + __dirname
app = module.exports = express()

PORT = process.env.PORT or 80
DOMAIN = process.env.DOMAIN or 'triggerrally.com'
URL_PREFIX = 'http://' + DOMAIN

authenticateUser = (profile, done) ->
  passport_id = profile.identifier or (profile.provider + profile.id)
  console.log 'authenticateUser: ' + JSON.stringify(profile)
  console.log 'authenticateUser: ' + passport_id
  UserPassport
    .findOne(passport_id: passport_id)
    .populate('user')
    .exec (error, userPassport) ->
    if error then done error
    else
      user = userPassport and userPassport.user or null
      unless user
        userPassport = new UserPassport() unless userPassport
        # Create new user from passport profile.
        user = new User(name: profile.displayName or profile.username)
        user.email = profile.emails[0].value if profile.emails and profile.emails[0]
        user.save (error) ->
        if error then done error
        else
            userPassport.profile = profile
            userPassport.user = user._id
            userPassport.save (error) ->
              done error, userPassport
              #res.redirect('/user/' + user.pub_id + '/edit');

authenticationSuccessful = (req, res) ->
  user = req.user
  throw new Error('authenticationSuccessful: user array') if Array.isArray(user)
  res.redirect '/'
  # Directing users to edit their profile each time may be annoying.
  #
  #  if (user.newbie) {
  #    // User has not yet saved their profile.
  #    res.redirect('/user/' + user.pub_id + '/edit');
  #    //res.end();
  #  } else {
  #    res.redirect('/');
  #    //res.end();
  #  }

#passport.use new LocalStrategy(
#  usernameField: 'email'
#  passwordField: 'password'
#, (email, password, done) ->
#  User.findOne
#    _email: email
#  , (err, user) ->
#    return done(err)  if err
#    return done(null, false)  unless user
#    return done(null, false)  unless user.authenticate(password)
#    done null, user
#)

passport.use new FacebookStrategy(
  clientID: config.FACEBOOK_APP_ID
  clientSecret: config.FACEBOOK_APP_SECRET
  callbackURL: URL_PREFIX + '/auth/facebook/callback'
, (accessToken, refreshToken, profile, done) ->
  profile.auth = { accessToken, refreshToken }
  authenticateUser profile, done
)

passport.use new GoogleStrategy(
  returnURL: URL_PREFIX + '/auth/google/return'
  realm: URL_PREFIX + '/'
, (identifier, profile, done) ->
  # passport-oauth doesn't supply provider or id.
  profile.identifier = identifier  # Old storage
  profile.auth = { identifier }    # New unified auth
  authenticateUser profile, done
)

passport.use new TwitterStrategy(
  consumerKey: config.TWITTER_APP_KEY
  consumerSecret: config.TWITTER_APP_SECRET
  callbackURL: URL_PREFIX + '/auth/twitter/callback'
, (token, tokenSecret, profile, done) ->
  profile.auth = { token, tokenSecret }
  authenticateUser profile, done
)

passport.serializeUser (userPassport, done) ->
  done null, userPassport.id

passport.deserializeUser (id, done) ->
  UserPassport
    .findOne(_id: id)
    .populate('user')
    .exec (error, userPassport) ->
    done error, userPassport


express.logger.format 'isodate', (req, res) ->
  new Date().toISOString()

app.use express.logger(format: '[:isodate] :status :response-time ms :method :url :referrer')
app.disable 'x-powered-by'
app.set 'views', __dirname + '/views'
app.set 'view engine', 'jade'
app.use express.bodyParser()
app.use express.cookieParser(config.SESSION_SECRET)
app.use express.session(
  cookie:
    maxAge: 4 * 7 * 24 * 60 * 60 * 1000

  store: sessionStore
)
app.use passport.initialize()
app.use passport.session()
app.use express.methodOverride()
app.use stylus.middleware(
  src: __dirname + '/stylus'
  dest: __dirname + '/public'
)
app.use routes.defaultParams
app.use (req, res, next) ->
  # Enable Chrome Frame if installed.
  res.setHeader 'X-UA-Compatible', 'chrome=1'
  next()

#
#// We can delay certain resources for debugging purposes.
#app.use(function(req, res, next) {
#  var delay = 0;
#  if (req.path.match('nice.png')) delay = 3000;
#  if (req.path.match('heightdetail1.jpg')) delay = 6000;
#  setTimeout(function() {
#    next();
#  }, delay);
#});
#

app.use app.router
app.use express.static(__dirname + '/public')
app.configure 'development', ->
  app.use express.errorHandler(
    dumpExceptions: true
    showStack: true
  )
  mongoose.connect 'mongodb://localhost/trigger-prod'

app.configure 'production', ->
  app.use express.errorHandler(dumpExceptions: true)
  mongoose.connect 'mongodb://localhost/trigger-prod'

loadUrlUser = (req, res, next) ->
  User
    .findOne(pub_id: req.params.idUser)
    .exec (error, urlUser) ->
    if error then done error
    else
      if urlUser
        urlUser.isAuthenticated = req.user and req.user.user and req.user.user.id is urlUser.id
        req.urlUser = urlUser
        next()
      else
        res.send 404

loadUrlTrack = (req, res, next) ->
  Track
    .findOne(pub_id: req.params.idTrack)
    .populate('user')
    .populate('env')
    .exec (error, urlTrack) ->
    if error then done error
    else
      if urlTrack
        urlTrack.isAuthenticated = req.user and req.user.user and req.user.user.id is urlTrack.user.id
        req.urlTrack = urlTrack
        if urlTrack.env
          Car
            .find()
            .where('_id')
            .in(urlTrack.env.cars)
            .exec (error, cars) ->
          if error then done error
          else
              # Horrible workaround because we can't populate env.cars directly.
              # See Environment model for the rest of the hack.
              req.urlTrack.env.populatedCars = cars
              next()

        else
          next()
      else
        res.send 404

loadUrlCar = (req, res, next) ->
  Car
    .findOne(pub_id: req.params.idCar)
    .populate('user')
    .exec (error, urlCar) ->
    if error then done error
    else
      if urlCar
        urlCar.isAuthenticated = req.user and req.user.user and req.user.user.id is urlCar.user.id
        req.urlCar = urlCar
        next()
      else
        res.send 404

loadUrlRun = (req, res, next) ->
  Run
    .findOne(pub_id: req.params.idRun)
    .populate('user')
    .populate('car')
    .populate('track')
    .exec (error, urlRun) ->
    if error then done error
    else
      if urlRun
        urlRun.isAuthenticated = req.user and req.user.user and req.user.user.id is urlRun.user.id
        req.urlRun = urlRun
        next()
      else
        res.send 404

editTrack = (req, res, next) ->
  if req.urlTrack.isAuthenticated
    req.editing = true
    next()

editCar = (req, res, next) ->
  if req.urlCar.isAuthenticated
    req.editing = true
    next()

editUser = (req, res, next) ->
  if req.urlUser.isAuthenticated
    req.editing = true
    next()

app.get '/', routes.index
app.get '/about', routes.about
app.get '/login', routes.login
app.get '/user/confirm', routes.userconfirm
app.get '/user/:idUser', loadUrlUser, routes.user
app.get '/user/:idUser/edit', loadUrlUser, editUser, routes.user
app.post '/user/:idUser/save', loadUrlUser, editUser, routes.userSave
app.get '/track/:idTrack', loadUrlTrack, routes.track
app.get '/track/:idTrack/edit', loadUrlTrack, editTrack, routes.trackEdit
app.get '/track/:idTrack/json', loadUrlTrack, routes.trackJson
app.get '/track/:idTrack/json/edit', loadUrlTrack, editTrack, routes.trackJson
app.post '/track/:idTrack/json/save', loadUrlTrack, editTrack, routes.trackJsonSave
app.put '/track/:idTrack/json/save', loadUrlTrack, editTrack, routes.trackJsonSave
app.get '/car/:idCar', loadUrlCar, routes.car
app.get '/car/:idCar/json', loadUrlCar, routes.carJson
app.get '/car/:idCar/json/edit', loadUrlCar, editCar, routes.carJson
app.post '/car/:idCar/json/save', loadUrlCar, editCar, routes.carJsonSave
app.get '/run/:idRun', loadUrlRun, routes.run
app.post '/run/new', routes.runSave
app.get '/run/:idRun/replay', loadUrlRun, routes.runReplay
app.get '/x/:idTrack/:idCar/drive', loadUrlTrack, loadUrlCar, routes.drive
app.get '/x/:idTrack/:idCar/top', loadUrlTrack, loadUrlCar, routes.top
app.post '/metrics', routes.metricsSave
app.get '/auth/facebook', passport.authenticate('facebook')
app.get '/auth/facebook/callback', passport.authenticate('facebook',
  failureRedirect: '/login'
), authenticationSuccessful
app.get '/auth/google', passport.authenticate('google')
app.get '/auth/google/return', passport.authenticate('google',
  failureRedirect: '/login'
), authenticationSuccessful
app.get '/auth/twitter', passport.authenticate('twitter')
app.get '/auth/twitter/callback', passport.authenticate('twitter',
  failureRedirect: '/login'
), authenticationSuccessful

#
#app.post('/login',
#    passport.authenticate('local', { failureRedirect: '/login?status=failed' }),
#    authenticationSuccessful
#);
#

app.get '/logout', (req, res) ->
  req.logOut()
  res.redirect '/'

# Backward compatibility.
app.get '/drive', (req, res) ->
  res.redirect '/x/Preview/Arbusu/drive', 301

server = http.createServer(app)
io = socketio.listen(server)
server.listen PORT
console.log 'Server listening on port %d in %s mode', PORT, app.settings.env

if 'production' is process.env.NODE_ENV
  io.set 'log level', 1
else
  io.set 'log level', 2

showNumberConnected = ->
  clients = io.sockets.clients()
  numConnected = clients.length
  console.log '[' + (new Date).toISOString() + ']' + ' Connected sockets: ' + numConnected

io.set 'authorization', (data, accept) ->
  # http://www.danielbaulig.de/socket-ioexpress/
  return accept('No cookie transmitted.', false)  unless data.headers.cookie
  data.cookie = cookie.parse(data.headers.cookie)
  data.sessionID = data.cookie['connect.sid'].substring(2, 26)
  # save the session store to the data object
  # (as required by the Session constructor)
  data.sessionStore = sessionStore
  sessionStore.get data.sessionID, (err, session) ->
    if err
      accept err, false
    else unless session
      accept 'No session', false
    else
      # create a session object, passing data as request and our
      # just acquired session data
      Session = connect.middleware.session.Session
      data.session = new Session(data, session)
      # TODO: accept fast, before deserialization?
      passport.deserializeUser data.session.passport.user, (err, userPassport) ->
        if err then accept 'passport error: ' + err, false
        else
          data.session.user = userPassport.user
          data.session.userPassport = userPassport
          accept null, true

io.sockets.on 'connection', (socket) ->
  session = socket.handshake.session
  wireId = socket.id
  tag = (if session.user then ' (' + session.user.pub_id + ')' else '')
  console.log wireId + ' connected' + tag
  showNumberConnected()

  # Stuff a custom storage object into the socket.
  socket.hackyStore = {}
  socket.on 'c2s', (data) ->

    #console.log('Update from ' + wireId + tag);
    if data.config

      # TODO: Find a cleaner way of signaling that cars are remote?
      data.config.isRemote = true
      socket.hackyStore['config'] = data.config
    if data.carstate
      clients = io.sockets.clients()
      clients.forEach (client) ->
        if client.id isnt wireId
          seen = client.hackyStore['seen'] or (client.hackyStore['seen'] = {})
          unless seen[wireId]
            seen[wireId] = true
            client.emit 'addcar',
              wireId: wireId
              config: socket.hackyStore['config']

          client.volatile.emit 's2c',
            wireId: wireId
            carstate: data.carstate

  socket.on 'disconnect', ->
    showNumberConnected()
    console.log wireId + ' disconnected' + tag
    clients = io.sockets.clients()
    clients.forEach (client) ->
      if client.id isnt wireId
        seen = client.hackyStore['seen'] or (client.hackyStore['seen'] = {})
        if wireId of seen
          delete seen[wireId]

          client.emit 'deletecar',
            wireId: wireId

  socket.on 'error', (data) ->
    console.log 'Error from ' + wireId + ': ' + data.msg
