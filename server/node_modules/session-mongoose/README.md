`session-mongoose` module is an implementation of `connect` session store using [Mongoose](http://mongoosejs.com).

## Status ##

I believe every open source project should clearly indicate its status and intended applications
of the project. In that spirit, here is the status of `session-mongoose`.

This project is IMO not production-ready for following reasons:

1. insufficient testing
2. zero optimization
3. there are better options than MongoDB for session storage.

I use `session-mongoose` primarily in prototype webapps where above factors don't matter.

Accordingly, I am ready to commit just enough time to fix things when things break.
I can't guarantee all reported issues will be fixed in reasonable amount of time but
I do try to address them promptly mainly because I can't sleep at night when someone
in need is out there.

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
        cookie: { maxAge: 900000 } // expire session in 15 min or 900 seconds
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
        model.collection.drop(function (err) { console.log(err); });

## Version 0.1 Migration Note

* `connect` moved from `dependencies` to `devDependencies`.

## Version 0.0.3 Migration Note

Version 0.0.3 changes Mongoose schema data type for session data from JSON string to `Mixed`.

If you notice any migration issues, please file an issue.
