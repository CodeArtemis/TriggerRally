// Copyright (c) 2012 jareiko. All rights reserved.

// Utilities to load database objects.

var _ = require('underscore');
var crypto = require('crypto');
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var common = require('./common');
// TODO: Clean up validate so we don't have to require it twice.
var validate = require('./validate');

_.extend(exports, require('./comment'));
_.extend(exports, require('./track'));
_.extend(exports, require('./user'));
_.extend(exports, require('./validate'));
_.extend(exports, require('./verify'));


// Car

var Car = new Schema({
    pub_id    : { type: String, index: { unique: true } }
  , name      : { type: String, trim: true, validate: [validate.goosify(validate.required), 'name'] }
  , user      : { type: Schema.ObjectId, ref: 'User' }
  , config    : Schema.Types.Mixed
  , product   : String
}, { strict: true });

Car.virtual('created')
  .get(function() {
    return new Date(parseInt(this._id.toHexString().substring(0, 8), 16) * 1000);
  });

Car.pre('save', function(next) {
  if (this.isNew) {
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id);
  }
  next();
});

// Run

var Run = new Schema({
    pub_id    : { type: String, index: { unique: true } }
  , user      : { type: Schema.ObjectId, ref: 'User' }
  , car       : { type: Schema.ObjectId, ref: 'Car' }
  , track     : { type: Schema.ObjectId, ref: 'Track' }
  , status    : { type: String, enum: [ 'Unverified', 'Processing', 'Verified', 'Error' ]}
  , time      : { type: Number, index: { sparse: true } }
  , record_i  : Schema.Types.Mixed
  , record_p  : Schema.Types.Mixed
}, { strict: true });

Run.virtual('created')
  .get(function() {
    return new Date(parseInt(this._id.toHexString().substring(0, 8), 16) * 1000);
  });

Run.virtual('created_ago')
  .get(function() {
    return common.formatDateAgo(this.created);
  });

function padZero(val, digits) {
  return(1e15 + val + '').slice(-digits);
};

Run.virtual('time_readable')
  .get(function() {
    var time = this.time;
    if (time) {
      var mins = Math.floor(time / 60);
      time -= mins * 60;
      var secs = Math.floor(time);
      time -= secs;
      var millis = Math.floor(time * 1000);
      return mins + ':' + padZero(secs, 2) + '.' + padZero(millis, 3);
    } else {
      return 'DNF';
    }
  });

Run.pre('save', function(next) {
  if (this.isNew) {
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id);
  }
  next();
});


// Metrics

var MetricsRecord = new Schema({
    performanceData   : Schema.Types.Mixed
  , userAgent         : String
  , car               : { type: Schema.ObjectId, ref: 'Car' }
  , track             : { type: Schema.ObjectId, ref: 'Track' }
}, { strict: true });



mongoose.model('Car', Car);
mongoose.model('Run', Run);
mongoose.model('MetricsRecord', MetricsRecord);
