# Copyright (c) 2012 jareiko. All rights reserved.

"use strict"

connect = require('connect')
express = require('express')
http = require('http')
stylus = require('stylus')

getIsodate = -> new Date().toISOString()
express.logger.format 'isodate', (req, res) -> getIsodate()
log = (msg) ->
  isodate = getIsodate()
  console.log "[#{isodate}] #{msg}"

routes = require('./routes')

log "DOWN SERVER"
log "Base directory: #{__dirname}"

app = module.exports = express()

PORT = process.env.PORT or 80
DOMAIN = process.env.DOMAIN or 'triggerrally.com'
URL_PREFIX = 'http://' + DOMAIN


app.use express.logger(format: '[:isodate] :status :response-time ms :method :url :referrer')
app.disable 'x-powered-by'
app.set 'views', __dirname + '/views'
app.set 'view engine', 'jade'
app.use express.bodyParser()
app.use express.methodOverride()
app.use stylus.middleware(
  src: __dirname + '/stylus'
  dest: __dirname + '/public'
)
app.use routes.defaultParams
app.use app.router
app.use express.static(__dirname + '/public')
app.configure 'development', ->
  app.use express.errorHandler(
    dumpExceptions: true
    showStack: true
  )

app.configure 'production', ->
  app.use express.errorHandler(dumpExceptions: true)

app.get '/about', routes.about
app.use routes.down

server = http.createServer(app)
server.listen PORT
log "Server listening on port #{PORT} in #{app.settings.env} mode"
