var http        = require('http');
var url         = require('url');
var util        = require('util');
var querystring = require('querystring');
var multiline   = require('multiline');
var parseString = require('xml2js').parseString;
var lodash      = require('lodash');
var validator   = require('validator');
var async       = require('async');

var successXML = multiline(function() {/*
<?xml version="1.0"?>
<methodResponse>
  <params>
    <param>
      <value>%s</value>
    </param>
  </params>
</methodResponse>
*/});

var failureXML = multiline(function() {/*
<?xml version="1.0"?>
<methodResponse>
  <fault>
    <value>
      <struct>
        <member>
          <name>faultCode</name>
          <value><int>%d</int></value>
        </member>
        <member>
          <name>faultString</name>
          <value><string>Request was not successful.</string></value>
        </member>
      </struct>
    </value>
  </fault>
</methodResponse>
*/});

function dummyCallback(json, done) {
  return done(null, json);
}

function xmlToJSON(xml) {
  var params = xml.methodCall.params;

  // Credentials
  var username = lodash.isPlainObject(params.param[1].value) ? params.param[1].value.string : params.param[1].value;
  var password = lodash.isPlainObject(params.param[2].value) ? params.param[2].value.string : params.param[1].value;

  var content = params.param[3].value.struct.member;

  var json = lodash.reduce(content, function(json, obj) {
    var key = obj.name !== 'mt_keywords' ? obj.name : 'tags';
    var value = lodash.isPlainObject(obj.value) ? lodash.values(obj.value)[0] : obj.value;
    if (lodash.isPlainObject(value) && !!value.data && !!value.data.value) {
      json[key] = value.data.value;
    } else {
      if (key == 'description') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = value.trim();
        }
      }

      json[key] = value;
    }

    return json;
  }, { username: username, password: password });

  return json;
}

function makeRequest(theUrl, params, done) {
  done = done || lodash.noop;

  var postData = querystring.stringify(params);

  var parsed = url.parse(theUrl);
  var opts = {
    hostname : parsed.hostname,
    port     : parsed.port,
    path     : parsed.path,
    method   : 'POST',
    headers  : {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  var request = http.request(opts, function(res) {
    res.on('data', function(chunk) {
      done();
    });
  });

  request.write(postData);
  request.end();
}

module.exports = function(authCallback, callback) {
  if (!callback || !lodash.isFunction(callback)) {
    callback = authCallback;
    authCallback = null;
  }

  return function(req, res, next) {
    if (req.url.match(/^\/wp-admin\/*/)) {
      return res.status(200).end();
    }

    if (req.url == '/xmlrpc.php') {
      var body = '';
      req.on('data', function(chunk) {
        body += chunk;
      });

      return req.on('end', function() {
        parseString(body, { explicitArray: false }, function(err, xml) {
          if (err || !xml || !xml.methodCall || !xml.methodCall.methodName) {
            return res
              .set({ 'Content-Type': 'text/xml' })
              .status(404)
              .end(util.format(failureXML, 404))
            ;
          }

          var xmlResponse = '';
          switch(xml.methodCall.methodName) {
          case 'mt.supportedMethods':
            xmlResponse = util.format(successXML, '<string>metaWeblog.getRecentPosts</string>');
            break;
          case 'metaWeblog.getRecentPosts':
            xmlResponse = util.format(successXML, '<array><data></data></array>');
            break;
          case 'metaWeblog.newPost':
            var json = xmlToJSON(xml);

            function doneCallback(err, results) {
              res = res.set({ 'Content-Type': 'text/xml' });

              if (err) {
                return res.status(404).end(util.format(failureXML, 404));
              }

              var transformed = results[0];
              if (transformed) {
                var url = transformed.url || transformed.categories;
                if (validator.isURL(url)) {
                  makeRequest(url, lodash.omit(transformed, ['url', 'categories']));
                }
              }

              return res
                .status(200)
                .end(util.format(successXML, '<string>' + new Date().getTime() + '</string>'))
              ;
            }

            var callbacks = lodash(json.categories)
              .map(function(cat) {
                var matches = /^cat\:(.+)/.exec(cat);
                if (!matches) {
                  return false;
                }

                return callback[matches[1]];
              })
              .compact()
              .value()
            ;

            if (callbacks.length) {
              authCallback = lodash.isFunction(callback.auth) ? callback.auth : null;
              json = lodash.omit(json, ['categories']);
            } else {
              authCallback = lodash.isFunction(authCallback) ? authCallback : null;
              callbacks.push(lodash.isFunction(callback) ? callback : dummyCallback);
            }

            if (authCallback) {
              var username = json.username;
              var password = json.password;
              json = lodash.omit(json, ['username', 'password']);

              return authCallback(username, password, function(err, user) {
                if (err || !user) {
                  return res
                    .set({ 'Content-Type': 'text/xml' })
                    .status(404).end(util.format(failureXML, 404))
                  ;
                }

                if (lodash.isPlainObject(user)) {
                  json.user = user;
                }

                var asyncCallbacks = callbacks.map(function(cb) {
                  return async.apply(cb, json);
                });

                return async.parallel(asyncCallbacks, doneCallback);
              });
            }

            var asyncCallbacks = callbacks.map(function(cb) {
              return async.apply(cb, json);
            });

            return async.parallel(asyncCallbacks, doneCallback);
          default:
            break;
          }

          return res.set({ 'Content-Type': 'text/xml' }).status(200).end(xmlResponse);
        });
      });
    }

    return next();
  };
};
