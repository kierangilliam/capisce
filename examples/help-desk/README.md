# Help desk

A small Go web app with a complete capisce map, to show capisce on a Go codebase.

Customers open tickets. Agents reply, assign, escalate and close them. Each ticket has a deadline for our reply, set by its priority and the customer's plan. Everything is kept in memory, and the app uses only the standard library.

## Layout

- `cmd/helpdesk/`: starts the server and loads the demo accounts.
- `web/`: the HTTP layer. `routes.go` lists the 18 endpoints; the `*_handlers.go` files hold their handlers.
- `internal/tickets/`: tickets, replies, status changes, who may do what, deadlines on a ticket, and who is told.
- `internal/accounts/`: customers, agents, teams and sessions.
- `internal/deadlines/`: priorities and how long a customer may wait.
- `internal/notify/`: the notices people get.
- `capisce.config.mjs`: what capisce reads from the code.
- `capisce/domains.map`: the six domains and how they relate.
- `capisce/maps/`: the pseudo-code and flows, one file per domain, plus `shared.map`.
- `capisce/models.mjs`: reads the Go struct types in each `models.go` as models.
- `capisce/stamps.json`: what was reviewed, written by `capisce stamp`.

## Run the app

```sh
go run ./cmd/helpdesk          # http://localhost:8080, or set PORT
go build ./... && go vet ./... && go test ./...
```

The demo accounts all have the password `demo`:

- Customers: `ada@customer.example` (free), `bo@customer.example` (standard), `cy@customer.example` (premium).
- Agents: `noor@helpdesk.example` (lead, Support), `sam@helpdesk.example` (Support), `ines@helpdesk.example` (lead, Billing).

```sh
curl -c jar -X POST localhost:8080/sign-in -d '{"email":"ada@customer.example","password":"demo"}'
curl -b jar -X POST localhost:8080/tickets -d '{"subject":"Printer","body":"It is on fire","topic":"billing"}'
curl -b jar localhost:8080/tickets
```

## Build, check and view the map

Run these from this folder. Build the capisce page once first: `pnpm install && pnpm build` in the root of the capisce repo.

```sh
node ../../bin/capisce.mjs build                # build the page into .capisce/index.html
node ../../bin/capisce.mjs serve --port 8094    # build it, then serve it at http://127.0.0.1:8094 with comments and notes
node ../../bin/capisce.mjs check                # fails when mapped code changed
node ../../bin/capisce.mjs stamp                # after you reviewed the map
```

`make map`, `make map-serve`, `make map-check` and `make map-stamp` do the same.

The page, and the comments and notes left on it, are kept in `.capisce/`. This example ignores that whole folder in git. `node ../../bin/capisce.mjs comments` prints the comments that wait on a reply.

## How the map reads the Go code

- **Endpoints** are the `mux.HandleFunc("METHOD /path", …)` lines in `web/routes.go`. Each must have pseudo-code. The line only names a handler, so each endpoint's block has an `also:` line that names the handler method. Changing the handler then asks for a review of the endpoint.
- **Functions** are Go functions and methods, named the way Go code names them: `<package>.<Name>` for a function (`deadlines.Window`) and `<package>.<Type>.<Name>` for a method (`tickets.Service.Open`). The config sets `module: "folder"` and reads the receiver for this. In `internal/tickets/` unexported functions are read too, because rules such as `tickets.canMove` live there. Elsewhere only exported ones are read. Constructors, storage plumbing (`service.go`, `directory.go`) and `_test.go` files are left out.
- **Models** are the struct types in each package's `models.go`. A field such as `AssignedAgentID` links to the `Agent` model.
- Every endpoint is registered in one file, so each endpoint's block says which domain it belongs to with a `domain:` line.
