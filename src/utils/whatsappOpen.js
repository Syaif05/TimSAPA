// Start the clipboard operation in the click gesture, then open the existing tab
// without waiting for image rendering to finish.
export async function openChatWithImage({ copyImage, openTab, imageWaitMs = 2000 }) {
  let imagePromise
  try { imagePromise = Promise.resolve(copyImage()).catch(error => ({ success: false, error: error.message })) }
  catch (error) { imagePromise = Promise.resolve({ success: false, error: error.message }) }
  const result = await openTab()
  if (!result.ok) return { result, image: { success: false } }
  let timer
  const image = await Promise.race([
    imagePromise,
    new Promise(resolve => { timer = setTimeout(() => resolve({ success: false, pending: true }), imageWaitMs) }),
  ])
  clearTimeout(timer)
  return { result, image }
}
