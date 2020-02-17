/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * Copyright (C) 2012 jareiko / http://www.jareiko.net/
 */

define(() =>
  ({
    syncSocket(socket) {
      return function(method, model, options) {
        socket.emit('sync', {
          method,
          url: _.result(model, 'url'),  // remove?
          urlRoot: _.result(model, 'urlRoot'),
          id: model.id,
          model: model.toJSON()
        }  // remove?
        , function(err, response) {
          if (err) {
            if (typeof options.error === 'function') {
              options.error(model, err, options);
            }
          } else {
            if (typeof options.success === 'function') {
              options.success(response);
            }
          }
        });
      };
    }
  })
);
