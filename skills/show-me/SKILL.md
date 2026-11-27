---
name: show-me
description: This shows the current topic as a picture, using the map's pseudo-code where it covers the topic. Use when asked to show, picture or explain visually how something works or what a change did, or when a short view would explain it better than prose.
---

# Show me

Help the user understand the current topic of conversation with a picture. Skip the preamble and keep prose brief. Pick the smallest view that makes the point. Put each view next to the one or two sentences it supports.

A capisce map holds pseudo-code for a codebase's endpoints, functions and flows, written to be read by people. When the topic is behavior the map covers, that pseudo-code is the best picture you have: show it. For anything else, draw the view by hand, as the second half of this skill says.

Run capisce the way the project wraps it (look for a package script, a Makefile target or a script that calls it). If the project has `.capisce/README.md`, read it first: it says what is specific to this project, such as its own commands. If there is none, clone the capisce repository and run `node <capisce>/bin/capisce.mjs <command>` from the project's root. `capisce skill <name>` prints any of the skills named here.

## 1. Find what to show

- **What a branch changed.** `capisce changes` lists every symbol the working tree changes in the map: its id, kind, domain, status (added, changed or removed) and the parts that changed (doc, pseudo, flow, code). It compares with the point where the branch left the repository's default branch. Give `--base <git ref>` to compare with another commit, and `--json` to read the list from a script.
- **A named endpoint, function or flow.** Its id is the `===` line of its block in the program files: `grep -n "^=== " .capisce/program/*.capisce`. An endpoint is `METHOD path`, a function is `<file>.<name>`, and a flow is a plain name.

Show the one to three symbols that answer the question, not everything that matched.

## 2. Check the map is true

Run `capisce check`. If it names the code you are about to show, the pseudo-code no longer matches that code. Say so, and do not show it as what the code does. Either update the map first with the update skill (`capisce skill update`), or read the code and draw the view by hand.

## 3. Make the picture

```sh
capisce show "POST /api/orders/:id/refund" --out /tmp/show/refund.html
capisce show "POST /api/orders/:id/refund" --base main --format diff
capisce show --changed --out /tmp/show
```

- `capisce show <id>` writes one symbol as a small file of its own: its name, kind, description and pseudo-code with its stage labels. Put an id in quotes: most have a space in them.
- With `--base <git ref>` the file is the change since that commit: added and removed lines, and a badge that says New, Changed or Removed. Use it when the point is what changed. Leave it off when the point is how something works.
- `--format` is `html` (the default), `svg` or `diff`. `html` is one file with no script and nothing loaded from outside, made to be shown inline in a chat. `svg` is a plain image. `diff` is plain text: with `--base`, lines marked `+` and `-` for a fenced `diff` block; without it, the pseudo-code as written, for a fenced `text` block.
- Without `--out` the result is printed. With several ids, or with `--changed` (every changed symbol), `--out` is a folder: one file is written for each symbol, and each `id -> path` is printed.
- Always write outside the repository, so nothing is committed by mistake.
- It does not draw flow charts. For a flow it shows the flow's stages and sentences.

## 4. Put it in front of the user

- **If you have a tool that shows HTML inline in the chat**, show the `html` file with it.
- **If you do not**, write the `html` file outside the repository and give its full path. Then run the same command with `--format diff` and paste the result in a fenced block (`diff` with `--base`, `text` without), so there is something to read in the chat itself.

Say in a sentence what the user is looking at and the one thing to notice. Do not repeat the pseudo-code in prose.

## When the map does not cover the topic

The map holds behavior. It does not hold the structure of a UI, a file layout, the shape of some data, or code nobody has mapped yet. For those, draw the view by hand from the code. Read the code first: never draw from memory or from a name.

- Logic or an algorithm, as pseudocode:

  ```text
  on(save)
    if content is unchanged
      return cached result
    write new content
    return fresh result
  ```

- Control flow, as a call tree:

  ```text
  submit_form
    create_session
      save_prompt
      start_run
    go_to_session
  ```

- The structure of a UI, as a component tree, with the state and the file boundaries that matter:

  ```text
  <Shell> (src/shell)
    <Sidebar>
    <Thread> (src/thread)
      <Composer> (state in composer_state)
  ```

- Who owns what, or a wide refactor, as a shallow file tree:

  ```text
  src/
  ├── commands/       # reads what the user asked for
  ├── sessions/       # owns session state
  └── transport/      # sends requests
  ```

- A data shape, as the type or table itself, cut down to the fields that matter.

- Use a `diff` block when the point is what changes and the shape around it is already there. It works for any of the views above:

  ```diff
   submit_form
     create_session
       save_prompt
  +    expand_mention
       start_run
  -  go_to_session
  +  go_to_session
  +    listen_for_events
  ```

- Show the whole block when most of it is new, when leaving lines out would hide the order or who owns what, or when the user needs something to copy.

- For a screen, a layout, a comparison of states, or anything too dense for text, make one focused HTML page. Use the product's own colors, type and spacing, real labels and real data, and make it work on a narrow screen. Show it inline if you have a tool for that. If not, write it outside the repository and give its path.

## Rules

- One topic, the fewest views. Keep only the calls, files, fields and states the question needs.
- Never show pseudo-code from the map as true when `capisce check` says it is out of date.
- Do not edit the map to make a better picture. A change to the map goes through the update skill.
- Write every file outside the repository.
