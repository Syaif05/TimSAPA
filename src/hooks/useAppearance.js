import { useEffect } from 'react'
import { appearanceVariables } from '../utils/appearance'
export function useAppearance(appearance, dark) {
  useEffect(() => {
    const variables = appearanceVariables(appearance, dark)
    for (const [key, value] of Object.entries(variables)) document.documentElement.style.setProperty(key, value)
    return () => { for (const key of Object.keys(variables)) document.documentElement.style.removeProperty(key) }
  }, [appearance, dark])
}
