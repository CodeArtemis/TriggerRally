// Copyright (C) 2012 jareiko / http://www.jareiko.net/
window.BASE_PATH = window.location.href.slice(window.location.origin.length).replace(/\/$/, '')

requirejs.config({
  //baseUrl: '/scripts',
  shim: {
    'underscore': {
      exports: '_',
      init: function() {
        return this._.noConflict();
      }
    },
    'backbone': {
      deps: ['jquery', 'underscore'],
      exports: 'Backbone'
    },
    'jquery': {
      exports: '$'
    },
    'THREE': {
      exports: 'THREE'
    },
    'THREE-json-loader': {
      deps: ['THREE'],
      export: 'JSONLoader'
    },
    'THREE-scene-loader': {
      deps: ['THREE', 'THREE-json-loader'],
      export: 'SceneLoader'
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
        'THREE': '../js/three-r101'  // .min
      , 'THREE-json-loader': '../js/three-json-loader'  // .min
      , 'THREE-scene-loader': '../js/three-scene-loader'  // .min
      , 'async': '../js/async'  // .min
      , 'backbone': '../js/backbone'  // -min
      , 'jade': '../js/require-jade'
      , 'jquery': '../js/jquery-2.0.0'  // .min
      , 'underscore': '../js/underscore'  // -min
    }
  },
  [
    'app'
  ],
  function main(App) {
    new App();
  }
);
