---
name: update
description: This updates capisce's state by writing pseudo-code and updating the glossary for new code changes. Use when `capisce check` fails, when you add or change code the map covers, or when you write or edit pseudo-code, flows or glossary terms in the program files.
---

# Update the map

A capisce map is one page for reading a codebase at the level of business behavior. Models, endpoints and functions are read from the code. People and agents write only the pseudo-code, the flows and the glossary, in the program files. Those live in `.capisce` at the root of the project and are committed with the code: `.capisce/program/<domain>.capisce`, `.capisce/domains.capisce` and `.capisce/stamps.json`. `capisce.config.mjs` at the root says what is read from the code, and names other paths if the project keeps its map elsewhere. An older project may still have `.capisce/maps/<domain>.map` and `.capisce/domains.map`: they are the same files under their former names, and they still work.

Run capisce the way the project wraps it (look for a package script, a Makefile target or a script that calls it). If there is none, clone the capisce repository and run `node <capisce>/bin/capisce.mjs <command>` from the project's root. `build` and `serve` also need the page built once: `pnpm install && pnpm build` in the capisce folder. `capisce skill <name>` prints any of the skills named here.

- `capisce check` names what needs an update. It fails when mapped code changed, when code that must be mapped has no pseudo-code, and when a stamp is out of date.
- `capisce stamp` records that you reviewed the map against the code. Run it last, once the map says what the code does.
- `capisce build <out.html> --only <domain>` builds from one program file (`<domain>.capisce`) and `shared.capisce` only. It fails on a `src:` line that matches nothing and on a step that points at something that is not there.
- `capisce build <out.html> --base <git ref>` builds the page with what changed since that commit. It compares against the map committed there, so commit your map changes with the code they describe.
- `capisce build` with no file writes the page to `.capisce/index.html`, and `capisce serve` builds it there and serves it with comments and notes.
- `capisce timings` fetches how long each endpoint takes, when the project's config names a source of `timings`. The served page shows them when a reader presses Tab. The numbers are a local file, `.capisce/timings.json`, which git ignores. After you rename or add an endpoint, check that the project's source still returns the map's ids.
- The page, timings, comments and notes are local files in `.capisce`, listed in `.capisce/.gitignore`. Never commit them, and never add `.capisce/` itself to an ignore file.
- `capisce comments` prints what readers left on the page that waits on a reply. The address-comments skill (`capisce skill address-comments`) says how to answer.

## When the check fails

1. Read the code it names. Open the function: do not guess from its name.
2. Update the block so it says what the code now does. Add a block for new code. Delete the block for code that is gone.
3. Update every flow that passes through what you changed.
4. Update the glossary: add a term for a new word of the business, and correct one whose meaning the change moved.
5. If a domain's description or relations no longer hold, fix them in the domains file.
6. Run `capisce check` again, then `capisce stamp`.

Never stamp to make the check pass without reading the code. The stamp says a person or agent compared the two.

## A block

```text
=== POST /api/orders/:id/refund
kind: route
group: Refunds
src: server/routes/orders.ts :: app.post("/api/orders/:id/refund",
doc: Refunds an order, in full or in part. Only staff can refund an order that has shipped.
---
route POST /api/orders/:id/refund(id, amount=None):
    #> Find the order -> order_for | 404
    order = order_for(id)
    #> Shipped orders need staff | 403
    if order.shipped and not user.is_staff:
        raise 403
    #> Refund the payment -> payment_service.refund | 409 AlreadyRefunded
    refund = payment_service.refund(order, amount or order.total)
    #> Tell the customer -> email_service.send_refund_notice
    email_service.send_refund_notice(order, refund)
    return refund
```

