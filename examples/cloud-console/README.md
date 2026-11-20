# Cloud console

An example of a capisce map across two languages: a Rust API service and the TypeScript web console that calls it.

The product is a small cloud console. People sign in, and manage projects, instances and disks. It is loosely inspired by the web console and control-plane API of a rack-scale cloud computer, and shares no code with any real one.

## Layout

- `api/`: the Rust service, built on Dropshot. It keeps everything in memory, so it needs no database.
  - `src/external_api/`: the 17 endpoints the console calls.
  - `src/app/`: the rules behind each endpoint, such as quotas and which states allow a start or a stop.
  - `src/auth/`: who is calling, and their role on a project.
  - `src/db/`: the models and the in-memory store.
- `console/`: the web console as plain TypeScript.
  - `api_client.ts`: one function per endpoint.
  - `*_actions.ts`: what happens when a person does something, such as submitting the create-instance form.
- `capisce.config.mjs`: what capisce reads from the code.
- `capisce/domains.map`: the domains and how they relate.
- `capisce/maps/`: the pseudo-code and flows, one file per domain.
- `capisce/rust_models.mjs`: reads the Rust structs and enums in `api/src/db/models.rs` as models.
- `capisce/console_actions.mjs`: makes every console action something the check requires pseudo-code for.

## The map

Build the page once in the capisce repository (`pnpm install && pnpm build`), then run these from this folder:

```sh
node ../../bin/capisce.mjs build             # build the map into .capisce/index.html
node ../../bin/capisce.mjs serve --port 8094 # build it, then serve it at http://127.0.0.1:8094 with comments and notes
node ../../bin/capisce.mjs check             # fail if mapped code changed since the last review
node ../../bin/capisce.mjs stamp             # record a review, once the map says what the code does
```

`make map`, `make serve`, `make check` and `make stamp` do the same.

The page, and the comments and notes left on it, are kept in `.capisce/`. This example ignores that whole folder in git. `node ../../bin/capisce.mjs comments` prints the comments that wait on a reply.

To see the check work, change a rule in `api/src/app/instances.rs` or `console/instance_actions.ts` and run the check again.

Good places to start on the page: the flow "Creating an instance from the console" under Instances, and the function `submit_create_instance` under Console, whose trace runs from the console through the API client and the endpoint into the app layer and the store.

## The code

```sh
cd api && cargo build                        # the API
cd api && cargo run                          # serves on http://127.0.0.1:12220
cd console && npx -p typescript tsc -p .     # type-check the console
```

The API starts with two people, `ada` and `grace`, whose password is `console-demo`, and one project named `demo`.
