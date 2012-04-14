// Copyright (c) 2012 jareiko. All rights reserved.

var config = require('./config');
var mongodb = require('mongodb');


exports.db = new mongodb.Db(
    config.MONGODB_DATABASE,
    new mongodb.Server(config.MONGODB_HOST,
                       config.MONGODB_PORT,
                       {auto_reconnect: true},
                       {}));
