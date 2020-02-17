/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
"use strict";

let id, pack;
const _                 = require('underscore');
const bodyParser        = require('body-parser');
const cookieParser      = require('cookie-parser');
const connect           = require('connect');
const compression       = require('compression');
const cookie            = require('cookie');
const express           = require('express');
const expressSession    = require('express-session');
const http              = require('http');
const logger            = require('morgan');
const methodOverride    = require('method-override');
const mongoose          = require('mongoose');
const mongoskin         = require('mongoskin');
const session_mongoose  = require('session-mongoose');
const socketio          = require('socket.io');
const stylus            = require('stylus');
const passport          = require('passport');
const FacebookStrategy  = require('passport-facebook').Strategy;
const GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy;
const TwitterStrategy   = require('passport-twitter').Strategy;
const LocalStrategy     = require('passport-local').Strategy;

// This has to come first to set up Mongoose schemas.
const objects           = require('./objects');

const api               = require('./api');
const config            = require('./config');
const { makePubId }     = require('./objects/common');
const routes            = require('./routes');

// stripe            = require('stripe')(config.stripe.API_KEY)

const getIsodate = () => new Date().toISOString();
logger.format('isodate', (req, res) => getIsodate());
const log = function(msg) {
  const isodate = getIsodate();
  return console.log(`[${isodate}] ${msg}`);
};

mongoose.set('debug', true);

mongoose.connection.on("error", function(err) {
  log("Could not connect to mongo server!");
  return log(err.message);
});

const SessionStore = session_mongoose(connect);
const sessionStore = new SessionStore({
  url: `mongodb://${config.MONGODB_HOST}/sessions`,
  // Expiration check worker run interval in millisec (default: 60000)
  interval: 120000
});

const User = mongoose.model('User');
const UserPassport = mongoose.model('UserPassport');
const Car = mongoose.model('Car');
const Track = mongoose.model('Track');
const Run = mongoose.model('Run');

mongoose.connect(config.MONGOOSE_URL);

// Alternate DB connection
const dbUrl = `${config.db.host}:${config.db.port}/${config.db.name}?auto_reconnect`;
const db = mongoskin.db(dbUrl, { safe: true });

db.bind('cars');
db.bind('runs');
db.bind('tracks');
db.bind('users');

log(`Base directory: ${__dirname}`);

const app = (module.exports = express());

const DOMAIN = process.env.DOMAIN || 'triggerrally.com';
const { NODE_ENV } = process.env;
const PORT = process.env.PORT || 80;
const PROTOCOL = process.env.PROTOCOL || 'http';
const PUBLIC_PORT = NODE_ENV === 'production' ? 80 : PORT;
const PORT_SUFFIX = PUBLIC_PORT === 80 ? "" : `:${PUBLIC_PORT}`;
const URL_PREFIX = `${PROTOCOL}://${DOMAIN}${PORT_SUFFIX}`;

const authenticateUser = function(profile, done) {
  const passport_id = profile.identifier || (profile.provider + profile.id);
  return UserPassport
    .findOne({passport_id})
    .populate('user')
    .exec(function(error, userPassport) {
      if (error) { return done(error); }
      let user = userPassport != null ? userPassport.user : undefined;
      if (user) { return done(null, userPassport); }
      if (userPassport == null) { userPassport = new UserPassport(); }
      // Create new user from passport profile.
      user = new User({
        name: profile.displayName || profile.username});
      // user.email = profile.emails[0].value if profile.emails?[0]
      return user.save(function(error) {
        if (error) { return done(error); }
        userPassport.profile = profile;
        userPassport.user = user._id;
        return userPassport.save(error => done(error, userPassport));
      });
  });
};
          //res.redirect('/user/' + user.pub_id + '/edit');

const authenticationSuccessfulAPI = function(req, res) {
  if (Array.isArray(req.user)) { throw new Error('authenticationSuccessfulAPI: req.user array'); }
  return res.redirect('/closeme');
};

const authenticationSuccessful = function(req, res) {
  if (Array.isArray(req.user)) { throw new Error('authenticationSuccessful: req.user array'); }
  return res.redirect('/');
};

//passport.use new LocalStrategy(
//  usernameField: 'email'
//  passwordField: 'password'
//, (email, password, done) ->
//  User.findOne
//    _email: email
//  , (err, user) ->
//    return done(err)  if err
//    return done(null, false)  unless user
//    return done(null, false)  unless user.authenticate(password)
//    done null, user
//)

