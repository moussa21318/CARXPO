export const APP_SLUG = 'carxpo'
export const APP_TITLE = 'CARXPO'

export function storageKey(key: string) {
  return `${APP_SLUG}_${key}`
}
