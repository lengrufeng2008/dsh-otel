---
name: otel-export
description: Export a dsh-token-audit JSON summary to OTLP/JSON metrics. Use when a team wants DSH cost/token data in Grafana, Langfuse, or another OTLP backend. Summary only; no per-turn spans, no network upload.
whenToUse: "A DSH audit needs to become machine-readable metrics for an existing observability stack."
---

# OTLP summary export

## Pipeline

```bash
dsh-token-audit --all --format json > audit.json
node bin/dsh-otel.mjs --input audit.json --output otlp.json
```

In DSH:

```text
Use otel_export on audit.json, format=summary.
```

## What is exported

- `dsh.cost.cny`, `dsh.tokens.input`, `dsh.tokens.cache_read`, `dsh.tokens.output`
- `dsh.sessions`, `dsh.calls`
- `dsh.cost.projected_monthly_cny`, `dsh.cost.idle_cny`, `dsh.cost.peak_cny`
- per-model `dsh.model.cost.cny`, `dsh.model.calls`, `dsh.model.tokens.output`

## Boundaries

- **Summary metrics only.** No per-turn, per-tool, or per-subagent spans.
- No network calls; it writes a JSON artifact. Your collector/agent does the upload.
- It does not validate provider pricing; the audit's numbers are inherited.
- No dashboard, alerting, or retention policy is included.
- Do not export an audit containing secrets; `dsh-token-audit --redact` removes titles/paths/commands.

## OTLP shape

The output is OTLP/JSON (`resourceMetrics[].scopeMetrics[].metrics[]`) and is suitable for a collector
that accepts JSON. It is not OTLP/protobuf and not a live stream.
