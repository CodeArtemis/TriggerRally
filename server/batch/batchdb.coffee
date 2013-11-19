mongoskin = require 'mongoskin'

config = require '../config'

dbUrl = "#{config.db.host}:#{config.db.port}/#{config.db.name}?auto_reconnect"

db = mongoskin.db dbUrl, { safe: false }

db.bind 'comments'
db.bind 'runs'
db.bind 'tracks'
db.bind 'users'

module.exports = db
