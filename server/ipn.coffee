https = require 'https'

URL = 'www.sandbox.paypal.com'

module.exports =
  handleIPN: (req, res) ->
    res.send 200

    body = 'cmd=_notify-validate&' + req.rawBody

    options =
      host: URL
      method: 'POST'
      path: '/cgi-bin/webscr'
      headers: {'Content-Length': body.length}

    validate = https.request options, (res) ->
      response = ''
      res.on 'data', (chunk) -> response += chunk
      res.on 'end', ->
        return console.log "Invalid IPN received" if response isnt 'VERIFIED'
        console.log "Verified IPN:"
        console.log req.body

    validate.write body
    validate.end
