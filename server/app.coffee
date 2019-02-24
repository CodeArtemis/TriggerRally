"use strict"

_                 = require 'underscore'
bodyParser        = require 'body-parser'
cookieParser      = require 'cookie-parser'
connect           = require 'connect'
compression       = require 'compression'
cookie            = require 'cookie'
express           = require 'express'
expressSession    = require 'express-session'
http              = require 'http'
logger            = require 'morgan'
methodOverride    = require 'method-override'
mongoose          = require 'mongoose'
mongoskin         = require 'mongoskin'
session_mongoose  = require 'session-mongoose'
socketio          = require 'socket.io'
stylus            = require 'stylus'
passport          = require 'passport'
FacebookStrategy  = require('passport-facebook').Strategy
GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy
TwitterStrategy   = require('passport-twitter').Strategy
LocalStrategy     = require('passport-local').Strategy

# This has to come first to set up Mongoose schemas.
objects           = require './objects'

api               = require './api'
config            = require './config'
{ makePubId }     = require './objects/common'
routes            = require './routes'

# stripe            = require('stripe')(config.stripe.API_KEY)

getIsodate = -> new Date().toISOString()
logger.format 'isodate', (req, res) -> getIsodate()
log = (msg) ->
  isodate = getIsodate()
  console.log "[#{isodate}] #{msg}"

mongoose.set 'debug', true

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

# Alternate DB connection
dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"
db = mongoskin.db dbUrl, { safe: true }

db.bind 'cars'
db.bind 'runs'
db.bind 'tracks'
db.bind 'users'

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
      # user.email = profile.emails[0].value if profile.emails?[0]
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

# for i in ["", "/v1"]
#  passport.use "facebook#{i}", new FacebookStrategy(
#    clientID: config.FACEBOOK_APP_ID
#    clientSecret: config.FACEBOOK_APP_SECRET
#    callbackURL: "#{URL_PREFIX}#{i}/auth/facebook/callback"
#  , (accessToken, refreshToken, profile, done) ->
#    profile.auth = { accessToken, refreshToken }
#    authenticateUser profile, done
#  )
#  passport.use "google#{i}", new GoogleStrategy(
#    clientID: config.GOOGLE_CLIENT_ID
#    clientSecret: config.GOOGLE_CLIENT_SECRET
#    callbackURL: "#{URL_PREFIX}#{i}/auth/google/callback"
#  , (token, refreshToken, profile, done) ->
#    profile.auth = { token, refreshToken }
#    authenticateUser profile, done
#  )
#  passport.use "twitter#{i}", new TwitterStrategy(
#    consumerKey: config.TWITTER_APP_KEY
#    consumerSecret: config.TWITTER_APP_SECRET
#    callbackURL: "#{URL_PREFIX}#{i}/auth/twitter/callback"
#  , (token, tokenSecret, profile, done) ->
#    profile.auth = { token, tokenSecret }
#    authenticateUser profile, done
#  )

passport.serializeUser (userPassport, done) ->
  done null, userPassport.id

passport.deserializeUser (id, done) ->
  UserPassport
    .findOne(_id: id)
    .populate('user')
    .exec (error, userPassport) ->
      done error, userPassport

app.use logger('[:isodate] :status :response-time ms :res[content-length] :method :url :referrer', format: '[:isodate] :status :response-time ms :res[content-length] :method :url :referrer')
app.disable 'x-powered-by'
app.use compression()
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
app.use bodyParser.urlencoded({
  extended: true
})
app.use bodyParser.json();

app.use cookieParser(config.SESSION_SECRET)
app.use expressSession(
  secret: 'asecret'
  saveUninitialized: true
  resave: true
  cookie:
    maxAge: 4 * 7 * 24 * 60 * 60 * 1000

  store: sessionStore
)
app.use passport.initialize()
app.use passport.session()
app.use methodOverride()
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

if app.get('env') is 'development'
  app.use (err, req, res, next) ->
    console.error err
    res.json 500,
      error: "Internal Server Error"
      call_stack: err.stack?.split('\n')

if app.get('env') is 'production'
  app.use (err, req, res, next) ->
    console.error err
    res.json 500,
      error: "Internal Server Error"

