"use strict";

// Copyright (c) 2012 jareiko. All rights reserved.

// Module dependencies.

var express = require('express');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;

var config = require('./config');
var routes = require('./routes');
var objects = require('./objects');

var mongoose = require('mongoose');
var SessionMongoose = require("session-mongoose");

var User = mongoose.model('User');
var UserPassport = mongoose.model('UserPassport');
var Car = mongoose.model('Car');
var Track = mongoose.model('Track');
var Run = mongoose.model('Run');

// Configuration

console.log('Base directory: ' + __dirname);

// Global app object is accessible from other modules.
var app = module.exports = express.createServer();

var PORT = process.env.PORT || 80;
var DOMAIN = process.env.DOMAIN || 'triggerrally.com';
var URL_PREFIX = 'http://' + DOMAIN;

// Not used.
function multiref(obj) {
  var parts = Array.prototype.slice.call(arguments, 1)
  var o = obj;
  while (o && parts.length > 0) {
    o = o[parts.shift()];
  }
  return o;
}

// Authentication

var authenticateUser = function(profile, done) {
  var passport_id = profile.identifier ||
                    (profile.provider + profile.id);
  console.log('authenticateUser: ' + JSON.stringify(profile));
  console.log('authenticateUser: ' + passport_id);
  UserPassport
    .findOne({passport_id: passport_id})
    .populate('user')
    .run(function(error, userPassport) {
    if (error) done(error);
    else {
      var user = userPassport && userPassport.user || null;
      if (user) done(null, userPassport);
      else {
        if (!userPassport) {
          // No UserPassport yet, so create one.
          userPassport = new UserPassport();
        }
        // Create new user from passport profile.
        user = new User({
          name: profile.displayName || profile.username
        });
        if (profile.emails && profile.emails[0]) {
          user.email = profile.emails[0].value;
        }
        user.save(function(error) {
          if (error) done(error);
          else {
            userPassport.profile = profile;
            userPassport.user = user._id;
            userPassport.save(function(error) {
              done(error, userPassport);
              //res.redirect('/user/' + user.pub_id + '/edit');
            });
          }
        });
      }
    }
  });
};

var authenticationSuccessful = function(req, res) {
  var user = req.user;
  if (Array.isArray(user)) throw new Error('authenticationSuccessful: user array');
  //console.log('authenticationSuccessful: ' + JSON.stringify(user));
  res.redirect('/');
  // Directing users to edit their profile each time may be annoying.
  /*
  if (user.newbie) {
    // User has not yet saved their profile.
    res.redirect('/user/' + user.pub_id + '/edit');
    //res.end();
  } else {
    res.redirect('/');
    //res.end();
  }
  */
};

/*
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  function(email, password, done) {
    User.findOne({ _email: email }, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (!user.authenticate(password)) { return done(null, false); }
      return done(null, user);
    });
  }
));
*/

passport.use(new FacebookStrategy({
    clientID: config.FACEBOOK_APP_ID,
    clientSecret: config.FACEBOOK_APP_SECRET,
    callbackURL: URL_PREFIX + '/auth/facebook/callback'
  },
  function(accessToken, refreshToken, profile, done) {
    profile.auth = {
      accessToken: accessToken,
      refreshToken: refreshToken
    };
    authenticateUser(profile, done);
  }
));

passport.use(new GoogleStrategy({
    returnURL: URL_PREFIX + '/auth/google/return',
    realm: URL_PREFIX + '/'
  },
  function(identifier, profile, done) {
    // passport-oauth doesn't supply provider or id.
    profile.identifier = identifier;
    authenticateUser(profile, done);
  }
));

passport.use(new TwitterStrategy({
    consumerKey: config.TWITTER_APP_KEY,
    consumerSecret: config.TWITTER_APP_SECRET,
    callbackURL: URL_PREFIX + '/auth/twitter/callback'
  },
  function(token, tokenSecret, profile, done) {
    profile.auth = {
      token: token,
      tokenSecret: tokenSecret
    };
    authenticateUser(profile, done);
  }
));

passport.serializeUser(function(userPassport, done) {
  done(null, userPassport.id);
});

passport.deserializeUser(function(id, done) {
  UserPassport
    .findOne({ _id: id })
    .populate('user')
    .run(function (error, userPassport) {
    done(error, userPassport);
  });
});

