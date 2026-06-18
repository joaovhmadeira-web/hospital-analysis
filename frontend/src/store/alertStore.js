import { create } from 'zustand'
import { alertasApi } from '../services/api'

export const useAlertStore = create((set) => ({
  alertas:    [],
  wsStatus:   'disconnected',  // 'connected' | 'disconnected' | 'error'
  setAlertas: (alertas)  => set({ alertas }),
  setWsStatus:(wsStatus) => set({ wsStatus }),

  // Dispensa um alerta (qualquer severidade, inclusive crítico).
  // Remove localmente já (feedback imediato) e persiste no backend.
  // O próximo tick do WebSocket reflete o estado global.
  dispensarAlerta: (id) => {
    set((s) => ({ alertas: s.alertas.filter((a) => a.id !== id) }))
    alertasApi.dispensar(id).catch(() => {})
  },
}))
