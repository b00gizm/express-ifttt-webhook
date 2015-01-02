express-ifttt-webhook
=====================

[![npm](https://img.shields.io/npm/v/express-ifttt-webhook.svg)](https://www.npmjs.com/package/express-ifttt-webhook) [![Travis](https://img.shields.io/travis/b00giZm/express-ifttt-webhook.svg)](https://travis-ci.org/b00giZm/express-ifttt-webhook)

We all love and use [IFTTT](https://ifttt.com) to automate our digital life. As a developer, I have always wanted IFTTT to be a little more flexibel and open for custom webhooks and services. This might come (as a premium feature?) one day, but for now, there is **express-ifttt-webhook**.

What is it all about?
---------------------

In a nutshell: **express-ifttt-webhook** is an [Express](http://expressjs.com/) [middleware](http://expressjs.com/guide/using-middleware.html), which allows you, to transform your app into an IFTTT-enabled service **in just two lines of code**.

No, I sh*t you not!

### Disclaimer

This project is heavily inspired and influenced by the [awesome](https://github.com/captn3m0/ifttt-webhook) [work](https://github.com/mapkyca/ifttt-webhook) of [@captn3m0](https://github.com/captn3m0) and [@mapkyca](https://github.com/mapkyca). But instead of making it a straight port for Node.js, I wanted to go one step beyond, and make it a more flexible drop-in solution for existing Express apps.

How does it work
----------------

This middleware mimics your Express app to be a [Wordpress](https://wordpress.org/) blog by exposing the neccessary endpoints used by IFTTT to exchange data. Over at IFTTT, in order to connect to your app, you just have to create a [Wordpress channel](https://ifttt.com/wordpress) with the URL of your app (detailed instructions below).

So yeah, it's kind of a hack, but it works great!

Quickstart
----------

Install the middleware via [npm](https://www.npmjs.com/):

```bash
$ npm install --save express-ifttt-webhook
```

Require the module in your app.js:

```javascript
var webhook = require('express-ifttt-webhook');
```

and connect the middleware:

```javascript
app.use(webhook());
```

**Boom. You're done!**

This default middleware is pretty basic, but might be sufficient for really simple requirements. It's like an API proxy which forwards data to a specified API endpoint.

Now, hop over to IFTTT and create a new Wordpress channel:

![](http://i.imgur.com/BSS22t1.png)

The URL has to contain a publicly accessible domain. If you want to just toy around with the middleware, you can use `example/server.js` and host it on [Heroku](https://www.heroku.com) ([instructions](https://devcenter.heroku.com/articles/getting-started-with-nodejs#introduction)).

The security credentials are, more or less, arbitrary. For now, use just any username and password combination you want (as long as they are not empty). For a more serious approach, see the dedicated section below.

After activation, create a new recipe with any trigger you like and a Wordpress, "Create a post" action:

![](http://i.imgur.com/ryMF3cI.png)

When a recipe is triggered, it will forward all data (username, password, title, body, tags) to the URL specified in categories via POST request (`application/x-www-form-urlencoded`).

For testing purpose, [RequestBin](http://requestb.in/) is a great and simple tool for capturing and inspecting requests, so I encourage you to go ahead and create your own bin.

And here's the result:

![](http://i.imgur.com/wC1BELs.png)

Congratulations! You just created your first IFTTT webhook.

Using webhook callbacks
-----------------------

Like I said, the default functionality is pretty basic and not very flexible if you want to do more than just forwarding data. Now, it's time to get real fancy.

By using your own callbacks, you can send much more flexible and complex data over IFTTT to your app and do what you want with it.

Change your action to look something like this:

![](http://i.imgur.com/Z8pX5MR.png)

That's right - we're now sending JSON data over IFTTT. Feel free to use IFTTT recipe ingredients, if you want (blue test tube button).

Now, make the middleware to use a custom callback:

```javascript
app.use(webhook(function(json, done) {

  // Do awesome stuff here!

  done();
}));
```

When a recipe is triggered, the callback will be called with the following paramters:

* `json` - A JavaScript object containing all request data
* `done` - A callback to be called after you're done processing the data

In our case, `json` will contain the following data:

```javascript
{ username: 'johnedoe',
  password: 's3cr3t',
  title: 'Webhook Test 2',
  description: { foo: 123, bar: { baz: 234 } },
  tags: [ 'one', 'two', 'three' ] }
```

### Special case: Value transformer

If you still want to forward data to a custom URL, you can use the custom callback as value transformer:


```javascript
app.use(webhook(function(json, done) {
  // transform data
  var out = getOutputObjectFromInput(json);

  // specify URL to forward your transformed data to
  out.url = 'http://api.example.org';

  done(null, out);
}));
```

Here `out` will be POST'ed as `application/x-www-form-urlencoded` to `http://api.example.org`.

### Error handling

If there's an error down the road which you want to show up in your IFTTT logs, just call `done` with a non-empty first argument:


```javascript
app.use(webhook(function(json, done) {
  if (someErrorCondition) {
    done(new Error('Kaboom!'));
  } else {
    ...
    done();
  }
}));
```

Using callback categories
-------------------------

If you want to have multiple callbacks (like your own Twitter callback, your own Instagram callback and so on), you can use callback categories. Instead of supplying a callback function, just supply an object with keys for different callbacks:

```javascript
app.use(webhook({
  twitter   : function(json, done) { ... },
  instagram : function(json, done) { ... },
  ...
}));
```

Over at IFTTT, use the `cat:*` notation inside the categories field to specify which callback(s) to call.

![](http://i.imgur.com/gLmQiUW.png)

Here, when the recipe is triggered, the `twitter` callback will be called.

### Special case: Calling multiple categories

If you want to call multiple callback categories at once, we got you covered as well:

![](http://i.imgur.com/3JFhbCH.png)

When triggered, both `twitter` and `instagram` callbacks will be called in parallel.

Authentication
--------------

For serious use cases, you might want to protect your app from outside abuse. So, if you want, you can supply your own authentication (auth) callback:

```javascript
app.use(webhook(
  function(username, password, done) {
    return getUserFromDatabase(username, password, function(err, user) {
      // Some error occured
      if (err) {
        return done(err);
      }

      // Invalid credentials
      if (!user) {
        return done(null, false);
      }

      // Everything OK!
      return done(null, user);
    });
  },
  function(json, done) {

    // json does now has a new property 'user' containing the user object

    done();
  }
));
```

With an auth callback, you've got the chance to validate the user credentials before proceeding to the actual callback. If the credentials cannot be verified, just call `done(null, false)` to end. If the credentials are valid and you have a user object, you can pass it as second argument to `done`. When doing so, it will be accessible in the actual callack via `json.user`.

### Special case: Auth with callback categories

When using callback categories, just use your auth callback with the `auth` key:

```javascript
app.use(webhook({
  auth      : function(username, password, done) { ... }
  twitter   : function(json, done) { ... },
  instagram : function(json, done) { ... },
  ...
}));
```

Real world use case
-------------------

I'm an avid [Sonos](http://www.sonos.com/) fan and user. Last year, I discovered the [sonos module](https://www.npmjs.com/package/sonos), which allows you to access your Sonos speakers from Nodejs. So I thought, wouldn't it be cool, to write an app which pauses the speakers when you leave the house?

With **express-ifttt-webhook**, this is pretty easy to do:

![](http://i.imgur.com/Y0pbBDI.png)

This recipe is triggered every time I'm entering or exiting my home (based on my iPhone's GPS). It is connected to my [RaspberryPi](http://www.raspberrypi.org/), which runs a small Express app that pauses all my Sonos speakers, when it receives the `exit` event. Pretty neat, huh? ;)

Maintainer
----------

Pascal Cremer

* Email: <hello@codenugget.co>
* Twitter: [@b00gizm](https://twitter.com/b00gizm)
* Web: [http://codenugget.co](http://codenugget.co)

License
-------

>The MIT License (MIT)
>
>Copyright (c) 2014-2015 Pascal Cremer
>
>Permission is hereby granted, free of charge, to any person obtaining a copy
>of this software and associated documentation files (the "Software"), to deal
>in the Software without restriction, including without limitation the rights
>to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
>copies of the Software, and to permit persons to whom the Software is
>furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in all
>copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
