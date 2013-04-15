_     = require 'underscore'
https = require 'https'
qs    = require 'querystring'

SANDBOX_API = 'api-3t.sandbox.paypal.com'
REGULAR_API = 'api-3t.paypal.com'
API_VERSION = '78.0'

# USER
# PWD
# SIGNATURE

module.exports = class NVPEndpoint
  constructor: (@params, opts) ->
    @sandbox = opts?.sandbox ? false
    params.VERSION or= opts?.version or API_VERSION

  request: (params, callback) ->
    params = _.extend [], @params, params
    query = qs.stringify params

    req_opts =
      host: if @sandbox then SANDBOX_API else REGULAR_API
      path: "/nvp?#{query}"

    req = https.get req_opts, (res) ->
      buffer = ''
      res.on 'data', (chunk) -> buffer += chunk
      res.on 'end', -> callback null, qs.parse(buffer), buffer

    req.on 'error', (e) -> callback "#{e} (#{query})"
