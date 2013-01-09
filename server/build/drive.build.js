({
  baseUrl: "../public/scripts",
  dir: "../public/build-out",
  optimize: "none",
  modules: [
    {
      name: "drive-main",
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
    /*'backbone-relational': {
      deps: ['underscore', 'backbone']
    },*/
    'THREE': {
      exports: 'THREE'
    },
    'async': {
      exports: 'async'
    },
    'zepto': {
      exports: '$'
    }
  },
  paths: {
      'THREE': '../js/three-r54.min'  // .min
    , 'async': '../js/async.min'  // .min
    , 'cs': '../js/cs'
    , 'coffee-script': '../js/coffee-script'
    , 'underscore': '../js/underscore-min'  // -min
    , 'backbone': '../js/backbone-min'  // -min
    //, 'backbone-relational': '../js/backbone-relational'  // don't define modules that aren't used
    , 'zepto': '../js/zepto.min'  // .min
  },
  stubModules: ['cs']
})