// for i in ["", "/v1"]
//  passport.use "facebook#{i}", new FacebookStrategy(
//    clientID: config.FACEBOOK_APP_ID
//    clientSecret: config.FACEBOOK_APP_SECRET
//    callbackURL: "#{URL_PREFIX}#{i}/auth/facebook/callback"
//  , (accessToken, refreshToken, profile, done) ->
//    profile.auth = { accessToken, refreshToken }
//    authenticateUser profile, done
//  )
//  passport.use "google#{i}", new GoogleStrategy(
//    clientID: config.GOOGLE_CLIENT_ID
//    clientSecret: config.GOOGLE_CLIENT_SECRET
//    callbackURL: "#{URL_PREFIX}#{i}/auth/google/callback"
//  , (token, refreshToken, profile, done) ->
//    profile.auth = { token, refreshToken }
//    authenticateUser profile, done
//  )
//  passport.use "twitter#{i}", new TwitterStrategy(
//    consumerKey: config.TWITTER_APP_KEY
//    consumerSecret: config.TWITTER_APP_SECRET
//    callbackURL: "#{URL_PREFIX}#{i}/auth/twitter/callback"
//  , (token, tokenSecret, profile, done) ->
//    profile.auth = { token, tokenSecret }
//    authenticateUser profile, done
//  )

passport.serializeUser((userPassport, done) => done(null, userPassport.id));

passport.deserializeUser((id, done) =>
  UserPassport
    .findOne({_id: id})
    .populate('user')
    .exec((error, userPassport) => done(error, userPassport))
);

app.use(logger('[:isodate] :status :response-time ms :res[content-length] :method :url :referrer', {format: '[:isodate] :status :response-time ms :res[content-length] :method :url :referrer'}));
app.disable('x-powered-by');
app.use(compression());
app.use(stylus.middleware({
  src: __dirname + '/stylus',
  dest: __dirname + '/public'
})
);
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(function(req, res, next) {
  req.rawBody = '';
  // req.setEncoding('utf8')
  req.on('data', chunk => req.rawBody += chunk);
  return next();
});
app.use(bodyParser.urlencoded({
  extended: true
})
);
app.use(bodyParser.json());

app.use(cookieParser(config.SESSION_SECRET));
app.use(expressSession({
  secret: 'asecret',
  saveUninitialized: true,
  resave: true,
  cookie: {
    maxAge: 4 * 7 * 24 * 60 * 60 * 1000
  },

  store: sessionStore
})
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride());
app.use(function(req, res, next) {
  // Enable Chrome Frame if installed.
  res.setHeader('X-UA-Compatible', 'chrome=1');
  return next();
});
app.use(routes.defaultParams);

//
//// We can delay certain resources for debugging purposes.
//app.use(function(req, res, next) {
//  var delay = 0;
//  if (req.path.match('nice.png')) delay = 3000;
//  if (req.path.match('heightdetail1.jpg')) delay = 6000;
//  setTimeout(function() {
//    next();
//  }, delay);
//});
//

app.use(app.router);

// Send any path not otherwise handled to the unified app.
// TODO: Make the app show a 404 as appropriate.
app.use(routes.unified);

if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    console.error(err);
    return res.json(500, {
      error: "Internal Server Error",
      call_stack: (err.stack != null ? err.stack.split('\n') : undefined)
    }
    );
  });
}

if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    console.error(err);
    return res.json(500,
      {error: "Internal Server Error"});
  });
}

app.get('/v1/auth/facebook', passport.authenticate('facebook/v1'));
app.get('/v1/auth/facebook/callback', passport.authenticate('facebook/v1',
  {failureRedirect: '/login?popup=1'}
), authenticationSuccessfulAPI);
app.get('/v1/auth/google', passport.authenticate('google/v1', { scope : ['profile', 'email'] }));
app.get('/v1/auth/google/callback', passport.authenticate('google/v1',
  {failureRedirect: '/login?popup=1'}
), authenticationSuccessfulAPI);
app.get('/v1/auth/twitter', passport.authenticate('twitter/v1'));
app.get('/v1/auth/twitter/callback', passport.authenticate('twitter/v1'), authenticationSuccessfulAPI);

