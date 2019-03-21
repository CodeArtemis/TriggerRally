/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let NVPEndpoint;
const _     = require('underscore');
const https = require('https');
const qs    = require('querystring');

const SANDBOX_API = 'api-3t.sandbox.paypal.com';
const REGULAR_API = 'api-3t.paypal.com';
const API_VERSION = '78.0';

// USER
// PWD
// SIGNATURE

module.exports = (NVPEndpoint = class NVPEndpoint {
  constructor(params, opts) {
    this.params = params;
    this.sandbox = (opts != null ? opts.sandbox : undefined) != null ? (opts != null ? opts.sandbox : undefined) : false;
    if (!params.VERSION) { params.VERSION = (opts != null ? opts.version : undefined) || API_VERSION; }
  }

  request(params, callback) {
    params = _.extend([], this.params, params);
    const query = qs.stringify(params);

    const req_opts = {
      host: this.sandbox ? SANDBOX_API : REGULAR_API,
      path: `/nvp?${query}`
    };

    const req = https.get(req_opts, function(res) {
      let buffer = '';
      res.on('data', chunk => buffer += chunk);
      return res.on('end', () => callback(null, qs.parse(buffer), buffer));
    });

    return req.on('error', e => callback(`${e} (${query})`));
  }
});
