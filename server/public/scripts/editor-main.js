
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
  function editorMain(editor) {
    editor.run();
  }
);