app.get('/v1/auth/logout', function(req, res) {
  req.logOut();
  return res.json({status: "ok"});
});

api.setup(app, passport);

app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback', passport.authenticate('facebook',
  {failureRedirect: '/login'}
), authenticationSuccessful);
app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google',
  {failureRedirect: '/login'}
), authenticationSuccessful);
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter',
  {failureRedirect: '/login'}
), authenticationSuccessful);

app.get('/logout', function(req, res) {
  req.logOut();
  return res.redirect('/');
});

app.get('/autologin', function(req, res, next) {
  const { code } = req.query;
  const passport_id = config.autologin[code];
  if (!passport_id) { return res.send(401); }
  return UserPassport
    .findOne({ passport_id })
    .populate('user')
    .exec(function(error, userPassport) {
      if (error) { return next(error); }
      if (!userPassport) { return res.send(500); }
      return req.login(userPassport, function(error) {
        if (error) { return next(error); }
        return res.redirect('/');
      });
  });
});

app.get('/closeme', routes.closeme);

// Backward compatibility.
app.get('/drive', (req, res) => res.redirect('/', 301));
app.get('/x/Preview/Arbusu/drive', (req, res) =>
  // req.params.idTrack = 'Preview'
  // req.params.idCar = 'Arbusu'
  // loadUrlTrack req, res, ->
  //   loadUrlCar req, res, ->
  //     routes.drive req, res
  // Preview is broken, so just redirect to home.
  res.redirect('/', 301)
);
app.get('/x/:idTrack/:idCar/drive', (req, res) => res.redirect(`/track/${req.params.idTrack}/drive`, 301));
// app.get '/track/:idTrack', (req, res) ->
//   res.redirect "/track/#{req.params.idTrack}/drive", 301

app.get('/login', routes.login);

// ppec = require './paypal/expresscheckout'
const qs = require('querystring');

const availablePacks = {
  ignition: {
    cost: '750',
    currency: 'credits',
    // name: 'Trigger Rally: Icarus Ignition'
    // description: 'A new car for Trigger Rally.'
    // url: 'https://triggerrally.com/ignition'
    products: [ 'ignition' ]
  },
  mayhem: {
    cost: '400',
    currency: 'credits',
    // name: 'Trigger Rally: Mayhem Monster Truck'
    // description: 'The Mayhem Monster Truck for Trigger Rally.'
    // url: 'https://triggerrally.com/mayhem'
    products: [ 'mayhem' ]
  }
};
  // full:
  //   name: 'Trigger Rally: Full Game'
  //   description: 'Access all tracks, the Arbusu, Mayhem and Icarus cars, and more!'
  //   url: 'https://triggerrally.com/purchase'
  //   products: [ 'packa', 'ignition', 'mayhem', 'paid' ]

const addCredits = (credits, cost) =>
  availablePacks[`credits${credits}`] = {
    name: `${credits} Credits - Trigger Rally`,
    description: `A package of ${credits} credits for your Trigger Rally account.`,
    url: "https://triggerrally.com/",
    cost,
    credits,
    currency: 'USD'
  }
;

addCredits('80',   '0.99');
addCredits('200',  '1.99');
addCredits('550',  '4.99');
addCredits('1200', '9.99');
addCredits('2000', '14.99');

// # addCredits '80',   '0.29'
// addCredits '200',  '0.59'
// addCredits '550',  '1.49'
// addCredits '1200', '2.99'
// addCredits '2000', '4.49'

// addCredits '200',  '0.59'
// addCredits '400',  '1.15'
// addCredits '750',  '1.95'
// addCredits '1150', '2.95'
// addCredits '2000', '4.49'

// Add an 'id' field matching the pack key.
for (id of Object.keys(availablePacks || {})) { pack = availablePacks[id]; pack.id = id; }

const grantPackToUser = function(pack, bbUser, method, res) {
  const saveData = {};
  if (pack.products) {
    saveData.products = _.union((bbUser.products != null ? bbUser.products : []), pack.products);
  }
  if (pack.credits) {
    saveData.credits = bbUser.credits + parseInt(pack.credits);
  }
  saveData.pay_history = bbUser.pay_history != null ? bbUser.pay_history : [];
  saveData.pay_history.push([ Date.now(), method, pack.currency, pack.cost, pack.id ]);
  console.log(saveData);
  return bbUser.save(saveData, {
    success() {
      log(`PURCHASE COMPLETE for user ${bbUser.id} using ${method}`);
      return res.redirect('/closeme');
    },
    error() {
      log(`user: ${JSON.stringify(bbUser)}`);
      return failure(res, 500, "COMPLETE BUT FAILED TO RECORD - VERY BAD!!");
    }
  }
  );
};

