var chai       = require('chai');
var express    = require('express');
var sinon      = require('sinon');
var proxyquire = require('proxyquire');
var request    = require('supertest');
var fixtures   = require('./fixtures');
var should     = chai.should();

// Sinon stubs
var requestStub = sinon.stub();
requestStub.returns({
  write: sinon.stub(),
  end: sinon.stub()
});

var httpStub = {
  request: requestStub
};

var webhook = proxyquire('../lib/webhook', {
  'http': httpStub
});

describe('webhook', function() {

  it('should exist', function() {
    webhook.should.exist();
    webhook.should.be.a('function');
  });

  describe('middleware', function() {
    beforeEach(function() {
      var app = express();

      app.use(webhook());

      this.app = app;
    });

    it('should not affect other routes', function(done) {
      this.app.get('/', function(req, res) {
        return res.send('Hello World!');
      });

      var agent = request.agent(this.app);

      agent
        .get('/')
        .expect(200)
        .expect('Hello World!', done)
      ;
    });

    it('should expose /xmlrpc.php endpoint', function(done) {
      var agent = request.agent(this.app);

      agent
        .get('/xmlrpc.php')
        .expect(404)
        .expect('content-type', /text\/xml/, done)
      ;
    });

    it('should expose /wp-admin/profile.php endpoint', function(done) {
      var agent = request.agent(this.app);

      agent
        .get('/wp-admin/profile.php')
        .expect(200, done)
      ;
    });

    it('should expose /wp-admin/options-discussion.php endpoint', function(done) {
      var agent = request.agent(this.app);

      agent
        .get('/wp-admin/options-discussion.php')
        .expect(200, done)
      ;
    });

    it('should expose /wp-admin/options-general.php endpoint', function(done) {
      var agent = request.agent(this.app);

      agent
        .get('/wp-admin/options-general.php')
        .expect(200, done)
      ;
    });

    it('should return XML response for "mt.supportedMethods" XML-RPC request', function(done) {
      var agent = request.agent(this.app);

      var xmlPayload = fixtures.genericRequest('mt.supportedMethods');

      agent
        .post('/xmlrpc.php')
        .set({
          'Content-Type'   : 'text/xml',
          'Accept'         : 'text/xml',
          'Accept-Charset' : 'UTF8'
        })
        .send(xmlPayload)
        .expect(200)
        .expect('content-type', /text\/xml/, done)
      ;
    });

    it('should return XML response for "metaWeblog.getRecentPosts" XML-RPC request', function(done) {
      var agent = request.agent(this.app);

      var xmlPayload = fixtures.genericRequest('metaWeblog.getRecentPosts');

      agent
        .post('/xmlrpc.php')
        .set({
          'Content-Type'   : 'text/xml',
          'Accept'         : 'text/xml',
          'Accept-Charset' : 'UTF8'
        })
        .send(xmlPayload)
        .expect(200)
        .expect('content-type', /text\/xml/, done)
      ;
    });

    describe('IFTTT request', function() {
      describe('with default middleware', function() {
        beforeEach(function() {
          this.app = express();
          this.app.use(webhook());
        });

        it('should make HTTP POST request to a given URL in categories array', function(done) {
          var agent = request.agent(this.app);

          var xmlPayload = fixtures.newPostRequest('A title', 'A body', ['http://example.org'], ['one', 'two', 'three']);

          var postData = 'username=johndoe&password=s3cr3t&title=A%20title&description=A%20body&tags=one&tags=two&tags=three';

          agent
            .post('/xmlrpc.php')
            .set({
              'Content-Type'   : 'text/xml',
              'Accept'         : 'text/xml',
              'Accept-Charset' : 'UTF8'
            })
            .send(xmlPayload)
            .expect(200)
            .expect('content-type', /text\/xml/, function() {
              requestStub.calledOnce.should.be.true();
              requestStub
                .calledWith({
                  hostname: 'example.org',
                  port: null,
                  path: '/',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': postData.length
                  }
                })
                .should.be.true()
              ;
              requestStub().write.calledOnce.should.be.true();
              requestStub().write.calledWith(postData).should.be.true();

              done();
            })
          ;
        });
      });

      describe('with middleware callback', function() {
        beforeEach(function() {
          this.app = express();
        });

        it('should call the callback', function(done) {
          this.app.use(webhook(function(json, done) {
            json.should.eql({
              username    : 'johndoe',
              password    : 's3cr3t',
              title       : 'A title',
              description : 'A body',
              categories  : [ 'one', 'two', 'three' ],
              tags        : [ 'four', 'five', 'six' ]
            });

            done();
          }));

          var agent = request.agent(this.app);

          var xmlPayload = fixtures.newPostRequest('A title', 'A body', ['one', 'two', 'three'], ['four', 'five', 'six']);

          agent
            .post('/xmlrpc.php')
            .set({
              'Content-Type'   : 'text/xml',
              'Accept'         : 'text/xml',
              'Accept-Charset' : 'UTF8'
            })
            .send(xmlPayload)
            .expect(200)
            .expect('content-type', /text\/xml/, done)
          ;
        });

        it('should try to parse JSON object from body', function(done) {
          this.app.use(webhook(function(json, done) {
            json.should.eql({
              username    : 'johndoe',
              password    : 's3cr3t',
              title       : 'A title',
              description : { foo: 123, bar: 234 },
              categories  : [ 'one', 'two', 'three' ],
              tags        : [ 'four', 'five', 'six' ]
            });

            done();
          }));

          var agent = request.agent(this.app);

          var xmlPayload = fixtures.newPostRequest('A title', '{"foo": 123, "bar": 234}', ['one', 'two', 'three'], ['four', 'five', 'six']);

          agent
            .post('/xmlrpc.php')
            .set({
              'Content-Type'   : 'text/xml',
              'Accept'         : 'text/xml',
              'Accept-Charset' : 'UTF8'
            })
            .send(xmlPayload)
            .expect(200)
            .expect('content-type', /text\/xml/, done)
          ;
        });
      });

      // describe('with middleware auth');
      //
      // describe('with middleware categories');
      //
      // describe('with middleware auth and categories');
    });
  });

});
