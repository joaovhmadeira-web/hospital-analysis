export default function KPICard({ titulo, valor, subtitulo, icone: Icone, cor = 'blue', alerta }) {
  const CORES = {
    blue:  { bg: 'bg-blue-600',   light: 'bg-blue-50',   text: 'text-blue-600'  },
    teal:  { bg: 'bg-teal-600',   light: 'bg-teal-50',   text: 'text-teal-600'  },
    green: { bg: 'bg-green-700',  light: 'bg-green-50',  text: 'text-green-700' },
    amber: { bg: 'bg-amber-600',  light: 'bg-amber-50',  text: 'text-amber-600' },
    red:   { bg: 'bg-red-700',    light: 'bg-red-50',    text: 'text-red-700'   },
    slate: { bg: 'bg-slate-600',  light: 'bg-slate-100', text: 'text-slate-600' },
  }
  const c = CORES[cor] ?? CORES.blue

  return (
    <div className={`card flex flex-col gap-3 ${alerta ? 'ring-2 ring-red-400' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${c.light}`}>
          {Icone && <Icone className={`w-5 h-5 ${c.text}`} />}
        </div>
        {alerta && (
          <span className="badge-critico">Alerta</span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{valor ?? '—'}</p>
        <p className="text-sm font-medium text-slate-700 mt-1">{titulo}</p>
        {subtitulo && <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}