app.get('/checkout', function(req, res) {
  if (!req.user) { return res.send(401); }
  const packId = req.query.pack;

  pack = availablePacks[packId];
  if (!pack) { return res.send(404); }

  if (pack.products) {
    // Check that user doesn't already have this pack. Prevents accidental double-purchase.
    const newProducts = _.difference(pack.products, req.user.user.products);
    if (_.isEmpty(newProducts)) { return res.send(409); }
  }

  switch (pack.currency) {
    // Real currency payments are disabled.
    // when 'USD'
    //   switch req.query.method
    //     when 'paypal' then paypalCheckout pack, req, res
    //     when 'stripe' then stripeCheckout pack, req, res
    //     else res.send 400
    case 'credits': return creditsCheckout(pack, req, res);
    default: return res.send(400);
  }
});

// freeCheckout = (pack, req, res) ->
//   return res.send 402 unless pack.cost in [ 0, '0' ]
//   api.findUser req.user.user.pub_id, (bbUser) ->
//     return failure 500 unless bbUser
//     products = bbUser.products ? []
//     products = _.union products, pack.products
//     bbUser.save { products },
//       success: ->
//         res.redirect '/closeme'
//       error: ->
//         res.send 500

var creditsCheckout = function(pack, req, res) {
  if (!req.user) { return failure(res, 401); }
  return api.findUser(req.user.user.pub_id, function(bbUser) {
    if (!bbUser) { return failure(500); }
    const cost = parseInt(pack.cost);
    if (!(bbUser.credits >= cost)) { return res.send(402); }
    log(`user ${bbUser.id} purchased ${pack.id} for ${cost} credits`);
    let products = bbUser.products != null ? bbUser.products : [];
    products = _.union(products, pack.products);
    return bbUser.save({ products, credits: bbUser.credits - cost }, {
      success() {
        log(`saved user ${JSON.stringify(bbUser)}`);
        if (req.query.popup) {
          return res.redirect('/closeme');
        } else {
          return res.send(200);
        }
      },
      error() {
        return res.send(500);
      }
    }
    );
  });
};

// stripeCheckout = (pack, req, res) ->
//   return failure res, 401 unless req.user
//   api.findUser req.user.user.pub_id, (bbUser) ->
//     return failure res, 500 unless bbUser
//     charge = stripe.charges.create
//       amount: Math.round(pack.cost * 100)  # amount in cents
//       currency: "usd"
//       card: req.query.token
//       description: "Charge for user ID #{bbUser.id}"
//     , (err, charge) =>
//       if err
//         console.error err
//         return res.send 500
//       grantPackToUser pack, bbUser, 'stripe', res

const getPaymentParams = function(pack) {
  const { cost } = pack;
  return {
    PAYMENTREQUEST_0_CUSTOM: pack.id,
    PAYMENTREQUEST_0_PAYMENTACTION: 'Sale',
    PAYMENTREQUEST_0_AMT: cost,
    PAYMENTREQUEST_0_ITEMAMT: cost,  // Required for digital goods.
    RETURNURL: `${URL_PREFIX}/checkout/return`,
    CANCELURL: `${URL_PREFIX}/closeme`,
    REQCONFIRMSHIPPING: 0,
    NOSHIPPING: 1,
    ALLOWNOTE: 0,
    // HDRIMG: "https://triggerrally.com/images/TODO-750x90.png"  # TODO
    // HDRBORDERCOLOR
    // HDRBACKCOLOR
    // PAYFLOWCOLOR
    // EMAIL: req.user.user.email
    // LANDINGPAGE  # should test results of this
    BUYEREMAILOPTINENABLE: 1,
    // BUYERUSERNAME  # May be useful to increase user confidence?
    // BUYERREGISTRATIONDATE
    L_PAYMENTREQUEST_0_ITEMCATEGORY0: 'Digital',
    L_PAYMENTREQUEST_0_ITEMURL0: pack.url,
    L_PAYMENTREQUEST_0_QTY0: 1,
    L_PAYMENTREQUEST_0_AMT0: cost,
    L_PAYMENTREQUEST_0_DESC0: pack.description,
    L_PAYMENTREQUEST_0_NAME0: pack.name
  };
};

