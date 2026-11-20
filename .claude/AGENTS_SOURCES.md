# Project subagents: sources

Subagents in `.claude/agents/` that come from third-party collections. Review a file again before updating it from upstream.

| File | Source | License |
|---|---|---|
| `nextjs-developer.md` | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) `categories/02-language-specialists/` @ `ed74d11` | MIT, Copyright (c) 2025 VoltAgent |
| `typescript-pro.md` | same repo, `categories/02-language-specialists/` @ `ed74d11` | MIT |
| `test-automator.md` | same repo, `categories/04-quality-security/` @ `ed74d11` | MIT |
| `accessibility-tester.md` | same repo, `categories/04-quality-security/` @ `ed74d11` | MIT |
| `ux-microcopy-reviewer.md` | same repo, `categories/08-business-product/` @ `ed74d11` (originally from [Clagoss/claude-code-para-disenadores](https://github.com/Clagoss/claude-code-para-disenadores)) | MIT |

The files are copied unchanged. Some of them mention a "context manager" agent that this project does not have, so the agent falls back to reading the repository directly.

`postgres-pro` and `ui-designer` from the same collection were reviewed and left out. `postgres-pro` targets replication and high-availability operations rather than Supabase RLS. `ui-designer` requires a "context-manager" JSON protocol this project does not have.
