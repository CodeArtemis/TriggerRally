// Copyright (c) 2012 jareiko. All rights reserved.

var objects = require('../objects');
var mongoose = require('mongoose');
var async = require('async');
var _ = require('underscore');

var User = mongoose.model('User');
var Verify = mongoose.model('Verify');
var Car = mongoose.model('Car');
var Track = mongoose.model('Track');
var Run = mongoose.model('Run');
var MetricsRecord = mongoose.model('MetricsRecord');

var alpEnvId = new mongoose.Types.ObjectId('506754342668a4626133ccd7');

exports.defaultParams = function(req, res, next) {
  req.jadeParams = {
      title: null
    , user: req.user && req.user.user || null
    , userPassport: req.user
    , editing: false
    , isChrome: /Chrome/.test(req.headers['user-agent'])
    , randomSmiley: function() {
      smileys = [
        "smiley.png",
        "smile.png",
        "smirk.png",
        "relaxed.png",
        "grinning.png",
        "yum.png",
        "sunglasses.png",
        "satisfied.png",
        "stuck_out_tongue.png",
        "innocent.png"
      ];
      var idx = Math.floor(Math.random() * smileys.length);
      var url = "https://triggerrally.com/emojis/" + smileys[idx];
      return encodeURIComponent(url);
    }
  };
  next();
};

exports.unified = function(req, res) {
  res.render('main');
};

exports.index = function(req, res) {
  if (false) {
    req.jadeParams.recentTracks = null;
    res.render('index', req.jadeParams);
  } else {
    var query = { published: true };
    if (!(req.user && req.user.user.admin)) query.env = alpEnvId;
    Track
      .find(query)
      .sort({modified: -1})
      .limit(10)
      .populate('user')  // Is this too slow?
      .exec(function(err, tracks) {
        if (err) {
          console.log("Error fetching tracks:");
          console.log(err);
          return res.send(500);
        }
        req.jadeParams.recentTracks = tracks;
        res.render('index', req.jadeParams);
      });
  }
};

exports.closeme = function(req, res) {
  res.render('closeme', req.jadeParams);
};

exports.recentTracks = function(req, res) {
  var query = {};
  if (!(req.user && req.user.user.admin)) query.env = alpEnvId;
  Track
    .find(query)
    .sort({modified: -1})
    .limit(50)
    .populate('user')  // Is this too slow?
    .exec(function(err, tracks) {
      if (err) {
        console.log("Error fetching tracks:");
        console.log(err);
        return res.send(500);
      }
      req.jadeParams.title = 'Recently modified tracks';
      req.jadeParams.recentTracks = tracks;
      res.render('recenttracks', req.jadeParams);
    });
};

exports.about = function(req, res) {
  req.jadeParams.title = 'About';
  res.render('about', req.jadeParams);
};

exports.requirements = function(req, res) {
  req.jadeParams.title = 'Requirements';
  res.render('requirements', req.jadeParams);
};

exports.down = function(req, res) {
  req.jadeParams.title = 'Down';
  res.statusCode = 503;
  res.render('down', req.jadeParams);
};

exports.login = function(req, res) {
  req.jadeParams.title = 'Log In';
  req.jadeParams.validate = {};
  req.jadeParams.popup = req.query['popup'] || false;
  res.render('login', req.jadeParams);
};

/*
exports.verify = function(res, req) {
  require('passport').authenticate('local')(req, res, function() {
    res.redirect('/user/' + req.user.pub_id + '/edit');
  });
};
*/

exports.userconfirm = function(req, res) {
  req.jadeParams.title = 'Confirm';
  req.jadeParams.validate = {};
  res.render('confirmcreate', req.jadeParams);
};

