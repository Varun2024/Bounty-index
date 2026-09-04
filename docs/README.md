# docs

Everything not-code, categorized by purpose. Read this first when opening the folder cold.

## progress.md
Running build log. Appended per session, never rewritten. Start here on session resume.

## foundations/ — what the project is
Stable reference. Change rarely.

- [`PLAN.md`](foundations/PLAN.md) — project charter, MVP scope, tech stack, folder structure
- [`architecture.md`](foundations/architecture.md) — system diagram, stack decisions, data flow, trust boundaries
- [`design.md`](foundations/design.md) — visual tokens, component recipes, patterns to avoid
- [`rules.md`](foundations/rules.md) — project-specific coding/data/UI/security rules
- [`memory.md`](foundations/memory.md) — persistent session context, locked decisions, resumption checklist

## roadmap/ — what we'll build
Forward-looking. Aspirational, sequenced.

- [`ROADMAP.md`](roadmap/ROADMAP.md) — top-level product roadmap
- [`NEXT_STEP.md`](roadmap/NEXT_STEP.md) — phased feature backlog, priorities
- [`phases.md`](roadmap/phases.md) — phase checklists with exit criteria
- [`moat.md`](roadmap/moat.md) — retention/moat feature options, ranked by leverage

## plans/ — per-feature implementation contracts
One doc per non-trivial feature. Written before code, read by the session that ships it.

- [`PLAN_MCP_AND_DETAIL.md`](plans/PLAN_MCP_AND_DETAIL.md) — MCP server + rich program detail page
- [`PLAN_DISCORD.md`](plans/PLAN_DISCORD.md) — Discord webhook alerts (E3)

## reviews/ — self-audits, weakness triage
Honest takes on what's broken or missing. Not roadmap — diagnosis.

- [`BRUTAL_REVIEW.md`](reviews/BRUTAL_REVIEW.md) — brutal current-state review
- [`known-gaps.md`](reviews/known-gaps.md) — weakness triage ranked by user impact

---

**Adding a new doc:** pick the folder by *purpose*, not topic. If it's a diagnosis → reviews. If it's a to-do → roadmap. If it's a "how we'll build X" → plans. If it's stable reference → foundations.
