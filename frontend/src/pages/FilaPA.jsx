import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import KPICard from '../components/KPICard'
import LoadingSpinner from '../components/LoadingSpinner'
import { fila as api } from '../services/api'
import { Users, Clock, UserX } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'

const COR_MANCHESTER = {
  vermelho: '#c62828',
  laranja:  '#e65100',
  amarelo:  '#f9a825',
  verde:    '#2e7d32',
  azul:     '#1565c0',
}

const LABEL_MANCHESTER = {
  vermelho: 'Emergência',
  laranja:  'Muito Urgente',
  amarelo:  'Urgente',
  verde:    'Pouco Urgente',
  azul:     'Não Urgente',
}

export default function FilaPA() {
  const [resumo,      setResumo]      = useState(null)
  const [prioridade,  setPrioridade]  = useState([])
  const [historico,   setHistorico]   = useState([])
  const [carregando,  setCarregando]  = useState(true)

  useEffect(() => {
    Promise.all([api.resumo(), api.porPrioridade(), api.historico(30)]).then(([r, p, h]) => {
      setResumo(r.data)
      setPrioridade(p.data)
      setHistorico(h.data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [])

  if (carregando) return <Layout titulo="Fila do PA"><LoadingSpinner /></Layout>

  const dadosPie = prioridade.map(p => ({
    name:  LABEL_MANCHESTER[p.prioridade] ?? p.prioridade,
    value: Number(p.total),
    fill:  COR_MANCHESTER[p.prioridade] ?? '#94a3b8',
  }))

  return (
    <Layout titulo="Fila do PA — Pronto Atendimento">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard
          titulo="Total de Registros no Dia"
          valor={resumo?.total_registros ?? 0}
          subtitulo="Chegadas no Pronto Atendimento"
          icone={Users}
          cor="blue"
        />
        <KPICard
          titulo="Aguardando Atendimento"
          valor={resumo?.aguardando ?? 0}
          subtitulo="Em espera ou em atendimento"
          icone={Clock}
          cor={resumo?.aguardando >= 50 ? 'red' : resumo?.aguardando >= 30 ? 'amber' : 'teal'}
          alerta={resumo?.aguardando >= 50}
        />
        <KPICard
          titulo="Desistências"
          valor={resumo?.desistencias ?? 0}
          subtitulo="Pacientes que saíram sem atendimento"
          icone={UserX}
          cor="slate"
        />
      </div>

      {/* Tempo de espera banner */}
      {resumo?.tempo_medio_atendimento_min > 0 && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl mb-6 text-sm font-medium ${
          resumo.tempo_medio_atendimento_min >= 120
            ? 'bg-red-100 text-red-800 border border-red-200'
            : resumo.tempo_medio_atendimento_min >= 60
            ? 'bg-amber-100 text-amber-800 border border-amber-200'
            : 'bg-green-100 text-green-800 border border-green-200'
        }`}>
          <Clock className="w-5 h-5 shrink-0" />
          <span>
            Tempo médio de espera no PA:{' '}
            <strong>{resumo.tempo_medio_atendimento_min} min</strong>
            {' '}— Mínimo: {resumo.tempo_min_min} min / Máximo: {resumo.tempo_max_min} min
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        {/* Classificação de Risco - Pie */}
        <div className="card xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Classificação de Risco — Protocolo Manchester
          </h2>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={dadosPie} dataKey="value" nameKey="name" outerRadius={85} paddingAngle={2}>
                {dadosPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legenda detalhada */}
          <div className="mt-2 space-y-2">
            {prioridade.map(p => (
              <div key={p.prioridade} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: COR_MANCHESTER[p.prioridade] }}
                  />
                  <span className="text-slate-700">{LABEL_MANCHESTER[p.prioridade]}</span>
                </div>
                <div className="flex gap-3 text-slate-500 font-mono">
                  <span>{p.total} total</span>
                  <span>{p.aguardando ?? 0} aguard.</span>
                  <span>~{p.tempo_medio_min ?? '—'} min</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evolução diária */}
        <div className="card xl:col-span-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Fluxo Diário do PA — Últimos 30 Dias
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} interval={6} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="total"        name="Total Chegadas"  stroke="#1565c0" strokeWidth={2} dot={false} />
              <Line dataKey="atendidos"    name="Atendidos"       stroke="#2e7d32" strokeWidth={2} dot={false} />
              <Line dataKey="desistencias" name="Desistências"    stroke="#c62828" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de tempo por prioridade */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Indicadores de Tempo por Nível de Classificação de Risco
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full table-hospital">
            <thead>
              <tr>
                <th>Nível</th>
                <th>Classificação</th>
                <th className="text-center">Total</th>
                <th className="text-center">Aguardando</th>
                <th className="text-center">Atendidos</th>
                <th className="text-center">T. Médio Espera</th>
              </tr>
            </thead>
            <tbody>
              {prioridade.map(p => (
                <tr key={p.prioridade}>
                  <td>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: COR_MANCHESTER[p.prioridade] }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                      {p.prioridade.charAt(0).toUpperCase() + p.prioridade.slice(1)}
                    </span>
                  </td>
                  <td>{LABEL_MANCHESTER[p.prioridade]}</td>
                  <td className="text-center font-mono">{p.total}</td>
                  <td className="text-center font-mono">{p.aguardando ?? 0}</td>
                  <td className="text-center font-mono">{Number(p.total) - Number(p.aguardando ?? 0)}</td>
                  <td className="text-center font-mono">
                    {p.tempo_medio_min ? `${p.tempo_medio_min} min` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
