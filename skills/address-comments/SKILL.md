---
name: address-comments
description: Answer the comments a reader left on a capisce map. Use when asked to address, answer or go through the comments on the map, or when `capisce comments` lists threads waiting on a reply.
---

# Address the comments

A reader leaves comments on the page: a pin or a drawing on some part of it, some words, sometimes a picture. Each comment is a thread. You change what the comment asks for, then answer in the thread. The reader gets a notice for every answer, so the thread is how they learn what you did.

Run capisce the way the project wraps it (look for a script that calls it), or as `node <capisce>/bin/capisce.mjs <command>` from the project root. The comments are files in the project's state folder, `.capisce` unless the project says otherwise, so these commands work with or without the page being served.

## 1. Read what is waiting

```sh
capisce comments          # threads that wait on a reply: open, and the reader spoke last
capisce comments --all    # every thread, to see what was said before
```

A thread looks like this:

```text
4a7cceda-64d6-4054-ac24-08567a83765b  [open]  2026-03-02 14:10
  page:     POST /api/orders/:id/refund › Refund the payment
  part:     code
  pinned to: refund = payment_service.refund(order, amount or order.total)
  drawn over: #> Shipped orders need staff | 403
  reader: This skips the check for a partial refund, I think?
    picture: /path/to/project/.capisce/comments/screenshots/3f0c….png
  agent: Which order did you see this on?
  reader: Any order that shipped.
```

- **`page`** is the endpoint, function, flow or domain the reader was on, and the step they had selected, if any.
- **`part`** is where on the page the pin is: `flow` (the trace diagram), `code` (the pseudo-code and descriptions), `browse` (the list on the left) or `bar` (the top bar). A comment on `browse` or `bar` is about the page as a whole, not about the `page` it was left on.
- **`pinned to`** is the text under the pin. **`drawn over`** lines are the text under a drawing.
- **`picture`** is a file. Open every picture before you answer: it is often the whole point of the comment.
- The messages follow in order. Read all of them, not only the last.

## 2. Decide what each thread asks for

- **A change to the map** (a description that is wrong, pseudo-code that is unclear, a flow that misses a step, a relation that does not hold): read the code the comment is about, make the change, and follow the maintain skill (`capisce skill maintain`), including `capisce check` and `capisce stamp`.
- **A change to the code**: only make it if you were asked to work on the code. Otherwise say what you found and leave the thread open.
- **A question**: answer it from the code, not from the map. If the answer shows the map is wrong, fix the map too.
- **Feedback on the page itself** (how capisce looks or works, not what this map says): you cannot fix that in the project. Say so in the reply, and pass it on to whoever maintains capisce if you can.
- **Unclear**: do not guess. Ask one short question.

## 3. Answer in the thread

```sh
capisce reply 4a7cceda "The partial refund now goes through the same staff check. Updated the pseudo-code and the Refunds flow." --done
capisce reply 4a7cceda "Which order did you see this on?"
```

The id can be shortened to its first characters.

- Use `--done` when you made the change the comment asked for, or answered a question in full.
- Leave `--done` off when you ask something back, when the reader has to decide something, or when you could not do what was asked. The thread stays open and the reader is told there is a reply.
- A new message from the reader opens a thread again. It then shows up in `capisce comments` like any other.

## Rules

- Never mark a thread done without a reply. The reply is how the reader learns what happened.
- Never delete a comment, and never edit `comments.json` by hand.
- Answer every thread `capisce comments` lists, even if only to say why nothing changed.
- Keep replies short and plain: what changed and where, in one to three sentences. No internal names the reader would not know, and no apologies.
- One reply for each thread. If a change answers several threads, reply to each.
- When you are done, run `capisce comments` again. It should say that no comments are waiting, apart from threads you were told to leave alone.
