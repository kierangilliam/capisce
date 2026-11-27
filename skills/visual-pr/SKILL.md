---
name: visual-pr
description: This creates or updates the pull request for the current work with a short description that shows the changed pseudo-code from the map as pictures. Use when asked to open, describe or update a pull request, or to write a visual description of one.
---

# Describe a pull request

Create or update the pull request for the current task. The description is short: one sentence of why, one to three things a reviewer should note, and an outline of the change. The outline leads with pictures from the capisce map: the pseudo-code of each endpoint, function and flow the pull request changes, with the added and removed lines marked.

Run capisce the way the project wraps it (look for a package script, a Makefile target or a script that calls it). If the project has `.capisce/README.md`, read it first: it says what is specific to this project, such as its own commands. If there is none, clone the capisce repository and run `node <capisce>/bin/capisce.mjs <command>` from the project's root. `capisce skill <name>` prints any of the skills named here.

This skill has two more files, in the `references` folder beside this one: `pr_description_template.md` and `final_answer.md`. If you are reading this through `capisce skill visual-pr`, they are in `<capisce>/skills/visual-pr/references/`.

## 1. Read the template

Read `references/pr_description_template.md`. The description follows it and holds nothing more.

## 2. Find or create the pull request

- `gh pr view --json url,number,title,state,baseRefName,headRefName` finds the pull request of the current branch.
- If there is none, look at `git status --short --branch` and at the commits on the branch. Commit the changes that belong to the task if they are not committed, push the branch, and create the pull request. Follow the project's own rules for commits, branches and pull requests.
- Ask the user which pull request they mean only when the branch has no work of its own and there is nothing safe to create.

Keep the number and the base branch (`baseRefName`). Run `git fetch origin <base branch>` so the comparison below is with the base as it is now.

## 3. Make sure the map is true

Run `capisce check`. If it fails, update the map first with the update skill (`capisce skill update`), commit that and push it. A description must never show pseudo-code that does not match the code.

## 4. Gather what the description needs

- Read the whole diff of the pull request, and enough of the code around it to know what it does and why.
- Read the ticket or the task notes, if there are any.
- See what the pull request changes in the map:

  ```sh
  capisce changes --base origin/<base branch>
  ```

  It lists each changed symbol: its id, kind, domain, status (added, changed or removed) and the parts that changed (doc, pseudo, flow, code). `--json` prints the same as `{ "base", "head", "changes": [...] }`.

- Make one image for each changed symbol, in a folder outside the repository:

  ```sh
  capisce show --changed --base origin/<base branch> --format svg --out /tmp/pr-<number>/images
  ```

  It prints `id -> path` for every file it writes (`--json` prints a list of `{ "id", "path" }`). Each image is one symbol's name, kind, description and pseudo-code, with added and removed lines marked and a badge for its status. Use the paths it prints: do not guess the file names.

If `capisce changes` lists nothing, the pull request does not touch mapped behavior. Skip the images and write the outline by hand (step 5).

## 5. Write the description

Write it to a file outside the repository, such as `/tmp/pr-<number>/description.md`, so it is never committed.

- **Why the change** is exactly one sentence.
- **Special things to note** is one to three bullets: what a reviewer must be warned about, a migration, a limit on compatibility, something left out on purpose, a decision that would surprise. Write `- None.` when there is nothing.
- **Change outline** shows the shape of the change. It is not prose and not a list of files.

The outline leads with the images from the map:

- Put the most important first. Give each a caption of one line above it: what this symbol now does differently, in plain words.
- Choose. A pull request that changes many symbols shows the few that carry the change, about three to five, and lists the rest by name in one line under them.
- Skip a symbol whose only changed part is `code` when its pseudo-code reads the same: there is nothing to see.
- capisce does not draw flow charts. A changed flow is shown as its stages and sentences.

After the images, add a view written by hand only for what the map does not cover and a reviewer needs:

- A change to a table or to the contract of an endpoint.
- A data structure or type the change rests on.
- A shallow file tree, when the change moves who owns what.
- A component tree, when the change is to the structure of a UI, with the state and boundaries that matter.

Use a `diff` block for a change to a shape that is already there. Show the whole shape when most of it is new or when diff marks would hide the order. Leave out every view that does not help. Do not write pseudo-code by hand for behavior the map already shows.

Write as one person talking to another: simple, short sentences, no jargon.

## 6. Publish it

An image in a description has to be uploaded: a path on your machine shows nothing to a reviewer. Run `gh pr edit --help` and look for `--attach`.

**If `gh` has `--attach`:** write each image into the description as `![<the symbol's id>](<full path of the image>)`, and pass the same full path once for each image:

```sh
gh pr edit <number> --body-file /tmp/pr-<number>/description.md \
  --attach /tmp/pr-<number>/images/<file>.svg \
  --attach /tmp/pr-<number>/images/<other file>.svg
```

`gh` uploads each file and puts its address in place of the path. Attach only the images the description uses.

**If `gh` has no `--attach`, or an upload fails:** do not commit the images to the branch. Show the same symbols as text instead:

```sh
capisce show "<symbol id>" --base origin/<base branch> --format diff
```

Paste each result into the description in a fenced `diff` block under its caption, then publish with `gh pr edit <number> --body-file /tmp/pr-<number>/description.md`. Tell the user where the image files are, so they can drag them into the description.

Then run `gh pr view <number> --json body` and confirm the description is there, and that no image still points at a path on your machine.

## 7. Report

Read `references/final_answer.md` and answer in that form.

## Rules

- Exactly one sentence of why. One to three notes, or `- None.`.
- Nothing in the description beyond the template.
- Never show pseudo-code that `capisce check` says is out of date.
- Never commit the images or the description file.
