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
    }
  }
});

// Dummy modules.
define('canvas', function() {});
define('fs', function() {});

define('backbone-full',
       [ 'backbone', 'backbone-relational' ],
       function(bb1, bb2) { return bb1; });

require(
  {
    paths: {
        'THREE': '../js/three-r54.min'  // .min
      , 'async': '../js/async.min'  // .min
      , 'cs': '../js/cs'
      , 'coffee-script': '../js/coffee-script'
      , 'underscore': '../js/underscore-min'  // -min
      , 'backbone': '../js/backbone'  // -min
      , 'backbone-relational': '../js/backbone-relational'
      , 'jquery': '../js/jquery-1.8.3.min'  // .min
    }
  },
  [
    'cs!editor/editor'
  ],
  function editorMain(editor) {
    editor.run();
  }
);
