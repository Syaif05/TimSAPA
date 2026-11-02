import { checkConnection } from './popupStatus.js'

const title = document.getElementById('connection-title')
const description = document.getElementById('connection-description')
const status = document.getElementById('connection-status')
const sapa = document.getElementById('sapa-status')
const whatsapp = document.getElementById('whatsapp-status')
const refreshButton = document.getElementById('refresh-button')
const help = document.getElementById('connection-help')
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
    sapa.textContent = result.sapaCount ? `${result.sapaCount} tab terhubung` : result.sapaTabCount ? 'Perlu dimuat ulang' : 'Tab belum ditemukan'
    whatsapp.textContent = result.waCount ? `${result.waCount} tab ditemukan` : 'Tab belum ditemukan'
    description.textContent = result.ready
      ? result.repaired ? 'Koneksi SAPA dipulihkan. Kembali ke SAPA dan tekan Buka chat.' : 'Koneksi siap. Tekan Buka chat di SAPA untuk memakai tab WhatsApp Web yang sudah ada.'
      : !result.sapaTabCount ? 'Buka timsapa.vercel.app pada profil browser ini.'
        : !result.sapaCount ? 'Tab SAPA ditemukan, tetapi penghubung belum aktif. Muat ulang tab SAPA, lalu periksa lagi.'
          : 'Buka dan login WhatsApp Web pada profil browser ini.'
    help.textContent = result.ready ? 'Siap untuk membuka draf chat.'
      : !result.sapaTabCount ? '1. Buka website SAPA. 2. Buka WhatsApp Web. 3. Tekan tombol periksa di bawah.'
        : !result.sapaCount ? '1. Muat ulang tab SAPA. 2. Pastikan izin akses situs untuk ekstensi diaktifkan. 3. Periksa lagi.'
          : 'Buka web.whatsapp.com dan pastikan memakai profil browser yang sama.'
  } catch {
    status.dataset.state = 'waiting'
    title.textContent = 'Koneksi belum dapat diperiksa'
    description.textContent = 'Muat ulang ekstensi, lalu coba periksa kembali.'
    sapa.textContent = 'Belum diketahui'
    whatsapp.textContent = 'Belum diketahui'
    help.textContent = 'Periksa izin situs ekstensi, lalu tekan tombol di bawah.'
  } finally {
    checking = false
    refreshButton.disabled = false
  }
}

refreshButton.addEventListener('click', refresh)
refresh()
