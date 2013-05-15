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
    'jquery': {
      exports: '$'
    },
    'THREE': {
      exports: 'THREE'
    },
    'async': {
      exports: 'async'
    }
  }
});

// Dummy modules.
define('canvas', function() {});
define('fs', function() {});

// Legacy, from when we also depended on backbone-relational.
define('backbone-full',
       [ 'backbone' ],
       function(bb1) { return bb1; });

require(
  {
    paths: {
        'THREE': '../js/three-r54'  // .min
      , 'async': '../js/async'  // .min
      , 'cs': '../js/cs'
      , 'coffee-script': '../js/coffee-script'
      , 'backbone': '../js/backbone'  // -min
      , 'jade': '../js/require-jade'
      , 'jquery': '../js/jquery-2.0.0'  // .min
      , 'underscore': '../js/underscore'  // -min
    }
  },
  [
    'cs!app'
  ],
  function main(App) {
    new App();
  }
);
