import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import KPICard from '../components/KPICard'
import LoadingSpinner from '../components/LoadingSpinner'
import { profissionais as api } from '../services/api'
import { Stethoscope, UserCheck, Activity } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const TURNO_LABEL = {
  manha: 'Manhã (06h–14h)',
  tarde: 'Tarde (14h–22h)',
  noite: 'Noite (22h–06h)',
}

const TURNO_COR = {
  manha: 'bg-blue-100 text-blue-800 border-blue-200',
  tarde: 'bg-amber-100 text-amber-800 border-amber-200',
  noite: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

const TIPO_LABEL = {
  medico:             'Médico(a)',
  enfermeiro:         'Enfermeiro(a)',
  tecnico_enfermagem: 'Técnico(a) Enf.',
  fisioterapeuta:     'Fisioterapeuta',
  outro:              'Outro',
}

export default function Escala() {
  const [resumo,     setResumo]     = useState(null)
  const [escala,     setEscala]     = useState(null)
  const [plantao,    setPlantao]    = useState(null)
  const [abaAtiva,   setAbaAtiva]   = useState('escala')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([api.resumo(), api.escala(), api.dePlantao()]).then(([r, e, p]) => {
      setResumo(r.data)
      setEscala(e.data)
      setPlantao(p.data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [])

  if (carregando) return <Layout titulo="Escala de Profissionais"><LoadingSpinner /></Layout>

  const totalPorTipo = resumo?.por_tipo ?? []
  const totalGeral   = totalPorTipo.reduce((s, t) => s + Number(t.total), 0)
  const medicos      = totalPorTipo.find(t => t.tipo === 'medico')?.total ?? 0
  const enfermeiros  = totalPorTipo.find(t => t.tipo === 'enfermeiro')?.total ?? 0
  const nPlantaoNow  = plantao?.profissionais?.length ?? 0

  // Dados para o gráfico de médicos por especialidade
  const dadosEsp = (resumo?.medicos_por_especialidade ?? []).slice(0, 10)

  // Agrupar escala por turno
  const turnosMapa = {}
  ;(escala?.escala ?? []).forEach(row => {
    if (!turnosMapa[row.turno]) turnosMapa[row.turno] = []
    turnosMapa[row.turno].push(row)
  })

  return (
    <Layout titulo="Escala de Profissionais">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard titulo="Total de Profissionais" valor={totalGeral}   subtitulo="Equipe ativa cadastrada"        icone={UserCheck}    cor="blue"  />
        <KPICard titulo="Médicos"                valor={medicos}      subtitulo="Profissionais médicos"          icone={Stethoscope}  cor="teal"  />
        <KPICard titulo="Enfermagem"             valor={enfermeiros}  subtitulo="Enfermeiros e técnicos"         icone={Activity}     cor="green" />
        <KPICard titulo="De Plantão Agora"       valor={nPlantaoNow}  subtitulo={`Turno: ${TURNO_LABEL[plantao?.turno_atual] ?? '—'}`} icone={UserCheck} cor="blue" />
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'escala',       label: 'Cobertura por Turno' },
          { id: 'especialidades', label: 'Médicos por Especialidade' },
          { id: 'plantao',      label: 'De Plantão Agora' },
        ].map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              abaAtiva === aba.id
                ? 'bg-white text-hospital-blue shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* Cobertura por turno */}
      {abaAtiva === 'escala' && (
        <div className="space-y-4">
          {['manha', 'tarde', 'noite'].map(turno => {
            const linhas = turnosMapa[turno] ?? []
            return (
              <div key={turno} className="card">
                <h3 className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-sm font-semibold mb-4 ${TURNO_COR[turno]}`}>
                  {TURNO_LABEL[turno]}
                </h3>
                {linhas.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem registros neste turno.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-hospital">
                      <thead>
                        <tr>
                          <th>Setor</th>
                          <th className="text-center">Profissionais</th>
                          <th className="text-center">Médicos</th>
                          <th className="text-center">Enfermeiros</th>
                          <th className="text-center">Técnicos</th>
                          <th>Cobertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map(l => {
                          const suficiente = Number(l.profissionais) >= 2
                          return (
                            <tr key={l.setor}>
                              <td className="font-medium">{l.setor}</td>
                              <td className="text-center font-mono">
                                <span className={`font-bold ${suficiente ? 'text-green-700' : 'text-red-600'}`}>
                                  {l.profissionais}
                                </span>
                              </td>
                              <td className="text-center font-mono">{l.medicos}</td>
                              <td className="text-center font-mono">{l.enfermeiros}</td>
                              <td className="text-center font-mono">{l.tecnicos}</td>
                              <td>
                                {suficiente
                                  ? <span className="badge-ok">Adequada</span>
                                  : <span className="badge-critico">Insuficiente</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Médicos por especialidade */}
      {abaAtiva === 'especialidades' && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Médicos por Especialidade</h2>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={dadosEsp} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="especialidade" tick={{ fontSize: 11 }} width={200} />
              <Tooltip />
              <Bar dataKey="medicos" name="Médicos" fill="#1565c0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* De plantão agora */}
      {abaAtiva === 'plantao' && (
        <div className="card overflow-hidden p-0">
          <div className={`px-5 py-3 border-b flex items-center gap-2 ${TURNO_COR[plantao?.turno_atual]}`}>
            <span className="text-sm font-semibold">
              Plantão Atual — {TURNO_LABEL[plantao?.turno_atual] ?? '—'}
            </span>
            <span className="text-xs opacity-70">Data ref.: {escala?.data_referencia}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-hospital">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Especialidade</th>
                  <th>Setor</th>
                  <th>Registro</th>
                  <th>Início</th>
                  <th>Fim</th>
                </tr>
              </thead>
              <tbody>
                {(plantao?.profissionais ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-10">Nenhum profissional de plantão registrado.</td></tr>
                ) : (plantao?.profissionais ?? []).map((p, i) => (
                  <tr key={i}>
                    <td className="font-medium">{p.nome}</td>
                    <td><span className="badge-info">{TIPO_LABEL[p.tipo] ?? p.tipo}</span></td>
                    <td className="text-slate-500">{p.especialidade}</td>
                    <td>{p.setor}</td>
                    <td className="font-mono text-xs text-slate-400">{p.registro}</td>
                    <td className="font-mono text-xs">{String(p.inicio).slice(11, 16)}</td>
                    <td className="font-mono text-xs">{String(p.fim).slice(11, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
