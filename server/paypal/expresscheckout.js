/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const NVPEndpoint = require('./nvp');
const secret      = require('./secret');

const sandbox = false;

const params = sandbox ? secret.sandbox : secret.prod;
const opts = { sandbox };

const nvp = new NVPEndpoint(params, opts);

module.exports = {
  request(params, callback) {
    return nvp.request(params, callback);
  },

  redirectUrl(TOKEN){
    if (sandbox) {
      return `https://www.sandbox.paypal.com/incontext?token=${TOKEN}`;
    } else {
      return `https://www.paypal.com/incontext?token=${TOKEN}`;
    }
  }
};
