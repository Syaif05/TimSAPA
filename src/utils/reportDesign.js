export const REPORT_DESIGN = { title:'Hasil Laporan Follow Up', theme:'blue', showTitle:true, showDate:true, period:'Pagi', periodAutomatic:true, showPeriod:true, showSummary:true, showDetail:true, showTotals:true, footer:'', fontSize:11, grid:false, showZero:false }
export function cleanReportDesign(value) {
 if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Desain tidak valid.')
 const result={...REPORT_DESIGN}
 for(const key of Object.keys(result))if(Object.hasOwn(value,key)){
 const v=value[key]
 if(typeof REPORT_DESIGN[key]==='boolean'){if(typeof v!=='boolean')throw new Error('Pilihan tampilan tidak valid.');result[key]=v}
 else if(key==='fontSize'){if(![10,11,12,14].includes(v))throw new Error('Ukuran font tidak valid.');result[key]=v}
 else {if(typeof v!=='string'||v.length>200)throw new Error('Teks desain maksimal 200 karakter.');result[key]=v}
 }
 if(!['blue','green','slate','minimal'].includes(result.theme)||!['Pagi','Siang','Sore','Malam'].includes(result.period))throw new Error('Tema atau waktu laporan tidak valid.')
 if(!result.showSummary&&!result.showDetail)throw new Error('Tampilkan setidaknya satu tabel.')
 return result
}

// Overnight hours continue the evening reporting period until 07:00 WIB.
export function reportPeriodAt(date = new Date()) {
 const parts = new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Jakarta', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(date)
 const minutes = Number(parts.find(p=>p.type==='hour').value)*60 + Number(parts.find(p=>p.type==='minute').value)
 return minutes >= 420 && minutes <= 840 ? 'Pagi' : minutes > 840 && minutes <= 1080 ? 'Sore' : 'Malam'
}
