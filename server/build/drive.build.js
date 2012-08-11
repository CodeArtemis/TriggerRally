({
  baseUrl: "../public/scripts",
  dir: "../public/build-v2",
  optimize: "none",
  modules: [
      {
          name: "drive-main",
          exclude: [ 'coffee-script' ]
      }
  ],
  shim: {
    'THREE': {
      deps: [],
      exports: 'THREE'
    },
    'async': {
      deps: [],
      exports: 'async'
    },
    'underscore': {
      deps: [ 'async' ],
      exports: 'underscore'
    },
    'zepto': {
      deps: [],
      exports: '$'
    }
  },
  paths: {
      'THREE': '../js/Three'
    , 'async': '../js/async'
    , 'cs': '../js/cs'
    , 'coffee-script': '../js/coffee-script'
    , 'underscore': '../js/underscore-min'
    , 'zepto': '../js/zepto'
  },
  stubModules: ['cs']
})
