# Issue tracker: GitHub

Planning issues for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically inside a clone.

GitHub shares one number space across issues and PRs, so resolve a bare `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a GitHub sub-issue, falling back to a map task-list entry plus `Part of #<map>` in the child. Label it `wayfinder:grilling`, `wayfinder:research`, or `wayfinder:prototype`.
- **Blocking**: use native issue dependencies, falling back to a `Blocked by: #<n>` line when unavailable.
- **Frontier query**: list open map children, exclude assigned or blocked tickets, and follow Wayfinder's loading rules.
- **Claim**: `gh issue edit <n> --add-assignee @me` as the first write.
- **Resolve**: comment with the answer, close the issue, and append a context pointer to the map's Decisions-so-far.
