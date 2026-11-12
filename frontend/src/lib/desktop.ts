/** Set by the desktop app's preload script (desktop/preload.js); undefined in a normal browser. */
interface DesktopBridge {
  platform: string
}

declare global {
  interface Window {
    sumtalkDesktop?: DesktopBridge
  }
}

export const desktop: DesktopBridge | null = (typeof window !== 'undefined' && window.sumtalkDesktop) || null

/** Running inside the SumTalk desktop app (Electron) rather than a browser tab. */
export const isDesktop = desktop !== null