app.get    '/v1/auth/facebook', passport.authenticate('facebook/v1')
app.get    '/v1/auth/facebook/callback', passport.authenticate('facebook/v1',
  failureRedirect: '/login?popup=1'
), authenticationSuccessfulAPI
app.get    '/v1/auth/google', passport.authenticate('google/v1', { scope : ['profile', 'email'] })
app.get    '/v1/auth/google/callback', passport.authenticate('google/v1',
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
app.get    '/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] })
app.get    '/auth/google/callback', passport.authenticate('google',
  failureRedirect: '/login'
), authenticationSuccessful
app.get    '/auth/twitter', passport.authenticate('twitter')
app.get    '/auth/twitter/callback', passport.authenticate('twitter',
  failureRedirect: '/login'
), authenticationSuccessful

app.get    '/logout', (req, res) ->
  req.logOut()
  res.redirect '/'

app.get    '/autologin', (req, res, next) ->
  code = req.query.code
  passport_id = config.autologin[code]
  return res.send 401 unless passport_id
  UserPassport
    .findOne({ passport_id })
    .populate('user')
    .exec (error, userPassport) ->
      return next error if error
      return res.send 500 unless userPassport
      req.login userPassport, (error) ->
        return next error if error
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

# ppec = require './paypal/expresscheckout'
qs = require 'querystring'

availablePacks =
  ignition:
    cost: '750'
    currency: 'credits'
    # name: 'Trigger Rally: Icarus Ignition'
    # description: 'A new car for Trigger Rally.'
    # url: 'https://triggerrally.com/ignition'
    products: [ 'ignition' ]
  mayhem:
    cost: '400'
    currency: 'credits'
    # name: 'Trigger Rally: Mayhem Monster Truck'
    # description: 'The Mayhem Monster Truck for Trigger Rally.'
    # url: 'https://triggerrally.com/mayhem'
    products: [ 'mayhem' ]
  # full:
  #   name: 'Trigger Rally: Full Game'
  #   description: 'Access all tracks, the Arbusu, Mayhem and Icarus cars, and more!'
  #   url: 'https://triggerrally.com/purchase'
  #   products: [ 'packa', 'ignition', 'mayhem', 'paid' ]

addCredits = (credits, cost) ->
  availablePacks["credits#{credits}"] =
    name: "#{credits} Credits - Trigger Rally"
    description: "A package of #{credits} credits for your Trigger Rally account."
    url: "https://triggerrally.com/"
    cost: cost
    credits: credits
    currency: 'USD'

addCredits '80',   '0.99'
addCredits '200',  '1.99'
addCredits '550',  '4.99'
addCredits '1200', '9.99'
addCredits '2000', '14.99'

# # addCredits '80',   '0.29'
# addCredits '200',  '0.59'
# addCredits '550',  '1.49'
# addCredits '1200', '2.99'
# addCredits '2000', '4.49'

# addCredits '200',  '0.59'
# addCredits '400',  '1.15'
# addCredits '750',  '1.95'
# addCredits '1150', '2.95'
# addCredits '2000', '4.49'

# Add an 'id' field matching the pack key.
pack.id = id for own id, pack of availablePacks

grantPackToUser = (pack, bbUser, method, res) ->
  saveData = {}
  if pack.products
    saveData.products = _.union (bbUser.products ? []), pack.products
  if pack.credits
    saveData.credits = bbUser.credits + parseInt(pack.credits)
  saveData.pay_history = bbUser.pay_history ? []
  saveData.pay_history.push [ Date.now(), method, pack.currency, pack.cost, pack.id ]
  console.log saveData
  bbUser.save saveData,
    success: ->
      log "PURCHASE COMPLETE for user #{bbUser.id} using #{method}"
      res.redirect '/closeme'
    error: ->
      log "user: #{JSON.stringify bbUser}"
      failure res, 500, "COMPLETE BUT FAILED TO RECORD - VERY BAD!!"

app.get '/checkout', (req, res) ->
  return res.send 401 unless req.user
  packId = req.query.pack

  pack = availablePacks[packId]
  return res.send 404 unless pack

  if pack.products
    # Check that user doesn't already have this pack. Prevents accidental double-purchase.
    newProducts = _.difference pack.products, req.user.user.products
    return res.send 409 if _.isEmpty newProducts

  switch pack.currency
    # Real currency payments are disabled.
    # when 'USD'
    #   switch req.query.method
    #     when 'paypal' then paypalCheckout pack, req, res
    #     when 'stripe' then stripeCheckout pack, req, res
    #     else res.send 400
    when 'credits' then creditsCheckout pack, req, res
    else res.send 400

# freeCheckout = (pack, req, res) ->
#   return res.send 402 unless pack.cost in [ 0, '0' ]
#   api.findUser req.user.user.pub_id, (bbUser) ->
#     return failure 500 unless bbUser
#     products = bbUser.products ? []
#     products = _.union products, pack.products
#     bbUser.save { products },
#       success: ->
#         res.redirect '/closeme'
#       error: ->
#         res.send 500

creditsCheckout = (pack, req, res) ->
  return failure res, 401 unless req.user
  api.findUser req.user.user.pub_id, (bbUser) ->
    return failure 500 unless bbUser
    cost = parseInt(pack.cost)
    return res.send 402 unless bbUser.credits >= cost
    log "user #{bbUser.id} purchased #{pack.id} for #{cost} credits"
    products = bbUser.products ? []
    products = _.union products, pack.products
    bbUser.save { products, credits: bbUser.credits - cost },
      success: ->
        log "saved user #{JSON.stringify bbUser}"
        if req.query.popup
          res.redirect '/closeme'
        else
          res.send 200
      error: ->
        res.send 500

# stripeCheckout = (pack, req, res) ->
#   return failure res, 401 unless req.user
#   api.findUser req.user.user.pub_id, (bbUser) ->
#     return failure res, 500 unless bbUser
#     charge = stripe.charges.create
#       amount: Math.round(pack.cost * 100)  # amount in cents
#       currency: "usd"
#       card: req.query.token
#       description: "Charge for user ID #{bbUser.id}"
#     , (err, charge) =>
#       if err
#         console.error err
#         return res.send 500
#       grantPackToUser pack, bbUser, 'stripe', res

getPaymentParams = (pack) ->
  cost = pack.cost
  PAYMENTREQUEST_0_CUSTOM: pack.id
  PAYMENTREQUEST_0_PAYMENTACTION: 'Sale'
  PAYMENTREQUEST_0_AMT: cost
  PAYMENTREQUEST_0_ITEMAMT: cost  # Required for digital goods.
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
  L_PAYMENTREQUEST_0_ITEMURL0: pack.url
  L_PAYMENTREQUEST_0_QTY0: 1
  L_PAYMENTREQUEST_0_AMT0: cost
  L_PAYMENTREQUEST_0_DESC0: pack.description
  L_PAYMENTREQUEST_0_NAME0: pack.name

# paypalCheckout = (pack, req, res) ->
#   params = getPaymentParams pack
#   return res.send 404 unless params
#   params.METHOD = 'SetExpressCheckout'
#   log "Calling: #{JSON.stringify params}"
#   ppec.request params, (err, nvp_res) ->
#     if err
#       console.error "#{params.METHOD} error: #{err}"
#       return res.send 500
#     log "#{params.METHOD} response: #{JSON.stringify nvp_res}"
#     return res.send 500 if nvp_res.ACK isnt 'Success'
#     TOKEN = nvp_res.TOKEN
#     return res.send 500 unless TOKEN
#     res.redirect ppec.redirectUrl TOKEN

failure = (res, code, msg) ->
  console.error "PURCHASE FAILED: (#{code}) #{msg}"
  res.send code

# app.get '/checkout/return', (req, res) ->
#   return failure res, 401 unless req.user
#   api.findUser req.user.user.pub_id, (bbUser) ->
#     return failure res, 500 unless bbUser
#     params =
#       METHOD: 'GetExpressCheckoutDetails'
#       TOKEN: req.query.token
#     log "Calling: #{JSON.stringify params}"
#     ppec.request params, paypalResponse_GetExpressCheckoutDetails.bind null, bbUser, req, res

# paypalResponse_GetExpressCheckoutDetails = (bbUser, req, res, err, nvp_res) ->
#   method = 'GetExpressCheckoutDetails'
#   return failure res, 500, "#{method} error: #{err}" if err
#   log "#{method} response: #{nvp_res}"
#   return failure res, 500 if nvp_res.ACK isnt 'Success'
#   packId = nvp_res.PAYMENTREQUEST_0_CUSTOM
#   pack = availablePacks[packId]
#   # TODO: Check that price and description match what we expect?
#   params = getPaymentParams pack
#   return failure res, 500 unless params
#   params.METHOD = 'DoExpressCheckoutPayment'
#   params.TOKEN = nvp_res.TOKEN
#   params.PAYERID = nvp_res.PAYERID
#   params.RETURNFMFDETAILS = 1
#   log "Calling: #{JSON.stringify params}"
#   ppec.request params, paypalResponse_DoExpressCheckoutPayment.bind null, bbUser, req, res

# paypalResponse_DoExpressCheckoutPayment = (bbUser, req, res, err, nvp_res) ->
#   method = 'DoExpressCheckoutPayment'
#   return failure res, 500, "#{method} error: #{err}" if err
#   log "#{method} response: #{JSON.stringify nvp_res}"
#   return failure res, 500 if nvp_res.ACK isnt 'Success'
#   grantPackToUser pack, bbUser,'paypal', res

#
#app.post('/login',
#    passport.authenticate('local', { failureRedirect: '/login?status=failed' }),
#    authenticationSuccessful
#);
#

server = http.createServer(app)
io = socketio.listen(server)
server.listen PORT
log "Server listening on port #{PORT} in #{app.settings.env} mode"


# TODO: Mirror http api over socket.io.

if NODE_ENV is 'production'
  io.set 'log level', 1
else
  io.set 'log level', 2

showNumberConnected = ->
  clients = io.sockets.clients()
  numConnected = clients.length
  log "Connected sockets: #{numConnected}"

io.set 'authorization', (data, accept) ->
  # http://www.danielbaulig.de/socket-ioexpress/
  return accept('No cookie transmitted.', false) unless data.headers.cookie
  data.cookie = cookie.parse(data.headers.cookie)
  sid = data.cookie['connect.sid']
  return accept('No session id found.', false) unless sid
  data.sessionID = sid.substring(2, 26)
  # save the session store to the data object
  # (as required by the Session constructor)
  data.sessionStore = sessionStore
  sessionStore.get data.sessionID, (err, session) ->
    return accept err, false if err
    return accept 'No session', false unless session
    # create a session object, passing data as request and our
    # just acquired session data
    Session = connect.middleware.session.Session
    data.session = new Session(data, session)
    # TODO: accept fast, before deserialization?
    passport.deserializeUser data.session.passport.user, (err, userPassport) ->
      return accept 'passport error: ' + err, false if err
      user = data.session.user = userPassport.user
      data.session.userPassport = userPassport
      return accept null, true unless user
      api.findUser data.session.user.pub_id, (bbUser) ->
        return accept 'failed to load backbone user' unless bbUser
        data.session.bbUser = bbUser
        accept null, true

io.on 'connection', (socket) ->
  showNumberConnected()
  socket.on 'disconnect', ->
    showNumberConnected()

dbCallback = (err) ->
  console.error err if err

io.of('/drive').on 'connection', (socket) ->
  session = socket.handshake.session
  user = session.user
  bbUser = session.bbUser

  run = record_i_timeline = record_p_timeline = null

  do resetRun = ->
    run = null
    record_i_timeline = []
    record_p_timeline = []

  completeRun = ->
    return unless run
    console.log "Finalizing records for run: #{run.pub_id}"
    newValues =
      "record_i.timeline": record_i_timeline
      "record_p.timeline": record_p_timeline
    newValues.times = run.times if run.times
    newValues.time = run.time if run.time?
    db.runs.update { _id: run._id }, $set: newValues, dbCallback
    resetRun()

  socket.on 'disconnect', completeRun

  # TODO: Resume connections, or notify user if recording has stopped.

  socket.on 'start', (data) ->
    completeRun()
    resetRun()
    car = track = null
    done = _.after 2, ->
      return unless car and track
      # This is why I should have a model layer.
      db.tracks.update { _id: track._id }, { $inc: { count_drive: 1 } }, dbCallback
      # return  # Disable run recording
      return unless user
      newRun =
        car: car._id
        pub_id: makePubId()
        record_i: { keyMap: data.keyMap_i, timeline: [] }
        record_p: { keyMap: data.keyMap_p, timeline: [] }
        status: 'Unverified'
        track: track._id
        user: user._id
      console.log "Started run: #{newRun.pub_id}"
      db.runs.insert newRun, (err) ->
        return console.error 'Run insert error: ' + err if err
        return if run  # Another run was already started. Discard this one.
        run = newRun
    db.cars.findOne   pub_id: data.car,   (err, doc) -> car = doc;   done()
    db.tracks.findOne pub_id: data.track, (err, doc) -> track = doc; done()

  socket.on 'record_i', (data) ->
    Array::push.apply record_i_timeline, data.samples
  socket.on 'record_p', (data) ->
    Array::push.apply record_p_timeline, data.samples
  socket.on 'times', (data) ->
    # TODO: Also buffer times in the event that the run isn't ready yet.
    return unless run
    # TODO: Verification!
    run.times = data.times
    run.time = data.times[data.times.length - 1]

  awardCredit = ->
    credits = bbUser.credits + 1
    bbUser.save { credits }
    # db.users.update { _id: user._id }, { $set: { credits: bbUser.credits } }, dbCallback
    socket.emit 'updateuser',
      id: user.pub_id
      credits: credits
    return

  # awardCreditThrottled = _.throttle awardCredit, 1500, leading: no

  lastCall = Date.now()
  awardCreditThrottled = ->
    now = Date.now()
    elapsed = (now - lastCall) / 1000
    lastCall = now

    k = 4
    k2 = k * k
    x2 = elapsed * elapsed
    cdf = x2 / (x2 + k2)
    # cdf = Math.min 1, Math.pow(elapsed / 5000, 2)

    if Math.random() < cdf
      setTimeout awardCredit, 800

  socket.on 'advance', (data) ->
    return unless user
    return unless data.cp > 0
    awardCreditThrottled()
