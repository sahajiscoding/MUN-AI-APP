# MUN Prep · MiroFish-inspired scenario pack

This directory is a reproducible, local scenario replay built from the repository's existing **synthetic** founder-panel personas and answers. It follows the five-stage MiroFish workflow as a design reference—Graph Build, Environment Setup, dual-platform simulation, ReportAgent, and Deep Interaction—but it is **not the MiroFish runtime**.

## Rebuild

From the repository root, run:

```sh
corepack pnpm mirofish:simulate
```

The deterministic script writes the graph, profiles, configuration, two platform timelines, run state, report outline, tool trace, and report below. It also adds the separate post-replay summary at `founder/panel/swarm-reactions.md` and `.json`; the original panel answers/results remain unchanged.

## Artifacts

- `ontology.json` — scenario, entity types, relationship types, and evidence boundary.
- `graph.json` — 51 nodes, 88 relationships, and temporal-memory facts.
- `oasis_profiles.json` — 40 synthetic profiles with experience, behavior, memory, and social dimensions.
- `simulation_config.json` — seed, timeline, action types, and live-vs-what-if event definitions.
- `twitter_actions.jsonl` / `reddit_actions.jsonl` — five rounds of synthetic actions per platform.
- `run_state.json` — completed run metadata and historical baseline label.
- `outline.json`, `agent_log.jsonl`, and `report.md` — local ReACT-style report plan, inspectable tool trace, and interpretation.

## Evidence and privacy limits

- No real delegates were interviewed; no customer records or credentials are included.
- No external LLM, OASIS simulator, Zep graph service, or network call is used.
- Stance tags are not purchase intent, conversion probabilities, or population estimates.
- The original 9/40 result belongs to an earlier synthetic panel and a pay-first offer. It is not validation of the current 3-day trial.
- Source-linked proof, public sample briefs, and club pilots appear only as clearly labeled what-if experiments unless independently verified in the product.

Workflow reference: <https://github.com/666ghj/MiroFish>.
