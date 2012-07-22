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
    'zepto': {
      deps: [],
      exports: '$'
    }
  }
});

require(
  {
    paths: {
        'THREE': '../js/Three'
      , 'async': '../js/async'
      , 'cs': '../js/cs'
      , 'coffee-script': '../js/coffee-script'
      , 'zepto': '../js/zepto'
    }
  },
  [
    'cs!editor/editor'
  ],
  function editorMain(editor) {
    editor.run();
  }
);
