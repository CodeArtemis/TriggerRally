(function() {
  var Schema, Session, SessionSchema, SessionStore, defaultCallback, mongoose,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  mongoose = require('mongeese').create();

  Schema = mongoose.Schema;

  SessionSchema = new Schema({
    sid: {
      type: String,
      required: true,
      unique: true
    },
    data: {
      type: String,
      "default": '{}'
    },
    expires: {
      type: Date,
      index: true
    }
  });

  Session = mongoose.model('Session', SessionSchema);

  defaultCallback = function(err) {};

  SessionStore = (function(_super) {

    __extends(SessionStore, _super);

    function SessionStore(options) {
      if (options != null) if (options.interval == null) options.interval = 60000;
      mongoose.connect(options.url);
      setInterval((function() {
        return Session.remove({
          expires: {
            '$lte': new Date()
          }
        }, defaultCallback);
      }), options.interval);
    }

    SessionStore.prototype.get = function(sid, cb) {
      if (cb == null) cb = defaultCallback;
      return Session.findOne({
        sid: sid
      }, function(err, session) {
        if (session != null) {
          try {
            return cb(null, JSON.parse(session.data));
          } catch (err) {
            return cb(err);
          }
        } else {
          return cb(err, session);
        }
      });
    };

    SessionStore.prototype.set = function(sid, data, cb) {
      var _ref;
      if (cb == null) cb = defaultCallback;
      try {
        return Session.update({
          sid: sid
        }, {
          sid: sid,
          data: JSON.stringify(data),
          expires: (data != null ? (_ref = data.cookie) != null ? _ref.expires : void 0 : void 0) != null ? data.cookie.expires : null
        }, {
          upsert: true
        }, cb);
      } catch (err) {
        return cb(err);
      }
    };

    SessionStore.prototype.destroy = function(sid, cb) {
      if (cb == null) cb = defaultCallback;
      return Session.remove({
        sid: sid
      }, cb);
    };

    SessionStore.prototype.all = function(cb) {
      if (cb == null) cb = defaultCallback;
      return Session.find({
        expires: {
          '$gte': new Date()
        }
      }, ['sid'], function(err, sessions) {
        var session;
        if (sessions != null) {
          return cb(null, (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = sessions.length; _i < _len; _i++) {
              session = sessions[_i];
              _results.push(session.sid);
            }
            return _results;
          })());
        } else {
          return cb(err);
        }
      });
    };

    SessionStore.prototype.clear = function(cb) {
      if (cb == null) cb = defaultCallback;
      return Session.drop(cb);
    };

    SessionStore.prototype.length = function(cb) {
      if (cb == null) cb = defaultCallback;
      return Session.count({}, cb);
    };

    return SessionStore;

  })(require('connect').session.Store);

  module.exports = SessionStore;

}).call(this);
