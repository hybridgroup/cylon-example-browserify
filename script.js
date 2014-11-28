"use strict";

var Cylon = require('cylon');

// log directly to the page if we're in the browser
if (process.browser) {
  var Logger = require('./browser-logger');
  Cylon.Logger.setup({ logger: Logger, level: 'debug' });
}

Cylon.robot({
  name: "BrowserBot",

  connections: {
    loopback: { adaptor: 'loopback' }
  },

  devices: {
    ping: { driver: 'ping' }
  },

  work: function(my) {
    every((2).seconds(), function() {
      Cylon.Logger.info("Hi, my name is " + my.name)
    });
  }
});

Cylon.start();
