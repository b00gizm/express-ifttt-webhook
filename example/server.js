var express = require('express');
var webhook = require('../lib/webhook');

var app = express();

app.set('port', process.env.PORT || 3000);

app.use(webhook());

app.get('/', function(req, res) {
  return res.redirect('https://github.com/b00giZm/express-ifttt-webhook');
});

var server = app.listen(app.get('port'), function() {
  console.log('Server listening on port', server.address().port);
});
