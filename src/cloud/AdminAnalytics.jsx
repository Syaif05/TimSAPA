import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Users, Clock3, FileSpreadsheet, BarChart3, Download, RefreshCw, SlidersHorizontal, ArrowUpRight } from 'lucide-react'
import { sourceRequest } from './sourceRequest'
import { ACTIVITY_ACTIONS, ACTIVITY_FEATURES } from '../utils/activityCatalog'
import { jakartaDate } from '../utils/sheetsConfig'
const number = value => Number(value||0).toLocaleString('id-ID')
const dateText = value => value ? new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Belum tercatat'
const minutes = value => `${Math.round(Number(value||0)/60)} menit`
const defaults = {trend:true,features:true,hours:true,pics:true,recent:true}
const colors=['#6654db','#3c8de0','#32aa91','#e6ae4d','#be6dab','#8095ac']
export function AdminAnalytics() {
 const today=jakartaDate()
 const [from,setFrom]=useState(()=>jakartaDate(new Date(Date.now()-6*86400000)))
 const [to,setTo]=useState(today),[pic,setPic]=useState(''),[feature,setFeature]=useState('')
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[updated,setUpdated]=useState(null)
 const [refresh,setRefresh]=useState(0),[custom,setCustom]=useState(false),[sort,setSort]=useState('activities')
 const request=useRef(0)
 const [widgets,setWidgets]=useState(()=>{try{return {...defaults,...JSON.parse(localStorage.getItem('sapa_admin_widgets')||'{}')}}catch{return defaults}})
 useEffect(()=>{try{localStorage.setItem('sapa_admin_widgets',JSON.stringify(widgets))}catch{}},[widgets])
 useEffect(()=>{
  let disposed=false;const id=++request.current
  const load=async()=>{
   setLoading(true)
   try {const result=await sourceRequest(`/api/admin/analytics?${new URLSearchParams({from,to,pic,feature})}`);if(!disposed&&id===request.current){setData(result);setError('');setUpdated(new Date())}}
   catch(e){if(!disposed)setError(e.message)} finally{if(!disposed)setLoading(false)}
  }
  load();const timer=setInterval(()=>{if(!document.hidden)load()},60000)
  return ()=>{disposed=true;clearInterval(timer)}
 },[from,to,pic,feature,refresh])
 const stats=data?.totals||{},actions=data?.actions||[]
 const actionCount=(...names)=>actions.filter(a=>names.includes(a.action)).reduce((total,a)=>total+Number(a.count),0)
 const roster=data?.roster||[]
 const daily=useMemo(()=>{const values=new Map((data?.daily||[]).map(d=>[d.date,d]));const points=[];const a=new Date(`${from}T00:00:00+07:00`),b=new Date(`${to}T00:00:00+07:00`);for(let n=+a;n<=+b&&points.length<93;n+=86400000){const date=jakartaDate(new Date(n));points.push(values.get(date)||{date,activities:0,pics:0})}return points},[data,from,to])
 const max=Math.max(1,...daily.map(d=>Number(d.activities)))
 const points=daily.map((d,i)=>`${30+i*640/Math.max(daily.length-1,1)},${170-Number(d.activities)/max*140}`).join(' ')
 const features=(data?.features||[]).filter(f=>Number(f.activities)>0)
 const total=features.reduce((sum,f)=>sum+Number(f.activities),0)
 let position=0;const gradient=features.map((f,i)=>{const start=position;position+=Number(f.activities)/Math.max(total,1)*100;return `${colors[i%colors.length]} ${start}% ${position}%`}).join(',')||'#edf0f5 0% 100%'
 const pics=[...(data?.pics||[])].sort((a,b)=>Number(b[sort]||0)-Number(a[sort]||0)||a.pic.localeCompare(b.pic))
 const exportCsv=()=>{
  const escape=v=>{const text=String(v??'');return `"${(/^[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')}"`}
  const content=[['PIC','Sesi','Hari aktif','Aktivitas','Upload tarikan','Update langsung','Ekspor laporan','Detik aktif estimasi','Terakhir aktif'],...pics.map(p=>[p.pic,p.sessions,p.days,p.activities,p.uploads,p.updates,p.reports,p.active_seconds,p.last_seen])].map(row=>row.map(escape).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\uFEFF',content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`aktivitas-pic-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url)
 }
 return <div className="analytics-page">
  <div className="analytics-toolbar"><div><span className="analytics-eyebrow">TEAM ACTIVITY</span><h2>Penggunaan SAPA oleh PIC</h2><p>Pantau frekuensi penggunaan dan fitur yang dipakai tim.</p></div><div className="analytics-actions"><button onClick={()=>setCustom(!custom)} className="admin-button admin-button-secondary" aria-expanded={custom}><SlidersHorizontal size={15}/>Atur tampilan</button><button className="admin-button admin-button-secondary" disabled={!data} onClick={exportCsv}><Download size={15}/>Ekspor CSV</button><button className="admin-icon-button" aria-label="Muat ulang statistik" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={17}/></button></div></div>
  <div className="analytics-filters"><label>Dari<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Sampai<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>PIC<select value={pic} onChange={e=>setPic(e.target.value)}><option value="">Semua PIC</option>{roster.map(name=><option key={name}>{name}</option>)}</select></label><label>Fitur<select value={feature} onChange={e=>setFeature(e.target.value)}><option value="">Semua fitur</option>{Object.entries(ACTIVITY_FEATURES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><div className="analytics-presets">{[1,7,30].map(days=><button key={days} onClick={()=>{setFrom(jakartaDate(new Date(Date.now()-(days-1)*86400000)));setTo(today)}}>{days===1?'Hari ini':`${days} hari`}</button>)}</div></div>
  {custom&&<div className="analytics-custom">{Object.keys(defaults).map(key=><label key={key}><input type="checkbox" checked={!!widgets[key]} onChange={e=>setWidgets(w=>({...w,[key]:e.target.checked}))}/>{{trend:'Tren harian',features:'Distribusi fitur',hours:'Jam penggunaan',pics:'Perbandingan PIC',recent:'Aktivitas terbaru'}[key]}</label>)}</div>}
  {error&&<div className="admin-alert admin-alert-error" role="alert">{error} Data yang tampil mungkin berasal dari pembaruan sebelumnya.</div>}
  <p className="analytics-meta" role="status">{loading?'Memuat statistik…':`Diperbarui ${dateText(updated)} WIB · otomatis setiap 60 detik`}. Pencatatan mulai {dateText(data?.trackingSince)}. Rentang maksimal 93 hari.</p>
  <div className="analytics-kpis">{[
   ['PIC aktif',stats.activePics,Users,`${roster.length} PIC terdaftar`],['Sesi website',stats.sessions,Activity,'Sesi per tab / PIC'],['Upload tarikan',actionCount('tarik_upload'),FileSpreadsheet,'Upload CSV berhasil'],['Hasil laporan',actionCount('report_copy','report_export'),BarChart3,'Salin atau unduh gambar'],['Waktu aktif',minutes(stats.activeSeconds),Clock3,'Estimasi tab fokus dan digunakan']
  ].map(([label,value,Icon,hint])=><section key={label}><div><span>{label}</span><Icon size={18}/></div><strong>{typeof value==='string'?value:number(value)}</strong><small>{hint}</small></section>)}</div>
  {!loading&&data&&!data.trackingSince&&<div className="analytics-notice">Belum ada aktivitas tercatat. Data akan terisi saat PIC memakai website versi terbaru; riwayat sebelum fitur ini tidak direkonstruksi.</div>}
  <div className="analytics-grid">
   {widgets.trend&&<section className="analytics-card analytics-wide"><header><h3>Tren aktivitas harian</h3><span>{number(stats.activities)} aktivitas</span></header><div className="analytics-chart"><svg viewBox="0 0 700 205" role="img" aria-label="Grafik jumlah aktivitas per hari WIB">{[0,1,2,3].map(i=><g key={i}><line x1="30" x2="670" y1={30+i*140/3} y2={30+i*140/3} stroke="#e9edf3"/><text x="2" y={34+i*140/3} fontSize="9" fill="#8a94a6">{Math.round(max*(1-i/3))}</text></g>)}{daily.length>0&&<><polygon points={`30,170 ${points} ${daily.length>1?670:30},170`} fill="#6b57df12"/><polyline points={points} fill="none" stroke="#6851d8" strokeWidth="2.5"/>{daily.map((d,i)=><circle key={d.date} cx={30+i*640/Math.max(daily.length-1,1)} cy={170-Number(d.activities)/max*140} r="3" fill="#6851d8"><title>{d.date}: {d.activities} aktivitas · {d.pics} PIC</title></circle>)}</>}<text x="30" y="195" fontSize="11" fill="#788599">{from}</text><text x="670" y="195" textAnchor="end" fontSize="11" fill="#788599">{to}</text></svg></div><details><summary>Lihat angka harian</summary><div className="analytics-table-wrap"><table><thead><tr><th>Tanggal WIB</th><th>Aktivitas</th><th>PIC aktif</th></tr></thead><tbody>{daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.activities}</td><td>{d.pics}</td></tr>)}</tbody></table></div></details></section>}
   {widgets.features&&<section className="analytics-card"><header><h3>Fitur yang digunakan</h3><span>Aktivitas</span></header><div className="analytics-donut-row"><div className="analytics-donut" style={{background:`conic-gradient(${gradient})`}}><div><strong>{number(total)}</strong><small>Total</small></div></div><div className="analytics-legend">{features.map((f,i)=><button key={f.feature} onClick={()=>setFeature(f.feature)}><i style={{background:colors[i%colors.length]}}/><span>{ACTIVITY_FEATURES[f.feature]||f.feature}</span><strong>{number(f.activities)}</strong></button>)}{!features.length&&<p>Belum ada data pada filter ini.</p>}</div></div></section>}
   {widgets.hours&&<section className="analytics-card analytics-wide"><header><h3>Jam penggunaan (WIB)</h3><span>Frekuensi aktivitas</span></header><div className="analytics-hours">{Array.from({length:24},(_,hour)=>{const value=Number(data?.hours?.find(h=>Number(h.hour)===hour)?.count||0);const maximum=Math.max(1,...(data?.hours||[]).map(h=>Number(h.count)));return <div key={hour} title={`${hour}:00 · ${value} aktivitas`}><i style={{height:`${6+value/maximum*72}px`,opacity:value?1:.25}}/><span>{hour.toString().padStart(2,'0')}</span></div>})}</div></section>}
   <section className="analytics-card"><header><h3>Rincian penggunaan fitur</h3><ArrowUpRight size={17}/></header><div className="analytics-feature-stats">{[['Tarikan disalin','tarik_copy'],['Update Langsung','tarik_update'],['Upload laporan','report_upload'],['Draf POD dibuka','pod_open'],['Ceklis Hasil Kerja','work_check']].map(([label,action])=><div key={action}><span>{label}</span><strong>{number(actionCount(action))}</strong></div>)}</div><p className="analytics-meta">Angka menunjukkan tindakan sukses, bukan jumlah pesanan selesai atau pesan terkirim.</p></section>
  </div>
  {widgets.pics&&<section className="analytics-card"><header><div><h3>Perbandingan aktivitas PIC</h3><p>PIC tanpa aktivitas tetap ditampilkan.</p></div><label>Urutkan <select value={sort} onChange={e=>setSort(e.target.value)}>{[['activities','Aktivitas'],['sessions','Sesi'],['uploads','Upload tarikan'],['reports','Ekspor laporan'],['active_seconds','Waktu aktif']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></header><div className="analytics-table-wrap"><table><thead><tr>{['PIC','Sesi','Hari aktif','Aktivitas','Tarik Data','Update langsung','Laporan','Aktif (estimasi)','Terakhir terlihat'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{pics.map(p=><tr key={p.pic}><td><button className="analytics-pic" onClick={()=>setPic(p.pic)}>{p.pic}</button></td><td>{number(p.sessions)}</td><td>{number(p.days)}</td><td><div className="analytics-rank"><span>{number(p.activities)}</span><i style={{width:`${Number(p.activities)/Math.max(1,...pics.map(p=>Number(p.activities)))*90}px`}}/></div></td><td>{number(p.uploads)}</td><td>{number(p.updates)}</td><td>{number(p.reports)}</td><td>{minutes(p.active_seconds)}</td><td>{dateText(p.last_seen)}</td></tr>)}</tbody></table></div></section>}
  {widgets.recent&&<section className="analytics-card"><header><h3>Aktivitas terbaru</h3><span>Maksimal 50 aktivitas pada filter ini</span></header><div className="analytics-feed">{(data?.recent||[]).map((event,i)=><div key={`${event.created_at}:${i}`}><span className="analytics-feed-dot"/><strong>{event.pic}</strong><span>{ACTIVITY_ACTIONS[event.action]||event.action}</span><small>{ACTIVITY_FEATURES[event.feature]}</small><time>{dateText(event.created_at)}</time></div>)}{!data?.recent?.length&&<p>Belum ada aktivitas.</p>}</div></section>}
  <p className="analytics-meta">Aktivitas berdasarkan profil PIC yang dipilih pengguna, bukan autentikasi personal. Waktu aktif merupakan estimasi tab fokus dengan interaksi dalam 2 menit terakhir dan dapat terhitung dari beberapa tab/perangkat. Tidak menyimpan isi CSV, pesan, nomor telepon, atau data pelanggan.</p>
 </div>
}
