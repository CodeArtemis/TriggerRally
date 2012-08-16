// Copyright (c) 2012 jareiko. All rights reserved.

// Validation
// These functions return null if valid, or an error if invalid.

// Each function should be self-contained for transmission to client.
// TODO: Use now.js instead?

var validate = exports;

validate.optional = function(val) {
  return (
    val && val.length > 100 && 'No more than 100 characters please' ||
    null);
};

validate.required = function(val) {
  return (
    !val && 'Required' ||
    val.length < 3 && 'At least 3 characters please' ||
    val.length > 60 && 'No more than 60 characters please' ||
    val.match(/[_\`\~\!\@\#\£\$\%\^\*\[\]\{\}\\\|\;\:\'\"\<\>\?]/) && 'Contains invalid characters' ||
    //'
    null);
};

validate.email = function(val) {
  return (
    !val && 'Required' ||
    val.length > 60 && 'No more than 60 characters please' ||
    val.match(/[^a-zA-Z0-9@._+-]/) && 'Contains invalid characters' ||
    null);
};

// Utility to invert [null|error] to [true|false] for Mongoose.
validate.goosify = function(fn) {
  return function(value) {
    return !fn(value);
  };
}



// CLIENT SIDE VALIDATION below this point.

// TODO: Merge this with Mongoose's validation.

exports.validation = {};

exports.validation.User = {};
exports.validation.User.profileValidator = {
  name: validate.required,
  //email: validate.email,
  bio: validate.optional,
  location: validate.optional,
  website: validate.optional
};

exports.validation.Track = {};
exports.validation.Track.validator = {
  name: validate.required,
  pub_id: validate.required
};

exports.validation.Car = {};
exports.validation.Car.validator = {
  name: validate.required,
  pub_id: validate.required
};
