[{RELEVANT LINK}]({RELEVANT LINK}) | [{RELEVANT LINK 2}]({RELEVANT LINK 2})

## Why the change

{Exactly one sentence: the problem this pull request solves and what becomes possible once it ships.}

## Special things to note

- {One to three things a reviewer must know: a warning, a migration, a limit on compatibility, something left out on purpose, a surprising decision. Write "None." when there is nothing.}

## Change outline

{One line: what this symbol now does differently.}

![{symbol id}]({full path of its image})

{One line for the next most important symbol.}

![{symbol id}]({full path of its image})

Also changed: `{symbol id}`, `{symbol id}`, `{symbol id}`.

{One line: what this view shows.}

```diff
{A change to a table, to the contract of an endpoint, to a data structure, to a file tree or to a component tree. Only for what the images above do not show.}
```

{How to use this template:

- The first line of links is optional. Keep it when you know a ticket, a task or a plan this pull request belongs to. Leave it out otherwise.
- The images come from `capisce show --changed --format svg`, most important first. Show the few that carry the change and name the rest on the "Also changed" line. Leave that line out when every changed symbol is shown.
- When images cannot be uploaded, put the output of `capisce show "<symbol id>" --base <base> --format diff` in a fenced `diff` block in place of each image.
- Views written by hand are optional, and there can be more than one. Use `diff` for a change to a shape that is already there. Use a block in the code's own language, or `text`, for a shape that is mostly new.
- Tell the story in the order that is easiest to follow. It may be clearer to show a table or a contract before the behavior that uses it.
- Leave out everything that does not help a reviewer. Add no other heading.}
