// Copyright (c) 2012 jareiko. All rights reserved.

var crypto = require('crypto');
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var common = require('./common');
var validate = require('./validate');

var VERIFY_PUB_ID_LENGTH = 20;


// Verify

var Verify = new Schema({
    pub_id    : { type: String, index: { unique: true } }
  , user      : { type: Schema.ObjectId, ref: 'User' }
}, { strict: true });

Verify.virtual('id')
  .get(function() {
    return this._id.toHexString();
  });

Verify.pre('save', function(next) {
  if (this.isNew) {
    // Creating new verify.
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id, VERIFY_PUB_ID_LENGTH);
  }
  next();
});


mongoose.model('Verify', Verify);
