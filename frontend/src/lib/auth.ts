import { NetworkError, SIGNED_OUT_EVENT, api } from '../api/client'
import type { AuthState } from '../api/types'
import { kickSync } from '../offline/sync'
import { Store } from './store'

/**
 * checking: asking the server. off: the server has no sign-in. unknown: the server could not be reached, so the
 * app opens anyway and recordings stay on this device until it is back.
 */
export type AuthStatus = 'checking' | 'off' | 'signed-in' | 'signed-out' | 'unknown'

export const authStore = new Store<{ status: AuthStatus; username: string | null }>({ status: 'checking', username: null })

function apply(state: AuthState) {
  if (!state.enabled) authStore.set({ status: 'off', username: null })
  else authStore.set({ status: state.signed_in ? 'signed-in' : 'signed-out', username: state.username })
}

export async function refreshAuth(): Promise<void> {
  try {
    apply(await api.authSession())
  } catch (error) {
    // Offline or the server is down: don't lock the recorder out. A later API call answers 401 if needed.
    if (error instanceof NetworkError || authStore.get().status === 'checking') authStore.set({ status: 'unknown' })
  }
}

export async function signIn(username: string, password: string): Promise<void> {
  apply(await api.login(username, password))
  kickSync() // audio recorded while signed out can upload now
}

export async function signOut(): Promise<void> {
  try {
    await api.logout()
  } finally {
    authStore.set({ status: 'signed-out', username: null })
  }
}

let started = false

export function startAuth(): void {
  if (started) return
  started = true
  window.addEventListener(SIGNED_OUT_EVENT, () => {
    if (authStore.get().status !== 'off') authStore.set({ status: 'signed-out', username: null })
  })
  // Coming back online (or to the tab) after an unreachable server: ask again.
  const recheck = () => {
    if (authStore.get().status === 'unknown') void refreshAuth()
  }
  window.addEventListener('online', recheck)
  window.addEventListener('focus', recheck)
  void refreshAuth()
}
