/**
 * `InternalOAuthError` error.
 *
 * @api private
 */
function InternalOAuthError(message, err) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.name = 'InternalOAuthError';
  this.message = message;
  this.oauthError = err;
};

/**
 * Inherit from `Error`.
 */
InternalOAuthError.prototype.__proto__ = Error.prototype;


/**
 * Expose `InternalOAuthError`.
 */
module.exports = InternalOAuthError;
