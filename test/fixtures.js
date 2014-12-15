var util      = require('util');
var multiline = require('multiline');
var lodash    = require('lodash');

module.exports.genericRequest = function(methodName, params) {

  var xml = multiline(function() {/*
    <?xml version="1.0"?>
    <methodCall>
      <methodName>%s</methodName>
      <params>%s</params>
    </methodCall>
  */});

  if (lodash.isArray(params)) {
    xmlParams = params.map(function(pair) {
      if (lodash.isArray(pair)) {
        return '<param><value><' + pair[0] + '>' + pair[1]  + '</' + pair[0] + '></value></param>';
      }

      if (!pair) {
        return;
      }

      return '<param>' + pair + '</param>';
    });

    return util.format(xml, methodName, xmlParams);
  }

  return util.format(xml, methodName, params || '');
};

module.exports.genericResponse = function(params) {
  var xml = multiline(function() {/*
    <?xml version="1.0"?>
    <methodResponse>
      <params>%s</params>
    </methodResponse>
    */});

  if (lodash.isArray(params)) {
    xmlParams = params.map(function(pair) {
      if (lodash.isArray(pair)) {
        return '<param><value><' + pair[0] + '>' + pair[1]  + '</' + pair[0] + '></value></param>';
      }

      if (!pair) {
        return;
      }

      return '<param>' + pair + '</param>';
    });

    return util.format(xml, xmlParams);
  }

  return util.format(xml, params || '');
};

module.exports.newPostRequest = function(title, body, categories, keywords) {
  var xml = multiline(function() {/*
    <?xml version="1.0"?>
    <methodCall>
      <methodName>metaWeblog.newPost</methodName>
      <params>
        <param>
          <value>
            <int>4711</int>
          </value>
        </param>
        <param>
          <value>
            <string>johndoe</string>
          </value>
        </param>
        <param>
          <value>
            <string>s3cr3t</string>
          </value>
        </param>
        <param>
          <value>
            <struct>
              <member>
                <name>title</name>
                <value>
                  <string>%s</string>
                </value>
              </member>
              <member>
                <name>description</name>
                <value>
                  <string>
                    <![CDATA[%s]]>
                  </string>
                </value>
              </member>
              <member>
                <name>categories</name>
                <value>
                  <array>
                    <data>%s</data>
                  </array>
                </value>
              </member>
              <member>
                <name>mt_keywords</name>
                <value>
                  <array>
                    <data>%s</data>
                  </array>
                </value>
              </member>
            </struct>
          </value>
        </param>
      </params>
    </methodCall>
    */});

  categoriesXML = (categories || [])
    .map(function(category) {
      return '<value>' + category + '</value>';
    })
    .join("\n")
  ;

  keywordsXML = (keywords || [])
    .map(function(category) {
      return '<value>' + category + '</value>';
    })
    .join("\n")
  ;

  return util.format(xml, title, body, categoriesXML, keywordsXML);
};
