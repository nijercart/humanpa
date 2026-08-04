# HumanOS — from "what you need" to a done-able plan

An AI operating layer for real-life problems. You describe a need in plain language, HumanOS figures out what the real problem is, researches it on the live web with citations, lays out your options side by side, and hands you a checklist you can actually work through.

## The flow

```text
1. Tell me what you need     free-text prompt, voice-of-the-user
2. Clarify                   AI asks 2-4 sharp questions, restates the real problem
3. Research                  live web search, every claim carries a source link
4. Compare                   options table: cost, time, effort, risk, best-for
5. Action plan               ordered checklist, each step deep-links to the right page
6. Track                     tick steps off, revisit or re-run any past need
```

## Screens

- **Home** — single large input, "Tell me what you need.", a few example needs, recent needs below.
- **Need workspace** — one page per need with four stacked sections that fill in as the AI works: Problem, Sources, Options, Action Plan. Streaming, so you watch it think rather than staring at a spinner.
- **Problem card** — the restated problem, assumptions made, constraints picked up from your answers. Editable: correct it and re-run.
- **Sources** — cited results with title, domain, date and a trust cue (official/institutional domains flagged distinctly from general web).
- **Options** — 2-4 realistic routes compared on the dimensions that matter for that need, with a recommended pick and why.
- **Action plan** — numbered steps, each with a one-line what/why, an optional link to the exact site or form, and a checkbox. Progress persists.
- **Account** — sign in / sign up; every need is saved to your account and available on any device.

## Design direction

Calm, high-signal, editorial. Warm off-white canvas, near-black text, one confident accent for actions and progress. Generous type scale on the prompt, tight dense type in the research and comparison areas. No chat-bubble aesthetic — this is a document being assembled, not a conversation. Custom mark for HumanOS, no generic AI sparkle.

## Technical section

- **Backend**: Lovable Cloud (database + accounts). Tables: `needs` (owner, raw input, restated problem, status), `need_sources`, `need_options`, `need_steps` (with `done` flag and order). RLS scoped to `auth.uid()` on all four, plus explicit grants.
- **Auth**: email/password + Google sign-in via the Cloud broker. All need pages live under the authenticated route subtree; each need has its own URL (`/need/$needId`) so it reloads and can be shared to yourself.
- **AI**: Lovable AI Gateway via the AI SDK, called from TanStack server functions/routes — never from the browser. Clarification and synthesis use a strong reasoning-capable chat model.
- **Search**: agent-style tool loop — the model calls a `web_search` tool as many times as it needs, results are captured as source rows, and every option/step references the source IDs it came from. Streaming to the UI so sections appear progressively.
- **Structured output**: problem restatement, options and steps are generated as structured objects (loose schemas, limits enforced in prompt + code) and persisted; source links are stored verbatim.
- **Failure handling**: rate limit and credit-exhaustion responses from the gateway surface as clear in-app messages with the user's input preserved; partial results are saved so a failed research pass never loses the need.

## Not in v1

Reminders/deadlines, generated email or letter drafts, and sharing plans with other people. The data model leaves room for all three.
