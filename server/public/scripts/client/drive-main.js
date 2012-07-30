// Copyright (C) 2012 jareiko / http://www.jareiko.net/

requirejs.config({
  baseUrl: '/scripts',
  shim: {
    /*'backbone': {
      //These script dependencies should be loaded before loading
      //backbone.js
      deps: ['underscore', 'jquery'],
      //Once loaded, use the global 'Backbone' as the
      //module value.
      exports: 'Backbone'
    },*/
    'THREE': {
      deps: [],
      exports: 'THREE'
    },
    'async': {
      deps: [],
      exports: 'async'
    },
    'underscore': {
      deps: [],
      exports: 'underscore'
    },
    'zepto': {
      deps: [],
      exports: '$'
    }
  }
});

// Dummy modules.
define('canvas', function() {});
define('fs', function() {});

require(
  {
    paths: {
        'THREE': '../js/Three'
      , 'async': '../js/async'
      , 'cs': '../js/cs'
      , 'coffee-script': '../js/coffee-script'
      , 'underscore': '../js/underscore-min'
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
