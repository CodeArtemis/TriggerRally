NVPEndpoint = require './nvp'
secret      = require './secret'

sandbox = no

params = if sandbox then secret.sandbox else secret.prod
opts = { sandbox }

nvp = new NVPEndpoint params, opts

module.exports =
  request: (params, callback) ->
    nvp.request params, callback

  redirectUrl: (TOKEN)->
    if sandbox
      "https://www.sandbox.paypal.com/incontext?token=#{TOKEN}"
    else
      "https://www.paypal.com/incontext?token=#{TOKEN}"
