BIN := ./node_modules/.bin/

.PHONY: start build

serve:
	@echo "Starting HTTP server on port 8000"
	python -m SimpleHTTPServer

build:
	@echo "Building script.js with Browserify"
	$(BIN)browserify script.js > ./browser.js
