import { toBlob, toPng } from 'html-to-image'

// Local fonts need no remote stylesheet scan, which may be blocked by CORS.
const skipRemoteFonts = (node) => !getComputedStyle(node).fontFamily.includes('Plus Jakarta Sans')

/**
 * Konversi elemen DOM tabel menjadi PNG Blob dan salin ke Clipboard macOS
 * @param {HTMLElement} node
 * @param {object} options
 * @returns {Promise<{success: boolean, blob?: Blob, dataUrl?: string, error?: string}>}
 */
export async function copyTableImageToClipboard(node, options = {}) {
  if (!node) {
    return { success: false, error: 'Elemen tabel tidak ditemukan' }
  }

  const bgColor = options.backgroundColor || node.style.backgroundColor || '#ffffff'
  const pixelRatio = options.pixelRatio || 2.5

  try {
    if (!navigator.clipboard?.write || !window.ClipboardItem) {
      return { success: false, error: 'Penyalinan gambar tidak didukung. Gunakan Perbesar / Unduh PNG.' }
    }
    // Initiate write during the click, before asynchronous image rendering.
    const blobPromise = toBlob(node, {
      quality: 1.0,
      skipFonts: skipRemoteFonts(node),
      pixelRatio,
      backgroundColor: bgColor,
      cacheBust: true,
      style: { transform: 'none', margin: '0' },
    }).then((blob) => {
      if (options.isCurrent && !options.isCurrent()) throw new Error('Data pesanan berubah. Salin kembali gambar terbaru.')
      if (!blob) throw new Error('Gagal menghasilkan gambar tabel')
      return blob
    })
    blobPromise.catch(() => {})
    const item = new window.ClipboardItem({ 'image/png': blobPromise })
    await navigator.clipboard.write([item])
    return { success: true, blob: await blobPromise }
  } catch (err) {
    console.error('Error saat menyalin gambar ke clipboard:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Generate Data URL PNG untuk preview
 * @param {HTMLElement} node
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function generateTableDataUrl(node, options = {}) {
  if (!node) return ''
  const bgColor = options.backgroundColor || node.style?.backgroundColor || '#ffffff'
  const pixelRatio = options.pixelRatio || 2
  return await toPng(node, {
    quality: 0.95,
    skipFonts: skipRemoteFonts(node),
    pixelRatio,
    backgroundColor: bgColor,
  })
}

/**
 * Download tabel sebagai file PNG
 * @param {HTMLElement} node
 * @param {string} fileName
 * @param {object} options
 */
export async function downloadTableImage(node, fileName = 'tabel-kendala-ac.png', options = {}) {
  if (!node) return
  const bgColor = options.backgroundColor || node.style?.backgroundColor || '#ffffff'
  const pixelRatio = options.pixelRatio || 2.5
  const dataUrl = await toPng(node, { pixelRatio, backgroundColor: bgColor, skipFonts: skipRemoteFonts(node) })
  const link = document.createElement('a')
  link.download = fileName
  link.href = dataUrl
  link.click()
}
