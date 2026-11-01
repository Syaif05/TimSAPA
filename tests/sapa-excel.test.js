import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'
import { SAMPLE_SAPA_TSV } from '../src/utils/sampleSapaData.js'

// Resolve the existing Vite-style specifiers for Node without changing parser code.
const file = new URL('../src/utils/sapaParser.js', import.meta.url)
let source = await readFile(file, 'utf8')
source = source.replace("'papaparse'", JSON.stringify(import.meta.resolve('papaparse')))
source = source.replace("'./phoneUtils'", JSON.stringify(new URL('../src/utils/phoneUtils.js', import.meta.url).href))
source = source.replace("import('xlsx')", `import(${JSON.stringify(import.meta.resolve('xlsx'))})`)
const { parseSapaExcel, parseSapaRawText } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('lazy Excel parser produces the same rows as pasted SAPA data', async () => {
  const workbook = XLSX.utils.book_new()
  const values = SAMPLE_SAPA_TSV.trim().split('\n').map(row => row.split('\t'))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(values), 'SAPA')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const actual = await parseSapaExcel(buffer)
  assert.ok(actual.length > 0)
  const content = rows => rows.map(({ id, ...fields }) => fields)
  assert.deepEqual(content(actual), content(parseSapaRawText(SAMPLE_SAPA_TSV)))
})
