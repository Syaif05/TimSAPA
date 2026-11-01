export const SPREADSHEET_ID = '1MxYuZs7ayhRas9BvmPIP3oCeTGh4fIgtgUFmKAC4FKc'
export const LINKED_SHEET_DATE = '2026-10-31'
export const SHEET_SOURCES = [
  { key: 'REG', gid: '981444386', title: 'REG 31/10' },
  { key: 'DS', gid: '960401050', title: 'DS 31/10' },
]
export const spreadsheetLink = gid => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${gid}`
export function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function dailySheetTitle(source, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal sumber tidak valid.')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('Tanggal sumber tidak valid.')
  return `${source} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

export const CONTACTS_SOURCE = {
  id: '1gz9Gt3uVMtpfK4JJN_6qh1URWb8wTK3K',
  gid: '843052731',
  sheet: 'KONTAK TOKO BARU',
  url: 'https://docs.google.com/spreadsheets/d/1gz9Gt3uVMtpfK4JJN_6qh1URWb8wTK3K/edit?gid=843052731#gid=843052731',
}
