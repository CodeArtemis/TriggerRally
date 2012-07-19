
require(
  {
    paths: {
      'cs': '../js/cs',
      'coffee-script': '../js/coffee-script'
    }
  },
  [
    'cs!editor'
  ],
  function(editor) {
    editor.run();
  }
);
