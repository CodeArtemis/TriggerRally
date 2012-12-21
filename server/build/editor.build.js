({
  baseUrl: "../public/scripts",
  dir: "../public/build-out",
  optimize: "none",
  modules: [
    {
      name: "editor/editor-main",
      exclude: [ 'coffee-script' ]
    }
  ],
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
  },
  paths: {
      'THREE': '../js/Three'
    , 'async': '../js/async'
    , 'cs': '../js/cs'
    , 'coffee-script': '../js/coffee-script'
    , 'underscore': '../js/underscore'  // -min
    , 'backbone': '../js/backbone'  // -min
    , 'backbone-relational': '../js/backbone-relational'
    , 'jquery': '../js/jquery-1.8.3.min'
  },
  stubModules: ['cs']
})
