// Convert the JSON summary emitted by dsh-token-audit into OTLP/JSON metrics.
// This is a summary exporter, not a per-turn trace exporter.
const nowNano = () => String(BigInt(Date.now()) * 1_000_000n)

function attr(key, value) {
  if (typeof value === 'number') return { key, value: { doubleValue: value } }
  return { key, value: { stringValue: String(value) } }
}
function metric(name, unit, value, time, attributes = []) {
  return {
    name, unit,
    sum: {
      aggregationTemporality: 2, // CUMULATIVE
      isMonotonic: false,
      dataPoints: [{ asDouble: Number(value) || 0, timeUnixNano: time, attributes }],
    },
  }
}

export function auditToOtlp(audit, { serviceName = 'deepseek-harness' } = {}) {
  if (!audit || !audit.totals) throw new Error('input is not a dsh-token-audit JSON report')
  const t = audit.totals
  const time = String(BigInt(Date.parse(audit.generatedAt || new Date().toISOString())) * 1_000_000n)
  const base = [attr('dsh.audit.window.days', audit.window?.days ?? 0)]
  const metrics = [
    metric('dsh.cost.cny', 'CNY', t.cost, time, [...base, attr('dsh.cost.kind', 'total')]),
    metric('dsh.tokens.input', 'tokens', Number(t.hit || 0) + Number(t.miss || 0), time, [...base, attr('dsh.token.kind', 'input')]),
    metric('dsh.tokens.cache_read', 'tokens', t.hit || 0, time, [...base, attr('dsh.token.kind', 'cache_read')]),
    metric('dsh.tokens.output', 'tokens', t.out || 0, time, [...base, attr('dsh.token.kind', 'output')]),
    metric('dsh.sessions', '1', t.sessions || 0, time, base),
    metric('dsh.calls', '1', t.calls || 0, time, base),
    metric('dsh.cost.projected_monthly_cny', 'CNY', t.projectedMonthly || 0, time, base),
    metric('dsh.cost.idle_cny', 'CNY', t.idleCost || 0, time, [...base, attr('dsh.cost.kind', 'idle_rate')]),
    metric('dsh.cost.peak_cny', 'CNY', t.peakCost || 0, time, [...base, attr('dsh.cost.kind', 'peak')]),
  ]
  for (const [model, summary] of audit.byModel || []) {
    const attrs = [...base, attr('dsh.model', model)]
    metrics.push(metric('dsh.model.cost.cny', 'CNY', summary.cost || 0, time, attrs))
    metrics.push(metric('dsh.model.calls', '1', summary.calls || 0, time, attrs))
    metrics.push(metric('dsh.model.tokens.output', 'tokens', summary.out || 0, time, attrs))
  }
  return {
    resourceMetrics: [{
      resource: { attributes: [attr('service.name', serviceName), attr('service.version', '0.1.0')] },
      scopeMetrics: [{ scope: { name: 'dsh-otel', version: '0.1.0' }, metrics }],
    }],
  }
}

export function summaryMarkdown(audit, otlp) {
  const metrics = otlp.resourceMetrics[0].scopeMetrics[0].metrics
  const t = audit.totals
  return [
    '# DSH OTLP summary export', '',
    `- service: ${otlp.resourceMetrics[0].resource.attributes.find((a) => a.key === 'service.name')?.value.stringValue}`,
    `- metrics: ${metrics.length}`,
    `- sessions: ${t.sessions}`, `- calls: ${t.calls}`,
    `- cost: ¥${Number(t.cost).toFixed(4)}`,
    `- model(s): ${(audit.byModel || []).map(([m]) => m).join(', ') || 'unknown'}`, '',
    'This is a **summary metrics** export. It does not include per-turn or per-tool spans.',
  ].join('\n')
}
