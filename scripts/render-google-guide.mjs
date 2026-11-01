import { readFile, writeFile, mkdir } from 'node:fs/promises'
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const inline = value => escape(value).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
const source = await readFile(new URL('../docs/GOOGLE-CLOUD-SETUP.md', import.meta.url), 'utf8')
const blocks = []; let code = null; let table = false
for (const line of source.split('\n')) {
  if (line.trimStart().startsWith('```')) {
    if (code) { blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`); code = null } else code = []
    continue
  }
  if (code) { code.push(line.replace(/^ {3}/, '')); continue }
  if (!line.startsWith('|') && table) { blocks.push('</tbody></table></div>'); table = false }
  if (line.startsWith('# ')) blocks.push(`<h1>${inline(line.slice(2))}</h1>`)
  else if (line.startsWith('## ')) blocks.push(`<h2>${inline(line.slice(3))}</h2>`)
  else if (line.startsWith('|')) {
    if (!table) { blocks.push('<div class="table-scroll"><table><tbody>'); table = true }
    const cells = line.replace(/^\||\|$/g, '').split('|')
    if (!cells.every(cell => /^[\s:-]+$/.test(cell))) blocks.push(`<tr>${cells.map(cell => `<td>${inline(cell.trim())}</td>`).join('')}</tr>`)
  } else if (line.trim()) blocks.push(`<p>${inline(line.trim())}</p>`)
}
const style = 'body{margin:0;background:#f6f7f9;color:#252832;font:15px/1.8 system-ui,sans-serif}article{max-width:780px;margin:auto;padding:36px 22px 70px}h1{font-size:32px;line-height:1.3}h2{font-size:20px;margin-top:40px}p{overflow-wrap:anywhere}a{color:#2563eb}pre{padding:18px;overflow:auto;background:#e9edf4;border-radius:14px;line-height:1.6;font-size:12px}code{font-size:.87em}nav a{text-decoration:none;font-size:13px}.table-scroll{overflow:auto}table{font-size:13px;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd;vertical-align:top}tr:first-child{font-weight:bold}@media(max-width:600px){article{padding:22px 18px}h1{font-size:26px}}'
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/panduan-google.html', import.meta.url), `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Panduan Google Cloud · SAPA</title><style>${style}</style></head><body><article><nav><a href="/admin">← Pengelola sumber</a></nav>${blocks.join('\n')}</article></body></html>\n`)
