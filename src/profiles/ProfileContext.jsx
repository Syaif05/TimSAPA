import React, { createContext, useContext, useEffect, useId, useSyncExternalStore } from 'react'
const ProfileContext = createContext(null)
export function ProfileProvider({ store, children }) { return <ProfileContext.Provider value={store}>{children}</ProfileContext.Provider> }
export function usePicProfile() {
  const store = useContext(ProfileContext)
  if (!store) throw new Error('Pilih PIC terlebih dahulu.')
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { ...state, name: store.name, storage: store.storage, set: store.set, flush: store.flush, refresh: store.refresh, resolve: store.resolve }
}
export function usePicSetting(key, fallback) {
  const profile = usePicProfile()
  return [profile.values[key] ?? fallback, update => profile.set(key, update)]
}

// Keep a form's revision baseline stable until Save, so another device triggers a conflict.
export function usePicEditing(dirty = false) {
  const store = useContext(ProfileContext)
  const id = useId()
  useEffect(() => store.beginEdit(), [store])
  useEffect(() => { store.setFormDirty(id, dirty); return () => store.setFormDirty(id, false) }, [store, id, dirty])
}
