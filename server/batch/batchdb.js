const mongoskin = require('mongoskin');

const config = require('../config');

const dbUrl = `${config.db.host}:${config.db.port}/${config.db.name}?auto_reconnect`;

const db = mongoskin.db(dbUrl, { safe: false });

db.bind('comments');
db.bind('runs');
db.bind('tracks');
db.bind('users');

module.exports = db;
