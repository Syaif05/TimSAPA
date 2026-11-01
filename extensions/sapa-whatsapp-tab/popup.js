import { checkConnection } from './popupStatus.js'

const title = document.getElementById('connection-title')
const description = document.getElementById('connection-description')
const status = document.getElementById('connection-status')
const sapa = document.getElementById('sapa-status')
const whatsapp = document.getElementById('whatsapp-status')
const refreshButton = document.getElementById('refresh-button')
let checking = false

async function refresh() {
  if (checking) return
  checking = true
  refreshButton.disabled = true
  status.dataset.state = 'checking'
  title.textContent = 'Memeriksa koneksi…'
  try {
    const result = await checkConnection(chrome)
    status.dataset.state = result.ready ? 'ready' : 'waiting'
    title.textContent = result.ready ? 'Siap digunakan' : 'Belum terhubung penuh'
    sapa.textContent = result.sapaCount ? `${result.sapaCount} tab terhubung` : 'Tab SAPA belum terdeteksi'
    whatsapp.textContent = result.waCount ? `${result.waCount} tab ditemukan` : 'Tab belum ditemukan'
    description.textContent = result.ready
      ? 'Buka chat dari SAPA untuk memakai tab WhatsApp Web yang sudah ada. Pengiriman pesan tetap manual.'
      : 'Buka SAPA dan WhatsApp Web di profil Chrome yang sama. Muat ulang SAPA jika tabnya sudah terbuka.'
  } catch {
    status.dataset.state = 'waiting'
    title.textContent = 'Koneksi belum dapat diperiksa'
    description.textContent = 'Muat ulang ekstensi, lalu coba periksa kembali.'
    sapa.textContent = 'Belum diketahui'
    whatsapp.textContent = 'Belum diketahui'
  } finally {
    checking = false
    refreshButton.disabled = false
  }
}

refreshButton.addEventListener('click', refresh)
refresh()
