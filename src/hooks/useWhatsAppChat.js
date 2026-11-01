import { useEffect, useRef, useState } from 'react'
import { createWhatsAppWebUrl, isValidIndonesianPhone } from '../utils/phoneUtils'
import { copyTableImageToClipboard } from '../utils/imageGenerator'
import { requestWhatsAppTab } from '../utils/whatsappBridge'

export function useWhatsAppChat({ phone, message, tableRef, tableSettings, showToast, onOpened, contactsReady = true }) {
  const busy = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [isOpeningWhatsApp, setIsOpening] = useState(false)
  const handleOpenWhatsApp = async () => {
    if (busy.current) return
    if (!contactsReady) { showToast('Sumber kontak spreadsheet belum siap. Tunggu sinkronisasi kontak.', 'info'); return }
    if (!isValidIndonesianPhone(phone)) {
      showToast('Isi nomor WhatsApp Indonesia yang valid terlebih dahulu.', 'error')
      return
    }
    busy.current = true
    setIsOpening(true)
    try {
      // Initiate clipboard write during the click, before rendering or changing focus.
      const table = tableRef.current
      const imagePromise = copyTableImageToClipboard(table, {
        isCurrent: () => mounted.current && tableRef.current === table,
        backgroundColor: tableSettings?.colors?.tableBg,
        pixelRatio: tableSettings?.exportScale || 2.5,
      })
      const image = await imagePromise
      if (!mounted.current || tableRef.current !== table) { showToast('Data pesanan berubah. Periksa draf terbaru sebelum membuka chat.', 'info'); return }
      const result = await requestWhatsAppTab('SAPA_WA_OPEN', createWhatsAppWebUrl(phone, message))
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      onOpened?.()
      showToast(image.success
        ? 'Tab WhatsApp digunakan kembali. Gambar tersalin; tempel dengan Cmd/Ctrl+V, lalu kirim di WhatsApp.'
        : 'Chat dibuka, tetapi gambar belum tersalin. Kembali ke SAPA dan klik “Salin Gambar Tabel”, atau unduh PNG.', image.success ? 'success' : 'info')
    } catch {
      showToast('Gagal menyiapkan chat. Coba kembali atau salin pesan secara manual.', 'error')
    } finally {
      busy.current = false
      setIsOpening(false)
    }
  }
  return { handleOpenWhatsApp, isOpeningWhatsApp }
}
