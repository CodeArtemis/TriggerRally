`session-mongoose` module is an implementation of `connect` session store using [Mongoose](http://mongoosejs.com).

## Implementation Note:

Uses its own instance of Mongoose object, leaving default instance for use by the app.

## Install

    npm install session-mongoose

## Usage

Create session store:

    var connect = require('connect');
    var SessionStore = require("session-mongoose")(connect);
    var store = new SessionStore({
        url: "mongodb://localhost/session",
        interval: 120000 // expiration check worker run interval in millisec (default: 60000)
    });

Configure Express

    var express = require("express");
    var SessionStore = require("session-mongoose")(express);
    var store = new SessionStore({
        url: "mongodb://localhost/session",
        interval: 120000 // expiration check worker run interval in millisec (default: 60000)
    });
    ...
    // configure session provider
    app.use(express.session({
        store: store,
        ...
    });
    ...

That's it.

## Version 0.2 Migration Note

* an instance of `connect` module (or equivalent like `express`) is now **required** to get
  SessionStore implementation (see examples above).

* moved Mongoose model for session data to session store instance (SessionStore.model).

    var connect = require('connect');
    var SessionStore = require("session-mongoose")(connect);
    var store = new SessionStore({
        url: "mongodb://localhost/session",
        interval: 120000 // expiration check worker run interval in millisec (default: 60000)
    });
    var model = store.model; // Mongoose model for session

    // this wipes all sessions
    model.collection.drop (err) -> console.log(err)

## Version 0.1 Migration Note

* `connect` moved from `dependencies` to `devDependencies`.

## Version 0.0.3 Migration Note

Version 0.0.3 changes Mongoose schema data type for session data from JSON string to `Mixed`.

If you notice any migration issues, please file an issue.