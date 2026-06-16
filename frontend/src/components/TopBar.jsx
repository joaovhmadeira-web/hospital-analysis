import { useState, useEffect } from 'react'
import { Bell, Wifi, WifiOff, Clock } from 'lucide-react'
import { useAlertStore } from '../store/alertStore'
import AlertPanel from './AlertPanel'

export default function TopBar({ titulo }) {
  const { alertas, wsStatus } = useAlertStore()
  const [painelAberto, setPainelAberto] = useState(false)
  const [horaAtual, setHoraAtual] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const nCriticos = alertas.filter(a => a.tipo === 'critico').length
  const nTotal    = alertas.length

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 h-14">
        {/* Título da página */}
        <h1 className="text-base font-semibold text-hospital-navy">{titulo}</h1>

        <div className="flex items-center gap-4">
          {/* Relógio */}
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <Clock className="w-4 h-4" />
            <span className="font-mono">
              {horaAtual.toLocaleTimeString('pt-BR')}
            </span>
          </div>

          {/* Status WebSocket */}
          <div className="flex items-center gap-1.5 text-xs">
            {wsStatus === 'connected' ? (
              <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600">Ao vivo</span></>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400">Reconectando…</span></>
            )}
          </div>

          {/* Sino de alertas */}
          <div className="relative">
            <button
              onClick={() => setPainelAberto(!painelAberto)}
              className={`relative p-2 rounded-lg transition-colors ${
                nCriticos > 0
                  ? 'bg-red-50 text-red-600 alert-pulse'
                  : nTotal > 0
                  ? 'bg-amber-50 text-amber-600'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Bell className="w-5 h-5" />
              {nTotal > 0 && (
                <span className={`absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold rounded-full flex items-center justify-center text-white ${
                  nCriticos > 0 ? 'bg-red-600' : 'bg-amber-500'
                }`}>
                  {nTotal > 9 ? '9+' : nTotal}
                </span>
              )}
            </button>

            {painelAberto && (
              <AlertPanel alertas={alertas} onFechar={() => setPainelAberto(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Barra de alerta crítico ativo */}
      {nCriticos > 0 && (
        <div className="bg-red-600 text-white text-xs font-medium px-6 py-1.5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
          {nCriticos} alerta(s) crítico(s) ativo(s) — verifique o painel de alertas
        </div>
      )}
    </header>
  )
}