// paypalCheckout = (pack, req, res) ->
//   params = getPaymentParams pack
//   return res.send 404 unless params
//   params.METHOD = 'SetExpressCheckout'
//   log "Calling: #{JSON.stringify params}"
//   ppec.request params, (err, nvp_res) ->
//     if err
//       console.error "#{params.METHOD} error: #{err}"
//       return res.send 500
//     log "#{params.METHOD} response: #{JSON.stringify nvp_res}"
//     return res.send 500 if nvp_res.ACK isnt 'Success'
//     TOKEN = nvp_res.TOKEN
//     return res.send 500 unless TOKEN
//     res.redirect ppec.redirectUrl TOKEN

var failure = function(res, code, msg) {
  console.error(`PURCHASE FAILED: (${code}) ${msg}`);
  return res.send(code);
};

// app.get '/checkout/return', (req, res) ->
//   return failure res, 401 unless req.user
//   api.findUser req.user.user.pub_id, (bbUser) ->
//     return failure res, 500 unless bbUser
//     params =
//       METHOD: 'GetExpressCheckoutDetails'
//       TOKEN: req.query.token
//     log "Calling: #{JSON.stringify params}"
//     ppec.request params, paypalResponse_GetExpressCheckoutDetails.bind null, bbUser, req, res

// paypalResponse_GetExpressCheckoutDetails = (bbUser, req, res, err, nvp_res) ->
//   method = 'GetExpressCheckoutDetails'
//   return failure res, 500, "#{method} error: #{err}" if err
//   log "#{method} response: #{nvp_res}"
//   return failure res, 500 if nvp_res.ACK isnt 'Success'
//   packId = nvp_res.PAYMENTREQUEST_0_CUSTOM
//   pack = availablePacks[packId]
//   # TODO: Check that price and description match what we expect?
//   params = getPaymentParams pack
//   return failure res, 500 unless params
//   params.METHOD = 'DoExpressCheckoutPayment'
//   params.TOKEN = nvp_res.TOKEN
//   params.PAYERID = nvp_res.PAYERID
//   params.RETURNFMFDETAILS = 1
//   log "Calling: #{JSON.stringify params}"
//   ppec.request params, paypalResponse_DoExpressCheckoutPayment.bind null, bbUser, req, res

// paypalResponse_DoExpressCheckoutPayment = (bbUser, req, res, err, nvp_res) ->
//   method = 'DoExpressCheckoutPayment'
//   return failure res, 500, "#{method} error: #{err}" if err
//   log "#{method} response: #{JSON.stringify nvp_res}"
//   return failure res, 500 if nvp_res.ACK isnt 'Success'
//   grantPackToUser pack, bbUser,'paypal', res

//
//app.post('/login',
//    passport.authenticate('local', { failureRedirect: '/login?status=failed' }),
//    authenticationSuccessful
//);
//

const server = http.createServer(app);
const io = socketio.listen(server);
server.listen(PORT);
log(`Server listening on port ${PORT} in ${app.settings.env} mode`);


// TODO: Mirror http api over socket.io.

if (NODE_ENV === 'production') {
  io.set('log level', 1);
} else {
  io.set('log level', 2);
}

const showNumberConnected = function() {
  const clients = io.sockets.clients();
  const numConnected = clients.length;
  return log(`Connected sockets: ${numConnected}`);
};

io.set('authorization', function(data, accept) {
  // http://www.danielbaulig.de/socket-ioexpress/
  if (!data.headers.cookie) { return accept('No cookie transmitted.', false); }
  data.cookie = cookie.parse(data.headers.cookie);
  const sid = data.cookie['connect.sid'];
  if (!sid) { return accept('No session id found.', false); }
  data.sessionID = sid.substring(2, 26);
  // save the session store to the data object
  // (as required by the Session constructor)
  data.sessionStore = sessionStore;
  return sessionStore.get(data.sessionID, function(err, session) {
    if (err) { return accept(err, false); }
    if (!session) { return accept('No session', false); }
    // create a session object, passing data as request and our
    // just acquired session data
    const { Session } = connect.middleware.session;
    data.session = new Session(data, session);
    // TODO: accept fast, before deserialization?
    return passport.deserializeUser(data.session.passport.user, function(err, userPassport) {
      if (err) { return accept(`passport error: ${err}`, false); }
      const user = (data.session.user = userPassport.user);
      data.session.userPassport = userPassport;
      if (!user) { return accept(null, true); }
      return api.findUser(data.session.user.pub_id, function(bbUser) {
        if (!bbUser) { return accept('failed to load backbone user'); }
        data.session.bbUser = bbUser;
        return accept(null, true);
      });
    });
  });
});

