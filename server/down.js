/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Copyright (c) 2012 jareiko. All rights reserved.

"use strict";

const connect = require('connect');
const express = require('express');
const http = require('http');
const stylus = require('stylus');

const getIsodate = () => new Date().toISOString();
express.logger.format('isodate', (req, res) => getIsodate());
const log = function(msg) {
  const isodate = getIsodate();
  return console.log(`[${isodate}] ${msg}`);
};

const routes = require('./routes');

log("DOWN SERVER");
log(`Base directory: ${__dirname}`);

const app = (module.exports = express());

const PORT = process.env.PORT || 80;
const DOMAIN = process.env.DOMAIN || 'triggerrally.com';
const URL_PREFIX = `http://${DOMAIN}`;


app.use(express.logger({format: '[:isodate] :status :response-time ms :method :url :referrer'}));
app.disable('x-powered-by');
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(stylus.middleware({
  src: __dirname + '/stylus',
  dest: __dirname + '/public'
})
);
app.use(routes.defaultParams);
app.use(app.router);
app.use(express.static(__dirname + '/public'));
app.configure('development', () =>
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  })
  )
);

app.configure('production', () => app.use(express.errorHandler({dumpExceptions: true})));

app.get('/about', routes.about);
app.use(routes.down);

const server = http.createServer(app);
server.listen(PORT);
log(`Server listening on port ${PORT} in ${app.settings.env} mode`);
