# TryNex Lifestyle — Agent Operating Rules

This file is part of the project handoff. It must be read before making changes.
It applies to the original project and to copies/remixes that include this file.

## First priority: understand the project

Before responding with an implementation plan or editing files, every Agent must:

1. Read this file.
2. Read `AGENT_HANDOFF.md`.
3. Read `replit.md`.
4. Inspect the current state of the files and workflows relevant to the request.
5. Check the user's current request and treat it as the highest-priority product instruction.

The project rules in this file and `replit.md` provide context and safety constraints.
They do not override the user's current request, platform safety rules, or a newer
explicit decision made by the project owner.

## Preserve the full history of work

- Do not replace, reset, or rewrite working features just because a new Agent is
  unfamiliar with them.
- Treat existing code, completed work, decisions, plans, and documented gotchas as
  intentional unless current evidence shows otherwise.
- Before changing a shared behavior, search for every consumer and update the
  related code and documentation together.
- When a change affects a "before" and "after" flow, update both sides in the
  same task. Do not leave an old path, fallback, route, client, mobile screen,
  admin screen, or documentation path silently behind.
- Prefer a focused change that fits the existing architecture over an unrelated
  refactor.

## Plan before implementation

Before editing code, the Agent must submit a concise plan in its response or task
proposal. The plan must state:

- What will change
- Which existing behavior must remain intact
- Files or areas likely to be affected
- Dependencies and related "before/after" paths
- How the result will be checked
- Whether any work can safely run in parallel

For multi-step or risky work, stop after presenting the plan until the user
approves it. For a small, clearly scoped fix, the plan may be brief, but it still
must be stated before the first edit.

Before declaring the work complete or handing it to another user, submit a final
completion note containing:

- What changed
- What was preserved
- Verification performed and its result
- Any remaining limitations or follow-up work
- The updates made to `AGENT_HANDOFF.md`

## Parallel work

Parallel work is allowed when tasks are independent and have clear boundaries.

- Split work by isolated feature or file group.
- State dependencies before starting parallel work.
- Do not let two Agents edit the same file or shared contract simultaneously.
- Reconcile all parallel results in the main project before completion.
- Resolve conflicts deliberately; never silently choose one branch.
- Re-run the relevant checks after reconciliation.

Parallel work must never be used to bypass the plan, review, security, or
verification requirements.

## Keep the handoff current

After meaningful work, update `AGENT_HANDOFF.md` before finishing. Keep it concise
and useful to the next Agent:

- Record completed work and current open work.
- Record durable architecture decisions and important gotchas.
- Record plans that were approved, rejected, or still pending.
- Record the next safe recommended prompt.
- Never record passwords, API keys, session tokens, private keys, database URLs,
  personal data, or any other secret value.

If the current task changes an existing decision, update the handoff instead of
creating contradictory notes. If a note is stale, correct or remove it.

## Secrets and access

- Never ask a user to paste a secret into a project file or chat.
- Never copy secret values into `AGENT_HANDOFF.md`, `AGENTS.md`, `replit.md`,
  source code, logs, screenshots, or commits.
- Refer to secret names only when documenting configuration.
- Use the project's secure secret mechanism for secret changes.

## Remix expectations

A Remix/copy should receive these project files and therefore should receive this
operating context. The new Agent must still read them first and verify that the
copied project matches the documented state.

These files do not transfer the original private Agent conversation. They transfer
the durable project context that has been written down. If the copied project
does not contain a detail, the Agent must ask for clarification rather than
inventing history.
