#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { auditToOtlp, summaryMarkdown } from '../src/otlp.mjs'
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log('dsh-otel --input audit.json [--output otlp.json] [--service NAME] [--summary]\n\nConvert dsh-token-audit JSON into OTLP/JSON summary metrics.')
  process.exit(0)
}
const value = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1] }
try {
  const input = value('--input')
  if (!input) throw new Error('--input audit.json is required')
  const audit = JSON.parse(await readFile(input, 'utf8'))
  const otlp = auditToOtlp(audit, { serviceName: value('--service', 'deepseek-harness') })
  if (args.includes('--summary')) { console.log(summaryMarkdown(audit, otlp)); process.exit(0) }
  const output = value('--output')
  const text = JSON.stringify(otlp, null, 2)
  if (output) { await writeFile(output, text); console.log(`wrote ${output} (${otlp.resourceMetrics[0].scopeMetrics[0].metrics.length} metrics)`) }
  else process.stdout.write(text + '\n')
} catch (error) { console.error(`dsh-otel: ${error.message}`); process.exitCode = 2 }
