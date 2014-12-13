var http        = require('http');
var url         = require('url');
var util        = require('util');
var querystring = require('querystring');
var multiline   = require('multiline');
var parseString = require('xml2js').parseString;
var lodash      = require('lodash');
var validator   = require('validator');

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

module.exports = function(callback) {

  callback = lodash.isFunction(callback) ? callback : dummyCallback;

  return function(req, res, next) {
    if (req.url.match(/^\/wp-admin\/*/)) {
      return res.status(200).end();
    }

    if (req.url == '/xmlrpc.php') {
      var body = '';
      req.on('data', function(chunk) {
        body += chunk;
      });

      req.on('end', function() {
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

            return callback(json, function(err, transformed) {
              res = res.set({ 'Content-Type': 'text/xml' });

              if (err) {
                return res.status(404).end(util.format(failureXML, 404));
              }

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
            });
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
