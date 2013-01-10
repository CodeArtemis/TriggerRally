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
      exports: '_'
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
      'THREE': '../js/three-r54.min'  // .min
    , 'async': '../js/async.min'  // .min
    , 'cs': '../js/cs'
    , 'coffee-script': '../js/coffee-script'
    , 'underscore': '../js/underscore-min'  // -min
    , 'backbone': '../js/backbone-min'  // -min
    , 'backbone-relational': '../js/backbone-relational'
    , 'jquery': '../js/jquery-1.8.3.min'  // .min
  },
  stubModules: ['cs']
})
