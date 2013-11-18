
var mongodb = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var common = require('./common');



// Comments do not currently have their own pub_id.

var Comment = new Schema({
    parent    : { type: String, index: true }
  , user      : { type: Schema.ObjectId, ref: 'User' }
  , text      : String
}, { strict: true });

Comment.virtual('created')
  .get(function() {
    return new Date(parseInt(this._id.toHexString().substring(0, 8), 16) * 1000);
  });

Comment.virtual('created_ago')
  .get(function() {
    return common.formatDateAgo(this.created);
  });

// Comment.pre('save', function(next) {
//   if (this.isNew) {
//     this._id = this._id || new mongodb.ObjectID();
//     this.pub_id = common.makePubId(this.id);
//   }
//   next();
// });

mongoose.model('Comment', Comment);
