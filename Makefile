.PHONY: start build

serve:
	@node ./bin/serve

build:
	@browserify script.js > ./js/robot.js
