// Copyright (c) 2012 jareiko. All rights reserved.

var nodemailer = require('nodemailer');
var jade = require('jade');

var transport = nodemailer.createTransport('SMTP', {});


exports.send = function(template, mailOptions, templateOptions) {
  jade.renderFile(path.join(__dirname, 'views', 'email', template), templateOptions, function(err, rendered) {
    mailOptions.html = rendered;
    mailOptions.generateTextFromHTML = true;
    mailOptions.from = mailOptions.from || 'noreply@triggerrally.com';
    mailOptions.subject = mailOptions.subject || 'Trigger Rally';

    console.log('[SENDING MAIL] to ', mailOptions.to);

    // Only send mails in production
    if (app.settings.env == 'production') {
      transport.sendMail(mailOptions,
        function(err, result) {
          if (err) {
            console.log('Mail error:');
            console.log(err);
          }
        }
      );
    } else {
      console.log('In production would send: ', sys.inspect(mailOptions));
    }
  });
};

exports.sendVerify = function(user) {
};

sendWelcome: function(user) {
  this.send('welcome.jade', { to: user.email, subject: 'Welcome to Nodepad' }, { locals: { user: user } });
}

exports.send = function(params) {
  transport.sendMail({
      from : 'bounce@triggerrally.com',
      to : params['to'],
      subject : params['subject'] || 'Trigger Rally',
      html: params['body'],
      generateTextFromHTML: true
  },
  function(error, result) {
    if(error) {
      console.log('Mail error:');
      console.log(error);
    }
  });
};
