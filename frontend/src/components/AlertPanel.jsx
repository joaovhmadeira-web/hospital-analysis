import { useEffect, useRef } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

const ICONE = {
  critico: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
  aviso:   <AlertCircle  className="w-4 h-4 text-amber-500 shrink-0" />,
  info:    <Info         className="w-4 h-4 text-blue-500 shrink-0" />,
}

const BORDA = {
  critico: 'border-l-4 border-red-500 bg-red-50',
  aviso:   'border-l-4 border-amber-500 bg-amber-50',
  info:    'border-l-4 border-blue-500 bg-blue-50',
}

export default function AlertPanel({ alertas, onFechar, onDispensar }) {
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onFechar()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onFechar])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-hospital-navy">
        <span className="text-sm font-semibold text-white">Alertas Operacionais</span>
        <button onClick={onFechar} className="text-blue-300 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {alertas.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Nenhum alerta ativo no momento.
          </p>
        ) : (
          alertas.map((a) => (
            <div key={a.id} className={`flex gap-3 p-3 ${BORDA[a.tipo] ?? BORDA.info}`}>
              {ICONE[a.tipo] ?? ICONE.info}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-600">{a.categoria}</p>
                <p className="text-xs text-slate-700 mt-0.5 leading-snug">{a.mensagem}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString('pt-BR') : ''}
                </p>
              </div>
              <button
                onClick={() => onDispensar?.(a.id)}
                title="Dispensar alerta"
                className="self-start text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-right">
        Atualizado a cada 20 s via WebSocket
      </div>
    </div>
  )
}
