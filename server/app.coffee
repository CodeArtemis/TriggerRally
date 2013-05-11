# Copyright (c) 2012 jareiko. All rights reserved.

"use strict"

connect           = require 'connect'
cookie            = require 'cookie'
express           = require 'express'
http              = require 'http'
mongoose          = require 'mongoose'
mongoskin         = require 'mongoskin'
session_mongoose  = require 'session-mongoose'
socketio          = require 'socket.io'
stylus            = require 'stylus'
passport          = require 'passport'
FacebookStrategy  = require('passport-facebook').Strategy
GoogleStrategy    = require('passport-google').Strategy
TwitterStrategy   = require('passport-twitter').Strategy
LocalStrategy     = require('passport-local').Strategy

# This has to come first to set up Mongoose schemas.
objects           = require './objects'

api               = require './api'
config            = require './config'
routes            = require './routes'

getIsodate = -> new Date().toISOString()
express.logger.format 'isodate', (req, res) -> getIsodate()
log = (msg) ->
  isodate = getIsodate()
  console.log "[#{isodate}] #{msg}"

mongoose.connection.on "error", (err) ->
  log "Could not connect to mongo server!"
  log err.message

SessionStore = session_mongoose(connect)
sessionStore = new SessionStore(
  url: "mongodb://#{config.MONGODB_HOST}/sessions"
  # Expiration check worker run interval in millisec (default: 60000)
  interval: 120000
)

User = mongoose.model('User')
UserPassport = mongoose.model('UserPassport')
Car = mongoose.model('Car')
Track = mongoose.model('Track')
Run = mongoose.model('Run')

mongoose.connect config.MONGOOSE_URL

# { handleIPN } = require './paypal/ipn'

# Alternate DB connection
# dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"
# db = mongoskin.db dbUrl, { safe: true }


log "Base directory: #{__dirname}"

app = module.exports = express()

DOMAIN = process.env.DOMAIN or 'triggerrally.com'
NODE_ENV = process.env.NODE_ENV
PORT = process.env.PORT or 80
PROTOCOL = process.env.PROTOCOL or 'http'
PUBLIC_PORT = if NODE_ENV is 'production' then 80 else PORT
PORT_SUFFIX = if PUBLIC_PORT is 80 then "" else ":#{PUBLIC_PORT}"
URL_PREFIX = "#{PROTOCOL}://#{DOMAIN}#{PORT_SUFFIX}"

authenticateUser = (profile, done) ->
  passport_id = profile.identifier or (profile.provider + profile.id)
  UserPassport
    .findOne(passport_id: passport_id)
    .populate('user')
    .exec (error, userPassport) ->
      return done error if error
      user = userPassport?.user
      return done null, userPassport if user
      userPassport ?= new UserPassport()
      # Create new user from passport profile.
      user = new User
        name: profile.displayName or profile.username
      user.email = profile.emails[0].value if profile.emails?[0]
      user.save (error) ->
        return done error if error
        userPassport.profile = profile
        userPassport.user = user._id
        userPassport.save (error) ->
          done error, userPassport
          #res.redirect('/user/' + user.pub_id + '/edit');

authenticationSuccessfulAPI = (req, res) ->
  throw new Error('authenticationSuccessfulAPI: req.user array') if Array.isArray req.user
  res.redirect '/closeme'

authenticationSuccessful = (req, res) ->
  throw new Error('authenticationSuccessful: req.user array') if Array.isArray req.user
  res.redirect '/'

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

