import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import KPICard from '../components/KPICard'
import LoadingSpinner from '../components/LoadingSpinner'
import { estoque as api } from '../services/api'
import { Package, AlertTriangle, XCircle, CheckCircle, Search } from 'lucide-react'

const STATUS_CONFIG = {
  adequado: { label: 'Adequado', cls: 'badge-ok'      },
  baixo:    { label: 'Baixo',    cls: 'badge-aviso'   },
  critico:  { label: 'Crítico',  cls: 'badge-critico' },
  esgotado: { label: 'Esgotado', cls: 'badge-critico' },
}

const FILTROS = [
  { valor: 'todos',    label: 'Todos'    },
  { valor: 'esgotado', label: 'Esgotado' },
  { valor: 'critico',  label: 'Crítico'  },
  { valor: 'baixo',    label: 'Baixo'    },
  { valor: 'adequado', label: 'Adequado' },
]

export default function Farmacia() {
  const [resumo,     setResumo]     = useState(null)
  const [itens,      setItens]      = useState([])
  const [filtroSts,  setFiltroSts]  = useState('todos')
  const [filtroCateg,setFiltroCateg]= useState('')
  const [busca,      setBusca]      = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.resumo().then(r => setResumo(r.data))
  }, [])

  useEffect(() => {
    setCarregando(true)
    api.listar(filtroSts, filtroCateg || undefined).then(r => {
      setItens(r.data)
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }, [filtroSts, filtroCateg])

  const itensFiltrados = itens.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.categoria.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <Layout titulo="Farmácia / Almoxarifado">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard titulo="Total de Insumos" valor={resumo?.total_itens}  subtitulo="Itens cadastrados"     icone={Package}        cor="blue"  />
        <KPICard titulo="Esgotados"        valor={resumo?.esgotados}    subtitulo="Estoque zerado"        icone={XCircle}        cor="red"   alerta={(resumo?.esgotados ?? 0) > 0} />
        <KPICard titulo="Críticos"         valor={resumo?.criticos}     subtitulo="Abaixo do mínimo"      icone={AlertTriangle}  cor="amber" alerta={(resumo?.criticos ?? 0) >= 5}  />
        <KPICard titulo="Adequados"        valor={resumo?.adequados}    subtitulo="Dentro do parâmetro"   icone={CheckCircle}    cor="green" />
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1">
            {FILTROS.map(f => (
              <button
                key={f.valor}
                onClick={() => setFiltroSts(f.valor)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  filtroSts === f.valor
                    ? 'bg-hospital-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {resumo?.categorias?.length > 0 && (
            <select
              value={filtroCateg}
              onChange={e => setFiltroCateg(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white"
            >
              <option value="">Todas as categorias</option>
              {resumo.categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <div className="flex items-center gap-2 ml-auto bg-slate-100 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar insumo…"
              className="text-xs bg-transparent outline-none w-40 text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        {carregando ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full table-hospital">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoria</th>
                  <th className="text-center">Qtd. Atual</th>
                  <th className="text-center">Qtd. Mínima</th>
                  <th className="text-center">Disponib.</th>
                  <th className="text-center">Status</th>
                  <th>Fornecedor</th>
                  <th>Validade</th>
                  <th>Localização</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-12">Nenhum item encontrado.</td></tr>
                ) : itensFiltrados.map(item => {
                  const sc = STATUS_CONFIG[item.status_estoque] ?? STATUS_CONFIG.adequado
                  return (
                    <tr key={item.id}>
                      <td className="font-medium text-slate-800">{item.nome}</td>
                      <td className="text-slate-500">{item.categoria}</td>
                      <td className="text-center font-mono font-semibold">{item.quantidade_atual} {item.unidade}</td>
                      <td className="text-center font-mono text-slate-400">{item.quantidade_minima}</td>
                      <td className="text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 progress-bar-track">
                            <div
                              className={`progress-bar-fill ${
                                item.percentual_disponibilidade >= 75 ? 'bg-green-600'
                                  : item.percentual_disponibilidade >= 40 ? 'bg-amber-500'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(item.percentual_disponibilidade, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono w-8 text-right">{item.percentual_disponibilidade}%</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={sc.cls}>{sc.label}</span>
                      </td>
                      <td className="text-slate-500 text-xs">{item.fornecedor}</td>
                      <td className="font-mono text-xs text-slate-500">{item.validade}</td>
                      <td className="font-mono text-xs text-slate-500">{item.localizacao_almoxarifado}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
