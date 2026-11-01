# OTel Export for DSH

> DSH has cost dashboards, but no machine-readable export. This turns a `dsh-token-audit` JSON
> summary into OTLP/JSON **metrics** for Grafana, Langfuse, or any collector that accepts JSON.

It is a **summary** exporter: cost, tokens, sessions, calls, projected monthly, idle/peak, and
per-model totals. It does not produce per-turn or per-tool spans.

## Pipeline

```bash
dsh-token-audit --all --format json > audit.json
node bin/dsh-otel.mjs --input audit.json --output otlp.json
```

In DSH:

```text
Use otel_export on audit.json, format=summary.
```

## Metrics

- `dsh.cost.cny`
- `dsh.tokens.input`, `dsh.tokens.cache_read`, `dsh.tokens.output`
- `dsh.sessions`, `dsh.calls`
- `dsh.cost.projected_monthly_cny`
- `dsh.cost.idle_cny`, `dsh.cost.peak_cny`
- per model: `dsh.model.cost.cny`, `dsh.model.calls`, `dsh.model.tokens.output`

## Boundaries

- No network: it writes JSON; your collector uploads it.
- No per-turn/per-tool spans, no live streaming, no dashboard.
- It inherits the audit's pricing; it does not re-price.
- Redact the audit before exporting if titles/paths are sensitive.
- OTLP/JSON only, not protobuf.

## Tests

```bash
npm test
```

## Provenance

Inspired by [claude-code-otel](https://github.com/ColeMurray/claude-code-otel); no source copied.
See `NOTICE.md`. License: MIT.
