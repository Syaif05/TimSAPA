const header = value => String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '')
// The actual 22-column monitoring sheets have a blank title in column O.
// Accept this one known layout; never infer PIC from an unrelated/shifted column.
export function monitoringHeader(cells) {
  const names = cells.map(header)
  if (!['shipment', 'namaac', 'kodetoko', 'status'].every(name => names.includes(name))) return null
  let pic = names.indexOf('pic')
  if (pic < 0 && names[0] === 'jam' && names[2] === 'namaac' && names[3] === 'kodetoko' && names[7] === 'shipment' && names[12] === 'podac' && names[13] === 'apvam' && !names[14] && names[15] === 'status') pic = 14
  return pic >= 0 ? { names, pic } : null
}