exports.user = function(req, res) {
  function next(runs, tracks) {
    req.jadeParams.title = req.urlUser.name;
    req.jadeParams.urlUser = req.urlUser;
    req.jadeParams.editing = req.editing || false;
    req.jadeParams.validate = objects.validation.User.profileValidator;
    req.jadeParams.runs = runs;
    req.jadeParams.tracks = tracks;
    res.render('user', req.jadeParams);
  }
  if (req.editing) next()
  else Run
    .find({ user: req.urlUser.id })
    .limit(500)
    .sort({_id: -1})
    .populate('track', {'pub_id':1, 'name':1})
    .populate('car', {'pub_id':1, 'name':1})
    .exec(function(error, runs) {
      if (error) {
        console.log('Error fetching runs:');
        console.log(error);
        // Continue despite the error.
      }
      var query = { user: req.urlUser.id };
      if (!(req.user && req.user.user.admin)) query.env = alpEnvId;
      Track
        .find(query)
        .limit(500)
        .sort({_id: 'desc'})
        .populate('parent', {'pub_id':1, 'name':1})
        .populate('user')
        .exec(function(error, tracks) {
          if (error) {
            console.log('Error fetching tracks:');
            console.log(error);
            // Continue despite the error.
          }
          next(runs, tracks);
        });
    });
};

exports.userSave = function(req, res) {
  var user = req.urlUser;
  // A user is no longer a newbie after updating their profile.
  user.newbie = false;
  // TODO: Find a better way to set multiple attributes?
  var attribs = [ 'name', 'realname', 'email', 'bio', 'website', 'location' ];
  attribs.forEach(function(attrib) {
    user[attrib] = req.body[attrib];
  });
  var prefsFlags = [ 'audio', 'shadows', 'terrainhq' ];
  prefsFlags.forEach(function(flag) {
    user.prefs[flag] = (req.body[flag] === "on");
  });
  user.save(function(error) {
    // TODO: Redirect back to wherever user clicked "log in" from.
    if (error) {
      console.log('Error updating user:');
      console.log(error);
      res.send(500);
    } else res.redirect('/user/' + req.urlUser.pub_id);
  });
};

exports.track = function(req, res) {
  req.jadeParams.title = req.urlTrack.name;
  req.jadeParams.urlTrack = req.urlTrack;
  res.render('track', req.jadeParams);
};

// TODO: Move these to Schema toObject?
function sanitizeUser(user) {
  return {
    id: user.pub_id,
    name: user.name,
    gravatar_hash: user.gravatar_hash
  };
}

// TODO: Delete this horrible code.
function sanitizeCars(cars) {
  var result = [], i, car;
  for (i = 0; i < cars.length; ++i) {
    car = cars[i];
    result.push({
      id: car.pub_id,
      name: car.name,
      config: car.config
    })
  }
  return result;
}

function sanitizeEnv(env) {
  if (env) return {
    id: env.pub_id,
    name: env.name,
    desc: env.desc,
    scenery: env.scenery,
    terrain: env.terrain,
    cars: sanitizeCars(env.cars)
  }; else return null;
}

function sanitizeTrack(track) {
  return {
    id: track.pub_id,
    name: track.name,
    env: sanitizeEnv(track.env),
    config: track.config,
    user: sanitizeUser(track.user),
    published: track.published
  };
}

exports.trackDrive = function(req, res) {
  // TODO: Fix this!! Hack alert!!!
  var car = 'ArbusuG';
  if (req.urlTrack.pub_id === 'Preview') {
    car = 'Arbusu';
  }
  res.redirect('/x/' + req.urlTrack.pub_id + '/' + car + '/drive');
};

exports.car = function(req, res) {
  req.jadeParams.title = req.urlCar.name;
  req.jadeParams.urlCar = req.urlCar;
  res.render('car', req.jadeParams);
};

exports.carJson = function(req, res) {
  if (req.editing) {
    req.jadeParams.title = req.urlCar.name;
    req.jadeParams.urlCar = req.urlCar;
    req.jadeParams.editing = true;
    req.jadeParams.validate = objects.validation.Car.validator;
    res.render('carjson', req.jadeParams);
  } else {
    res.contentType('json');
    res.send(req.urlCar.config);
  }
};

exports.carJsonSave = function(req, res) {
  var car = req.urlCar;
  car.name = req.body.name;
  car.pub_id = req.body.pub_id;
  car.config = JSON.parse(req.body.config);
  car.save(function(error) {
    if (error) {
      console.log('Error updating car:');
      console.log(error);
      res.send(500);
    } else {
      if (req.header('referer').match('/json/edit$')) {
        res.redirect('/car/' + car.pub_id + '/json/edit');
      } else {
        res.send(200);
      }
    }
  });
};

