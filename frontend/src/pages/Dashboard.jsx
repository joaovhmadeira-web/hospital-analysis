import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import KPICard from '../components/KPICard'
import LoadingSpinner from '../components/LoadingSpinner'
import { indicadores as api } from '../services/api'
import { useAlertStore } from '../store/alertStore'
import {
  BedDouble, ClipboardList, Users, HeartPulse,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const PERIODOS = [
  { valor: 'dia',    label: 'Hoje'    },
  { valor: 'semana', label: 'Semana'  },
  { valor: 'mes',    label: '30 dias' },
  { valor: 'ano',    label: '12 meses'},
]

const COR_TIPO_LEITO = ['#1565c0', '#00838f', '#c62828']

export default function Dashboard() {
  const [resumo,       setResumo]       = useState(null)
  const [historico,    setHistorico]    = useState([])
  const [enfermidades, setEnfermidades] = useState([])
  const [distribuicao, setDistribuicao] = useState([])
  const [periodo,      setPeriodo]      = useState('semana')
  const [carregando,   setCarregando]   = useState(true)
  const { alertas } = useAlertStore()

  useEffect(() => {
    Promise.all([
      api.resumo(),
      api.historico(30),
      api.distribuicao(),
    ]).then(([r, h, d]) => {
      setResumo(r.data)
      setHistorico(h.data)
      setDistribuicao(d.data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [])

  useEffect(() => {
    api.enfermidades(periodo).then(r => setEnfermidades(r.data))
  }, [periodo])

  if (carregando) return <Layout titulo="Painel de Indicadores"><LoadingSpinner /></Layout>

  const leitos    = resumo?.leitos ?? []
  const filaPA    = resumo?.fila_pa ?? {}
  const internAti = resumo?.internacoes_ativas ?? 0

  const totalLeitos  = leitos.reduce((s, l) => s + Number(l.total), 0)
  const totalDisponi = leitos.reduce((s, l) => s + Number(l.disponiveis), 0)
  const taxaOcup     = totalLeitos > 0 ? ((totalLeitos - totalDisponi) / totalLeitos * 100).toFixed(1) : 0
  const cti          = leitos.find(l => l.tipo === 'CTI/UTI') ?? {}

  const temAlertaCTI   = alertas.some(a => a.id?.startsWith('cti'))
  const temAlertaFila  = alertas.some(a => a.id?.startsWith('fila'))
  const temAlertaOcup  = alertas.some(a => a.id?.startsWith('ocupacao'))

  // Pie chart leitos
  const dadosPie = leitos.map((l, i) => ({
    name: l.tipo, value: Number(l.ocupados), fill: COR_TIPO_LEITO[i] ?? '#94a3b8',
  }))

  return (
    <Layout titulo="Painel de Indicadores">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard
          titulo="Internações Ativas"
          valor={internAti}
          subtitulo="Pacientes em leito ocupado"
          icone={ClipboardList}
          cor="blue"
          alerta={temAlertaOcup}
        />
        <KPICard
          titulo="Leitos Disponíveis"
          valor={`${totalDisponi} / ${totalLeitos}`}
          subtitulo={`Taxa de ocupação: ${taxaOcup}%`}
          icone={BedDouble}
          cor={taxaOcup >= 90 ? 'red' : taxaOcup >= 80 ? 'amber' : 'green'}
          alerta={temAlertaOcup}
        />
        <KPICard
          titulo="Fila do PA — Aguardando"
          valor={filaPA.aguardando ?? 0}
          subtitulo={`T. médio espera: ${filaPA.tempo_medio_espera_min ?? 0} min`}
          icone={Users}
          cor={filaPA.aguardando >= 50 ? 'red' : filaPA.aguardando >= 30 ? 'amber' : 'teal'}
          alerta={temAlertaFila}
        />
        <KPICard
          titulo="CTI/UTI Disponível"
          valor={cti.disponiveis ?? 0}
          subtitulo={`Ocupação CTI: ${cti.taxa_ocupacao_pct ?? 0}%`}
          icone={HeartPulse}
          cor={cti.disponiveis <= 3 ? 'red' : cti.disponiveis <= 6 ? 'amber' : 'green'}
          alerta={temAlertaCTI}
        />
      </div>

      {/* Ocupação histórica + Pie leitos */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="card xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Taxa de Ocupação Hospitalar — Últimos 30 Dias (%)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} interval={6} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line dataKey="taxa_ocupacao_pct"     name="Geral"   stroke="#1565c0" strokeWidth={2} dot={false} />
              <Line dataKey="taxa_ocupacao_cti_pct" name="CTI/UTI" stroke="#c62828" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribuição de Leitos — Situação Atual</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {dadosPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-auto pt-2 space-y-1.5">
            {leitos.map((l, i) => (
              <div key={l.tipo} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_TIPO_LEITO[i] }} />
                  {l.tipo}
                </span>
                <span className="text-slate-500 font-mono">
                  {l.disponiveis} livres / {l.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Enfermidades + Distribuição etária */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Principais CIDs Registrados nas Internações
            </h2>
            <div className="flex gap-1">
              {PERIODOS.map(p => (
                <button
                  key={p.valor}
                  onClick={() => setPeriodo(p.valor)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    periodo === p.valor
                      ? 'bg-hospital-blue text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={enfermidades} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="descricao" tick={{ fontSize: 10 }} width={170} />
              <Tooltip />
              <Bar dataKey="total_internacoes" name="Internações" fill="#1565c0" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Perfil Epidemiológico — Atendimentos por Faixa Etária e Sexo
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribuicao}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="faixa_etaria" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Masculino" fill="#1565c0" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Feminino"  fill="#00838f" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  )
}
