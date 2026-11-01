import React from 'react'
import { Users } from 'lucide-react'
import { InfoButton } from './InfoButton'
export function OrderProgress({ summary, acCount, storeCount, live, phase, checkedAt, ready = true }) {
  const format = n => ready ? n.toLocaleString('id-ID') : '—'
  return <div className="monitoring-stats order-progress" aria-label={`Ringkasan pesanan PIC ${summary.pic === 'ALL' ? 'semua' : summary.pic}`}>
    <span title="Pesanan yang belum DONE di spreadsheet"><strong>{format(summary.pending)}</strong><span>Belum</span></span>
    <span className="done-count" title="Pesanan DONE di spreadsheet, tidak masuk antrean atau lampiran"><strong>{format(summary.done)}</strong><span>DONE</span></span>
    <span><strong>{format(acCount)}</strong><span>AC</span></span>
    <span><strong>{format(storeCount)}</strong><span>Toko</span></span>
    <InfoButton title="Rekap pesanan per PIC" icon={Users}>
      <div className="order-recap-caption"><strong>{summary.source === 'ALL' ? 'DS + REG' : summary.source}</strong><span>{live ? phase === 'error' ? 'Data terakhir · sinkronisasi terhenti' : 'Mengikuti spreadsheet · pembaruan ±30 detik' : 'Data manual'}</span></div>
      {checkedAt && <p className="text-xs">Dibaca {new Date(checkedAt).toLocaleTimeString('id-ID', {timeZone:'Asia/Jakarta'})} WIB</p>}
      {!ready && <p className="text-xs">{phase === 'error' ? 'Sumber belum dapat dibaca. Hitungan belum tersedia.' : 'Menunggu data spreadsheet…'}</p>}
      <div className="order-recap-scroll"><table className="order-recap-table"><thead><tr><th>PIC</th><th>Belum</th><th>DONE</th><th>Total</th></tr></thead><tbody>{summary.byPic.map(item => <tr key={item.pic} className={item.pic === summary.pic ? 'current' : ''}><th>{item.pic}</th><td>{format(item.pending)}</td><td>{format(item.done)}</td><td>{format(item.total)}</td></tr>)}</tbody></table></div>
      <p className="text-xs">Hitungan berasal dari status pesanan di sumber, terpisah dari status chat lokal.</p>
    </InfoButton>
  </div>
}
