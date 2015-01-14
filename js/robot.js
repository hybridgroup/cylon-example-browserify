(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Logger = module.exports = {
  log: function(args) {
    args = args.length >= 1 ? [].slice.call(args, 0) : [];

    var container = document.getElementById('log'),
        div = document.createElement("div"),
        text = document.createTextNode(args.join(''));

    div.appendChild(text);
    container.appendChild(div);
  }
};

['debug', 'info', 'warn', 'error', 'fatal'].forEach(function(type) {
  Logger[type] = Logger.log;
});

},{}],2:[function(require,module,exports){
/*
 * adaptor
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Basestar = require("./basestar"),
    Utils = require("./utils"),
    _ = require("./lodash");

// Public: Creates a new Adaptor
//
// opts - hash of acceptable params
//   name - name of the Adaptor, used when printing to console
//   connection - Connection the adaptor will use to proxy commands/events
//
// Returns a new Adaptor
var Adaptor = module.exports = function Adaptor(opts) {
  opts = opts || {};

  this.name = opts.name;

  // the Robot the adaptor belongs to
  this.robot = opts.robot;

  // some default options
  this.host = opts.host;
  this.port = opts.port;

  // misc. details provided in args hash
  this.details = {};

  _.forEach(opts, function(opt, name) {
    if (_.include(["robot", "name", "adaptor", "events"], name)) {
      return;
    }

    this.details[name] = opt;
  }, this);
};

Utils.subclass(Adaptor, Basestar);

// Public: Expresses the Connection in JSON format
//
// Returns an Object containing Connection data
Adaptor.prototype.toJSON = function() {
  return {
    name: this.name,
    adaptor: this.constructor.name || this.name,
    details: this.details
  };
};

},{"./basestar":3,"./lodash":11,"./utils":21}],3:[function(require,module,exports){
/*
 * basestar
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var EventEmitter = require("events").EventEmitter;

var Utils = require("./utils");

// Basestar is a base class to be used when writing external Cylon adaptors and
// drivers. It provides some useful base methods and functionality
//
// It also extends EventEmitter, so child classes are capable of emitting events
// for other parts of the system to handle.
var Basestar = module.exports = function Basestar() {
};

Utils.subclass(Basestar, EventEmitter);

// Public: Proxies calls from all methods in the object to a target object
//
// methods - array of methods to proxy
// target - object to proxy methods to
// source - object to proxy methods from
// force - whether or not to overwrite existing method definitions
//
// Returns the klass where the methods have been proxied
Basestar.prototype.proxyMethods = Utils.proxyFunctionsToObject;

// Public: Defines an event handler that proxies events from a source object
// to a target object
//
// opts - object containing options:
//   - targetEventName or eventName - event that should be emitted from the
//                                    target
//   - target - object to proxy event to
//   - source - object to proxy event from
//   - sendUpdate - whether or not to send an "update" event
//
// Returns the source
Basestar.prototype.defineEvent = function(opts) {
  opts.sendUpdate = opts.sendUpdate || false;
  opts.targetEventName = opts.targetEventName || opts.eventName;

  opts.source.on(opts.eventName, function() {
    var args = arguments.length >= 1 ? [].slice.call(arguments, 0) : [];
    args.unshift(opts.targetEventName);
    opts.target.emit.apply(opts.target, args);

    if (opts.sendUpdate) {
      args.unshift("update");
      opts.target.emit.apply(opts.target, args);
    }
  });

  return opts.source;
};

// Public: Creates an event handler that proxies events from an adaptor"s
// "connector" (reference to whatever module is actually talking to the hw)
// to the adaptor
//
// opts - hash of opts to be passed to defineEvent()
//
// Returns this.connector
Basestar.prototype.defineAdaptorEvent = function(opts) {
  return this._proxyEvents(opts, this.connector, this);
};

// Public: Creates an event handler that proxies events from a driver"s
// connection to the driver
//
// opts - hash of opts to be passed to defineEvent()
//
// Returns this.connection
Basestar.prototype.defineDriverEvent = function(opts) {
  return this._proxyEvents(opts, this.connection, this);
};

Basestar.prototype._proxyEvents = function(opts, source, target) {
  opts = (typeof opts === "string") ? { eventName: opts } : opts;

  opts.source = source;
  opts.target = target;

  return this.defineEvent(opts);
};

},{"./utils":21,"events":25}],4:[function(require,module,exports){
/*
 * Cylon - Internal Configuration
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

module.exports = {
  logging: {},

  // are we in TDR test mode? Used to stub out adaptors/drivers.
  testMode: false
};

},{}],5:[function(require,module,exports){
(function (process){
/*
 * connection
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Registry = require("./registry"),
    Config = require("./config"),
    _ = require("./lodash");

var testMode = function() {
  return process.env.NODE_ENV === "test" && Config.testMode;
};

// Public: Creates a new Adaptor and returns it.
//
// opts - hash of acceptable params:
//   robot - Robot the Connection belongs to
//   name - name for the connection
//   adaptor - string module name of the adaptor to be set up
//   port - string port to use for the Connection
//
// Returns the newly set-up connection
module.exports = function Connection(opts) {
  var module;

  opts = opts || {};

  if (opts.module) {
    module = Registry.register(opts.module);
  } else {
    module = Registry.findByAdaptor(opts.adaptor);
  }

  if (!module) {
    Registry.register("cylon-" + opts.adaptor);
    module = Registry.findByAdaptor(opts.adaptor);
  }

  var adaptor = module.adaptor(opts);

  _.forIn(adaptor, function(prop, name) {
    if (name === "constructor") {
      return;
    }

    if (_.isFunction(prop)) {
      adaptor[name] = prop.bind(adaptor);
    }
  });

  if (testMode()) {
    var testAdaptor = Registry.findByAdaptor("test").adaptor(opts);

    _.forIn(adaptor, function(prop, name) {
      if (_.isFunction(prop) && !testAdaptor[name]) {
        testAdaptor[name] = function() { return true; };
      }
    });

    return testAdaptor;
  }

  return adaptor;
};

}).call(this,require('_process'))
},{"./config":4,"./lodash":11,"./registry":15,"_process":26}],6:[function(require,module,exports){
(function (process){
/*
 * cylon
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Async = require("async");

var Logger = require("./logger"),
    Robot = require("./robot"),
    Config = require("./config"),
    Utils = require("./utils"),
    _ = require("./lodash");

var EventEmitter = require("events").EventEmitter;

var Cylon = module.exports = new EventEmitter();

Cylon.Logger = Logger;
Cylon.Driver = require("./driver");
Cylon.Adaptor = require("./adaptor");
Cylon.Utils = Utils;

Cylon.IO = {
  DigitalPin: require("./io/digital-pin"),
  Utils: require("./io/utils")
};

Cylon.apiInstances = [];

Cylon.robots = {};
Cylon.commands = {};

Cylon.events = [ "robot_added", "robot_removed" ];

// Public: Creates a new Robot
//
// opts - hash of Robot attributes
//
// Returns a shiny new Robot
// Examples:
//   Cylon.robot
//     connection: { name: "arduino", adaptor: "firmata" }
//     device: { name: "led", driver: "led", pin: 13 }
//
//     work: (me) ->
//       me.led.toggle()
Cylon.robot = function robot(opts) {
  opts = opts || {};

  // check if a robot with the same name exists already
  if (opts.name && this.robots[opts.name]) {
    var original = opts.name;
    opts.name = Utils.makeUnique(original, Object.keys(this.robots));

    var str = "Robot names must be unique. Renaming '";
    str += original + "' to '" + opts.name + "'";

    Logger.warn(str);
  }

  var bot = new Robot(opts);
  this.robots[bot.name] = bot;
  this.emit("robot_added", bot.name);

  return bot;
};

// Public: Initializes an API instance based on provided options.
//
// Returns nothing
Cylon.api = function api(Server, opts) {
  // if only passed options (or nothing), assume HTTP server
  if (Server == null || _.isObject(Server) && !_.isFunction(Server)) {
    opts = Server;
    Server = "http";
  }

  opts = opts || {};

  if (_.isString(Server)) {
    var req = "cylon-api-" + Server;

    try {
      Server = require(req);
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND") {
        var messages;

        if (req === "cylon-api-http") {
          messages = [
            "The HTTP API is no longer included in Cylon by default.",
            "To use it, install the plugin module: `npm install cylon-api-http`"
          ];
        } else {
          messages = [
            "Cannot find the " + req + " API module.",
            "You may be able to install it: `npm install " + req + "`"
          ];
        }

        _.each(messages, function(str) { Logger.error(str); });
        return;
      } else {
        throw e;
      }
    }
  }

  opts.mcp = this;

  var instance = new Server(opts);
  this.apiInstances.push(instance);
  instance.listen();
};

// Public: Starts up the API and the robots
//
// Returns nothing
Cylon.start = function start() {
  var starters = _.map(this.robots, "start");

  Async.parallel(starters, function() {
    var mode = Utils.fetch(Config, "workMode", "async");

    if (mode === "sync") {
      _.invoke(this.robots, "startWork");
    }
  }.bind(this));
};

// Public: Sets the internal configuration, based on passed options
//
// opts - object containing configuration key/value pairs
//
// Returns the current config
Cylon.config = function(opts) {
  var logChanges = (opts.logging && !_.isEqual(Config.logging, opts.logging));

  if (_.isObject(opts) && !_.isArray(opts)) {
    Config = _.merge(Config, opts);
  }

  if (logChanges) {
    Logger.setup();
  }

  return Config;
};

// Public: Halts the API and the robots
//
// callback - callback to be triggered when Cylon is ready to shutdown
//
// Returns nothing
Cylon.halt = function halt(callback) {
  callback = callback || function() {};

  var fns = _.map(this.robots, "halt");

  // if robots can"t shut down quickly enough, forcefully self-terminate
  var timeout = Config.haltTimeout || 3000;
  Utils.after(timeout, callback);

  Async.parallel(fns, callback);
};

Cylon.toJSON = function() {
  return {
    robots: _.invoke(this.robots, "toJSON"),
    commands: _.keys(this.commands),
    events: this.events
  };
};

if (process.platform === "win32") {
  var readline = require("readline"),
      io = { input: process.stdin, output: process.stdout };

  readline.createInterface(io).on("SIGINT", function() {
    process.emit("SIGINT");
  });
}

process.on("SIGINT", function() {
  Cylon.halt(function() {
    process.kill(process.pid);
  });
});

}).call(this,require('_process'))
},{"./adaptor":2,"./config":4,"./driver":8,"./io/digital-pin":9,"./io/utils":10,"./lodash":11,"./logger":12,"./robot":16,"./utils":21,"_process":26,"async":22,"events":25,"readline":24}],7:[function(require,module,exports){
(function (process){
/*
 * device
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Registry = require("./registry"),
    Config = require("./config"),
    _ = require("./lodash");

var testMode = function() {
  return process.env.NODE_ENV === "test" && Config.testMode;
};

// Public: Creates a new Device
//
// opts - object containing Device params
//   name - string name of the device
//   pin - string pin of the device
//   robot - parent Robot to the device
//   connection - connection to the device
//   driver - string name of the module the device driver logic lives in
//
// Returns a new Device
module.exports = function Device(opts) {
  var module;

  if (opts.module) {
    module = Registry.register(opts.module);
  } else {
    module = Registry.findByDriver(opts.driver);
  }

  opts.device = this;

  if (!module) {
    Registry.register("cylon-" + opts.driver);
    module = Registry.findByDriver(opts.driver);
  }

  var driver = module.driver(opts);

  _.forIn(driver, function(prop, name) {
    if (name === "constructor") {
      return;
    }

    if (_.isFunction(prop)) {
      driver[name] = prop.bind(driver);
    }
  });

  if (testMode()) {
    var testDriver = Registry.findByDriver("test").driver(opts);

    _.forIn(driver, function(prop, name) {
      if (_.isFunction(prop) && !testDriver[name]) {
        testDriver[name] = function() { return true; };
      }
    });

    return testDriver;
  }

  return driver;
};

}).call(this,require('_process'))
},{"./config":4,"./lodash":11,"./registry":15,"_process":26}],8:[function(require,module,exports){
/*
 * driver
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Basestar = require("./basestar"),
    Utils = require("./utils"),
    _ = require("./lodash");

// Public: Creates a new Driver
//
// opts - hash of acceptable params
//   name - name of the Driver, used when printing to console
//   device - Device the driver will use to proxy commands/events
//
// Returns a new Driver
var Driver = module.exports = function Driver(opts) {
  opts = opts || {};

  this.name = opts.name;
  this.robot = opts.robot;

  this.connection = opts.connection;

  this.commands = {};
  this.events = [];

  // some default options
  this.pin = opts.pin;
  this.interval = opts.interval || 10;

  this.details = {};

  _.forEach(opts, function(opt, name) {
    if (_.include(["robot", "name", "connection", "driver", "events"], name)) {
      return;
    }

    this.details[name] = opt;
  }, this);
};

Utils.subclass(Driver, Basestar);

Driver.prototype.setupCommands = function(commands, proxy) {
  if (proxy == null) {
    proxy = this.connection;
  }

  Utils.proxyFunctionsToObject(commands, proxy, this);

  _.forEach(commands, function(command) {
    var snake_case = command.replace(/[A-Z]+/g, function(match) {
      if (match.length > 1) {
        match = match.replace(/[A-Z]$/, function(m) {
          return "_" + m.toLowerCase();
        });
      }

      return "_" + match.toLowerCase();
    }).replace(/^_/, "");

    this.commands[snake_case] = this[command];
  }, this);
};

Driver.prototype.toJSON = function() {
  return {
    name: this.name,
    driver: this.constructor.name || this.name,
    connection: this.connection.name,
    commands: _.keys(this.commands),
    events: this.events,
    details: this.details
  };
};

},{"./basestar":3,"./lodash":11,"./utils":21}],9:[function(require,module,exports){
/*
 * Linux IO DigitalPin
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var FS = require("fs"),
    EventEmitter = require("events").EventEmitter;

var Utils = require("../utils");

var GPIO_PATH = "/sys/class/gpio";

var GPIO_READ = "in";
var GPIO_WRITE = "out";

// DigitalPin class offers an interface with the Linux GPIO system present in
// single-board computers such as a Raspberry Pi, or a BeagleBone
var DigitalPin = module.exports = function DigitalPin(opts) {
  this.pinNum = opts.pin.toString();
  this.status = "low";
  this.ready = false;
  this.mode = opts.mode;
};

Utils.subclass(DigitalPin, EventEmitter);

DigitalPin.prototype.connect = function(mode) {
  if (this.mode == null) {
    this.mode = mode;
  }

  FS.exists(this._pinPath(), function(exists) {
    if (exists) {
      this._openPin();
    } else {
      this._createGPIOPin();
    }
  }.bind(this));
};

DigitalPin.prototype.close = function() {
  FS.writeFile(this._unexportPath(), this.pinNum, function(err) {
    this._closeCallback(err);
  }.bind(this));
};

DigitalPin.prototype.closeSync = function() {
  FS.writeFileSync(this._unexportPath(), this.pinNum);
  this._closeCallback(false);
};

DigitalPin.prototype.digitalWrite = function(value) {
  if (this.mode !== "w") {
    this._setMode("w");
  }

  this.status = value === 1 ? "high" : "low";

  FS.writeFile(this._valuePath(), value, function(err) {
    if (err) {
      var str = "Error occurred while writing value ";
      str += value + " to pin " + this.pinNum;

      this.emit("error", str);
    } else {
      this.emit("digitalWrite", value);
    }
  }.bind(this));

  return value;
};

// Public: Reads the digial pin"s value periodicly on a supplied interval,
// and emits the result or an error
//
// interval - time (in milliseconds) to read from the pin at
//
// Returns the defined interval
DigitalPin.prototype.digitalRead = function(interval) {
  if (this.mode !== "r") { this._setMode("r"); }

  Utils.every(interval, function() {
    FS.readFile(this._valuePath(), function(err, data) {
      if (err) {
        var error = "Error occurred while reading from pin " + this.pinNum;
        this.emit("error", error);
      } else {
        var readData = parseInt(data.toString());
        this.emit("digitalRead", readData);
      }
    }.bind(this));
  }.bind(this));
};

DigitalPin.prototype.setHigh = function() {
  return this.digitalWrite(1);
};

DigitalPin.prototype.setLow = function() {
  return this.digitalWrite(0);
};

DigitalPin.prototype.toggle = function() {
  return (this.status === "low") ? this.setHigh() : this.setLow();
};

// Creates the GPIO file to read/write from
DigitalPin.prototype._createGPIOPin = function() {
  FS.writeFile(this._exportPath(), this.pinNum, function(err) {
    if (err) {
      this.emit("error", "Error while creating pin files");
    } else {
      this._openPin();
    }
  }.bind(this));
};

DigitalPin.prototype._openPin = function() {
  this._setMode(this.mode, true);
  this.emit("open");
};

DigitalPin.prototype._closeCallback = function(err) {
  if (err) {
    this.emit("error", "Error while closing pin files");
  } else {
    this.emit("close", this.pinNum);
  }
};

// Sets the mode for the pin by writing the values to the pin reference files
DigitalPin.prototype._setMode = function(mode, emitConnect) {
  if (emitConnect == null) { emitConnect = false; }

  this.mode = mode;

  var data = (mode === "w") ? GPIO_WRITE : GPIO_READ;

  FS.writeFile(this._directionPath(), data, function(err) {
    this._setModeCallback(err, emitConnect);
  }.bind(this));
};

DigitalPin.prototype._setModeCallback = function(err, emitConnect) {
  if (err) {
    return this.emit("error", "Setting up pin direction failed");
  }

  this.ready = true;

  if (emitConnect) {
    this.emit("connect", this.mode);
  }
};

DigitalPin.prototype._directionPath = function() {
  return this._pinPath() + "/direction";
};

DigitalPin.prototype._valuePath = function() {
  return this._pinPath() + "/value";
};

DigitalPin.prototype._pinPath = function() {
  return GPIO_PATH + "/gpio" + this.pinNum;
};

DigitalPin.prototype._exportPath = function() {
  return GPIO_PATH + "/export";
};

DigitalPin.prototype._unexportPath = function() {
  return GPIO_PATH + "/unexport";
};

},{"../utils":21,"events":25,"fs":24}],10:[function(require,module,exports){
"use strict";

module.exports = {
  // Returns { period: int, duty: int }
  // Calculated based on params value, freq, pulseWidth = { min: int, max: int }
  // pulseWidth min and max need to be specified in microseconds
  periodAndDuty: function(scaledDuty, freq, pulseWidth, polarity) {
    var period, duty, maxDuty;

    polarity = polarity || "high";
    period = Math.round(1.0e9 / freq);

    if (pulseWidth != null) {
      var pulseWidthMin = pulseWidth.min * 1000,
          pulseWidthMax = pulseWidth.max * 1000;

      maxDuty =  pulseWidthMax - pulseWidthMin;
      duty = Math.round(pulseWidthMin + (maxDuty * scaledDuty));
    } else {
      duty = Math.round(period * scaledDuty);
    }

    if (polarity === "low") {
      duty = period - duty;
    }

    return { period: period, duty: duty };
  }
};

},{}],11:[function(require,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) lodash.com/license | Underscore.js 1.5.2 underscorejs.org/LICENSE
 * Build: `lodash compat exports="node" minus="template" --minify --output ./lib/lodash.js`
 */
;(function(){function n(n,t,r){r=(r||0)-1;for(var e=n?n.length:0;++r<e;)if(n[r]===t)return r;return-1}function t(t,r){var e=typeof r;if(t=t.l,"boolean"==e||null==r)return t[r]?0:-1;"number"!=e&&"string"!=e&&(e="object");var u="number"==e?r:d+r;return t=(t=t[e])&&t[u],"object"==e?t&&-1<n(t,r)?0:-1:t?0:-1}function r(n){var t=this.l,r=typeof n;if("boolean"==r||null==n)t[n]=true;else{"number"!=r&&"string"!=r&&(r="object");var e="number"==r?n:d+n,t=t[r]||(t[r]={});"object"==r?(t[e]||(t[e]=[])).push(n):t[e]=true
}}function e(n){return n.charCodeAt(0)}function u(n,t){for(var r=n.m,e=t.m,u=-1,o=r.length;++u<o;){var a=r[u],i=e[u];if(a!==i){if(a>i||typeof a=="undefined")return 1;if(a<i||typeof i=="undefined")return-1}}return n.n-t.n}function o(n){var t=-1,e=n.length,u=n[0],o=n[e/2|0],a=n[e-1];if(u&&typeof u=="object"&&o&&typeof o=="object"&&a&&typeof a=="object")return false;for(u=i(),u["false"]=u["null"]=u["true"]=u.undefined=false,o=i(),o.k=n,o.l=u,o.push=r;++t<e;)o.push(n[t]);return o}function a(){return h.pop()||[]
}function i(){return v.pop()||{k:null,l:null,m:null,"false":false,n:0,"null":false,number:null,object:null,push:null,string:null,"true":false,undefined:false,o:null}}function f(n){return typeof n.toString!="function"&&typeof(n+"")=="string"}function l(n){n.length=0,h.length<_&&h.push(n)}function c(n){var t=n.l;t&&c(t),n.k=n.l=n.m=n.object=n.number=n.string=n.o=null,v.length<_&&v.push(n)}function p(n,t,r){t||(t=0),typeof r=="undefined"&&(r=n?n.length:0);var e=-1;r=r-t||0;for(var u=Array(0>r?0:r);++e<r;)u[e]=n[t+e];
return u}function s(r){function h(n){return n&&typeof n=="object"&&!Br(n)&&gr.call(n,"__wrapped__")?n:new v(n)}function v(n,t){this.__chain__=!!t,this.__wrapped__=n}function _(n){function t(){if(e){var n=p(e);hr.apply(n,arguments)}if(this instanceof t){var o=M(r.prototype),n=r.apply(o,n||arguments);return vt(n)?n:o}return r.apply(u,n||arguments)}var r=n[0],e=n[2],u=n[4];return Nr(t,n),t}function J(n,t,r,e,u){if(r){var o=r(n);if(typeof o!="undefined")return o}if(!vt(n))return n;var i=ar.call(n);if(!z[i]||!Dr.nodeClass&&f(n))return n;
var c=Ar[i];switch(i){case D:case N:return new c(+n);case R:case L:return new c(n);case T:return o=c(n.source,j.exec(n)),o.lastIndex=n.lastIndex,o}if(i=Br(n),t){var s=!e;e||(e=a()),u||(u=a());for(var g=e.length;g--;)if(e[g]==n)return u[g];o=i?c(n.length):{}}else o=i?p(n):Gr({},n);return i&&(gr.call(n,"index")&&(o.index=n.index),gr.call(n,"input")&&(o.input=n.input)),t?(e.push(n),u.push(o),(i?$r:Vr)(n,function(n,a){o[a]=J(n,t,r,e,u)}),s&&(l(e),l(u)),o):o}function M(n){return vt(n)?_r(n):{}}function V(n,t,r){if(typeof n!="function")return qt;
if(typeof t=="undefined"||!("prototype"in n))return n;var e=n.__bindData__;if(typeof e=="undefined"&&(Dr.funcNames&&(e=!n.name),e=e||!Dr.funcDecomp,!e)){var u=pr.call(n);Dr.funcNames||(e=!x.test(u)),e||(e=E.test(u),Nr(n,e))}if(false===e||true!==e&&1&e[1])return n;switch(r){case 1:return function(r){return n.call(t,r)};case 2:return function(r,e){return n.call(t,r,e)};case 3:return function(r,e,u){return n.call(t,r,e,u)};case 4:return function(r,e,u,o){return n.call(t,r,e,u,o)}}return Lt(n,t)}function H(n){function t(){var n=f?a:this;
if(u){var h=p(u);hr.apply(h,arguments)}return(o||c)&&(h||(h=p(arguments)),o&&hr.apply(h,o),c&&h.length<i)?(e|=16,H([r,s?e:-4&e,h,null,a,i])):(h||(h=arguments),l&&(r=n[g]),this instanceof t?(n=M(r.prototype),h=r.apply(n,h),vt(h)?h:n):r.apply(n,h))}var r=n[0],e=n[1],u=n[2],o=n[3],a=n[4],i=n[5],f=1&e,l=2&e,c=4&e,s=8&e,g=r;return Nr(t,n),t}function Q(r,e){var u=-1,a=at(),i=r?r.length:0,f=i>=b&&a===n,l=[];if(f){var p=o(e);p?(a=t,e=p):f=false}for(;++u<i;)p=r[u],0>a(e,p)&&l.push(p);return f&&c(e),l}function X(n,t,r,e){e=(e||0)-1;
for(var u=n?n.length:0,o=[];++e<u;){var a=n[e];if(a&&typeof a=="object"&&typeof a.length=="number"&&(Br(a)||ct(a))){t||(a=X(a,t,r));var i=-1,f=a.length,l=o.length;for(o.length+=f;++i<f;)o[l++]=a[i]}else r||o.push(a)}return o}function Y(n,t,r,e,u,o){if(r){var i=r(n,t);if(typeof i!="undefined")return!!i}if(n===t)return 0!==n||1/n==1/t;if(n===n&&!(n&&$[typeof n]||t&&$[typeof t]))return false;if(null==n||null==t)return n===t;var c=ar.call(n),p=ar.call(t);if(c==A&&(c=F),p==A&&(p=F),c!=p)return false;switch(c){case D:case N:return+n==+t;
case R:return n!=+n?t!=+t:0==n?1/n==1/t:n==+t;case T:case L:return n==Zt(t)}if(p=c==I,!p){var s=gr.call(n,"__wrapped__"),g=gr.call(t,"__wrapped__");if(s||g)return Y(s?n.__wrapped__:n,g?t.__wrapped__:t,r,e,u,o);if(c!=F||!Dr.nodeClass&&(f(n)||f(t)))return false;if(c=!Dr.argsObject&&ct(n)?Xt:n.constructor,s=!Dr.argsObject&&ct(t)?Xt:t.constructor,c!=s&&!(ht(c)&&c instanceof c&&ht(s)&&s instanceof s)&&"constructor"in n&&"constructor"in t)return false}for(c=!u,u||(u=a()),o||(o=a()),s=u.length;s--;)if(u[s]==n)return o[s]==t;
var h=0,i=true;if(u.push(n),o.push(t),p){if(s=n.length,h=t.length,(i=h==s)||e)for(;h--;)if(p=s,g=t[h],e)for(;p--&&!(i=Y(n[p],g,r,e,u,o)););else if(!(i=Y(n[h],g,r,e,u,o)))break}else Mr(t,function(t,a,f){return gr.call(f,a)?(h++,i=gr.call(n,a)&&Y(n[a],t,r,e,u,o)):void 0}),i&&!e&&Mr(n,function(n,t,r){return gr.call(r,t)?i=-1<--h:void 0});return u.pop(),o.pop(),c&&(l(u),l(o)),i}function Z(n,t,r,e,u){(Br(t)?xt:Vr)(t,function(t,o){var a,i,f=t,l=n[o];if(t&&((i=Br(t))||Hr(t))){for(f=e.length;f--;)if(a=e[f]==t){l=u[f];
break}if(!a){var c;r&&(f=r(l,t),c=typeof f!="undefined")&&(l=f),c||(l=i?Br(l)?l:[]:Hr(l)?l:{}),e.push(t),u.push(l),c||Z(l,t,r,e,u)}}else r&&(f=r(l,t),typeof f=="undefined"&&(f=t)),typeof f!="undefined"&&(l=f);n[o]=l})}function nt(n,t){return n+cr(Sr()*(t-n+1))}function tt(r,e,u){var i=-1,f=at(),p=r?r.length:0,s=[],g=!e&&p>=b&&f===n,h=u||g?a():s;for(g&&(h=o(h),f=t);++i<p;){var v=r[i],y=u?u(v,i,r):v;(e?!i||h[h.length-1]!==y:0>f(h,y))&&((u||g)&&h.push(y),s.push(v))}return g?(l(h.k),c(h)):u&&l(h),s}function rt(n){return function(t,r,e){var u={};
if(r=h.createCallback(r,e,3),Br(t)){e=-1;for(var o=t.length;++e<o;){var a=t[e];n(u,a,r(a,e,t),t)}}else $r(t,function(t,e,o){n(u,t,r(t,e,o),o)});return u}}function et(n,t,r,e,u,o){var a=1&t,i=4&t,f=16&t,l=32&t;if(!(2&t||ht(n)))throw new nr;f&&!r.length&&(t&=-17,f=r=false),l&&!e.length&&(t&=-33,l=e=false);var c=n&&n.__bindData__;return c&&true!==c?(c=p(c),c[2]&&(c[2]=p(c[2])),c[3]&&(c[3]=p(c[3])),!a||1&c[1]||(c[4]=u),!a&&1&c[1]&&(t|=8),!i||4&c[1]||(c[5]=o),f&&hr.apply(c[2]||(c[2]=[]),r),l&&dr.apply(c[3]||(c[3]=[]),e),c[1]|=t,et.apply(null,c)):(1==t||17===t?_:H)([n,t,r,e,u,o])
}function ut(){W.h=S,W.b=W.c=W.g=W.i="",W.e="t",W.j=true;for(var n,t=0;n=arguments[t];t++)for(var r in n)W[r]=n[r];t=W.a,W.d=/^[^,]+/.exec(t)[0],n=Ht,t="return function("+t+"){",r=W;var e="var n,t="+r.d+",E="+r.e+";if(!t)return E;"+r.i+";";r.b?(e+="var u=t.length;n=-1;if("+r.b+"){",Dr.unindexedChars&&(e+="if(s(t)){t=t.split('')}"),e+="while(++n<u){"+r.g+";}}else{"):Dr.nonEnumArgs&&(e+="var u=t.length;n=-1;if(u&&p(t)){while(++n<u){n+='';"+r.g+";}}else{"),Dr.enumPrototypes&&(e+="var G=typeof t=='function';"),Dr.enumErrorProps&&(e+="var F=t===k||t instanceof Error;");
var u=[];if(Dr.enumPrototypes&&u.push('!(G&&n=="prototype")'),Dr.enumErrorProps&&u.push('!(F&&(n=="message"||n=="name"))'),r.j&&r.f)e+="var C=-1,D=B[typeof t]&&v(t),u=D?D.length:0;while(++C<u){n=D[C];",u.length&&(e+="if("+u.join("&&")+"){"),e+=r.g+";",u.length&&(e+="}"),e+="}";else if(e+="for(n in t){",r.j&&u.push("m.call(t, n)"),u.length&&(e+="if("+u.join("&&")+"){"),e+=r.g+";",u.length&&(e+="}"),e+="}",Dr.nonEnumShadows){for(e+="if(t!==A){var i=t.constructor,r=t===(i&&i.prototype),f=t===J?I:t===k?j:L.call(t),x=y[f];",k=0;7>k;k++)e+="n='"+r.h[k]+"';if((!(r&&x[n])&&m.call(t,n))",r.j||(e+="||(!x[n]&&t[n]!==A[n])"),e+="){"+r.g+"}";
e+="}"}return(r.b||Dr.nonEnumArgs)&&(e+="}"),e+=r.c+";return E",n("d,j,k,m,o,p,q,s,v,A,B,y,I,J,L",t+e+"}")(V,B,rr,gr,m,ct,Br,mt,W.f,er,$,Ir,L,ur,ar)}function ot(n){return zr[n]}function at(){var t=(t=h.indexOf)===Nt?n:t;return t}function it(n){return typeof n=="function"&&ir.test(n)}function ft(n){var t,r;return!n||ar.call(n)!=F||(t=n.constructor,ht(t)&&!(t instanceof t))||!Dr.argsClass&&ct(n)||!Dr.nodeClass&&f(n)?false:Dr.ownLast?(Mr(n,function(n,t,e){return r=gr.call(e,t),false}),false!==r):(Mr(n,function(n,t){r=t
}),typeof r=="undefined"||gr.call(n,r))}function lt(n){return qr[n]}function ct(n){return n&&typeof n=="object"&&typeof n.length=="number"&&ar.call(n)==A||false}function pt(n,t,r){var e=Rr(n),u=e.length;for(t=V(t,r,3);u--&&(r=e[u],false!==t(n[r],r,n)););return n}function st(n){var t=[];return Mr(n,function(n,r){ht(n)&&t.push(r)}),t.sort()}function gt(n){for(var t=-1,r=Rr(n),e=r.length,u={};++t<e;){var o=r[t];u[n[o]]=o}return u}function ht(n){return typeof n=="function"}function vt(n){return!(!n||!$[typeof n])
}function yt(n){return typeof n=="number"||n&&typeof n=="object"&&ar.call(n)==R||false}function mt(n){return typeof n=="string"||n&&typeof n=="object"&&ar.call(n)==L||false}function dt(n){for(var t=-1,r=Rr(n),e=r.length,u=Jt(e);++t<e;)u[t]=n[r[t]];return u}function bt(n,t,r){var e=-1,u=at(),o=n?n.length:0,a=false;return r=(0>r?kr(0,o+r):r)||0,Br(n)?a=-1<u(n,t,r):typeof o=="number"?a=-1<(mt(n)?n.indexOf(t,r):u(n,t,r)):$r(n,function(n){return++e<r?void 0:!(a=n===t)}),a}function _t(n,t,r){var e=true;if(t=h.createCallback(t,r,3),Br(n)){r=-1;
for(var u=n.length;++r<u&&(e=!!t(n[r],r,n)););}else $r(n,function(n,r,u){return e=!!t(n,r,u)});return e}function wt(n,t,r){var e=[];if(t=h.createCallback(t,r,3),Br(n)){r=-1;for(var u=n.length;++r<u;){var o=n[r];t(o,r,n)&&e.push(o)}}else $r(n,function(n,r,u){t(n,r,u)&&e.push(n)});return e}function jt(n,t,r){if(t=h.createCallback(t,r,3),!Br(n)){var e;return $r(n,function(n,r,u){return t(n,r,u)?(e=n,false):void 0}),e}r=-1;for(var u=n.length;++r<u;){var o=n[r];if(t(o,r,n))return o}}function xt(n,t,r){if(t&&typeof r=="undefined"&&Br(n)){r=-1;
for(var e=n.length;++r<e&&false!==t(n[r],r,n););}else $r(n,t,r);return n}function Ct(n,t,r){var e=n,u=n?n.length:0;if(t=t&&typeof r=="undefined"?t:V(t,r,3),Br(n))for(;u--&&false!==t(n[u],u,n););else{if(typeof u!="number")var o=Rr(n),u=o.length;else Dr.unindexedChars&&mt(n)&&(e=n.split(""));$r(n,function(n,r,a){return r=o?o[--u]:--u,t(e[r],r,a)})}return n}function kt(n,t,r){var e=-1,u=n?n.length:0,o=Jt(typeof u=="number"?u:0);if(t=h.createCallback(t,r,3),Br(n))for(;++e<u;)o[e]=t(n[e],e,n);else $r(n,function(n,r,u){o[++e]=t(n,r,u)
});return o}function Et(n,t,r){var u=-1/0,o=u;if(typeof t!="function"&&r&&r[t]===n&&(t=null),null==t&&Br(n)){r=-1;for(var a=n.length;++r<a;){var i=n[r];i>o&&(o=i)}}else t=null==t&&mt(n)?e:h.createCallback(t,r,3),$r(n,function(n,r,e){r=t(n,r,e),r>u&&(u=r,o=n)});return o}function Ot(n,t,r,e){var u=3>arguments.length;if(t=h.createCallback(t,e,4),Br(n)){var o=-1,a=n.length;for(u&&(r=n[++o]);++o<a;)r=t(r,n[o],o,n)}else $r(n,function(n,e,o){r=u?(u=false,n):t(r,n,e,o)});return r}function St(n,t,r,e){var u=3>arguments.length;
return t=h.createCallback(t,e,4),Ct(n,function(n,e,o){r=u?(u=false,n):t(r,n,e,o)}),r}function At(n){var t=-1,r=n?n.length:0,e=Jt(typeof r=="number"?r:0);return xt(n,function(n){var r=nt(0,++t);e[t]=e[r],e[r]=n}),e}function It(n,t,r){var e;if(t=h.createCallback(t,r,3),Br(n)){r=-1;for(var u=n.length;++r<u&&!(e=t(n[r],r,n)););}else $r(n,function(n,r,u){return!(e=t(n,r,u))});return!!e}function Dt(n,t,r){var e=0,u=n?n.length:0;if(typeof t!="number"&&null!=t){var o=-1;for(t=h.createCallback(t,r,3);++o<u&&t(n[o],o,n);)e++
}else if(e=t,null==e||r)return n?n[0]:g;return p(n,0,Er(kr(0,e),u))}function Nt(t,r,e){if(typeof e=="number"){var u=t?t.length:0;e=0>e?kr(0,u+e):e||0}else if(e)return e=Pt(t,r),t[e]===r?e:-1;return n(t,r,e)}function Bt(n,t,r){if(typeof t!="number"&&null!=t){var e=0,u=-1,o=n?n.length:0;for(t=h.createCallback(t,r,3);++u<o&&t(n[u],u,n);)e++}else e=null==t||r?1:kr(0,t);return p(n,e)}function Pt(n,t,r,e){var u=0,o=n?n.length:u;for(r=r?h.createCallback(r,e,1):qt,t=r(t);u<o;)e=u+o>>>1,r(n[e])<t?u=e+1:o=e;
return u}function Rt(n,t,r,e){return typeof t!="boolean"&&null!=t&&(e=r,r=typeof t!="function"&&e&&e[t]===n?null:t,t=false),null!=r&&(r=h.createCallback(r,e,3)),tt(n,t,r)}function Ft(){for(var n=1<arguments.length?arguments:arguments[0],t=-1,r=n?Et(Yr(n,"length")):0,e=Jt(0>r?0:r);++t<r;)e[t]=Yr(n,t);return e}function Tt(n,t){var r=-1,e=n?n.length:0,u={};for(t||!e||Br(n[0])||(t=[]);++r<e;){var o=n[r];t?u[o]=t[r]:o&&(u[o[0]]=o[1])}return u}function Lt(n,t){return 2<arguments.length?et(n,17,p(arguments,2),null,t):et(n,1,null,null,t)
}function zt(n,t,r){var e,u,o,a,i,f,l,c=0,p=false,s=true;if(!ht(n))throw new nr;if(t=kr(0,t)||0,true===r)var h=true,s=false;else vt(r)&&(h=r.leading,p="maxWait"in r&&(kr(t,r.maxWait)||0),s="trailing"in r?r.trailing:s);var v=function(){var r=t-(Zr()-a);0<r?f=yr(v,r):(u&&lr(u),r=l,u=f=l=g,r&&(c=Zr(),o=n.apply(i,e),f||u||(e=i=null)))},y=function(){f&&lr(f),u=f=l=g,(s||p!==t)&&(c=Zr(),o=n.apply(i,e),f||u||(e=i=null))};return function(){if(e=arguments,a=Zr(),i=this,l=s&&(f||!h),false===p)var r=h&&!f;else{u||h||(c=a);
var g=p-(a-c),m=0>=g;m?(u&&(u=lr(u)),c=a,o=n.apply(i,e)):u||(u=yr(y,g))}return m&&f?f=lr(f):f||t===p||(f=yr(v,t)),r&&(m=true,o=n.apply(i,e)),!m||f||u||(e=i=null),o}}function qt(n){return n}function Kt(n,t,r){var e=true,u=t&&st(t);t&&(r||u.length)||(null==r&&(r=t),o=v,t=n,n=h,u=st(t)),false===r?e=false:vt(r)&&"chain"in r&&(e=r.chain);var o=n,a=ht(o);xt(u,function(r){var u=n[r]=t[r];a&&(o.prototype[r]=function(){var t=this.__chain__,r=this.__wrapped__,a=[r];if(hr.apply(a,arguments),a=u.apply(n,a),e||t){if(r===a&&vt(a))return this;
a=new o(a),a.__chain__=t}return a})})}function Wt(){}function $t(n){return function(t){return t[n]}}function Gt(){return this.__wrapped__}r=r?U.defaults(G.Object(),r,U.pick(G,O)):G;var Jt=r.Array,Mt=r.Boolean,Vt=r.Date,Ht=r.Function,Ut=r.Math,Qt=r.Number,Xt=r.Object,Yt=r.RegExp,Zt=r.String,nr=r.TypeError,tr=[],rr=r.Error.prototype,er=Xt.prototype,ur=Zt.prototype,or=r._,ar=er.toString,ir=Yt("^"+Zt(ar).replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/toString| for [^\]]+/g,".*?")+"$"),fr=Ut.ceil,lr=r.clearTimeout,cr=Ut.floor,pr=Ht.prototype.toString,sr=it(sr=Xt.getPrototypeOf)&&sr,gr=er.hasOwnProperty,hr=tr.push,vr=er.propertyIsEnumerable,yr=r.setTimeout,mr=tr.splice,dr=tr.unshift,br=function(){try{var n={},t=it(t=Xt.defineProperty)&&t,r=t(n,n,n)&&t
}catch(e){}return r}(),_r=it(_r=Xt.create)&&_r,wr=it(wr=Jt.isArray)&&wr,jr=r.isFinite,xr=r.isNaN,Cr=it(Cr=Xt.keys)&&Cr,kr=Ut.max,Er=Ut.min,Or=r.parseInt,Sr=Ut.random,Ar={};Ar[I]=Jt,Ar[D]=Mt,Ar[N]=Vt,Ar[P]=Ht,Ar[F]=Xt,Ar[R]=Qt,Ar[T]=Yt,Ar[L]=Zt;var Ir={};Ir[I]=Ir[N]=Ir[R]={constructor:true,toLocaleString:true,toString:true,valueOf:true},Ir[D]=Ir[L]={constructor:true,toString:true,valueOf:true},Ir[B]=Ir[P]=Ir[T]={constructor:true,toString:true},Ir[F]={constructor:true},function(){for(var n=S.length;n--;){var t,r=S[n];
for(t in Ir)gr.call(Ir,t)&&!gr.call(Ir[t],r)&&(Ir[t][r]=false)}}(),v.prototype=h.prototype;var Dr=h.support={};!function(){var n=function(){this.x=1},t={0:1,length:1},e=[];n.prototype={valueOf:1,y:1};for(var u in new n)e.push(u);for(u in arguments);Dr.argsClass=ar.call(arguments)==A,Dr.argsObject=arguments.constructor==Xt&&!(arguments instanceof Jt),Dr.enumErrorProps=vr.call(rr,"message")||vr.call(rr,"name"),Dr.enumPrototypes=vr.call(n,"prototype"),Dr.funcDecomp=!it(r.WinRTError)&&E.test(s),Dr.funcNames=typeof Ht.name=="string",Dr.nonEnumArgs=0!=u,Dr.nonEnumShadows=!/valueOf/.test(e),Dr.ownLast="x"!=e[0],Dr.spliceObjects=(tr.splice.call(t,0,1),!t[0]),Dr.unindexedChars="xx"!="x"[0]+Xt("x")[0];
try{Dr.nodeClass=!(ar.call(document)==F&&!({toString:0}+""))}catch(o){Dr.nodeClass=true}}(1),_r||(M=function(){function n(){}return function(t){if(vt(t)){n.prototype=t;var e=new n;n.prototype=null}return e||r.Object()}}());var Nr=br?function(n,t){K.value=t,br(n,"__bindData__",K)}:Wt;Dr.argsClass||(ct=function(n){return n&&typeof n=="object"&&typeof n.length=="number"&&gr.call(n,"callee")&&!vr.call(n,"callee")||false});var Br=wr||function(n){return n&&typeof n=="object"&&typeof n.length=="number"&&ar.call(n)==I||false
},Pr=ut({a:"z",e:"[]",i:"if(!(B[typeof z]))return E",g:"E.push(n)"}),Rr=Cr?function(n){return vt(n)?Dr.enumPrototypes&&typeof n=="function"||Dr.nonEnumArgs&&n.length&&ct(n)?Pr(n):Cr(n):[]}:Pr,Fr={a:"g,e,K",i:"e=e&&typeof K=='undefined'?e:d(e,K,3)",b:"typeof u=='number'",v:Rr,g:"if(e(t[n],n,g)===false)return E"},Tr={a:"z,H,l",i:"var a=arguments,b=0,c=typeof l=='number'?2:a.length;while(++b<c){t=a[b];if(t&&B[typeof t]){",v:Rr,g:"if(typeof E[n]=='undefined')E[n]=t[n]",c:"}}"},Lr={i:"if(!B[typeof t])return E;"+Fr.i,b:false},zr={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},qr=gt(zr),Kr=Yt("("+Rr(qr).join("|")+")","g"),Wr=Yt("["+Rr(zr).join("")+"]","g"),$r=ut(Fr),Gr=ut(Tr,{i:Tr.i.replace(";",";if(c>3&&typeof a[c-2]=='function'){var e=d(a[--c-1],a[c--],2)}else if(c>2&&typeof a[c-1]=='function'){e=a[--c]}"),g:"E[n]=e?e(E[n],t[n]):t[n]"}),Jr=ut(Tr),Mr=ut(Fr,Lr,{j:false}),Vr=ut(Fr,Lr);
ht(/x/)&&(ht=function(n){return typeof n=="function"&&ar.call(n)==P});var Hr=sr?function(n){if(!n||ar.call(n)!=F||!Dr.argsClass&&ct(n))return false;var t=n.valueOf,r=it(t)&&(r=sr(t))&&sr(r);return r?n==r||sr(n)==r:ft(n)}:ft,Ur=rt(function(n,t,r){gr.call(n,r)?n[r]++:n[r]=1}),Qr=rt(function(n,t,r){(gr.call(n,r)?n[r]:n[r]=[]).push(t)}),Xr=rt(function(n,t,r){n[r]=t}),Yr=kt,Zr=it(Zr=Vt.now)&&Zr||function(){return(new Vt).getTime()},ne=8==Or(w+"08")?Or:function(n,t){return Or(mt(n)?n.replace(C,""):n,t||0)};
return h.after=function(n,t){if(!ht(t))throw new nr;return function(){return 1>--n?t.apply(this,arguments):void 0}},h.assign=Gr,h.at=function(n){var t=arguments,r=-1,e=X(t,true,false,1),t=t[2]&&t[2][t[1]]===n?1:e.length,u=Jt(t);for(Dr.unindexedChars&&mt(n)&&(n=n.split(""));++r<t;)u[r]=n[e[r]];return u},h.bind=Lt,h.bindAll=function(n){for(var t=1<arguments.length?X(arguments,true,false,1):st(n),r=-1,e=t.length;++r<e;){var u=t[r];n[u]=et(n[u],1,null,null,n)}return n},h.bindKey=function(n,t){return 2<arguments.length?et(t,19,p(arguments,2),null,n):et(t,3,null,null,n)
},h.chain=function(n){return n=new v(n),n.__chain__=true,n},h.compact=function(n){for(var t=-1,r=n?n.length:0,e=[];++t<r;){var u=n[t];u&&e.push(u)}return e},h.compose=function(){for(var n=arguments,t=n.length;t--;)if(!ht(n[t]))throw new nr;return function(){for(var t=arguments,r=n.length;r--;)t=[n[r].apply(this,t)];return t[0]}},h.constant=function(n){return function(){return n}},h.countBy=Ur,h.create=function(n,t){var r=M(n);return t?Gr(r,t):r},h.createCallback=function(n,t,r){var e=typeof n;if(null==n||"function"==e)return V(n,t,r);
if("object"!=e)return $t(n);var u=Rr(n),o=u[0],a=n[o];return 1!=u.length||a!==a||vt(a)?function(t){for(var r=u.length,e=false;r--&&(e=Y(t[u[r]],n[u[r]],null,true)););return e}:function(n){return n=n[o],a===n&&(0!==a||1/a==1/n)}},h.curry=function(n,t){return t=typeof t=="number"?t:+t||n.length,et(n,4,null,null,null,t)},h.debounce=zt,h.defaults=Jr,h.defer=function(n){if(!ht(n))throw new nr;var t=p(arguments,1);return yr(function(){n.apply(g,t)},1)},h.delay=function(n,t){if(!ht(n))throw new nr;var r=p(arguments,2);
return yr(function(){n.apply(g,r)},t)},h.difference=function(n){return Q(n,X(arguments,true,true,1))},h.filter=wt,h.flatten=function(n,t,r,e){return typeof t!="boolean"&&null!=t&&(e=r,r=typeof t!="function"&&e&&e[t]===n?null:t,t=false),null!=r&&(n=kt(n,r,e)),X(n,t)},h.forEach=xt,h.forEachRight=Ct,h.forIn=Mr,h.forInRight=function(n,t,r){var e=[];Mr(n,function(n,t){e.push(t,n)});var u=e.length;for(t=V(t,r,3);u--&&false!==t(e[u--],e[u],n););return n},h.forOwn=Vr,h.forOwnRight=pt,h.functions=st,h.groupBy=Qr,h.indexBy=Xr,h.initial=function(n,t,r){var e=0,u=n?n.length:0;
if(typeof t!="number"&&null!=t){var o=u;for(t=h.createCallback(t,r,3);o--&&t(n[o],o,n);)e++}else e=null==t||r?1:t||e;return p(n,0,Er(kr(0,u-e),u))},h.intersection=function(){for(var r=[],e=-1,u=arguments.length,i=a(),f=at(),p=f===n,s=a();++e<u;){var g=arguments[e];(Br(g)||ct(g))&&(r.push(g),i.push(p&&g.length>=b&&o(e?r[e]:s)))}var p=r[0],h=-1,v=p?p.length:0,y=[];n:for(;++h<v;){var m=i[0],g=p[h];if(0>(m?t(m,g):f(s,g))){for(e=u,(m||s).push(g);--e;)if(m=i[e],0>(m?t(m,g):f(r[e],g)))continue n;y.push(g)
}}for(;u--;)(m=i[u])&&c(m);return l(i),l(s),y},h.invert=gt,h.invoke=function(n,t){var r=p(arguments,2),e=-1,u=typeof t=="function",o=n?n.length:0,a=Jt(typeof o=="number"?o:0);return xt(n,function(n){a[++e]=(u?t:n[t]).apply(n,r)}),a},h.keys=Rr,h.map=kt,h.mapValues=function(n,t,r){var e={};return t=h.createCallback(t,r,3),Vr(n,function(n,r,u){e[r]=t(n,r,u)}),e},h.max=Et,h.memoize=function(n,t){if(!ht(n))throw new nr;var r=function(){var e=r.cache,u=t?t.apply(this,arguments):d+arguments[0];return gr.call(e,u)?e[u]:e[u]=n.apply(this,arguments)
};return r.cache={},r},h.merge=function(n){var t=arguments,r=2;if(!vt(n))return n;if("number"!=typeof t[2]&&(r=t.length),3<r&&"function"==typeof t[r-2])var e=V(t[--r-1],t[r--],2);else 2<r&&"function"==typeof t[r-1]&&(e=t[--r]);for(var t=p(arguments,1,r),u=-1,o=a(),i=a();++u<r;)Z(n,t[u],e,o,i);return l(o),l(i),n},h.min=function(n,t,r){var u=1/0,o=u;if(typeof t!="function"&&r&&r[t]===n&&(t=null),null==t&&Br(n)){r=-1;for(var a=n.length;++r<a;){var i=n[r];i<o&&(o=i)}}else t=null==t&&mt(n)?e:h.createCallback(t,r,3),$r(n,function(n,r,e){r=t(n,r,e),r<u&&(u=r,o=n)
});return o},h.omit=function(n,t,r){var e={};if(typeof t!="function"){var u=[];Mr(n,function(n,t){u.push(t)});for(var u=Q(u,X(arguments,true,false,1)),o=-1,a=u.length;++o<a;){var i=u[o];e[i]=n[i]}}else t=h.createCallback(t,r,3),Mr(n,function(n,r,u){t(n,r,u)||(e[r]=n)});return e},h.once=function(n){var t,r;if(!ht(n))throw new nr;return function(){return t?r:(t=true,r=n.apply(this,arguments),n=null,r)}},h.pairs=function(n){for(var t=-1,r=Rr(n),e=r.length,u=Jt(e);++t<e;){var o=r[t];u[t]=[o,n[o]]}return u},h.partial=function(n){return et(n,16,p(arguments,1))
},h.partialRight=function(n){return et(n,32,null,p(arguments,1))},h.pick=function(n,t,r){var e={};if(typeof t!="function")for(var u=-1,o=X(arguments,true,false,1),a=vt(n)?o.length:0;++u<a;){var i=o[u];i in n&&(e[i]=n[i])}else t=h.createCallback(t,r,3),Mr(n,function(n,r,u){t(n,r,u)&&(e[r]=n)});return e},h.pluck=Yr,h.property=$t,h.pull=function(n){for(var t=arguments,r=0,e=t.length,u=n?n.length:0;++r<e;)for(var o=-1,a=t[r];++o<u;)n[o]===a&&(mr.call(n,o--,1),u--);return n},h.range=function(n,t,r){n=+n||0,r=typeof r=="number"?r:+r||1,null==t&&(t=n,n=0);
var e=-1;t=kr(0,fr((t-n)/(r||1)));for(var u=Jt(t);++e<t;)u[e]=n,n+=r;return u},h.reject=function(n,t,r){return t=h.createCallback(t,r,3),wt(n,function(n,r,e){return!t(n,r,e)})},h.remove=function(n,t,r){var e=-1,u=n?n.length:0,o=[];for(t=h.createCallback(t,r,3);++e<u;)r=n[e],t(r,e,n)&&(o.push(r),mr.call(n,e--,1),u--);return o},h.rest=Bt,h.shuffle=At,h.sortBy=function(n,t,r){var e=-1,o=Br(t),f=n?n.length:0,p=Jt(typeof f=="number"?f:0);for(o||(t=h.createCallback(t,r,3)),xt(n,function(n,r,u){var f=p[++e]=i();
o?f.m=kt(t,function(t){return n[t]}):(f.m=a())[0]=t(n,r,u),f.n=e,f.o=n}),f=p.length,p.sort(u);f--;)n=p[f],p[f]=n.o,o||l(n.m),c(n);return p},h.tap=function(n,t){return t(n),n},h.throttle=function(n,t,r){var e=true,u=true;if(!ht(n))throw new nr;return false===r?e=false:vt(r)&&(e="leading"in r?r.leading:e,u="trailing"in r?r.trailing:u),q.leading=e,q.maxWait=t,q.trailing=u,zt(n,t,q)},h.times=function(n,t,r){n=-1<(n=+n)?n:0;var e=-1,u=Jt(n);for(t=V(t,r,1);++e<n;)u[e]=t(e);return u},h.toArray=function(n){return n&&typeof n.length=="number"?Dr.unindexedChars&&mt(n)?n.split(""):p(n):dt(n)
},h.transform=function(n,t,r,e){var u=Br(n);if(null==r)if(u)r=[];else{var o=n&&n.constructor;r=M(o&&o.prototype)}return t&&(t=h.createCallback(t,e,4),(u?$r:Vr)(n,function(n,e,u){return t(r,n,e,u)})),r},h.union=function(){return tt(X(arguments,true,true))},h.uniq=Rt,h.values=dt,h.where=wt,h.without=function(n){return Q(n,p(arguments,1))},h.wrap=function(n,t){return et(t,16,[n])},h.xor=function(){for(var n=-1,t=arguments.length;++n<t;){var r=arguments[n];if(Br(r)||ct(r))var e=e?tt(Q(e,r).concat(Q(r,e))):r
}return e||[]},h.zip=Ft,h.zipObject=Tt,h.collect=kt,h.drop=Bt,h.each=xt,h.eachRight=Ct,h.extend=Gr,h.methods=st,h.object=Tt,h.select=wt,h.tail=Bt,h.unique=Rt,h.unzip=Ft,Kt(h),h.clone=function(n,t,r,e){return typeof t!="boolean"&&null!=t&&(e=r,r=t,t=false),J(n,t,typeof r=="function"&&V(r,e,1))},h.cloneDeep=function(n,t,r){return J(n,true,typeof t=="function"&&V(t,r,1))},h.contains=bt,h.escape=function(n){return null==n?"":Zt(n).replace(Wr,ot)},h.every=_t,h.find=jt,h.findIndex=function(n,t,r){var e=-1,u=n?n.length:0;
for(t=h.createCallback(t,r,3);++e<u;)if(t(n[e],e,n))return e;return-1},h.findKey=function(n,t,r){var e;return t=h.createCallback(t,r,3),Vr(n,function(n,r,u){return t(n,r,u)?(e=r,false):void 0}),e},h.findLast=function(n,t,r){var e;return t=h.createCallback(t,r,3),Ct(n,function(n,r,u){return t(n,r,u)?(e=n,false):void 0}),e},h.findLastIndex=function(n,t,r){var e=n?n.length:0;for(t=h.createCallback(t,r,3);e--;)if(t(n[e],e,n))return e;return-1},h.findLastKey=function(n,t,r){var e;return t=h.createCallback(t,r,3),pt(n,function(n,r,u){return t(n,r,u)?(e=r,false):void 0
}),e},h.has=function(n,t){return n?gr.call(n,t):false},h.identity=qt,h.indexOf=Nt,h.isArguments=ct,h.isArray=Br,h.isBoolean=function(n){return true===n||false===n||n&&typeof n=="object"&&ar.call(n)==D||false},h.isDate=function(n){return n&&typeof n=="object"&&ar.call(n)==N||false},h.isElement=function(n){return n&&1===n.nodeType||false},h.isEmpty=function(n){var t=true;if(!n)return t;var r=ar.call(n),e=n.length;return r==I||r==L||(Dr.argsClass?r==A:ct(n))||r==F&&typeof e=="number"&&ht(n.splice)?!e:(Vr(n,function(){return t=false
}),t)},h.isEqual=function(n,t,r,e){return Y(n,t,typeof r=="function"&&V(r,e,2))},h.isFinite=function(n){return jr(n)&&!xr(parseFloat(n))},h.isFunction=ht,h.isNaN=function(n){return yt(n)&&n!=+n},h.isNull=function(n){return null===n},h.isNumber=yt,h.isObject=vt,h.isPlainObject=Hr,h.isRegExp=function(n){return n&&$[typeof n]&&ar.call(n)==T||false},h.isString=mt,h.isUndefined=function(n){return typeof n=="undefined"},h.lastIndexOf=function(n,t,r){var e=n?n.length:0;for(typeof r=="number"&&(e=(0>r?kr(0,e+r):Er(r,e-1))+1);e--;)if(n[e]===t)return e;
return-1},h.mixin=Kt,h.noConflict=function(){return r._=or,this},h.noop=Wt,h.now=Zr,h.parseInt=ne,h.random=function(n,t,r){var e=null==n,u=null==t;return null==r&&(typeof n=="boolean"&&u?(r=n,n=1):u||typeof t!="boolean"||(r=t,u=true)),e&&u&&(t=1),n=+n||0,u?(t=n,n=0):t=+t||0,r||n%1||t%1?(r=Sr(),Er(n+r*(t-n+parseFloat("1e-"+((r+"").length-1))),t)):nt(n,t)},h.reduce=Ot,h.reduceRight=St,h.result=function(n,t){if(n){var r=n[t];return ht(r)?n[t]():r}},h.runInContext=s,h.size=function(n){var t=n?n.length:0;
return typeof t=="number"?t:Rr(n).length},h.some=It,h.sortedIndex=Pt,h.unescape=function(n){return null==n?"":Zt(n).replace(Kr,lt)},h.uniqueId=function(n){var t=++y;return Zt(null==n?"":n)+t},h.all=_t,h.any=It,h.detect=jt,h.findWhere=jt,h.foldl=Ot,h.foldr=St,h.include=bt,h.inject=Ot,Kt(function(){var n={};return Vr(h,function(t,r){h.prototype[r]||(n[r]=t)}),n}(),false),h.first=Dt,h.last=function(n,t,r){var e=0,u=n?n.length:0;if(typeof t!="number"&&null!=t){var o=u;for(t=h.createCallback(t,r,3);o--&&t(n[o],o,n);)e++
}else if(e=t,null==e||r)return n?n[u-1]:g;return p(n,kr(0,u-e))},h.sample=function(n,t,r){return n&&typeof n.length!="number"?n=dt(n):Dr.unindexedChars&&mt(n)&&(n=n.split("")),null==t||r?n?n[nt(0,n.length-1)]:g:(n=At(n),n.length=Er(kr(0,t),n.length),n)},h.take=Dt,h.head=Dt,Vr(h,function(n,t){var r="sample"!==t;h.prototype[t]||(h.prototype[t]=function(t,e){var u=this.__chain__,o=n(this.__wrapped__,t,e);return u||null!=t&&(!e||r&&typeof t=="function")?new v(o,u):o})}),h.VERSION="2.4.1",h.prototype.chain=function(){return this.__chain__=true,this
},h.prototype.toString=function(){return Zt(this.__wrapped__)},h.prototype.value=Gt,h.prototype.valueOf=Gt,$r(["join","pop","shift"],function(n){var t=tr[n];h.prototype[n]=function(){var n=this.__chain__,r=t.apply(this.__wrapped__,arguments);return n?new v(r,n):r}}),$r(["push","reverse","sort","unshift"],function(n){var t=tr[n];h.prototype[n]=function(){return t.apply(this.__wrapped__,arguments),this}}),$r(["concat","slice","splice"],function(n){var t=tr[n];h.prototype[n]=function(){return new v(t.apply(this.__wrapped__,arguments),this.__chain__)
}}),Dr.spliceObjects||$r(["pop","shift","splice"],function(n){var t=tr[n],r="splice"==n;h.prototype[n]=function(){var n=this.__chain__,e=this.__wrapped__,u=t.apply(e,arguments);return 0===e.length&&delete e[0],n||r?new v(u,n):u}}),h}var g,h=[],v=[],y=0,m={},d=+new Date+"",b=75,_=40,w=" \t\x0B\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000",j=/\w*$/,x=/^\s*function[ \n\r\t]+\w/,C=RegExp("^["+w+"]*0+(?=.$)"),E=/\bthis\b/,O="Array Boolean Date Error Function Math Number Object RegExp String _ attachEvent clearTimeout isFinite isNaN parseInt setTimeout".split(" "),S="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" "),A="[object Arguments]",I="[object Array]",D="[object Boolean]",N="[object Date]",B="[object Error]",P="[object Function]",R="[object Number]",F="[object Object]",T="[object RegExp]",L="[object String]",z={};
z[P]=false,z[A]=z[I]=z[D]=z[N]=z[R]=z[F]=z[T]=z[L]=true;var q={leading:false,maxWait:0,trailing:false},K={configurable:false,enumerable:false,value:null,writable:false},W={a:"",b:null,c:"",d:"",e:"",v:null,g:"",h:null,support:null,i:"",j:false},$={"boolean":false,"function":true,object:true,number:false,string:false,undefined:false},G=$[typeof window]&&window||this,J=$[typeof exports]&&exports&&!exports.nodeType&&exports,M=$[typeof module]&&module&&!module.nodeType&&module,V=M&&M.exports===J&&J,H=$[typeof global]&&global;!H||H.global!==H&&H.window!==H||(G=H);
var U=s();J&&M&&V&&((M.exports=U)._=U)}).call(this);
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],12:[function(require,module,exports){
/*
 * logger
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var levels = ["debug", "info", "warn", "error", "fatal"];

var BasicLogger = require("./logger/basic_logger"),
    NullLogger = require("./logger/null_logger"),
    Config = require("./config"),
    _ = require("./lodash");

var Logger = module.exports = {
  setup: function(opts) {
    if (typeof opts === "object") {
      _.merge(Config.logging, opts);
    }

    var logger = Config.logging.logger,
        level  = Config.logging.level || "info";

    logger = (logger == null) ? BasicLogger : logger;

    this.logger = logger || NullLogger;
    this.level = level;

    return this;
  },

  toString: function() {
    return this.logger.toString();
  }
};

Logger.setup();

_.each(levels, function(level) {
  Logger[level] = function() {
    if (levels.indexOf(level) >= levels.indexOf(Logger.level)) {
      return Logger.logger[level].apply(Logger.logger, arguments);
    }
  };
});

},{"./config":4,"./lodash":11,"./logger/basic_logger":13,"./logger/null_logger":14}],13:[function(require,module,exports){
"use strict";

var getArgs = function(args) {
  return args.length >= 1 ? [].slice.call(args, 0) : [];
};

var logString = function(type) {
  var time = new Date().toISOString(),
      upcase = String(type).toUpperCase(),
      padded = String("      " + upcase).slice(-5);

  return upcase[0] + ", [" + time + "] " + padded + " -- :";
};

// The BasicLogger logs to console.log
var BasicLogger = module.exports = {
  toString: function() { return "BasicLogger"; },
};

["debug", "info", "warn", "error", "fatal"].forEach(function(type) {
  BasicLogger[type] = function() {
    var args = getArgs(arguments);
    return console.log.apply(console, [].concat(logString(type), args));
  };
});

},{}],14:[function(require,module,exports){
"use strict";

// The NullLogger is designed for cases where you want absolutely nothing to
// print to anywhere. Every proxied method from the Logger returns a noop.
var NullLogger = module.exports = {
  toString: function() { return "NullLogger"; }
};

["debug", "info", "warn", "error", "fatal"].forEach(function(type) {
  NullLogger[type] = function() {};
});

},{}],15:[function(require,module,exports){
(function (process){
/*
 * Registry
 *
 * The Registry contains references to all Drivers and Adaptors Cylon is aware
 * of, along with which module they live in (e.g. cylon-firmata).
 *
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Logger = require("./logger");

// Explicitly these modules here, so Browserify can grab them later
require("./test/loopback");
require("./test/test-adaptor");
require("./test/test-driver");
require("./test/ping");

var missingModuleError = function(module) {
  var str = "Cannot find the '" + module + "' module.\n";
  str += "This problem might be fixed by installing it with ";
  str +="'npm install " + module + "' and trying again.";

  console.log(str);

  process.emit("SIGINT");
};

var Registry = module.exports = {
  data: {},

  register: function(module) {
    if (this.data[module]) {
      return;
    }

    var pkg;

    try {
      pkg = require(module);
    } catch (e) {
      if (e.code === "MODULE_NOT_FOUND") {
        missingModuleError(module);
      }

      throw e;
    }

    this.data[module] = {
      module: pkg,
      adaptors: pkg.adaptors || [],
      drivers: pkg.drivers || [],
      dependencies: pkg.dependencies || []
    };

    this.logRegistration(module, this.data[module]);

    this.data[module].dependencies.forEach(function(dep) {
      Registry.register(dep);
    });

    return this.data[module].module;
  },

  findByAdaptor: function(adaptor) {
    return this.search("adaptors", adaptor);
  },

  findByDriver: function(driver) {
    return this.search("drivers", driver);
  },

  findByModule: function(module) {
    if (!this.data[module]) {
      return null;
    }

    return this.data[module].module;
  },

  logRegistration: function(name) {
    var module = this.data[name];

    Logger.debug("Registering module " + name);

    ["adaptors", "drivers", "dependencies"].forEach(function(field) {
      if (module[field].length) {
        Logger.debug("  " + field + ":");
        module[field].forEach(function(item) {
          Logger.debug("    - " + item);
        });
      }
    });
  },

  search: function(entry, value) {
    for (var name in this.data) {
      var repo = this.data[name];

      if (~repo[entry].indexOf(value)) {
        return repo.module;
      }
    }

    return false;
  }
};

// Default drivers/adaptors:
["loopback", "ping", "test-adaptor", "test-driver"].forEach(function(module) {
  Registry.register("./test/" + module);
});

}).call(this,require('_process'))
},{"./logger":12,"./test/loopback":17,"./test/ping":18,"./test/test-adaptor":19,"./test/test-driver":20,"_process":26}],16:[function(require,module,exports){
(function (process){
/*
 * robot
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var initConnection = require("./connection"),
    initDevice = require("./device"),
    Logger = require("./logger"),
    Utils = require("./utils"),
    Config = require("./config"),
    _ = require("./lodash");

var Async = require("async"),
    EventEmitter = require("events").EventEmitter;

// Public: Creates a new Robot
//
// opts - object containing Robot options
//   name - optional, string name of the robot
//   connection/connections - object connections to connect to
//   device/devices - object devices to connect to
//   work - work to be performed when the Robot is started
//
// Returns a new Robot
// Example (CoffeeScript):
//    Cylon.robot
//      name: "Spherobot!"
//
//      connection:
//        name: "sphero", adaptor: "sphero", port: "/dev/rfcomm0"
//
//      device:
//        name: "sphero", driver: "sphero"
//
//      work: (me) ->
//        Utils.every 1.second(), ->
//          me.sphero.roll 60, Math.floor(Math.random() * 360//
var Robot = module.exports = function Robot(opts) {
  opts = opts || {};

  var methods = [
    "toString",
    "halt",
    "startDevices",
    "startConnections",
    "start",
    "initDevices",
    "initConnections"
  ];

  _.bindAll(this, methods);

  this.name = opts.name || Robot.randomName();
  this.connections = {};
  this.devices = {};
  this.adaptors = {};
  this.drivers = {};
  this.commands = {};
  this.running = false;
  this.work = opts.work || opts.play;

  if (!this.work) {
    this.work =  function() { Logger.debug("No work yet."); };
  }

  this.initConnections(opts);
  this.initDevices(opts);

  _.forEach(opts, function(opt, name) {
    if (this[name] !== undefined) {
      return;
    }

    this[name] = opt;

    if (opts.commands == null && _.isFunction(opt)) {
      this.commands[name] = opt;
    }
  }, this);

  if (opts.commands) {
    var cmds = _.result(opts, "commands");

    if (_.isObject(cmds) && !_.isArray(cmds)) {
      this.commands = cmds;
    } else {
      var err = "#commands must be an object ";
      err += "or a function that returns an object";
      throw new Error(err);
    }
  }

  var mode = Utils.fetch(Config, "mode", "manual");

  if (mode === "auto") {
    // run on the next tick, to allow for "work" event handlers to be set up
    setTimeout(this.start, 0);
  }
};

Utils.subclass(Robot, EventEmitter);

// Public: Generates a random name for a Robot.
//
// Returns a string name
Robot.randomName = function() {
  return "Robot " + (Math.floor(Math.random() * 100000));
};

// Public: Expresses the Robot in a JSON-serializable format
//
// Returns an Object containing Robot data
Robot.prototype.toJSON = function() {
  return {
    name: this.name,
    connections: _.invoke(this.connections, "toJSON"),
    devices: _.invoke(this.devices, "toJSON"),
    commands: _.keys(this.commands),
    events: _.isArray(this.events) ? this.events : []
  };
};

Robot.prototype.connection = function(name, conn) {
  conn.robot = this;
  conn.name = name;

  if (this.connections[conn.name]) {
    var original = conn.name,
        str;

    conn.name = Utils.makeUnique(original, Object.keys(this.connections));

    str = "Connection names must be unique.";
    str += "Renaming '" + original + "' to '" + conn.name + "'";
    Logger.warn(str);
  }

  this.connections[conn.name] = initConnection(conn);

  return this;
};

// Public: Initializes all connections for the robot
//
// opts - options array passed to constructor
//
// Returns initialized connections
Robot.prototype.initConnections = function(opts) {
  var str;

  Logger.info("Initializing connections.");

  if (opts.connection == null && opts.connections == null) {
    return this.connections;
  }

  if (opts.connection) {
    str = "Specifying a single connection with the 'connection' key ";
    str += "is deprecated. It will be removed in 1.0.0.";

    Logger.warn(str);

    this.connection(opts.connection.name, opts.connection);
    return this.connections;
  }

  if (_.isObject(opts.connections)) {
    if (_.isArray(opts.connections)) {
      str = "Specifying connections as an array is deprecated. ";
      str += "It will be removed in 1.0.0.";

      Logger.warn(str);

      _.forEach(opts.connections, function(conn, key) {
        var name = _.isString(key) ? key : conn.name;
        this.connection(name, conn);
      }, this);

      return this.connections;
    }

    _.forIn(opts.connections, function(conn, key) {
      var name = _.isString(key) ? key : conn.name;

      if (conn.devices) {
        _.forIn(conn.devices, function(device, deviceName) {
          opts.devices = opts.devices || {};

          device.connection = name;

          opts.devices[deviceName] = device;
        });

        delete conn.devices;
      }

      this.connection(name, conn);
    }, this);
  }

  return this.connections;
};

Robot.prototype.device = function(name, device) {
  var str;

  device.robot = this;
  device.name = name;

  if (this.devices[device.name]) {
    var original = device.name;
    device.name = Utils.makeUnique(original, Object.keys(this.devices));

    str = "Device names must be unique.";
    str += "Renaming '" + original + "' to '" + device.name + "'";
    Logger.warn(str);
  }

  if (typeof device.connection === "string") {
    if (this.connections[device.connection] == null) {
      str = "No connection found with the name " + device.connection + ".\n";
      Logger.fatal(str);
      process.emit("SIGINT");
    }

    device.connection = this.connections[device.connection];
  } else {
    device.connection = _.first(_.values(this.connections));
  }

  this.devices[device.name] = initDevice(device);

  return this;
};

// Public: Initializes all devices for the robot
//
// opts - options array passed to constructor
//
// Returns initialized devices
Robot.prototype.initDevices = function(opts) {
  var str;

  Logger.info("Initializing devices.");

  if (opts.device == null && opts.devices == null) {
    return this.devices;
  }

  // check that there are connections to use
  if (!Object.keys(this.connections).length) {
    throw new Error("No connections specified");
  }

  if (opts.device) {
    str = "Specifying a single device with the 'device' key is deprecated. ";
    str += "It will be removed in 1.0.0.";

    Logger.warn(str);
    this.device(opts.device.name, opts.device);
    return this.devices;
  }

  if (_.isObject(opts.devices)) {
    if (_.isArray(opts.devices)) {
      str = "Specifying devices as an array is deprecated. ";
      str += "It will be removed in 1.0.0.";

      Logger.warn(str);

      _.forEach(opts.devices, function(device, key) {
        var name = _.isString(key) ? key : device.name;
        this.device(name, device);
      }, this);

      return this.devices;
    }

    _.forIn(opts.devices, function(device, key) {
      var name = _.isString(key) ? key : device.name;
      this.device(name, device);
    }, this);
  }

  return this.devices;
};

// Public: Starts the Robot working.
//
// Starts the connections, devices, and work.
//
// Returns the result of the work
Robot.prototype.start = function(callback) {
  if (this.running) {
    return this;
  }

  var mode = Utils.fetch(Config, "workMode", "async");

  var start = function() {
    if (mode === "async") {
      this.startWork();
    }
  }.bind(this);

  Async.series([
    this.startConnections,
    this.startDevices,
    start
  ], function(err, results) {
    if (!!err) {
      Logger.fatal("An error occured while trying to start the robot:");
      Logger.fatal(err);

      if (typeof(this.error) === "function") {
        this.error.call(this, err);
      }

      this.emit("error", err);
    }

    if (_.isFunction(callback)) {
      callback(err, results);
    }
  }.bind(this));

  return this;
};

// Public: Starts the Robot"s work and triggers a callback
//
// callback - callback function to be triggered
//
// Returns nothing
Robot.prototype.startWork = function() {
  Logger.info("Working.");

  this.emit("ready", this);
  this.work.call(this, this);
  this.running = true;
};

// Public: Starts the Robot"s connections and triggers a callback
//
// callback - callback function to be triggered
//
// Returns nothing
Robot.prototype.startConnections = function(callback) {
  Logger.info("Starting connections.");

  var starters = _.map(this.connections, function(conn, name) {
    this[name] = conn;

    return function(cb) {
      var str = "Starting connection '" + name + "'";

      if (conn.host) {
        str += " on host " + conn.host;
      } else if (conn.port) {
        str += " on port " + conn.port;
      }

      Logger.debug(str + ".");
      return conn.connect.call(conn, cb);
    };
  }, this);

  return Async.parallel(starters, callback);
};

// Public: Starts the Robot"s devices and triggers a callback
//
// callback - callback function to be triggered
//
// Returns nothing
Robot.prototype.startDevices = function(callback) {
  Logger.info("Starting devices.");

  var starters = _.map(this.devices, function(device, name) {
    this[name] = device;

    return function(cb) {
      var str = "Starting device '" + name + "'";

      if (device.pin) {
        str += " on pin " + device.pin;
      }

      Logger.debug(str + ".");
      return device.start.call(device, cb);
    };
  }, this);

  return Async.parallel(starters, callback);
};

// Public: Halts the Robot.
//
// Halts the devices, disconnects the connections.
//
// callback - callback to be triggered when the Robot is stopped
//
// Returns nothing
Robot.prototype.halt = function(callback) {
  callback = callback || function() {};

  var devices = _.map(this.devices, "halt");
  var connections = _.map(this.connections, "disconnect");

  Async.parallel(devices, function() {
    Async.parallel(connections, callback);
  });

  this.running = false;
};

// Public: Returns basic info about the robot as a String
//
// Returns a String
Robot.prototype.toString = function() {
  return "[Robot name='" + this.name + "']";
};

}).call(this,require('_process'))
},{"./config":4,"./connection":5,"./device":7,"./lodash":11,"./logger":12,"./utils":21,"_process":26,"async":22,"events":25}],17:[function(require,module,exports){
/*
 * Loopback adaptor
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Adaptor = require("../adaptor"),
    Utils = require("../utils");

var Loopback;

module.exports = Loopback = function Loopback() {
  Loopback.__super__.constructor.apply(this, arguments);
};

Utils.subclass(Loopback, Adaptor);

Loopback.prototype.connect = function(callback) {
  callback();
};

Loopback.prototype.disconnect = function(callback) {
  callback();
};

Loopback.adaptors = ["loopback"];
Loopback.adaptor = function(opts) { return new Loopback(opts); };

},{"../adaptor":2,"../utils":21}],18:[function(require,module,exports){
/*
 * Ping driver
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Driver = require("../driver"),
    Utils = require("../utils");

var Ping = module.exports = function Ping() {
  Ping.__super__.constructor.apply(this, arguments);

  this.commands = {
    ping: this.ping
  };

  this.events = ["ping"];
};

Utils.subclass(Ping, Driver);

Ping.prototype.ping = function() {
  this.emit("ping", "ping");
  return "pong";
};

Ping.prototype.start = function(callback) {
  callback();
};

Ping.prototype.halt = function(callback) {
  callback();
};

Ping.drivers = ["ping"];
Ping.driver = function(opts) { return new Ping(opts); };

},{"../driver":8,"../utils":21}],19:[function(require,module,exports){
/*
 * Test adaptor
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Adaptor = require("../adaptor"),
    Utils = require("../utils");

var TestAdaptor;

module.exports = TestAdaptor = function TestAdaptor() {
  TestAdaptor.__super__.constructor.apply(this, arguments);
};

Utils.subclass(TestAdaptor, Adaptor);

TestAdaptor.adaptors = ["test"];
TestAdaptor.adaptor = function(opts) { return new TestAdaptor(opts); };

},{"../adaptor":2,"../utils":21}],20:[function(require,module,exports){
/*
 * Test driver
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var Driver = require("../driver"),
    Utils = require("../utils");

var TestDriver;

module.exports = TestDriver = function TestDriver() {
  TestDriver.__super__.constructor.apply(this, arguments);
};

Utils.subclass(TestDriver, Driver);

TestDriver.drivers = ["test"];
TestDriver.driver = function(opts) { return new TestDriver(opts); };

},{"../driver":8,"../utils":21}],21:[function(require,module,exports){
(function (global){
/*
 * Cylon - Utils
 * cylonjs.com
 *
 * Copyright (c) 2013-2015 The Hybrid Group
 * Licensed under the Apache 2.0 license.
*/

"use strict";

var _ = require("./lodash");

var addCoreExtensions = function addCoreExtensions() {
  var max = Math.max,
      min = Math.min;

  // Public: Monkey-patches Number to have Rails-like //seconds() function.
  // Warning, due to the way the Javascript parser works, applying functions on
  // numbers is kind of weird. See examples for details.
  //
  // Examples
  //
  //   2.seconds()
  //   //=> SyntaxError: Unexpected token ILLEGAL
  //
  //   10..seconds()
  //   //=> 10000
  //
  //   (5).seconds()
  //   //=> 5000
  //   // This is the preferred way to represent numbers when calling these
  //   // methods on them
  //
  // Returns an integer representing time in milliseconds
  Number.prototype.seconds = function() {
    return this * 1000;
  };

  // Public: Alias for Number::seconds, see comments for that method
  //
  // Examples
  //
  //   1.second()
  //   //=> 1000
  //
  // Returns an integer representing time in milliseconds
  Number.prototype.second = function() {
    return this.seconds(this);
  };

  // Public: Convert value from old scale (start, end) to (0..1) scale
  //
  // start - low point of scale to convert value from
  // end - high point of scale to convert value from
  //
  // Examples
  //
  //   (5).fromScale(0, 10)
  //   //=> 0.5
  //
  // Returns an integer representing the scaled value
  Number.prototype.fromScale = function(start, end) {
    var val = (this - min(start, end)) / (max(start, end) - min(start, end));

    if (val > 1) {
      return 1;
    }

    if (val < 0){
      return 0;
    }

    return val;
  };

  // Public: Convert value from (0..1) scale to new (start, end) scale
  //
  // start - low point of scale to convert value to
  // end - high point of scale to convert value to
  //
  // Examples
  //
  //   (0.5).toScale(0, 10)
  //   //=> 5
  //
  // Returns an integer representing the scaled value
  Number.prototype.toScale = function(start, end) {
    var i = this * (max(start, end) - min(start, end)) + min(start, end);

    if (i < start) {
      return start;
    }

    if (i > end) {
      return end;
    }

    return i;
  };
};


var Utils = module.exports = {
  // Public: Alias to setInterval, combined with Number monkeypatches below to
  // create an artoo-like syntax.
  //
  // interval - interval to run action on
  // action - action to perform at interval
  //
  // Examples
  //
  //   every((5).seconds(), function() {
  //     console.log("Hello world (and again in 5 seconds)!");
  //   });
  //
  // Returns an interval
  every: function every(interval, action) {
    return setInterval(action, interval);
  },

  // Public: Alias to setTimeout, combined with Number monkeypatches below to
  // create an artoo-like syntax.
  //
  // interval - interval to run action on
  // action - action to perform at interval
  //
  // Examples
  //
  //   after((10).seconds(), function() {
  //     console.log("Hello world from ten seconds ago!");
  //   });
  //
  // Returns an interval
  after: function after(delay, action) {
    return setTimeout(action, delay);
  },

  // Public: Alias to the `every` function, but passing 0
  // Examples
  //
  //   constantly(function() {
  //     console.log("hello world (and again and again)!");
  //   });
  //
  // Returns an interval
  constantly: function constantly(action) {
    return every(0, action);
  },

  // Public: Sleep - do nothing for some duration of time.
  //
  // ms - number of ms to sleep for
  //
  // Examples
  //
  //   sleep((1).second());
  //
  // Returns a function
  sleep: function sleep(ms) {
    var start = Date.now(),
        i;

    while(Date.now() < start + ms) {
      i = 0;
    }
  },

  // Public: Function to use for class inheritance.
  // Based on CoffeeScript's implementation.
  //
  // Example
  //
  //    var Sphero = function Sphero() {};
  //
  //    subclass(Sphero, ParentClass);
  //
  //    // Sphero is now a subclass of Parent, and can access parent methods
  //    // through Sphero.__super__
  //
  // Returns subclass
  subclass: function subclass(child, parent) {
    var Ctor = function() {
      this.constructor = child;
    };

    _.forOwn(parent, function(prop, key) {
      child[key] = prop;
    });

    Ctor.prototype = parent.prototype;
    child.prototype = new Ctor();
    child.__super__ = parent.prototype;
    return child;
  },

  proxyFunctions: function proxyFunctions(source, target) {
    _.forEach(source, function(prop, key) {
      if (_.isFunction(prop) && !target[key]) {
        target[key] = prop.bind(source);
      }
    });
  },

  // Public: Proxies a list of methods from one object to another. It will not
  // overwrite existing methods unless told to.
  //
  // methods - array of functions to proxy
  // target  - object to proxy the functions to
  // base    - (optional) object that proxied functions will be declared on.
  //           Defaults to 'this'.
  // force   - (optional) boolean - whether or not to force method assignment
  //
  // Returns base
  proxyFunctionsToObject: function(methods, target, base, force) {
    if (base == null) {
      base = this;
    }

    force = force || false;

    _.forEach(methods, function(method) {
      if (_.isFunction(base[method]) && !force) {
        return;
      }

      base[method] = function() {
        return target[method].apply(target, arguments);
      };
    });

    return base;
  },

  // Public: Analogue to Ruby"s Hash#fetch method for looking up object
  // properties.
  //
  // obj - object to do property lookup on
  // property - string property name to attempt to look up
  // fallback - either:
  //    - a fallback value to return if `property` can"t be found
  //    - a function to be executed if `property` can"t be found. The function
  //    will be passed `property` as an argument.
  //
  //  Examples
  //
  //    var object = { property: "hello world" };
  //    fetch(object, "property");
  //    //=> "hello world"
  //
  //    fetch(object, "notaproperty", "default value");
  //    //=> "default value"
  //
  //    var notFound = function(prop) { return prop + " not found!" };
  //    fetch(object, "notaproperty", notFound)
  //    // "notaproperty not found!"
  //
  //    var badFallback = function(prop) { prop + " not found!" };
  //    fetch(object, "notaproperty", badFallback)
  //    // Error: no return value from provided callback function
  //
  //    fetch(object, "notaproperty");
  //    // Error: key not found: "notaproperty"
  //
  // Returns the value of obj[property], a fallback value, or the results of
  // running "fallback". If the property isn"t found, and "fallback" hasn"t been
  // provided, will throw an error.
  fetch: function(obj, property, fallback) {
    if (obj.hasOwnProperty(property)) {
      return obj[property];
    }

    if (fallback === void 0) {
      throw new Error("key not found: \"" + property + "\"");
    }

    if (typeof(fallback) === "function") {
      var value = fallback(property);

      if (value === void 0) {
        throw new Error("no return value from provided fallback function");
      }

      return value;
    }

    return fallback;
  },

  // Public: Given a name, and an array of existing names, returns a unique
  // name.
  //
  // name - name that"s colliding with existing names
  // arr - array of existing names
  //
  // Returns the new name as a string
  makeUnique: function(name, arr) {
    var newName;

    if (!~arr.indexOf(name)) {
      return name;
    }

    for (var n = 1; ; n++) {
      newName = name + "-" + n;
      if (!~arr.indexOf(newName)) {
        return newName;
      }
    }
  },

  // Public: Adds necessary utils to global namespace, along with base class
  // extensions.
  //
  // Examples
  //
  //    Number.prototype.seconds // undefined
  //    after                    // undefined
  //
  //    Utils.bootstrap();
  //
  //    Number.prototype.seconds // [function]
  //    (after === Utils.after)  // true
  //
  // Returns Cylon.Utils
  bootstrap: function bootstrap() {
    global.every = this.every;
    global.after = this.after;
    global.constantly = this.constantly;

    addCoreExtensions();

    return this;
  }
};

Utils.bootstrap();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lodash":11}],22:[function(require,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
},{"_process":26}],23:[function(require,module,exports){
(function (process){
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

}).call(this,require('_process'))
},{"./browser-logger":1,"_process":26,"cylon":6}],24:[function(require,module,exports){

},{}],25:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],26:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[23]);
