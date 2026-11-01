import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'

function HelpDialog({ title, children, onClose, id }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  const close = () => { ref.current.close(); onClose() }
  return createPortal(
    <dialog ref={ref} className="help-dialog" aria-labelledby={id} onClose={onClose} onCancel={e => { e.preventDefault(); close() }} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="help-content">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 id={id} className="text-base font-semibold">{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Tutup bantuan"><X size={18} /></button>
        </div>
        <div className="text-sm leading-7 text-zinc-500 dark:text-zinc-400 space-y-3">{children}</div>
      </div>
    </dialog>, document.body,
  )
}

export function InfoButton({ title = 'Informasi', children, icon: Icon = Info }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <>
    <button type="button" className="icon-button help-trigger" aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon size={16} /></button>
    {open && <HelpDialog title={title} id={id} onClose={() => setOpen(false)}>{children}</HelpDialog>}
  </>
}
