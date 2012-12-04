// Copyright (c) 2012 jareiko. All rights reserved.

// Utilities to load database objects.

var _ = require('underscore');
var crypto = require('crypto');
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var common = require('./common');
var validate = require('./validate');


var Environment = new Schema({
    pub_id    : { type: String, index: { unique: true } }
  , name      : { type: String }
  , desc      : { type: String }
  , scenery   : Schema.Types.Mixed
  , terrain   : Schema.Types.Mixed
  , cars      : { type: Array, get: function(cars) { return this.populatedCars || cars; } }
}, { strict: true });

Environment.pre('save', function(next) {
  if (this.isNew) {
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id);
  }
  next();
});


var Track = new Schema({
    pub_id    : { type: String, index: { unique: true } }
  , name      : { type: String, trim: true, validate: [validate.goosify(validate.required), 'name'] }
  , env       : { type: Schema.ObjectId, ref: 'Environment' }
  , user      : { type: Schema.ObjectId, ref: 'User' }
  , config    : Schema.Types.Mixed
}, { strict: true });

Track.virtual('created')
  .get(function() {
    return new Date(parseInt(this._id.toHexString().substring(0, 8), 16) * 1000);
  });

Track.pre('save', function(next) {
  if (this.isNew) {
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id);
  }
  next();
});



mongoose.model('Environment', Environment);
mongoose.model('Track', Track);
