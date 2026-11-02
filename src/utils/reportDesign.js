export const REPORT_DESIGN = { title:'Hasil Laporan Follow Up', theme:'blue', showTitle:true, showDate:true, period:'Siang', showPeriod:true, showSummary:true, showDetail:true, showTotals:true, footer:'', fontSize:11, grid:false, showZero:false }
export function cleanReportDesign(value) {
 if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('Desain tidak valid.')
 const result={...REPORT_DESIGN}
 for(const key of Object.keys(result))if(Object.hasOwn(value,key)){
 const v=value[key]
 if(typeof REPORT_DESIGN[key]==='boolean'){if(typeof v!=='boolean')throw new Error('Pilihan tampilan tidak valid.');result[key]=v}
 else if(key==='fontSize'){if(![10,11,12,14].includes(v))throw new Error('Ukuran font tidak valid.');result[key]=v}
 else {if(typeof v!=='string'||v.length>200)throw new Error('Teks desain maksimal 200 karakter.');result[key]=v}
 }
 if(!['blue','green','slate','minimal'].includes(result.theme)||!['Siang','Sore','Malam'].includes(result.period))throw new Error('Tema atau waktu laporan tidak valid.')
 if(!result.showSummary&&!result.showDetail)throw new Error('Tampilkan setidaknya satu tabel.')
 return result
}
