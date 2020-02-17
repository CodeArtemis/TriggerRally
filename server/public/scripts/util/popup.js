/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
], (
) =>
  ({
    create(url, name, done) {
      const width = 1000;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top}`;
      window._tr_popup_autoclosed = false;
      const popup = window.open(url, name, features);
      if (!popup) { return false; }
      var timer = setInterval(function() {
        if (popup.closed) {
          clearInterval(timer);
          return done(window._tr_popup_autoclosed);
        }
      }
      , 1000);
      return true;
    }
  })
);