- **`===` id.** An endpoint is `METHOD path`, with the path exactly as the code has it. A function is `<file name without its extension>.<function name>`, for example `payment_service.refund`, unless the project's config names functions another way: use the ids `capisce build --json` gives. A flow or a term is a plain name. An id is used once across all program files.
- **`kind`.** `route`, `def`, `flow` or `term`. A term is an entry in the glossary: it has a `doc` and a `src`, and no pseudo-code. If the project generates some kinds from the code (models, for example), never write those by hand.
- **`group`.** Endpoints only: a short plain name for endpoints that belong together, such as "Refunds".
- **`src`.** `<path> :: <the start of the line the code begins on>`. It must match exactly one line of the file. Leave it out when the block's id is one capisce reads from the code (an endpoint or a function it finds): the block then describes that code.
- **`also`.** Optional: more code the pseudo-code describes, as `<path> :: <line start>` entries joined by ` ; `. Use it when the `src` line only passes the call on, such as a route registration that names its handler, or when the pseudo-code states a rule held in a constant elsewhere, so a change there asks for a review too. Code named only on an `also` line should not also be read as a function, or it shows up as one with no pseudo-code.
- **`domain`.** Optional for code, required for a flow: the domain this belongs to, when it is not the domain of its file.
- **`doc`.** One or two sentences in plain words: what this does and why someone would call it. No internal names.
- **Pseudo-code**, after `---`. Python-like and short, at most about 62 characters a line. It says what happens and in what order, with the conditions and outcomes that matter to the business. Leave out logging detail, types, retries and plumbing. Name the errors and statuses a caller can get.
- **Long lists.** A list of fields or values that does not fit on one line goes one to a line, indented once, each with a comma after it. Do not carry it on under the first one. The same holds inside `{…}`, with the closing bracket on a line of its own.

  ```text
  update Order:
      refunded_amount,
      refunded_at,
      status,
  ```

## Stages

A `#>` line starts a stage. Stages are the steps a reader follows: they label the code and become the calls in the trace.

```text
#> Title [-> symbol id] [| way it can end early]...
```

- The title is a short phrase a non-engineer can follow, like "Find the order" or "Tell the customer".
- `-> id` names the function or endpoint the stage is about, so a reader can open it and the trace can follow the call. Use the full id for a function in another module.
- Each `| text` is a way the stage ends early: `| 404`, `| 409 AlreadyRefunded`, `| None not theirs`.
- Anything with more than two or three lines of behavior has stages. A one-line function needs none to be read, but the trace only follows a call into a function that has stages: give a pass-through one stage that points at what it calls if the trace should continue through it.

## Names in pseudo-code

A name that matches an id becomes a link, so write calls into other files in full: `payment_service.refund(order, amount)`. A call inside the same module (the same file, or the same folder where the project names things by folder) can use the bare name, as long as only one mapped function has that name; write the full id when in doubt. A model's name links to its model. Names several program files need live in `shared.capisce`: use them, do not define them again. A term links wherever its name appears as a word, so do not name one after a common word. `[[POST /api/orders/:id/refund]]` links an endpoint or flow from a comment.

## What to map

- Everything the check says must be mapped. The project's config decides what that is; endpoints usually are.
- The functions those lean on, where the behavior is worth reading: access rules, state changes, anything with a branch. Skip one-line reads.
- Local helpers several endpoints share, such as the one that finds a thing and checks the caller may touch it.

## The glossary

The glossary is the map's `kind: term` blocks: the words of the business, each said once in plain words. A reader sees a term's meaning wherever its name appears in pseudo-code.

```text
=== seat
kind: term
src: server/services/billing_service.ts :: export const SEAT_PRICE
doc: One person's place in a workspace's plan. A workspace pays for each seat, filled or not.
```

- Add a term when a change brings in a word a new reader would have to ask about, or a name several program files use that is not a function or a model.
- Update a term when the code changes what the word means, such as a new state or a rule that moved. Delete it when nothing uses the word any more.
- `src` points at the code that best holds the meaning, so a change there asks for a review of the term.
- Terms every domain uses live in `shared.capisce`. One domain's own terms live in its program file.

## Flows

A flow tells one thing a person or the system does, in plain words, across endpoints. A domain has about two to five.

```text
=== Refunding an order
kind: flow
domain: Orders
doc: What happens between a customer asking for their money back and getting it.
---
#> The customer asks for a refund -> POST /api/orders/:id/refund
The customer opens the order and asks for a refund, for all of it or part.
An order that has already shipped needs a member of staff to approve it.
#> The payment is returned -> payment_service.refund
The money goes back the way it was paid. An order can be refunded only once in full.
```

- Each stage is a `#>` line with plain sentences under it. No code, no internal names.
- Point a stage at the endpoint or function behind it when there is one.
- `domain:` is a domain's name exactly as the domains file has it. A flow has no `src`.

## Accuracy

Write only what you read in the code. If the code does something surprising, say it. The check proves the map was revisited, not that it is right.

- **No lists of errors in comments.** The ways a step can end already sit on its `#>` line after `|`. Do not repeat them as `# 404 …, 409 …` lines under it. Put what a reader must know into the step's name instead of a comment where it fits.
