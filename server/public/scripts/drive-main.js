// Copyright (C) 2012 jareiko / http://www.jareiko.net/

requirejs.config({
  baseUrl: '/scripts',
  shim: {
    'underscore': {
      exports: '_',
      init: function() {
        return this._.noConflict();
      }
    },
    'backbone': {
      deps: ['underscore'],
      exports: 'Backbone'
    },
    'backbone-relational': {
      deps: ['underscore', 'backbone']
    },
    'THREE': {
      exports: 'THREE'
    },
    'async': {
      exports: 'async'
    },
    'zepto': {
      exports: '$'
    }
  }
});

// Dummy modules.
define('canvas', function() {});
define('fs', function() {});

define('backbone-full',
       [ 'backbone', 'backbone-relational' ],
       function(Backbone) { return Backbone; });

require(
  {
    paths: {
        'THREE': '../js/three-r53'  // -min
      , 'async': '../js/async'
      , 'cs': '../js/cs'
      , 'coffee-script': '../js/coffee-script'
      , 'underscore': '../js/underscore'  // -min
      , 'backbone': '../js/backbone'  // -min
      , 'backbone-relational': '../js/backbone-relational'
      , 'zepto': '../js/zepto'
    }
  },
  [
    'cs!client/drive'
  ],
  function driveMain(drive) {
    drive.run();
  }
);