for i in ["", "/v1"]
  passport.use "facebook#{i}", new FacebookStrategy(
    clientID: config.FACEBOOK_APP_ID
    clientSecret: config.FACEBOOK_APP_SECRET
    callbackURL: "#{URL_PREFIX}#{i}/auth/facebook/callback"
  , (accessToken, refreshToken, profile, done) ->
    profile.auth = { accessToken, refreshToken }
    authenticateUser profile, done
  )
  passport.use "google#{i}", new GoogleStrategy(
    returnURL: "#{URL_PREFIX}#{i}/auth/google/return"
    realm: URL_PREFIX + '/'
  , (identifier, profile, done) ->
    # passport-oauth doesn't supply provider or id.
    profile.identifier = identifier  # Old storage
    profile.auth = { identifier }    # New unified auth
    authenticateUser profile, done
  )
  passport.use "twitter#{i}", new TwitterStrategy(
    consumerKey: config.TWITTER_APP_KEY
    consumerSecret: config.TWITTER_APP_SECRET
    callbackURL: "#{URL_PREFIX}#{i}/auth/twitter/callback"
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

app.use express.logger(format: '[:isodate] :status :response-time ms :res[content-length] :method :url :referrer')
app.disable 'x-powered-by'
app.use express.compress()
app.use stylus.middleware(
  src: __dirname + '/stylus'
  dest: __dirname + '/public'
)
app.use express.static(__dirname + '/public')
app.set 'views', __dirname + '/views'
app.set 'view engine', 'jade'
app.use (req, res, next) ->
  req.rawBody = ''
  # req.setEncoding('utf8')
  req.on 'data', (chunk) -> req.rawBody += chunk
  next()
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
app.use (req, res, next) ->
  # Enable Chrome Frame if installed.
  res.setHeader 'X-UA-Compatible', 'chrome=1'
  next()
app.use routes.defaultParams

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

# Send any path not otherwise handled to the unified app.
# TODO: Make the app show a 404 as appropriate.
app.use routes.unified

app.configure 'development', ->
  app.use (err, req, res, next) ->
    console.error err
    res.json 500,
      error: "Internal Server Error"
      call_stack: err.stack?.split('\n')

app.configure 'production', ->
  app.use (err, req, res, next) ->
    console.error err
    res.json 500,
      error: "Internal Server Error"

app.get    '/v1/auth/facebook', passport.authenticate('facebook/v1')
app.get    '/v1/auth/facebook/callback', passport.authenticate('facebook/v1',
  failureRedirect: '/login?popup=1'
), authenticationSuccessfulAPI
app.get    '/v1/auth/google', passport.authenticate('google/v1')
app.get    '/v1/auth/google/return', passport.authenticate('google/v1',
  failureRedirect: '/login?popup=1'
), authenticationSuccessfulAPI
app.get    '/v1/auth/twitter', passport.authenticate('twitter/v1')
app.get    '/v1/auth/twitter/callback', passport.authenticate('twitter/v1'), authenticationSuccessfulAPI

app.get    '/v1/auth/logout', (req, res) ->
  req.logOut()
  res.json status: "ok"

api.setup app, passport

app.get    '/auth/facebook', passport.authenticate('facebook')
app.get    '/auth/facebook/callback', passport.authenticate('facebook',
  failureRedirect: '/login'
), authenticationSuccessful
app.get    '/auth/google', passport.authenticate('google')
app.get    '/auth/google/return', passport.authenticate('google',
  failureRedirect: '/login'
), authenticationSuccessful
app.get    '/auth/twitter', passport.authenticate('twitter')
app.get    '/auth/twitter/callback', passport.authenticate('twitter',
  failureRedirect: '/login'
), authenticationSuccessful

app.get    '/logout', (req, res) ->
  req.logOut()
  res.redirect '/'

app.get    '/closeme', routes.closeme

# Backward compatibility.
app.get '/drive', (req, res) ->
  res.redirect '/', 301
app.get '/x/Preview/Arbusu/drive', (req, res) ->
  # req.params.idTrack = 'Preview'
  # req.params.idCar = 'Arbusu'
  # loadUrlTrack req, res, ->
  #   loadUrlCar req, res, ->
  #     routes.drive req, res
  # Preview is broken, so just redirect to home.
  res.redirect '/', 301
app.get '/x/:idTrack/:idCar/drive', (req, res) ->
  res.redirect "/track/#{req.params.idTrack}/drive", 301
# app.get '/track/:idTrack', (req, res) ->
#   res.redirect "/track/#{req.params.idTrack}/drive", 301

app.get    '/login', routes.login

ppec = require './paypal/expresscheckout'
qs = require 'querystring'

getPaymentParams = (productId) ->
  products =
    ignition:
      cost: '5.00'
      name: 'Trigger Rally Icarus Ignition'
      description: 'A new car for Trigger Rally.'
      url: 'https://triggerrally.com/ignition'

  product = products[productId]
  return null unless product

  # TODO: Hide these details inside expresscheckout module.

  PAYMENTREQUEST_0_CUSTOM: productId
  PAYMENTREQUEST_0_PAYMENTACTION: 'Sale'
  PAYMENTREQUEST_0_AMT: product.cost
  PAYMENTREQUEST_0_ITEMAMT: product.cost  # Required for digital goods.
  RETURNURL: "#{URL_PREFIX}/checkout/return"
  CANCELURL: "#{URL_PREFIX}/closeme"
  REQCONFIRMSHIPPING: 0
  NOSHIPPING: 1
  ALLOWNOTE: 0
  # HDRIMG: "https://triggerrally.com/images/TODO-750x90.png"  # TODO
  # HDRBORDERCOLOR
  # HDRBACKCOLOR
  # PAYFLOWCOLOR
  # EMAIL: req.user.user.email
  # LANDINGPAGE  # should test results of this
  BUYEREMAILOPTINENABLE: 1
  # BUYERUSERNAME  # May be useful to increase user confidence?
  # BUYERREGISTRATIONDATE

  L_PAYMENTREQUEST_0_ITEMCATEGORY0: 'Digital'
  L_PAYMENTREQUEST_0_ITEMURL0: product.url
  L_PAYMENTREQUEST_0_QTY0: 1
  L_PAYMENTREQUEST_0_AMT0: product.cost
  L_PAYMENTREQUEST_0_DESC0: product.description
  L_PAYMENTREQUEST_0_NAME0: product.name

app.get '/checkout', (req, res) ->
  return res.send 401 unless req.user
  productId = req.query.product

  # Check that user doesn't already have this product.
  return res.send 403 if productId in req.user.user.products

  params = getPaymentParams productId
  return res.send 404 unless params
  params.METHOD = 'SetExpressCheckout'
  console.log "Calling: #{JSON.stringify params}"
  ppec.request params, (err, nvp_res) ->
    if err
      console.error "#{params.METHOD} error: #{err}"
      return res.send 500
    console.log "#{params.METHOD} response: #{JSON.stringify nvp_res}"
    return res.send 500 if nvp_res.ACK isnt 'Success'
    TOKEN = nvp_res.TOKEN
    return res.send 500 unless TOKEN
    res.redirect ppec.redirectUrl TOKEN

app.get '/checkout/return', (req, res) ->
  failure = (code, msg) ->
    console.error "PURCHASE FAILED: (#{code}) #{msg}"
    res.send code
  return failure 401 unless req.user
  api.findUser req.user.user.pub_id, (bbUser) ->
    return failure 500 unless bbUser
    params =
      METHOD: 'GetExpressCheckoutDetails'
      TOKEN: req.query.token
    console.log "Calling: #{JSON.stringify params}"
    ppec.request params, (err, nvp_res) ->
      return failure 500, "#{params.METHOD} error: #{err}" if err
      console.log "#{params.METHOD} response: #{nvp_res}"
      return failure 500 if nvp_res.ACK isnt 'Success'
      productId = nvp_res.PAYMENTREQUEST_0_CUSTOM
      return failure 403 if productId in (bbUser.products ? [])
      params = getPaymentParams productId
      return failure 500 unless params
      params.METHOD = 'DoExpressCheckoutPayment'
      params.TOKEN = nvp_res.TOKEN
      params.PAYERID = nvp_res.PAYERID
      params.RETURNFMFDETAILS = 1
      console.log "Calling: #{JSON.stringify params}"
      # console.log "OMIT CALL"
      # if true
      ppec.request params, (err, nvp_res) ->
        return failure 500, "#{params.METHOD} error: #{err}" if err
        console.log "#{params.METHOD} response: #{JSON.stringify nvp_res}"
        return failure 500 if nvp_res.ACK isnt 'Success'
        products = bbUser.products ? []
        # We use concat instead of push to create a new array object.
        products = products.concat productId
        bbUser.save { products },
          success: ->
            # TODO: Show a "Thank you!" interstitial page?
            console.log "PURCHASE COMPLETE for user #{bbUser.id}"
            res.redirect '/closeme'
          error: ->
            console.log "user: #{JSON.stringify bbUser}"
            failure 500, "COMPLETE BUT FAILED TO RECORD - VERY BAD!!"

# app.post '/paypal/ipn', handleIPN

#
#app.post('/login',
#    passport.authenticate('local', { failureRedirect: '/login?status=failed' }),
#    authenticationSuccessful
#);
#

server = http.createServer(app)
# io = socketio.listen(server)
server.listen PORT
log "Server listening on port #{PORT} in #{app.settings.env} mode"


# TODO: Mirror http api over socket.io.

# if NODE_ENV is 'production'
#   io.set 'log level', 1
# else
#   io.set 'log level', 2

# showNumberConnected = ->
#   clients = io.sockets.clients()
#   numConnected = clients.length
#   log "Connected sockets: #{numConnected}"

# io.set 'authorization', (data, accept) ->
#   # http://www.danielbaulig.de/socket-ioexpress/
#   return accept('No cookie transmitted.', false) unless data.headers.cookie
#   data.cookie = cookie.parse(data.headers.cookie)
#   sid = data.cookie['connect.sid']
#   return accept('No session id found.', false) unless sid
#   data.sessionID = sid.substring(2, 26)
#   # save the session store to the data object
#   # (as required by the Session constructor)
#   data.sessionStore = sessionStore
#   sessionStore.get data.sessionID, (err, session) ->
#     if err
#       accept err, false
#     else unless session
#       accept 'No session', false
#     else
#       # create a session object, passing data as request and our
#       # just acquired session data
#       Session = connect.middleware.session.Session
#       data.session = new Session(data, session)
#       # TODO: accept fast, before deserialization?
#       passport.deserializeUser data.session.passport.user, (err, userPassport) ->
#         if err then accept 'passport error: ' + err, false
#         else
#           data.session.user = userPassport.user
#           data.session.userPassport = userPassport
#           accept null, true

# db.bind 'cars'
# db.bind 'environments'
# db.bind 'tracks'
# db.bind 'users'

# publicCar = (car) ->
#   id: car.pub_id
#   name: car.name
#   config: car.config

# publicUserBasic = (user) ->
#   id: user.pub_id
#   name: user.name

# getPublicEnv = (_id, cb) ->
#   db.environments.findOne {_id}, (err, env) ->
#     return cb err if err?
#     db.cars.find({ _id: { $in: env.cars } }).toArray (err, cars) ->
#       return cb err if err?
#       cb null,
#         id: env.pub_id
#         name: env.name
#         cars: (publicCar(car) for car in cars)
#         scenery: env.scenery
#         terrain: env.terrain

# getPublicTrackPubId = (pub_id, cb) ->
#   db.tracks.findOne {pub_id}, (err, track) ->
#     return cb err if err?
#     getPublicEnv track.env, (err, env) ->
#       return cb err if err?
#       db.users.findOne track.user, (err, user) ->
#         return cb err if err?
#         cb null,
#           id: track.pub_id
#           name: track.name
#           config: track.config
#           env: env
#           user: publicUserBasic user
#           published: track.published

# io.of('/api').on 'connection', (socket) ->
#   session = socket.handshake.session
#   wireId = socket.id
#   tag = (if session.user then " #{session.user.pub_id}" else "")
#   do ->
#     isodate = getIsodate()
#     console.log "[#{isodate}] #{wireId} connected" + tag
#   #showNumberConnected()

#   socket.on 'sync', (data, callback) ->
#     switch data.method
#       when 'create'
#         callback 'create not implemented'
#       when 'read'
#         switch data.urlRoot
#           when 'track'
#             getPublicTrackPubId data.model.id, (err, track) ->
#               return callback err if err?
#               callback null, track
#       when 'update'
#         switch data.urlRoot
#           when 'track'
#             db.tracks.findOne { pub_id: data.model.id }, (err, track) ->
#               return callback err if err?
#               unless track?
#                 return callback 404
#               unless track.user.equals session.user._id
#                 return callback 403
#               track.config = data.model.config
#               track.name = data.model.name
#               track.published = data.model.published
#               track.modified = new Date()
#               db.tracks.save track, (err) ->
#                 callback err, {}
#                 isodate = getIsodate()
#                 console.log "[#{isodate}] Track #{track.pub_id} saved by #{session.user.pub_id}"
#       when 'delete'
#         callback 'delete not implemented'
#     return

#   ###
#   # Stuff a custom storage object into the socket.
#   socket.hackyStore = {}
#   socket.on 'c2s', (data) ->

#     #console.log('Update from ' + wireId + tag);
#     if data.config

#       # TODO: Find a cleaner way of signaling that cars are remote?
#       data.config.isRemote = true
#       socket.hackyStore['config'] = data.config
#     if data.carstate
#       clients = io.sockets.clients()
#       clients.forEach (client) ->
#         if client.id isnt wireId
#           seen = client.hackyStore['seen'] or (client.hackyStore['seen'] = {})
#           unless seen[wireId]
#             seen[wireId] = true
#             client.emit 'addcar',
#               wireId: wireId
#               config: socket.hackyStore['config']

#           client.volatile.emit 's2c',
#             wireId: wireId
#             carstate: data.carstate

#   socket.on 'disconnect', ->
#     showNumberConnected()
#     console.log wireId + ' disconnected' + tag
#     clients = io.sockets.clients()
#     clients.forEach (client) ->
#       if client.id isnt wireId
#         seen = client.hackyStore['seen'] or (client.hackyStore['seen'] = {})
#         if wireId of seen
#           delete seen[wireId]

#           client.emit 'deletecar',
#             wireId: wireId
#   ###

#   socket.on 'error', (data) ->
#     isodate = getIsodate()
#     console.log "[#{isodate}] Error from #{wireId}: #{data.msg}"
