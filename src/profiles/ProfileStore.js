// Shared settings use per-key revisions. A stale device must explicitly resolve conflicts.
export class ProfileStore {
  constructor({ name, records = [], defaults = {}, request, storage, debounce = 650 }) {
    this.name = name; this.request = request; this.storage = storage; this.debounce = debounce
    this.records = Object.fromEntries(records.map(r => [r.setting_key, r]))
    this.defaults = defaults; this.pending = {}; this.listeners = new Set(); this.timer = null; this.working = null; this.disposed = false; this.editors = 0; this.dirtyForms = new Set(); this.formResetKey = 0
    try {
      const saved = JSON.parse(storage?.getItem('shared_drafts') || '{}')
      if (saved && !Array.isArray(saved) && typeof saved === 'object') this.pending = Object.fromEntries(Object.entries(saved).filter(([, draft]) => draft && Object.hasOwn(draft, 'value') && Number.isSafeInteger(draft.expectedRevision) && draft.expectedRevision >= 0))
    } catch {}
    this.state = this.snapshot('synced'); this.emit(this.pendingCount ? 'pending' : 'synced')
    if (this.pendingCount) this.schedule()
  }
  get pendingCount() { return Object.keys(this.pending).length }
  snapshot(phase, error = '', conflict = null) {
    const values = { ...this.defaults }
    for (const [key, record] of Object.entries(this.records)) values[key] = record.value
    for (const [key, draft] of Object.entries(this.pending)) values[key] = draft.value
    return { values, phase, error, conflict, pendingCount: this.pendingCount, formResetKey: this.formResetKey }
  }
  getSnapshot = () => this.state
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  emit(phase, error, conflict) { this.state = this.snapshot(phase, error, conflict); this.listeners.forEach(listener => listener()) }
  persist() {
    try { this.storage?.setItem('shared_drafts', JSON.stringify(this.pending)) } catch { /* in-memory draft remains available */ }
  }
  set = (key, update) => {
    const value = typeof update === 'function' ? update(this.state.values[key]) : update
    if (JSON.stringify(value) === JSON.stringify(this.state.values[key])) return
    this.pending[key] = { value, expectedRevision: this.pending[key]?.expectedRevision ?? this.records[key]?.revision ?? 0 }
    this.persist(); this.emit(this.state.conflict ? 'conflict' : 'pending', this.state.error, this.state.conflict); this.schedule()
  }
  schedule() { clearTimeout(this.timer); if (!this.disposed && !this.state.conflict) this.timer = setTimeout(() => this.flush().catch(() => {}), this.debounce) }
  flush = () => {
    clearTimeout(this.timer)
    if (this.working) return this.working
    if (this.state.conflict) return Promise.reject(new Error('Selesaikan perbedaan pengaturan sebelum berpindah PIC.'))
    this.working = this.save().finally(() => { this.working = null })
    return this.working
  }
  async save() {
    while (this.pendingCount) {
      const key = Object.keys(this.pending)[0]; const draft = this.pending[key]
      this.emit('saving')
      try {
        const { record } = await this.request(this.name, { method: 'PATCH', body: { key, ...draft } })
        this.records[key] = record
        if (this.pending[key] === draft) delete this.pending[key]
        else this.pending[key].expectedRevision = record.revision
        this.persist()
      } catch (error) {
        if (error.status === 409) this.emit('conflict', error.message, { key, current: error.current })
        else this.emit('error', error.message || 'Pengaturan belum tersimpan. Coba lagi.')
        throw error
      }
    }
    this.emit('synced')
  }
  resolve = keepMine => {
    const conflict = this.state.conflict
    if (!conflict) return
    const { key, current } = conflict
    if (current) this.records[key] = current
    else delete this.records[key]
    if (keepMine) this.pending[key].expectedRevision = current?.revision || 0
    else { delete this.pending[key]; this.formResetKey++ }
    this.persist(); this.emit(this.pendingCount ? 'pending' : 'synced'); if (this.pendingCount) this.schedule()
  }
  refresh = async () => {
    if (this.working || this.state.conflict || this.pendingCount || this.disposed || this.editors) return
    const { records } = await this.request(this.name)
    if (this.working || this.pendingCount || this.disposed) return
    this.records = Object.fromEntries(records.map(r => [r.setting_key, r])); this.emit('synced')
  }
  setFormDirty = (id, dirty) => { if (dirty) this.dirtyForms.add(id); else this.dirtyForms.delete(id) }
  get hasUnsavedForms() { return this.dirtyForms.size > 0 }
  beginEdit = () => { this.editors++; return () => { this.editors-- } }
  dispose() { this.disposed = true; clearTimeout(this.timer); this.listeners.clear() }
}
