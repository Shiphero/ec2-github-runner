dist/index.js: $(wildcard src/*.js)
	npm run package

docker-build:
	docker run --rm -ti -v "$(PWD):/src" node:16 bash -c "cd src && npm install && make"

docker-lint:
	docker run --rm -ti -v "$(PWD):/src" node:16 bash -c "cd src && npm install && npm run lint"

.PHONY: docker-build
