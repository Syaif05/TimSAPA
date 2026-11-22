import React, { useRef, useState } from 'react'
import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
import { MessageSquare, Save, Plus, Copy, Trash2, Search, Sparkles, Check, RotateCcw } from 'lucide-react'
import { DEFAULT_TEMPLATES, MAX_TEMPLATES, MAX_TEMPLATE_CONTENT, TEMPLATE_VARIABLES, TEMPLATE_PERIODS, renderTemplate, templateLibraryError, unknownTemplateVariables } from '../utils/templateEngine'

export function TemplateSettings({ templates = DEFAULT_TEMPLATES, activeTemplateKey, onSaveTemplates, showToast }) {
  const { name: picName } = usePicProfile()
  const [library, setLibrary] = useState(() => structuredClone(templates))
  const [selectedKey, setSelectedKey] = useState(() => templates[activeTemplateKey] ? activeTemplateKey : Object.keys(templates)[0])
  const [defaultKey, setDefaultKey] = useState(selectedKey)
  const [search, setSearch] = useState('')
  const [variableSearch, setVariableSearch] = useState('')
  const [variableGroup, setVariableGroup] = useState('Semua')
  const [customName, setCustomName] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const editor = useRef(null)
  const dirty = JSON.stringify(library) !== JSON.stringify(templates) || defaultKey !== activeTemplateKey
  usePicEditing(dirty)
  const selected = library[selectedKey]
  const count = Object.keys(library).length
  const patch = changes => setLibrary(prev => ({...prev,[selectedKey]:{...prev[selectedKey],...changes}}))
  const sampleAc = {
    acName:'AC CONTOH', phone:'6281111111111', cabang:'DC CONTOH', region:'Regional 1', pic:picName, jam:'09.00',
    rows:[
      {kodeToko:'U001',namaToko:'TOKO CONTOH SATU',shipment:'CONTOH-DS-001',source:'DS',sla:'2 Jam',namaKonsumen:'KONSUMEN CONTOH',pic:picName,jam:'09.00',sheetStatus:'Proses',kendala:'Menunggu pengiriman',grouping:'Dalam Pengiriman',kondisiMotor:'BAIK',jumlahPersonil:'3',namaPejabat:'PEJABAT CONTOH',sheetDate:'2026-11-22'},
      {kodeToko:'U002',namaToko:'TOKO CONTOH DUA',shipment:'CONTOH-REG-002',source:'REG',sla:'1 Jam',pic:picName,jam:'10.00',sheetStatus:'Proses'},
    ],
  }
  const add = (duplicate = false) => {
    if (count >= MAX_TEMPLATES) return
    const key = Array.from({length:MAX_TEMPLATES},(_,i)=>`template_${i+1}`).find(k=>!library[k])
    const tpl = duplicate ? {...structuredClone(selected),id:key,name:`${selected.name.slice(0,108)} (salinan)`} : {id:key,name:'Template baru',description:'',period:'auto',customVariables:{},content:'{salam}, Bapak/Ibu {nama_ac}.\n\nMohon bantuan follow up {total_shipment} pesanan pada toko berikut:\n{daftar_nama_toko}\n\nTerima kasih.\n{pic} · {jam_sekarang} WIB'}
    setLibrary(prev=>({...prev,[key]:tpl})); setSelectedKey(key); setSearch(''); setError('')
  }
  const remove = () => {
    if (count <= 1) return
    const next = {...library}; delete next[selectedKey]
    const key = Object.keys(next)[0]
    setLibrary(next); setSelectedKey(key); if(defaultKey===selectedKey)setDefaultKey(key)
  }
  const insert = tag => {
    const field = editor.current
    const start = field?.selectionStart ?? selected.content.length, end = field?.selectionEnd ?? start
    const content = selected.content.slice(0,start)+tag+selected.content.slice(end)
    if(content.length>MAX_TEMPLATE_CONTENT){setError('Isi template maksimal 20.000 karakter.');return}
    patch({content})
    requestAnimationFrame(()=>{field?.focus();field?.setSelectionRange(start+tag.length,start+tag.length)})
  }
  const addCustom = () => {
    const key=customName.trim().replace(/^\{|\}$/g,'').toLowerCase()
    if(!/^[a-z][a-z0-9_]{1,39}$/.test(key)){setError('Nama variabel 2–40 karakter: huruf, angka, dan garis bawah.');return}
    if(TEMPLATE_VARIABLES.some(v=>v.key===key)){setError('Nama ini sudah dipakai variabel otomatis. Gunakan nama khusus lain.');return}
    if(Object.keys(selected.customVariables||{}).length>=10 && !Object.hasOwn(selected.customVariables,key)){setError('Maksimal 10 variabel khusus per template.');return}
    patch({customVariables:{...selected.customVariables,[key]:customValue}});setCustomName('');setCustomValue('');setError('')
  }
  const save = async () => {
    const issue=templateLibraryError(library)
    if(issue){setError(issue);return}
    setBusy(true);setError('')
    try { await onSaveTemplates(library,defaultKey);showToast?.('Semua template tersimpan untuk PIC ini.','success') }
    catch(e){setError(e.message);showToast?.(e.message,'error')}
    finally{setBusy(false)}
  }
  const reset = () => {
    patch({content:DEFAULT_TEMPLATES[selectedKey]?.content || '{salam}, Bapak/Ibu {nama_ac}.\n\n{daftar_toko_dan_shipment}\n\nTerima kasih. {pic}'})
  }
  const variables=TEMPLATE_VARIABLES.filter(v=>(variableGroup==='Semua'||v.group===variableGroup)&&`${v.tag} ${v.description}`.toLowerCase().includes(variableSearch.toLowerCase()))
  const unknown=unknownTemplateVariables(selected?.content,selected?.customVariables)
  if(!selected)return <div className="empty-panel">Template belum tersedia.</div>
  return <div className="template-library-page">
    <header className="template-library-heading"><div><span className="template-eyebrow">PESAN OPERASIONAL · PIC {picName}</span><h1>Template pesan</h1><p>Susun pesan sekali, pilih cepat saat menghubungi AC.</p></div><div className="template-save-actions"><span>{dirty?'Ada perubahan belum disimpan':'Tersimpan'} · {count}/{MAX_TEMPLATES}</span><button className="primary-button" disabled={busy} onClick={save}><Save size={15}/>{busy?'Menyimpan…':'Simpan semua'}</button></div></header>
    {error && <p className="template-error" role="alert">{error}</p>}
    <div className="template-library-layout">
      <aside className="template-library-sidebar"><div className="template-list-heading"><h2>Koleksi template</h2><button className="secondary-button" disabled={count>=MAX_TEMPLATES || busy} onClick={()=>add()} title={count>=MAX_TEMPLATES?'Batas 20 template tercapai':'Tambah template'}><Plus size={14}/>Baru</button></div><label className="search-field"><Search size={14}/><input aria-label="Cari template" placeholder="Cari template…" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="template-list">{Object.entries(library).filter(([,tpl])=>`${tpl.name} ${tpl.description||''}`.toLowerCase().includes(search.toLowerCase())).map(([key,tpl])=><button className={`template-list-item ${key===selectedKey?'selected':''}`} aria-pressed={key===selectedKey} key={key} onClick={()=>{setSelectedKey(key);setError('');setPendingAction(null)}}><MessageSquare size={16}/><span><strong>{tpl.name}</strong><small>{tpl.description || 'Tanpa deskripsi'}</small>{key===defaultKey&&<em><Check size={11}/>Template utama</em>}</span></button>)}</div><p className="template-footnote">Maksimal 20 template per PIC. Koleksi mengikuti PIC di perangkat lain setelah disimpan.</p></aside>
      <section className="template-editor-panel"><div className="template-editor-heading"><h2>Edit template</h2><div><button className="icon-button" disabled={count>=MAX_TEMPLATES || busy} onClick={()=>add(true)} aria-label="Duplikat template" title="Duplikat template"><Copy size={15}/></button><button className="icon-button" onClick={()=>setPendingAction('reset')} aria-label="Reset isi template" title="Reset isi"><RotateCcw size={15}/></button><button className="icon-button danger-icon" disabled={count<=1 || busy} onClick={()=>setPendingAction('delete')} aria-label="Hapus template" title="Hapus template"><Trash2 size={15}/></button></div></div>
        {pendingAction && <div className="template-warning" role="alert"><strong>{pendingAction==='delete'?'Hapus template ini?':'Kembalikan isi bawaan?'}</strong><p>Perubahan diterapkan setelah Simpan semua.</p><div className="template-confirm-actions"><button className="secondary-button" onClick={()=>setPendingAction(null)}>Batal</button><button className="primary-button" onClick={()=>{if(pendingAction==='delete')remove();else reset();setPendingAction(null)}}>{pendingAction==='delete'?'Ya, hapus':'Ya, reset'}</button></div></div>}
        <label className="template-field">Nama template<input value={selected.name} maxLength={120} onChange={e=>patch({name:e.target.value})}/></label>
        <label className="template-field">Deskripsi<input value={selected.description||''} maxLength={500} onChange={e=>patch({description:e.target.value})} placeholder="Kapan template ini digunakan?"/></label>
        <div className="template-options"><label className="template-field">Waktu sapaan<select aria-label="Waktu sapaan" value={selected.period||'auto'} onChange={e=>patch({period:e.target.value})}>{TEMPLATE_PERIODS.map(period=><option key={period} value={period}>{period==='auto'?'Otomatis · WIB':period}</option>)}</select></label><button className={`secondary-button ${defaultKey===selectedKey?'template-default-active':''}`} aria-pressed={defaultKey===selectedKey} onClick={()=>setDefaultKey(selectedKey)}><Check size={14}/>{defaultKey===selectedKey?'Template utama':'Jadikan utama'}</button></div>
        <p className="template-footnote">Otomatis: Pagi 05–10.59 · Siang 11–14.59 · Sore 15–17.59 · Malam 18–04.59 WIB. Pilihan ini mengisi {'{salam}'} dan {'{waktu}'}.</p>
        <label className="template-field template-content-label"><span>Isi pesan <small>{selected.content.length.toLocaleString('id-ID')} / 20.000 karakter</small></span><textarea ref={editor} aria-label="Isi pesan template" rows={13} value={selected.content} maxLength={MAX_TEMPLATE_CONTENT} onChange={e=>patch({content:e.target.value})}/></label>
        {unknown.length>0&&<p className="template-warning" role="status">Variabel belum dikenal: {unknown.map(key=>`{${key}}`).join(', ')}. Tambahkan sebagai variabel khusus atau perbaiki penulisannya.</p>}
        <div className="template-variable-heading"><h3>Variabel otomatis <span>{TEMPLATE_VARIABLES.length}</span></h3><p>Klik untuk menyisipkan di posisi kursor.</p></div>
        <label className="search-field"><Search size={14}/><input aria-label="Cari variabel" value={variableSearch} onChange={e=>setVariableSearch(e.target.value)} placeholder="Cari nama toko, waktu, shipment…"/></label>
        <div className="template-variable-tabs" role="group" aria-label="Kategori variabel">{['Semua',...new Set(TEMPLATE_VARIABLES.map(v=>v.group))].map(group=><button key={group} aria-pressed={variableGroup===group} className={variableGroup===group?'active':''} onClick={()=>setVariableGroup(group)}>{group}</button>)}</div>
        <div className="template-variable-list">{variables.map(v=><button key={v.key} onClick={()=>insert(v.tag)} title={v.description}><code>{v.tag}</code><span>{v.description}</span></button>)}{!variables.length&&<p className="template-footnote">Tidak ada variabel yang cocok.</p>}</div>
        <details className="template-custom-variables"><summary>Variabel khusus · {Object.keys(selected.customVariables||{}).length}/10</summary><p className="template-footnote">Nilai tetap per template, misalnya {'{link_formulir}'}, {'{batas_waktu}'}, atau {'{catatan_tambahan}'}. Nilai kosong akan menghasilkan teks kosong.</p>{Object.entries(selected.customVariables||{}).map(([key,value])=><div className="template-custom-row" key={key}><button onClick={()=>insert(`{${key}}`)}><code>{`{${key}}`}</code></button><input aria-label={`Nilai ${key}`} value={value} maxLength={1000} onChange={e=>patch({customVariables:{...selected.customVariables,[key]:e.target.value}})}/><button className="icon-button" aria-label={`Hapus variabel ${key}`} onClick={()=>{const next={...selected.customVariables};delete next[key];patch({customVariables:next})}}><Trash2 size={14}/></button></div>)}<div className="template-custom-add"><input aria-label="Nama variabel khusus" placeholder="link_formulir" maxLength={40} value={customName} onChange={e=>setCustomName(e.target.value)}/><input aria-label="Nilai variabel khusus" placeholder="Nilai, tautan, atau catatan" maxLength={1000} value={customValue} onChange={e=>setCustomValue(e.target.value)}/><button className="secondary-button" onClick={addCustom}><Plus size={14}/>Tambah</button></div></details>
      </section>
      <aside className="template-preview-panel"><div className="template-editor-heading"><h2><Sparkles size={16}/>Pratinjau pesan</h2><span>Data contoh</span></div><div className="template-preview-message">{renderTemplate(selected.content,sampleAc,{period:selected.period,customVariables:selected.customVariables}) || 'Tulis pesan untuk melihat pratinjau.'}</div><p className="template-footnote">Data toko dan shipment akan mengikuti pesanan aktif AC yang dipilih. Pesanan DONE tidak disertakan.</p></aside>
    </div>
  </div>
}
