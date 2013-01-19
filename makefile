test:
	@NODE_ENV=test ./node_modules/.bin/mocha

test-report:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER)

test-cov: lib-cov
	@GRAPPLE_COV=1 $(MAKE) test-report REPORTER=html-cov > coverage.html

lib-cov:
	@jscoverage lib lib-cov

.PHONY: test
