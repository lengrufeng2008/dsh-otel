// DSH host plugin: turn a dsh-token-audit JSON report into OTLP/JSON summary metrics.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditToOtlp, summaryMarkdown } from '../src/otlp.mjs'

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const SKILL_PATH = join(PLUGIN_DIR, '..', 'skills', 'otel-export', 'SKILL.md')
const PROVIDER = 'dsh-otel'
export const name = 'otel'
export const inject = ['tools', 'skills']

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text
  const end = text.indexOf('\n---\n', 4)
  return end === -1 ? text : text.slice(end + 5)
}
const summary = {
  name: 'otel-export',
  description: 'Export a dsh-token-audit JSON summary as OTLP/JSON metrics for Grafana, Langfuse, or another OTLP backend. Summary metrics only; no per-turn spans and no network calls.',
  whenToUse: 'A team wants cost/token usage in an existing observability stack, or needs an OTLP metrics artifact from a DSH audit.',
  invocation: { modelInvocable: true, userInvocable: true },
  source: 'bundled', provider: PROVIDER,
  resourceBase: { kind: 'directory', path: join(PLUGIN_DIR, '..', 'skills', 'otel-export') },
  rank: 600, locator: 'otel-export', metadata: { domain: 'observability', version: '0.1.0' },
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'otel_export',
    description: 'Convert the JSON summary produced by dsh-token-audit into OTLP/JSON metrics. Summary only: cost, tokens, sessions, calls, projected monthly, idle/peak, and per-model cost/calls. Does not include per-turn spans and does not send data anywhere.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        input: { type: 'string', description: 'Path to a dsh-token-audit --format json report.' },
        serviceName: { type: 'string', description: 'OTLP service.name. Default deepseek-harness.' },
        format: { type: 'string', enum: ['summary', 'otlp'], description: 'Return a short summary or the full OTLP JSON. Default summary.' },
      },
      required: ['input'],
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: { markdown: { type: 'string' }, metrics: { type: 'integer' }, otlp: { type: 'string' } },
        required: ['markdown', 'metrics', 'otlp'],
      },
      render: (_args, value) => [{ type: 'text', text: value.markdown }],
    },
    timeoutMs: 30_000,
    async execute(args = {}) {
      const audit = JSON.parse(await readFile(args.input, 'utf8'))
      const otlp = auditToOtlp(audit, { serviceName: args.serviceName || 'deepseek-harness' })
      const metrics = otlp.resourceMetrics[0].scopeMetrics[0].metrics.length
      const summaryText = summaryMarkdown(audit, otlp)
      return {
        markdown: args.format === 'otlp' ? JSON.stringify(otlp, null, 2) : summaryText,
        metrics,
        otlp: JSON.stringify(otlp),
      }
    },
  })
  ctx.skills.registerProvider(() => ({
    name: PROVIDER,
    async list() { return [summary] },
    async get(candidate) {
      if (candidate?.name !== 'otel-export') return undefined
      return { ...summary, content: stripFrontmatter(await readFile(SKILL_PATH, 'utf8')) }
    },
  }))
}
