CAPISCE = node ../../bin/capisce.mjs

run:
	go run ./cmd/helpdesk

test:
	go build ./... && go vet ./... && go test ./...

map:
	$(CAPISCE) build

map-serve:
	$(CAPISCE) serve --port 8094

map-check:
	$(CAPISCE) check

map-stamp:
	$(CAPISCE) stamp

.PHONY: run test map map-serve map-check map-stamp
