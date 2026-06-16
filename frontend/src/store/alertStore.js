import { create } from 'zustand'

export const useAlertStore = create((set) => ({
  alertas:    [],
  wsStatus:   'disconnected',  // 'connected' | 'disconnected' | 'error'
  setAlertas: (alertas)  => set({ alertas }),
  setWsStatus:(wsStatus) => set({ wsStatus }),
}))
