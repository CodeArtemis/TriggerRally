({
  baseUrl: "../public/scripts",
  optimize: "none",
  name: "../js/almond",
  out: "../public/build-out/editor-main.js",
  include: [ "editor/editor-main" ],
  exclude: [ "coffee-script" ],

  shim: {
    "underscore": {
      exports: "_"
    },
    "backbone": {
      deps: ["underscore"],
      exports: "Backbone"
    },
    "THREE": {
      exports: "THREE"
    },
    "async": {
      exports: "async"
    }
  },
  paths: {
      "THREE": "../js/three-r54.min"  // .min
    , "async": "../js/async.min"  // .min
    , "backbone": "../js/backbone-min"  // -min
    , "cs": "../js/cs"
    , "coffee-script": "../js/coffee-script"
    , "jade": "../js/require-jade"
    , "jquery": "../js/jquery-1.9.1.min"  // .min
    , "underscore": "../js/underscore-min"  // -min
  },
  stubModules: ["cs"],
  pragmasOnSave: {
    excludeJade : true
  }
})
