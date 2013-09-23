// Copyright (c) 2012 jareiko. All rights reserved.

var crypto = require('crypto');
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var common = require('./common');
var validate = require('./validate');


// User

var User = new Schema({
    pub_id      : { type: String, index: { unique: true } }
  , name        : { type: String, trim: true, validate: [validate.goosify(validate.required), 'name'] }
  , admin       : { type: Boolean, default: false }
  , picture     : String
  , products    : [ String ]
  , favorite_tracks : [ { type: Schema.ObjectId, ref: 'Track', index: true } ]
  , credits     : { type: Number, default: 0 }
}, { strict: true });

User.virtual('id')
  .get(function() {
    return this._id.toHexString();
  });

User.virtual('created')
  .get(function() {
    return new Date(parseInt(this.id.substring(0, 8), 16) * 1000);
  });

User.virtual('gravatar_hash') // DEPRECATED
  .get(function() {
    var email = this.email || '';
    return common.makeHashMD5((email).toLowerCase());
  });

User.pre('save', function(next) {
  // Check virtual attributes.
  if (this.isNew) {
    // Creating new user.
    this._id = this._id || new mongodb.ObjectID();
    this.pub_id = common.makePubId(this.id);
  }
  next();
});


// UserPassport

var UserPassport = new Schema({
    user        : { type: Schema.ObjectId, ref: 'User' }
  , _profile    : Schema.Types.Mixed
  , passport_id : { type: String, index: { unique: true } }
}, { strict: true });

UserPassport.virtual('id')
  .get(function() {
    return this._id.toHexString();
  });

UserPassport.virtual('profile')
  .set(function(profile) {
    this._profile = profile;
    this.markModified('_profile');
    this.passport_id = profile.identifier || (profile.provider + profile.id);
  })
  .get(function() { return this._profile; });

UserPassport.virtual('id_prov')
  .get(function() {
    var profile = this.profile;
    return profile.provider + ' (' +
           (profile.username || profile.displayName || profile.id) + ')';
  });


mongoose.model('User', User);
mongoose.model('UserPassport', UserPassport);
