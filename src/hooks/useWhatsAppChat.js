import { useEffect, useRef, useState } from 'react'
import { createWhatsAppWebUrl, isValidIndonesianPhone } from '../utils/phoneUtils.js'
import { copyTableImageToClipboard } from '../utils/imageGenerator.js'
import { requestWhatsAppTab } from '../utils/whatsappBridge.js'
import { openChatWithImage } from '../utils/whatsappOpen.js'

export function useWhatsAppChat({ phone, message, tableRef, tableSettings, showToast, onOpened }) {
  const busy = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [isOpeningWhatsApp, setIsOpening] = useState(false)
  const handleOpenWhatsApp = async () => {
    if (busy.current) return
    if (!isValidIndonesianPhone(phone)) {
      showToast('Isi nomor WhatsApp Indonesia yang valid terlebih dahulu.', 'error')
      return
    }
    busy.current = true
    setIsOpening(true)
    try {
      // Initiate clipboard write during the click, before rendering or changing focus.
      const table = tableRef.current
      if (!mounted.current || tableRef.current !== table) return
      const { result, image } = await openChatWithImage({
        copyImage: () => copyTableImageToClipboard(table, {
          isCurrent: () => mounted.current && tableRef.current === table,
          backgroundColor: tableSettings?.colors?.tableBg,
          pixelRatio: tableSettings?.exportScale || 2.5,
        }),
        openTab: () => requestWhatsAppTab('SAPA_WA_OPEN', createWhatsAppWebUrl(phone, message)),
      })
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      if (!mounted.current || tableRef.current !== table) { showToast('Chat dibuka, tetapi data pesanan berubah. Periksa draf sebelum mengirim.', 'info'); return }
      onOpened?.()
      showToast(image.success
        ? 'Tab WhatsApp digunakan kembali. Gambar tersalin; tempel dengan Cmd/Ctrl+V, lalu kirim di WhatsApp.'
        : image.pending ? 'Chat dibuka. Gambar masih disiapkan; jika belum bisa ditempel, kembali ke SAPA dan klik “Salin gambar”.'
          : 'Chat dibuka, tetapi gambar belum tersalin. Kembali ke SAPA dan klik “Salin gambar”, atau unduh PNG.', image.success ? 'success' : 'info')
    } catch {
      showToast('Gagal menyiapkan chat. Coba kembali atau salin pesan secara manual.', 'error')
    } finally {
      busy.current = false
      setIsOpening(false)
    }
  }
  return { handleOpenWhatsApp, isOpeningWhatsApp }
}
