# ADR 0013: Nemotron inference posture — hosted NIM

**Date:** 2026-07-30

**Status:** Accepted

## Context

The AI-assisted DemandeDeplacement feature (map #128) needs an LLM inference backend for the propose-from-history task: given an employee's past demandes, suggest values for Ville, Motif, TypeTransport, and AvanceRequise. Two research tickets resolved the prerequisites:

- #129 confirmed `nvidia/nemotron-3-nano-30b-a3b` (Nemotron 3 Nano) as the recommended model — a structured-classification workload where constrained output (guided_json/guided_choice) is sufficient, and Nano's ~95ms TTFT / $0.05–$0.20 per 1M tokens is cost-effective.
- #130 confirmed self-host feasibility (49B Super fits single H100-80GB) but noted the ops + hardware cost.

Three postures were evaluated:

1. **Hosted NIM** — past demandes egress to NVIDIA via `integrate.api.nvidia.com/v1`. Simplest ops, no GPU infra to manage.
2. **Self-hosted NIM container** — no data egress; carries NVIDIA AI Enterprise licensing (~$4,500/GPU/yr or ~$1/GPU/hr) + hardware.
3. **Hybrid** — hosted for prototyping, self-host as production target.

## Decision

Use **hosted NIM** (`integrate.api.nvidia.com/v1`) with model `nvidia/nemotron-3-nano-30b-a3b`. Constrained output via `extra_body: {"nvext": {"guided_json": <schema>}}` (and `guided_choice` for enums). No reasoning budget — greedy decoding, temperature 0, `enable_thinking: false`.

## Rationale

- **Simplest operations** — no GPU cluster, no NIM container lifecycle, no NVIDIA AI Enterprise license management. An API key is the only dependency.
- **Model fit** — the task is structured classification, not reasoning. Nano's 3.2B active parameters and sub-100ms TTFT are more than adequate.
- **Cost** — at $0.05/$0.20 per 1M tokens, and with propose-from-history producing only a handful of output tokens per call, the per-request cost is negligible.
- **Future upgrade path** — if the spec later requires free-text generation or multi-step reasoning, switch to `nvidia/nemotron-3-ultra-550b-a55b` with no architectural change — same API, same client, different model id.
- **Data-residency risk accepted** — the Societe's legal posture (Moroccan Loi 09-08) permits this for the AI-assisted feature; recorded in CONTEXT.md.

## Rejected alternatives

- **Self-hosted NIM** — rejected for this iteration. Revisit if (a) data-residency rules tighten, (b) call volume makes per-token serverless more expensive than dedicated GPU, or (c) the spec adds features requiring a model too large to self-host practically (Ultra 550B needs an 8xH100 node).
- **Hybrid** — rejected for now. The overhead of maintaining two deployment targets (hosted + self-host container registry, CI, monitoring) is unjustified at current scale.

## Consequences

- Employee past-demandes leave the Societe premises toward NVIDIA's NIM endpoint. Documented in CONTEXT.md under the inference posture term.
- The API integration uses the OpenAI-compatible SDK (`openai` npm package) with custom `baseURL` — no vendor lock-in beyond the HTTP protocol.
- Structured generation must be re-verified at implementation time on the exact `nemotron-3-nano-30b-a3b` hosted endpoint (the `nvext` shape was verified on Gen-A Nemotron, not yet on Nemotron 3 Nano).
- Self-host remains available as a future escape hatch if requirements change.
