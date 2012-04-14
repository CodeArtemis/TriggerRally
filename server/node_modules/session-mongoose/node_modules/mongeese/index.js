(function() {
  var mongoose;
  mongoose = require('mongoose');
  exports.create = function() {
    var key, mongeese, value;
    mongeese = new mongoose.Mongoose();
    for (key in mongoose) {
      value = mongoose[key];
      if (!(mongeese[key] != null) && mongoose.hasOwnProperty(key)) {
        mongeese[key] = value;
      }
    }
    return mongeese;
  };
}).call(this);
