CAPISCE = node ../../bin/capisce.mjs

run:
	go run ./cmd/helpdesk

test:
	go build ./... && go vet ./... && go test ./...

map:
	$(CAPISCE) build capisce.html

map-check:
	$(CAPISCE) check

map-stamp:
	$(CAPISCE) stamp

.PHONY: run test map map-check map-stamp
