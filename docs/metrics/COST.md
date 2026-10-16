# Cost estimate (API-equivalent), Office Crawler project + harness work

_Computed 2026-10-16 from this session's transcripts (per-call `usage`, 166 JSONL files, deduplicated per message and request).
Prices: Anthropic first-party API list prices from the bundled Claude API reference (cached 2026-10-06): Sonnet 5.5
$2 in / $10 out / $0.20 cache read per MTok; Opus 5.5 $4 / $20 / $0.20. Cache-write prices are **assumed** [verify]:
5-minute write 1.25x input, 1-hour write 2x input._

| Model (role) | Calls | Input | Output | Cache read | Cache write | Cost |
|---|---|---|---|---|---|---|
| Sonnet 5.5 (all sub-agents) | 8,462 | 17 k | 146 k (understated, see 1) | 1,491.6 M | 60.3 M (5 min) | **~$451** (read $298, write $151, out $1) |
| Opus 5.5 (orchestrator) | 1,103 | 3 k | 843 k | 418.8 M | 5.2 M (1 h) | **~$142** (read $84, write $42, out $17) |
| **Total** | | | | | | **~$593** |

## What this number is and is not
1. **Sub-agent output is understated.** The transcripts log about 17 output tokens per Sonnet call, which cannot be
   right for agents that wrote thousands of lines; the logged usage seems to be taken before the stream ends. Even 10x
   the logged output adds only about $15, because cost is dominated by cache reads.
2. **Cache reads dominate (~65 %).** Every agent turn re-reads its whole context. Shorter agent sessions and smaller
   contexts are the main cost lever, not the model price.
3. **The ledger's `tokensK` (~28 M) is not the billed volume.** It is the agent's final context size per hand-back, about
   1/50 of what was actually read across all turns. Use this file, not the ledger, for money.
4. **API-equivalent only.** If the session runs on a subscription plan, this is the value consumed, not an invoice.
5. Covers the whole session from 2026-10-13 (rounds R1 to R11, benchmarks B1 0.5.0 and 0.6.0, post-mortem, release).
   Opus calls may be incomplete if early transcript parts were not kept.
