import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditToOtlp, summaryMarkdown } from '../src/otlp.mjs'
import { apply } from '../plugin/index.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const FIXTURE = join(ROOT, 'test/fixtures/audit.json')

test('audit JSON becomes OTLP summary metrics', async () => {
  const audit = JSON.parse(await readFile(FIXTURE, 'utf8'))
  const otlp = auditToOtlp(audit, { serviceName: 'fixture' })
  const metrics = otlp.resourceMetrics[0].scopeMetrics[0].metrics
  assert.equal(metrics.length, 12)
  const names = new Set(metrics.map((m) => m.name))
  for (const name of ['dsh.cost.cny', 'dsh.tokens.input', 'dsh.tokens.output', 'dsh.calls', 'dsh.model.cost.cny']) assert.ok(names.has(name), name)
  assert.equal(metrics.find((m) => m.name === 'dsh.cost.cny').sum.dataPoints[0].asDouble, 1.23)
  assert.match(summaryMarkdown(audit, otlp), /summary metrics/i)
})

test('the CLI writes OTLP JSON and a summary', () => {
  const out = join(ROOT, 'test/fixtures/otlp.out.json')
  const result = spawnSync(process.execPath, [join(ROOT, 'bin/dsh-otel.mjs'), '--input', FIXTURE, '--output', out], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /12 metrics/)
  const summary = spawnSync(process.execPath, [join(ROOT, 'bin/dsh-otel.mjs'), '--input', FIXTURE, '--summary'], { encoding: 'utf8' })
  assert.equal(summary.status, 0)
  assert.match(summary.stdout, /DSH OTLP summary export/)
  spawnSync(process.execPath, ['-e', `require('fs').unlinkSync(${JSON.stringify(out)})`])
})

test('the plugin registers otel_export and otel-export', async () => {
  const tools = []
  let factory
  apply({ tools: { register: (tool) => tools.push(tool) }, skills: { registerProvider: (fn) => { factory = fn } } })
  assert.equal(tools[0].name, 'otel_export')
  const result = await tools[0].execute({ input: FIXTURE })
  assert.equal(result.metrics, 12)
  assert.match(result.markdown, /summary metrics/i)
  const provider = factory()
  assert.equal((await provider.list())[0].name, 'otel-export')
  assert.match((await provider.get({ name: 'otel-export' })).content, /OTLP/)
  assert.equal(await provider.get({ name: 'missing' }), undefined)
})
