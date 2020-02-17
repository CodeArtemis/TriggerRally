/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const https = require('https');

const URL = 'www.sandbox.paypal.com';

module.exports = {
  handleIPN(req, res) {
    res.send(200);

    const body = `cmd=_notify-validate&${req.rawBody}`;

    const options = {
      host: URL,
      method: 'POST',
      path: '/cgi-bin/webscr',
      headers: {'Content-Length': body.length}
    };

    const validate = https.request(options, function(res) {
      let response = '';
      res.on('data', chunk => response += chunk);
      return res.on('end', function() {
        if (response !== 'VERIFIED') { return console.log("Invalid IPN received"); }
        console.log("Verified IPN:");
        return console.log(req.body);
      });
    });

    validate.write(body);
    return validate.end;
  }
};
