/**
 * Module dependencies.
 */
var passport = require('passport')
  , openid = require('openid')
  , util = require('util')


/**
 * `Strategy` constructor.
 *
 * The OpenID authentication strategy authenticates requests using the OpenID
 * 2.0 or 1.1 protocol.
 *
 * OpenID provides a decentralized authentication protocol, whereby users can
 * authenticate using their choice of OpenID provider.  Authenticating in this
 * this manner involves a sequence of events, including prompting the user to
 * enter their OpenID identifer and redirecting the user to their OpenID
 * provider for authentication.  Once authenticated, the user is redirected back
 * to the application with an assertion regarding the identifier.
 *
 * Applications must supply a `verify` callback which accepts an `identifier`,
 * and optionally a service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `returnURL`        URL to which the OpenID provider will redirect the user after authentication
 *   - `realm`            the part of URL-space for which an OpenID authentication request is valid
 *   - `profile`          enable profile exchange, defaults to _false_
 *   - `identifierField`  field name where the OpenID identifier is found, defaults to 'openid_identifier'
 *
 * Examples:
 *
 *     passport.use(new OpenIDStrategy({
 *         returnURL: 'http://localhost:3000/auth/openid/return',
 *         realm: 'http://localhost:3000/'
 *       },
 *       function(identifier, done) {
 *         User.findByOpenID(identifier, function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 *     passport.use(new OpenIDStrategy({
 *         returnURL: 'http://localhost:3000/auth/openid/return',
 *         realm: 'http://localhost:3000/',
 *         profile: true
 *       },
 *       function(identifier, profile, done) {
 *         User.findByOpenID(identifier, function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  if (!options.returnURL) throw new Error('OpenID authentication requires a returnURL option');
  if (!verify) throw new Error('OpenID authentication strategy requires a verify callback');
  
  passport.Strategy.call(this);
  this.name = 'openid';
  this._verify = verify;
  
  var extensions = [];
  if (options.profile) {
    var sreg = new openid.SimpleRegistration({
      "fullname" : true,
      "nickname" : true, 
      "email" : true, 
      "dob" : true, 
      "gender" : true, 
      "postcode" : true,
      "country" : true, 
      "timezone" : true,
      "language" : true
    });
    extensions.push(sreg);
  }
  if (options.profile) {
    var ax = new openid.AttributeExchange({
      "http://axschema.org/namePerson/first": "required",
      "http://axschema.org/namePerson/last": "required",
      "http://axschema.org/contact/email": "required"
    });
    extensions.push(ax);
  }
  
  this._relyingParty = new openid.RelyingParty(
    options.returnURL,
    options.realm,
    (options.stateless === undefined) ? false : options.stateless,
    (options.secure === undefined) ? true : options.secure,
    extensions);
      
  this._providerURL = options.providerURL;
  this._identifierField = options.identifierField || 'openid_identifier';
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);


/**
 * Authenticate request by delegating to an OpenID provider using OpenID 2.0 or
 * 1.1.
 *
 * @param {Object} req
 * @api protected
 */
Strategy.prototype.authenticate = function(req) {

  if (req.query && req.query['openid.mode']) {
    // The request being authenticated contains an `openid.mode` parameter in
    // the query portion of the URL.  This indicates that the OpenID Provider
    // is responding to a prior authentication request with either a positive or
    // negative assertion.  If a positive assertion is received, it will be
    // verified according to the rules outlined in the OpenID 2.0 specification.
    
    // NOTE: node-openid (0.3.1), which is used internally, will treat a cancel
    //       response as an error, setting `err` in the verifyAssertion
    //       callback.  However, for consistency with Passport semantics, a
    //       cancel response should be treated as an authentication failure,
    //       rather than an exceptional error.  As such, this condition is
    //       trapped and handled prior to being given to node-openid.
    
    if (req.query['openid.mode'] === 'cancel') { return this.fail(); }
    
    var self = this;
    this._relyingParty.verifyAssertion(req.url, function(err, result) {
      if (err) { return self.error(err); }
      if (!result.authenticated) { return self.error(new Error('OpenID authentication error')); }
      
      var profile = self._parseProfileExt(result);
      
      function verified(err, user) {
        if (err) { return self.error(err); }
        if (!user) { return self.fail(); }
        self.success(user);
      }
      
      var arity = self._verify.length;
      if (arity == 3) {
        self._verify(result.claimedIdentifier, profile, verified);
      } else {
        self._verify(result.claimedIdentifier, verified);
      }
    });
  } else {
    // The request being authenticated is initiating OpenID authentication.  By
    // default, an `openid_identifier` parameter is expected as a parameter,
    // typically input by a user into a form.
    //
    // During the process of initiating OpenID authentication, discovery will be
    // performed to determine the endpoints used to authenticate with the user's
    // OpenID provider.  Optionally, and by default, an association will be
    // established with the OpenID provider which is used to verify subsequent
    // protocol messages and reduce round trips.
  
    var identifier = undefined;
    if (req.body && req.body[this._identifierField]) {
      identifier = req.body[this._identifierField];
    } else if (req.query && req.query[this._identifierField]) {
      identifier = req.query[this._identifierField];
    } else if (this._providerURL) {
      identifier = this._providerURL;
    }
    
    if (!identifier) { return this.error(new Error('OpenID identifier undefined')); }

    var self = this;
    this._relyingParty.authenticate(identifier, false, function(err, providerUrl) {
      if (err || !providerUrl) { return self.error(err); }
      self.redirect(providerUrl);
    });
  }
}

/**
 * Parse user profile from OpenID response.
 *
 * Profile exchange can take place via OpenID extensions, the two common ones in
 * use are Simple Registration and Attribute Exchange.  If an OpenID provider
 * supports these extensions, the parameters will be parsed to build the user's
 * profile.
 *
 * @param {Object} params
 * @api private
 */
Strategy.prototype._parseProfileExt = function(params) {
  var profile = {};
  
  // parse simple registration parameters
  profile.displayName = params['fullname'];
  profile.emails = [{ value: params['email'] }];
  
  // parse attribute exchange parameters
  profile.name = { familyName: params['lastname'],
                   givenName: params['firstname'] };
  if (!profile.displayName) {
    profile.displayName = params['firstname'] + ' ' + params['lastname'];
  }
  if (!profile.emails) {
    profile.emails = [{ value: params['email'] }];
  }
  
  return profile;
}


/**
 * Expose `Strategy`.
 */ 
module.exports = Strategy;
