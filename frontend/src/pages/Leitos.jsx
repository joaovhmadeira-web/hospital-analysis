import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { leitos as api } from '../services/api'
import { BedDouble } from 'lucide-react'

const COR_TIPO = {
  'Enfermaria': { bar: 'bg-hospital-blue',  badge: 'bg-blue-100 text-blue-800' },
  'Quarto':     { bar: 'bg-hospital-teal',  badge: 'bg-teal-100 text-teal-800' },
  'CTI/UTI':   { bar: 'bg-hospital-red',   badge: 'bg-red-100 text-red-800'   },
}

function BarraOcupacao({ valor, cor }) {
  const pct = Math.min(Number(valor) || 0, 100)
  let bgCor = cor
  if (!bgCor) {
    bgCor = pct >= 90 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-green-600'
  }
  return (
    <div className="progress-bar-track">
      <div className={`progress-bar-fill ${bgCor}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Leitos() {
  const [resumo,       setResumo]       = useState([])
  const [detalhes,     setDetalhes]     = useState([])
  const [carregando,   setCarregando]   = useState(true)

  useEffect(() => {
    Promise.all([api.resumoTipo(), api.disponibilidade()]).then(([r, d]) => {
      setResumo(r.data)
      setDetalhes(d.data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [])

  if (carregando) return <Layout titulo="Censo de Leitos"><LoadingSpinner /></Layout>

  // Agrupar detalhes por tipo
  const tipos = [...new Set(detalhes.map(d => d.tipo))]

  return (
    <Layout titulo="Censo de Leitos">
      {/* Cards por tipo de leito */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {resumo.map(tipo => {
          const cores = COR_TIPO[tipo.tipo] ?? { bar: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700' }
          const pct = Number(tipo.taxa_ocupacao_pct)
          return (
            <div key={tipo.tipo} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{tipo.tipo}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {tipo.ocupados} <span className="text-base font-normal text-slate-400">/ {tipo.total}</span>
                  </p>
                </div>
                <BedDouble className="w-8 h-8 text-slate-300" />
              </div>

              <BarraOcupacao valor={pct} cor={cores.bar} />

              <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                <span>{tipo.disponiveis} disponíveis</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${cores.badge}`}>
                  {pct}% ocupado
                </span>
                {Number(tipo.manutencao) > 0 && (
                  <span className="text-amber-600">{tipo.manutencao} em manut.</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detalhamento por tipo e setor */}
      {tipos.map(tipo => {
        const setoDoTipo = detalhes.filter(d => d.tipo === tipo)
        const cores = COR_TIPO[tipo] ?? { bar: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700' }
        return (
          <div key={tipo} className="card mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${cores.badge}`}>{tipo}</span>
              — Disponibilidade por Setor
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full table-hospital">
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th className="text-center">Total</th>
                    <th className="text-center">Disponíveis</th>
                    <th className="text-center">Ocupados</th>
                    <th className="text-center">Manutenção</th>
                    <th className="text-center">Reservados</th>
                    <th className="w-48">Ocupação</th>
                  </tr>
                </thead>
                <tbody>
                  {setoDoTipo.map(s => (
                    <tr key={s.setor}>
                      <td className="font-medium">{s.setor}</td>
                      <td className="text-center font-mono">{s.total}</td>
                      <td className="text-center">
                        <span className="font-mono font-semibold text-green-700">{s.disponiveis}</span>
                      </td>
                      <td className="text-center font-mono">{s.ocupados}</td>
                      <td className="text-center font-mono text-amber-600">{s.manutencao}</td>
                      <td className="text-center font-mono text-blue-600">{s.reservados}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <BarraOcupacao valor={s.taxa_ocupacao_pct} />
                          </div>
                          <span className="text-xs font-mono w-10 text-right text-slate-500">
                            {s.taxa_ocupacao_pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </Layout>
  )
}
