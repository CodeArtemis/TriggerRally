mongoskin = require 'mongoskin'

config = require '../config'

dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"

module.exports = mongoskin.db dbUrl, { safe: false }
