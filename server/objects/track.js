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
    pub_id          : { type: String, index: { unique: true } }
  , name            : { type: String, trim: true }
  , env             : { type: Schema.ObjectId, ref: 'Environment' }
  , user            : { type: Schema.ObjectId, ref: 'User', index: true }
  , config          : Schema.Types.Mixed
  , modified        : { type: Date }
  , parent          : { type: Schema.ObjectId, ref: 'Track' }
  , published       : { type: Boolean, default: false }
  , count_drive     : { type: Number, default: 0 }
  , count_copy      : { type: Number, default: 0 }
  , count_fav       : { type: Number }
  , prevent_copy    : { type: Boolean, default: false }
}, { strict: true });

Track.statics.findAndModify = function() {
  return this.collection.findAndModify.apply(this.collection, arguments);
};

Track.virtual('created')
  .get(function() {
    return new Date(parseInt(this._id.toHexString().substring(0, 8), 16) * 1000);
  });

Track.virtual('created_ago')
  .get(function() {
    return common.formatDateAgo(this.created);
  });

Track.virtual('modified_ago')
  .get(function() {
    var modified = this.modified || this.created;
    return common.formatDateAgo(modified);
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
