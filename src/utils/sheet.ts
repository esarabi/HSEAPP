/**
 * خواندن فایل Excel (xlsx) یا CSV در مرورگر، بدون وابستگی خارجی.
 * فایل xlsx یک آرشیو zip است؛ با DecompressionStream مرورگر باز و XML آن تجزیه می‌شود.
 */

export type Row = string[]

export async function readSpreadsheet(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') return parseCSV(await readText(file))
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // امضای zip
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return parseXLSX(bytes)
  // فایل xls قدیمی (باینری)
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)
    throw new Error('فرمت xls قدیمی پشتیبانی نمی‌شود. فایل را در اکسل با Save As به xlsx یا CSV تبدیل کنید.')
  return parseCSV(await readText(file))
}

async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  // UTF-8 BOM
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes)
  // UTF-16 LE BOM (خروجی «Unicode Text» اکسل)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  // اگر کاراکتر جایگزین زیاد بود، احتمالاً Windows-1256 است (خروجی CSV پیش‌فرض اکسل فارسی)
  const bad = (utf8.match(/�/g) ?? []).length
  if (bad > 2) {
    try {
      return new TextDecoder('windows-1256').decode(bytes)
    } catch {
      return utf8
    }
  }
  return utf8
}

export function parseCSV(text: string): Row[] {
  const rows: Row[] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const sep = detectSeparator(text)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function detectSeparator(text: string): string {
  const head = text.slice(0, 2000)
  const counts: [string, number][] = [',', ';', '\t', '،'].map((s) => [s, head.split(s).length])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0]
}

// ---------- xlsx ----------

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  offset: number
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // پیدا کردن End of Central Directory
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('فایل xlsx معتبر نیست')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const compressedSize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const offset = dv.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.push({ name, method, compressedSize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function readZipFile(bytes: Uint8Array, e: ZipEntry): Promise<string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const nameLen = dv.getUint16(e.offset + 26, true)
  const extraLen = dv.getUint16(e.offset + 28, true)
  const start = e.offset + 30 + nameLen + extraLen
  const data = bytes.subarray(start, start + e.compressedSize)
  if (e.method === 0) return new TextDecoder().decode(data)
  if (e.method !== 8) throw new Error('روش فشرده‌سازی پشتیبانی نمی‌شود')
  const ds = new DecompressionStream('deflate-raw')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds)
  return new Response(stream).text()
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

function colIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase()
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export async function parseXLSX(bytes: Uint8Array): Promise<Row[]> {
  const entries = readZipEntries(bytes)
  const find = (n: string) => entries.find((e) => e.name === n)
  // رشته‌های مشترک
  const shared: string[] = []
  const ss = find('xl/sharedStrings.xml')
  if (ss) {
    const xml = await readZipFile(bytes, ss)
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1]))
      shared.push(texts.join(''))
    }
  }
  // اولین شیت (ترتیب workbook)
  let sheetName = 'xl/worksheets/sheet1.xml'
  const wb = find('xl/workbook.xml')
  const rels = find('xl/_rels/workbook.xml.rels')
  if (wb && rels) {
    const wbXml = await readZipFile(bytes, wb)
    const relXml = await readZipFile(bytes, rels)
    const first = wbXml.match(/<sheet [^>]*r:id="([^"]+)"/)
    if (first) {
      const rel = relXml.match(new RegExp(`<Relationship [^>]*Id="${first[1]}"[^>]*Target="([^"]+)"`)) ?? relXml.match(new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${first[1]}"`))
      if (rel) sheetName = (rel[1].startsWith('/') ? rel[1].slice(1) : 'xl/' + rel[1]).replace(/^xl\/xl\//, 'xl/')
    }
  }
  const sheet = find(sheetName) ?? entries.find((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
  if (!sheet) throw new Error('شیتی در فایل پیدا نشد')
  const xml = await readZipFile(bytes, sheet)
  const rows: Row[] = []
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const idx = colIndex(c[1])
      const attrs = c[2]
      const inner = c[3] ?? ''
      const type = attrs.match(/t="(\w+)"/)?.[1]
      let val = ''
      if (type === 's') {
        const v = inner.match(/<v>(\d+)<\/v>/)
        val = v ? (shared[Number(v[1])] ?? '') : ''
      } else if (type === 'inlineStr') {
        val = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join('')
      } else {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)
        val = v ? decodeXml(v[1]) : ''
      }
      while (row.length < idx) row.push('')
      row[idx] = val
    }
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** تبدیل ارقام فارسی/عربی به انگلیسی و حذف فاصله‌های اضافی */
export function normalize(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
}