exports.drive = function(req, res) {
  topRuns(req.urlTrack.id, req.urlCar.id, 1, function(error, runs) {
    if (error) runs = [];
    req.jadeParams.title = 'Drive';
    //req.jadeParams.trackData = sanitizeTrack(req.urlTrack.toJSON());
    req.jadeParams.trackData = sanitizeTrack(req.urlTrack.toObject({ getters:true }));
    req.jadeParams.urlTrack = req.urlTrack;  // For older versions.
    req.jadeParams.urlCar = req.urlCar;
    req.jadeParams.runs = runs;
    res.render('drive', req.jadeParams);
  });
};

function topRuns(track, car, limit, callback) {
  Run
    .find()
    .where('track', track)
    .where('car', car)
    .where('time', { $not: { $type: 10 } })  // Exclude null times.
    .limit(limit)
    .sort({time: 'asc'})
    .populate('user', {'pub_id':1, 'name':1, 'email':1})
    .exec(callback);
};

exports.top = function(req, res) {
  topRuns(req.urlTrack.id, req.urlCar.id, 50, function(error, runs) {
    if (error) {
      console.log('Error fetching runs:');
      console.log(error);
      res.send(500);
    } else {
      req.jadeParams.title = 'Top times';
      req.jadeParams.urlTrack = req.urlTrack;
      req.jadeParams.urlCar = req.urlCar;
      req.jadeParams.runs = runs;
      res.render('top', req.jadeParams);
    }
  });
};

exports.run = function(req, res) {
  req.jadeParams.title = req.urlRun.name;
  req.jadeParams.urlRun = req.urlRun;
  res.render('run', req.jadeParams);
};

exports.runSave = function(req, res) {
  if (req.user && req.user.user && req.user.user.pub_id == req.body.user) {
    async.parallel({
      car: function(cb){
        Car.findOne({ pub_id: req.body.car }, function(err, doc){
          cb(err, doc);
        });
      },
      track: function(cb){
        Track.findOne({ pub_id: req.body.track }, function(err, doc){
          cb(err, doc);
        });
      }
    }, function(error, data) {
      if (error) {
        console.log('Error fetching data for run:');
        console.log(error);
        res.send(500);
      } else {
        if (!data.car) {
          console.log('Error loading car');
          res.send(500);
        } else if (!data.track) {
          console.log('Error loading track');
          res.send(500);
        } else {
          var run = new Run({
            user: req.user.user,
            car: data.car,
            track: data.track,
            status: 'Unverified',
            time: JSON.parse(req.body.time),
            record_i: JSON.parse(req.body.record_i),
            record_p: JSON.parse(req.body.record_p)
          });
          run.save(function(error) {
            if (error) {
              console.log('Error saving run:');
              console.log(error);
              res.send(500);
            } else {
              res.send(JSON.stringify({
                run: run.pub_id
              }));
              // We duplicate params because they're not populated in run. Bug?
              //verifyRun(run, req.user, data.track, data.car);
            }
          });
        }
      }
    });
  } else {
    res.send(401);
  }
};

exports.runReplay = function(req, res) {
  req.jadeParams.urlRun = req.urlRun;
  res.render('replay', req.jadeParams);
};

exports.metricsSave = function(req, res) {
  // Don't make the browser wait for this to finish.
  res.send(200);
  async.parallel({
    car: function(cb){
      Car.findOne({ pub_id: req.body.car }, function(err, doc){
        cb(err, doc);
      });
    },
    track: function(cb){
      Track.findOne({ pub_id: req.body.track }, function(err, doc){
        cb(err, doc);
      });
    }
  }, function(error, data) {
    if (error) {
      console.log('Error fetching data for metrics:');
      console.log(error);
    } else {
      if (!data.car) {
        console.log('Error loading car for metrics');
      } else if (!data.track) {
        console.log('Error loading track for metrics');
      } else {
        var params = req.body;
        params.performanceData = JSON.parse(params.performanceData);
        params.userAgent = req.headers['user-agent'];
        params.car = data.car;
        params.track = data.track;
        var metricsRecord = new MetricsRecord(params);
        metricsRecord.save(function(error) {
          if (error) {
            console.log('Error saving metrics:');
            console.log(error);
          }
        });
      }
    }
  });
};