io.on('connection', function(socket) {
  showNumberConnected();
  return socket.on('disconnect', () => showNumberConnected());
});

const dbCallback = function(err) {
  if (err) { return console.error(err); }
};

io.of('/drive').on('connection', function(socket) {
  let record_i_timeline, record_p_timeline, resetRun;
  const { session } = socket.handshake;
  const { user } = session;
  const { bbUser } = session;

  let run = (record_i_timeline = (record_p_timeline = null));

  (resetRun = function() {
    run = null;
    record_i_timeline = [];
    return record_p_timeline = [];
  })();

  const completeRun = function() {
    if (!run) { return; }
    console.log(`Finalizing records for run: ${run.pub_id}`);
    const newValues = {
      "record_i.timeline": record_i_timeline,
      "record_p.timeline": record_p_timeline
    };
    if (run.times) { newValues.times = run.times; }
    if (run.time != null) { newValues.time = run.time; }
    db.runs.update({ _id: run._id }, {$set: newValues}, dbCallback);
    return resetRun();
  };

  socket.on('disconnect', completeRun);

  // TODO: Resume connections, or notify user if recording has stopped.

  socket.on('start', function(data) {
    let track;
    completeRun();
    resetRun();
    let car = (track = null);
    const done = _.after(2, function() {
      if (!car || !track) { return; }
      // This is why I should have a model layer.
      db.tracks.update({ _id: track._id }, { $inc: { count_drive: 1 } }, dbCallback);
      // return  # Disable run recording
      if (!user) { return; }
      const newRun = {
        car: car._id,
        pub_id: makePubId(),
        record_i: { keyMap: data.keyMap_i, timeline: [] },
        record_p: { keyMap: data.keyMap_p, timeline: [] },
        status: 'Unverified',
        track: track._id,
        user: user._id
      };
      console.log(`Started run: ${newRun.pub_id}`);
      return db.runs.insert(newRun, function(err) {
        if (err) { return console.error(`Run insert error: ${err}`); }
        if (run) { return; }  // Another run was already started. Discard this one.
        return run = newRun;
      });
    });
    db.cars.findOne({pub_id: data.car},   function(err, doc) { car = doc;   return done(); });
    return db.tracks.findOne({pub_id: data.track}, function(err, doc) { track = doc; return done(); });
  });

  socket.on('record_i', data => Array.prototype.push.apply(record_i_timeline, data.samples));
  socket.on('record_p', data => Array.prototype.push.apply(record_p_timeline, data.samples));
  socket.on('times', function(data) {
    // TODO: Also buffer times in the event that the run isn't ready yet.
    if (!run) { return; }
    // TODO: Verification!
    run.times = data.times;
    return run.time = data.times[data.times.length - 1];
});

  const awardCredit = function() {
    const credits = bbUser.credits + 1;
    bbUser.save({ credits });
    // db.users.update { _id: user._id }, { $set: { credits: bbUser.credits } }, dbCallback
    socket.emit('updateuser', {
      id: user.pub_id,
      credits
    }
    );
  };

  // awardCreditThrottled = _.throttle awardCredit, 1500, leading: no

  let lastCall = Date.now();
  const awardCreditThrottled = function() {
    const now = Date.now();
    const elapsed = (now - lastCall) / 1000;
    lastCall = now;

    const k = 4;
    const k2 = k * k;
    const x2 = elapsed * elapsed;
    const cdf = x2 / (x2 + k2);
    // cdf = Math.min 1, Math.pow(elapsed / 5000, 2)

    if (Math.random() < cdf) {
      return setTimeout(awardCredit, 800);
    }
  };

  return socket.on('advance', function(data) {
    if (!user) { return; }
    if (!(data.cp > 0)) { return; }
    return awardCreditThrottled();
  });
});
