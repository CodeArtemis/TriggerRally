I wrote Mongeese because I couldn't figure out how to transparently access
multiple MongoDB databases using [Mongoose](http://mongoosejs.com) API.

## Install

    npm install mongeese

## Usage

Replace code requiring `mongoose` module like this:

    var mongoose = require("mongoose");
    mongoose.connect(...);
    
with:

    var mongoose = require("mongeese").create();
    mongoose.connect(...);
    
Result of `create` method call should look and behave exactly like `mongoose` module
except each result can have its own *default connection*.
    
If you need to handle multiple databases at the same time, following should suffice:

    var logdb = require("mongeese").create();
    var keydb = require("mongeese").create();
    
    logdb.connect('mongodb://localhost/log');
    keydb.connect('mongodb://localhost/key');
    
That's it.
