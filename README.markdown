# Cylon.js - Browserify Example

This repo contains a basic example Cylon robot, and all the tooling needed to get it running in a browser.

It does this using the [Browserify](http://browserify.org) tool.

It also includes a custom Cylon logger (`browser-logger.js`) to log messages directly to the page.

## Building

After cloning, you can run the example with the `make` command:

    $ make
    Starting HTTP server on port 8000
    python -m SimpleHTTPServer

This will start a basic Python HTTP server on port `8000`, letting you run your robot from the browser by navigating to http://localhost:8000.

## Modifying

This is a very basic example, it's likely you'll want to expand on it and add more modules.

To install the Browserify tool, along with Cylon's core, use NPM:

    $ npm install

Now you can build the `browser.js` file again with `make build`:

    $ make build
    Building script.js with Browserify
    ./node_modules/.bin/browserify script.js > ./browser.js

Alternatively, you can run the above Browserify command manually if you'd like to change it.

## More Modules

If you're starting to use additional Cylon support modules, such as `cylon-leapmotion` or `cylon-ardrone`, you'll need to inform Browserify about them manually:

    $ ./node_modules/.bin/browserify -r cylon-leapmotion script.js > browser.js

This is necessary due to Browserify's static `require` call checking, which can't detect or work with Cylon's dynamic module loader.