app.configure(function() {
  express.logger.format('isodate', function(req, res) {
    return new Date().toISOString();
  });
  app.use(express.logger({
    format: '[:isodate] :status :response-time ms :method :url :referrer'
  }));
  /*
  app.use(function (req, res, next) {
    res.removeHeader("X-Powered-By");
    next();
  });
  */
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: config.SESSION_SECRET,
    cookie: {
      maxAge:  4 * 7 * 24 * 60 * 60 * 1000
    },
    store: new SessionMongoose({
      url: "mongodb://localhost/trigger-prod",
      interval: 120000 // expiration check worker run interval in millisec (default: 60000)
    })
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({
    src: __dirname + '/stylus',
    dest: __dirname + '/public'
  }));
  app.use(routes.defaultParams);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});
app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  // TODO: use a dev instance.
  mongoose.connect('mongodb://localhost/trigger-prod');
});
app.configure('production', function() {
  app.use(express.errorHandler({ dumpExceptions: true }));
  mongoose.connect('mongodb://localhost/trigger-prod');
});

// Helpers

var loadUrlUser = function(req, res, next) {
  User.findOne({ pub_id: req.params.idUser }, function(error, urlUser) {
    if (error) next(error);
    else {
      if (urlUser) {
        urlUser.isAuthenticated = req.user && req.user.user && req.user.user.id == urlUser.id;
        req.urlUser = urlUser;
        next();
      } else {
        res.send(404);
      }
    }
  });
};

var loadUrlTrack = function(req, res, next) {
  Track
    .findOne({ pub_id: req.params.idTrack })
    .populate('user')
    .run(function(error, urlTrack) {
    if (error) next(error);
    else {
      if (urlTrack) {
        urlTrack.isAuthenticated = req.user && req.user.user && req.user.user.id == urlTrack.user.id;
        req.urlTrack = urlTrack;
        next();
      } else {
        res.send(404);
      }
    }
  });
};

var loadUrlCar = function(req, res, next) {
  Car
    .findOne({ pub_id: req.params.idCar })
    .populate('user')
    .run(function(error, urlCar) {
    if (error) next(error);
    else {
      if (urlCar) {
        urlCar.isAuthenticated = req.user && req.user.user && req.user.user.id == urlCar.user.id;
        req.urlCar = urlCar;
        next();
      } else {
        res.send(404);
      }
    }
  });
};

var loadUrlRun = function(req, res, next) {
  Run
    .findOne({ pub_id: req.params.idRun })
    .populate('user')
    .populate('car')
    .populate('track')
    .run(function(error, urlRun) {
    if (error) next(error);
    else {
      if (urlRun) {
        urlRun.isAuthenticated = req.user && req.user.user && req.user.user.id == urlRun.user.id;
        req.urlRun = urlRun;
        next();
      } else {
        res.send(404);
      }
    }
  });
};

var editUser = function(req, res, next) {
  if (!req.urlUser.isAuthenticated) next('Unauthorized');
  else {
    req.editing = true;
    next();
  }
};

// Routes

app.get('/', routes.index);
app.get('/about', routes.about);
app.get('/login', routes.login);
app.get('/user/confirm', routes.userconfirm);
app.get('/user/:idUser', loadUrlUser, routes.user);
app.get('/user/:idUser/edit', loadUrlUser, editUser, routes.user);
app.post('/user/:idUser/save', loadUrlUser, editUser, routes.userSave);
app.get('/track/:idTrack', loadUrlTrack, routes.track);
app.get('/track/:idTrack/json', loadUrlTrack, routes.trackJson);
app.get('/car/:idCar', loadUrlCar, routes.car);
app.get('/car/:idCar/json', loadUrlCar, routes.carJson);
app.get('/run/:idRun', loadUrlRun, routes.run);
app.post('/run/new', routes.runSave);
app.get('/run/:idRun/replay', loadUrlRun, routes.runReplay);
app.get('/x/:idTrack/:idCar/drive', loadUrlTrack, loadUrlCar, routes.drive);
app.get('/x/:idTrack/:idCar/top', loadUrlTrack, loadUrlCar, routes.top);  // TODO: parallel load

app.post('/metrics', routes.metricsSave);

app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/callback', 
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    authenticationSuccessful);

app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/return', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    authenticationSuccessful);

app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { failureRedirect: '/login' }),
    authenticationSuccessful);

/*
app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login?status=failed' }),
    authenticationSuccessful
);
*/

app.get('/logout', function(req, res){
  req.logOut();
  res.redirect('/');
});

// Backward compatibility

app.get('/drive', function(req, res) {
  res.redirect('/x/Preview/Arbusu/drive', 301);
});

app.listen(PORT);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
