var chai    = require('chai');
var express = require('express');
var request = require('supertest');
var should  = chai.should();

var webhook = require('../lib/webhook');

describe('webhook', function() {

  it('should exist', function() {
    webhook.should.exist();
    webhook.should.be.a('function');
  });

  describe('middleware', function() {
    before(function() {
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
  });

});
