import { useSyncExternalStore } from 'react'

/** Tiny observable state container for app-wide singletons (sync engine, recorder session...). */
export class Store<T extends object> {
  private listeners = new Set<() => void>()

  constructor(private state: T) {}

  get = (): T => this.state

  set(patch: Partial<T>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get)
}
