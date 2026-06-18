import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import LoadingSpinner from '../components/LoadingSpinner'
import { simulador as api } from '../services/api'
import {
  Users, ClipboardList, PlusCircle, Calendar,
  Activity, Save, CheckCircle, XCircle, AlertTriangle,
  UserPlus, FileCheck, Stethoscope, Bed, RefreshCw
} from 'lucide-react'

const PRIORIDADES_MANCHESTER = [
  { valor: 'vermelho', label: 'Emergência (Vermelho)', corBg: 'bg-red-500', corText: 'text-white' },
  { valor: 'laranja',  label: 'Muito Urgente (Laranja)', corBg: 'bg-orange-500', corText: 'text-white' },
  { valor: 'amarelo',  label: 'Urgente (Amarelo)', corBg: 'bg-yellow-500', corText: 'text-slate-800' },
  { valor: 'verde',    label: 'Pouco Urgente (Verde)', corBg: 'bg-green-500', corText: 'text-white' },
  { valor: 'azul',     label: 'Não Urgente (Azul)', corBg: 'bg-blue-500', corText: 'text-white' },
]

export default function Simulacao() {
  const [abaAtiva, setAbaAtiva] = useState('fila')
  const [lookups, setLookups] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [mensagemStatus, setMensagemStatus] = useState(null)

  // CSV indicators
  const [historicoCsv, setHistoricoCsv] = useState([])
  const [linhaSelecionada, setLinhaSelecionada] = useState(null)
  const [filtroCsvDias, setFiltroCsvDias] = useState(30)

  // Forms states
  const [formPaciente, setFormPaciente] = useState({
    nome: '', data_nascimento: '', sexo: 'M', cpf: '', cidade: '', estado: 'SP'
  })
  const [formProfissional, setFormProfissional] = useState({
    nome: '', registro: '', tipo: 'medico', especialidade_id: '', setor_id: ''
  })
  const [formLeito, setFormLeito] = useState({
    numero: '', tipo_id: '', setor_id: '', status: 'disponivel'
  })
  const [formPlantao, setFormPlantao] = useState({
    profissional_id: '', data: new Date().toISOString().split('T')[0], turno: 'manha', setor_id: ''
  })
  const [formFila, setFormFila] = useState({
    paciente_id: '', nome_paciente: '', prioridade: 'verde', queixa_principal: ''
  })
  const [formInternacao, setFormInternacao] = useState({
    paciente_id: '', leito_id: '', diagnostico_principal_id: '', medico_responsavel_id: ''
  })

  // Modal Alta
  const [modalAlta, setModalAlta] = useState(null) // holds internacao object
  const [altaStatus, setAltaStatus] = useState('alta')

  const carregarDados = () => {
    setCarregando(true)
    Promise.all([
      api.lookups(),
      api.getHistoricoCsv(filtroCsvDias)
    ]).then(([lRes, cRes]) => {
      setLookups(lRes.data)
      setHistoricoCsv(cRes.data)
      setCarregando(false)
    }).catch(err => {
      mostrarMensagem('Erro ao carregar dados do simulador: ' + (err.response?.data?.detail ?? err.message), 'erro')
      setCarregando(false)
    })
  }

  useEffect(() => {
    carregarDados()
  }, [filtroCsvDias])

  const mostrarMensagem = (msg, tipo = 'sucesso') => {
    setMensagemStatus({ texto: msg, tipo })
    setTimeout(() => setMensagemStatus(null), 5000)
  }

  // --- HANDLERS DE SUBMIT ---

  const handleCriarPaciente = (e) => {
    e.preventDefault()
    api.criarPaciente(formPaciente).then(() => {
      mostrarMensagem('Paciente cadastrado com sucesso!')
      setFormPaciente({ nome: '', data_nascimento: '', sexo: 'M', cpf: '', cidade: '', estado: 'SP' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao cadastrar paciente.', 'erro'))
  }

  const handleCriarProfissional = (e) => {
    e.preventDefault()
    const payload = {
      ...formProfissional,
      especialidade_id: formProfissional.especialidade_id ? Number(formProfissional.especialidade_id) : null,
      setor_id: formProfissional.setor_id ? Number(formProfissional.setor_id) : null,
    }
    api.criarProfissional(payload).then(() => {
      mostrarMensagem('Profissional cadastrado com sucesso!')
      setFormProfissional({ nome: '', registro: '', tipo: 'medico', especialidade_id: '', setor_id: '' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao cadastrar profissional.', 'erro'))
  }

  const handleCriarLeito = (e) => {
    e.preventDefault()
    const payload = {
      ...formLeito,
      tipo_id: Number(formLeito.tipo_id),
      setor_id: Number(formLeito.setor_id)
    }
    api.criarLeito(payload).then(() => {
      mostrarMensagem('Leito criado com sucesso!')
      setFormLeito({ numero: '', tipo_id: '', setor_id: '', status: 'disponivel' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao criar leito.', 'erro'))
  }

  const handleCriarPlantao = (e) => {
    e.preventDefault()
    const payload = {
      ...formPlantao,
      profissional_id: Number(formPlantao.profissional_id),
      setor_id: Number(formPlantao.setor_id)
    }
    api.criarPlantao(payload).then(() => {
      mostrarMensagem('Plantão escalado com sucesso!')
      setFormPlantao({ ...formPlantao, profissional_id: '' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao escalar plantão.', 'erro'))
  }

  const handleEntrarNaFila = (e) => {
    e.preventDefault()
    let nome = formFila.nome_paciente
    if (formFila.paciente_id) {
      const pac = lookups?.pacientes.find(p => p.id === Number(formFila.paciente_id))
      nome = pac ? pac.nome : nome
    }

    const payload = {
      ...formFila,
      paciente_id: formFila.paciente_id ? Number(formFila.paciente_id) : null,
      nome_paciente: nome
    }

    api.entrarNaFila(payload).then(() => {
      mostrarMensagem('Paciente inserido na triagem do PA!')
      setFormFila({ paciente_id: '', nome_paciente: '', prioridade: 'verde', queixa_principal: '' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao entrar na fila.', 'erro'))
  }

  const handleAtenderFila = (id, status) => {
    api.atenderFila({ fila_id: id, status }).then(() => {
      mostrarMensagem(`Status da fila atualizado para '${status}'!`)
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao atualizar fila.', 'erro'))
  }

  const handleCriarInternacao = (e) => {
    e.preventDefault()
    const payload = {
      paciente_id: Number(formInternacao.paciente_id),
      leito_id: Number(formInternacao.leito_id),
      diagnostico_principal_id: Number(formInternacao.diagnostico_principal_id),
      medico_responsavel_id: Number(formInternacao.medico_responsavel_id)
    }

    api.criarInternacao(payload).then(() => {
      mostrarMensagem('Paciente internado e leito ocupado!')
      setFormInternacao({ paciente_id: '', leito_id: '', diagnostico_principal_id: '', medico_responsavel_id: '' })
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao internar paciente.', 'erro'))
  }

  const handleAltaInternacao = (e) => {
    e.preventDefault()
    if (!modalAlta) return

    api.altaInternacao({
      internacao_id: modalAlta.id,
      status: altaStatus
    }).then(() => {
      mostrarMensagem('Alta registrada e leito liberado!')
      setModalAlta(null)
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao registrar alta.', 'erro'))
  }

  // --- HISTORICO CSV HANDLERS ---

  const handleEditarLinhaCsv = (linha) => {
    setLinhaSelecionada({ ...linha })
  }

  const handleSalvarLinhaCsv = (e) => {
    e.preventDefault()
    if (!linhaSelecionada) return

    const novosDados = historicoCsv.map(row => 
      row.data === linhaSelecionada.data ? { ...linhaSelecionada } : row
    )

    api.salvarHistoricoCsv(novosDados).then(() => {
      mostrarMensagem('Indicadores projetados salvos no CSV com sucesso!')
      setLinhaSelecionada(null)
      carregarDados()
    }).catch(err => mostrarMensagem(err.response?.data?.detail ?? 'Erro ao salvar indicadores no CSV.', 'erro'))
  }

  const handleCriarNovaProjecao = () => {
    // Pegar última data e somar 1 dia
    const ultimo = historicoCsv[historicoCsv.length - 1]
    let novaDataStr = new Date().toISOString().split('T')[0]
    if (ultimo) {
      const dt = new Date(ultimo.data)
      dt.setDate(dt.getDate() + 1)
      novaDataStr = dt.toISOString().split('T')[0]
    }

    // Criar nova linha com valores padrão baseados na última
    const novaLinha = {
      ...(ultimo ?? {}),
      data: novaDataStr,
      cirurgias_realizadas: 0,
      obitos_dia: 0,
      altas_dia: 0,
      transferencias_dia: 0,
      novos_internados_dia: 0,
    }

    setLinhaSelecionada(novaLinha)
  }

  if (carregando && !lookups) return <Layout titulo="Centro de Simulação & Controle"><LoadingSpinner /></Layout>

  // Lookups filtrados
  const leitosDisponiveis = lookups?.leitos.filter(l => l.status === 'disponivel') ?? []
  const medicosAtivos = lookups?.profissionais.filter(p => p.tipo === 'medico') ?? []

  return (
    <Layout titulo="Centro de Simulação & Controle">
      {/* Mensagens de Notificação */}
      {mensagemStatus && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 animate-bounce max-w-md ${
          mensagemStatus.tipo === 'sucesso' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {mensagemStatus.tipo === 'sucesso' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span className="text-sm font-medium">{mensagemStatus.texto}</span>
        </div>
      )}

      {/* Header Premium com Gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-hospital-navy via-slate-900 to-hospital-teal rounded-2xl p-6 text-white mb-6 shadow-md border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel de Simulação Hospitalar</h1>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              Simule a operação hospitalar fictícia em tempo real. Adicione pacientes, execute internações, 
              faça triagens de classificação e ajuste indicadores de metas projetados diretamente na base de dados PostgreSQL.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Supabase PostgreSQL Ativo
            </span>
            <button 
              onClick={carregarDados}
              className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-lg border border-white/20 text-white"
              title="Sincronizar Banco"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -z-1" />
      </div>

      {/* Navegação por Abas Estilizada */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setAbaAtiva('fila')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px rounded-t-lg ${
            abaAtiva === 'fila'
              ? 'border-hospital-blue text-hospital-blue bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Pronto Atendimento (PA)
        </button>
        <button
          onClick={() => setAbaAtiva('internacao')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px rounded-t-lg ${
            abaAtiva === 'internacao'
              ? 'border-hospital-blue text-hospital-blue bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Internações & Altas
        </button>
        <button
          onClick={() => setAbaAtiva('cadastro')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px rounded-t-lg ${
            abaAtiva === 'cadastro'
              ? 'border-hospital-blue text-hospital-blue bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          Cadastro & Escala
        </button>
        <button
          onClick={() => setAbaAtiva('csv')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px rounded-t-lg ${
            abaAtiva === 'csv'
              ? 'border-hospital-blue text-hospital-blue bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          Projeção de Indicadores
        </button>
      </div>

      {/* --- CONTEÚDO DAS ABAS --- */}

      {/* ABA 1: FILA DO PA */}
      {abaAtiva === 'fila' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form entrada fila */}
          <div className="card h-fit">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-hospital-blue" />
              <h2 className="text-base font-bold text-slate-800">Triagem de Manchester (Check-in)</h2>
            </div>
            <form onSubmit={handleEntrarNaFila} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paciente Cadastrado (Opcional)</label>
                <select
                  value={formFila.paciente_id}
                  onChange={(e) => {
                    const id = e.target.value
                    setFormFila({
                      ...formFila,
                      paciente_id: id,
                      nome_paciente: id ? (lookups?.pacientes.find(p => p.id === Number(id))?.nome ?? '') : ''
                    })
                  }}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                >
                  <option value="">-- Selecione (ou preencha nome avulso abaixo) --</option>
                  {lookups?.pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} (CPF: {p.cpf})</option>
                  ))}
                </select>
              </div>

              {!formFila.paciente_id && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do Paciente</label>
                  <input
                    type="text"
                    required
                    value={formFila.nome_paciente}
                    onChange={(e) => setFormFila({ ...formFila, nome_paciente: e.target.value })}
                    placeholder="Nome completo do paciente"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classificação de Risco (Manchester)</label>
                <div className="grid grid-cols-1 gap-2">
                  {PRIORIDADES_MANCHESTER.map(p => (
                    <button
                      key={p.valor}
                      type="button"
                      onClick={() => setFormFila({ ...formFila, prioridade: p.valor })}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                        formFila.prioridade === p.valor
                          ? `${p.corBg} ${p.corText} border-transparent shadow-md scale-[1.02]`
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{p.label}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${formFila.prioridade === p.valor ? 'bg-white' : p.corBg}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Queixa Principal</label>
                <textarea
                  required
                  rows={3}
                  value={formFila.queixa_principal}
                  onChange={(e) => setFormFila({ ...formFila, queixa_principal: e.target.value })}
                  placeholder="Relato de sintomas principais..."
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                />
              </div>

              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Registrar Triagem
              </button>
            </form>
          </div>

          {/* Fila ativa */}
          <div className="card lg:col-span-2">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-hospital-teal" />
              Painel de Monitoramento do Pronto Atendimento (Aguardando / Em Atendimento)
            </h2>
            {lookups?.fila_ativa.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Não há pacientes aguardando atendimento no PA neste momento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-hospital">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Classificação</th>
                      <th>Chegada</th>
                      <th>Queixa</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookups?.fila_ativa.map(f => {
                      const prioridadeInfo = PRIORIDADES_MANCHESTER.find(p => p.valor === f.prioridade)
                      const dataFormat = new Date(f.data_chegada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                      return (
                        <tr key={f.id}>
                          <td>
                            <p className="font-semibold text-slate-800">{f.nome_paciente}</p>
                            {f.status === 'em_atendimento' && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mt-0.5">
                                Em Atendimento
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              f.prioridade === 'vermelho' ? 'badge-critico alert-pulse' :
                              f.prioridade === 'laranja' ? 'bg-orange-100 text-orange-800' :
                              f.prioridade === 'amarelo' ? 'badge-aviso' :
                              f.prioridade === 'verde' ? 'badge-ok' : 'badge-info'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${prioridadeInfo?.corBg}`} />
                              {prioridadeInfo?.label.split(' ')[0]}
                            </span>
                          </td>
                          <td className="font-mono text-xs text-slate-500">{dataFormat}</td>
                          <td className="max-w-[150px] truncate" title={f.queixa_principal}>{f.queixa_principal}</td>
                          <td>
                            <div className="flex gap-1">
                              {f.status === 'aguardando' && (
                                <button
                                  onClick={() => handleAtenderFila(f.id, 'em_atendimento')}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold"
                                >
                                  Chamar
                                </button>
                              )}
                              {f.status === 'em_atendimento' && (
                                <button
                                  onClick={() => handleAtenderFila(f.id, 'atendido')}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                                >
                                  Concluir
                                </button>
                              )}
                              <button
                                onClick={() => handleAtenderFila(f.id, 'desistiu')}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold"
                                title="Registrar Desistência"
                              >
                                Desistiu
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: INTERNAÇÕES & ALTAS */}
      {abaAtiva === 'internacao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Internação */}
          <div className="card h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Bed className="w-5 h-5 text-hospital-blue" />
              <h2 className="text-base font-bold text-slate-800">Lançar Nova Internação</h2>
            </div>
            <form onSubmit={handleCriarInternacao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paciente</label>
                <select
                  required
                  value={formInternacao.paciente_id}
                  onChange={(e) => setFormInternacao({ ...formInternacao, paciente_id: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                >
                  <option value="">-- Selecione o Paciente --</option>
                  {lookups?.pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leito Disponível</label>
                <select
                  required
                  value={formInternacao.leito_id}
                  onChange={(e) => setFormInternacao({ ...formInternacao, leito_id: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                >
                  <option value="">-- Selecione o Leito --</option>
                  {leitosDisponiveis.map(l => {
                    const setor = lookups?.setores.find(s => s.id === l.setor_id)?.nome ?? 'Setor'
                    const tipo = lookups?.tipos_leito.find(t => t.id === l.tipo_id)?.nome ?? 'Leito'
                    return (
                      <option key={l.id} value={l.id}>{l.numero} - {setor} ({tipo})</option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Diagnóstico de Entrada (CID)</label>
                <select
                  required
                  value={formInternacao.diagnostico_principal_id}
                  onChange={(e) => setFormInternacao({ ...formInternacao, diagnostico_principal_id: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                >
                  <option value="">-- Selecione o CID --</option>
                  {lookups?.diagnosticos.map(d => (
                    <option key={d.id} value={d.id}>{d.cid_codigo} - {d.descricao}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Médico Responsável (De Plantão)</label>
                <select
                  required
                  value={formInternacao.medico_responsavel_id}
                  onChange={(e) => setFormInternacao({ ...formInternacao, medico_responsavel_id: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                >
                  <option value="">-- Selecione o Médico --</option>
                  {medicosAtivos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} ({m.registro})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Efetivar Internação
              </button>
            </form>
          </div>

          {/* Internações ativas */}
          <div className="card lg:col-span-2">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-hospital-teal" />
              Censo Operacional — Internações Ativas
            </h2>
            {lookups?.internacoes_ativas.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Não há pacientes internados ativamente nos leitos do hospital.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-hospital">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Leito</th>
                      <th>Diagnóstico (CID)</th>
                      <th>Entrada</th>
                      <th>Médico</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookups?.internacoes_ativas.map(i => {
                      const dataFormat = new Date(i.data_entrada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

                      return (
                        <tr key={i.id}>
                          <td className="font-semibold text-slate-800">{i.paciente_nome}</td>
                          <td className="font-mono text-sm text-hospital-blue font-bold">{i.leito_numero}</td>
                          <td>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-xs">{i.cid}</span>
                            <span className="text-xs text-slate-500 ml-1.5 block lg:inline max-w-[120px] truncate">{i.diagnostico}</span>
                          </td>
                          <td className="text-xs text-slate-500">{dataFormat}</td>
                          <td className="text-xs text-slate-600 font-medium">{i.medico_nome}</td>
                          <td>
                            <button
                              onClick={() => setModalAlta(i)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                            >
                              Dar Alta
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: CADASTRO & ESCALA */}
      {abaAtiva === 'cadastro' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cadastro Paciente */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-hospital-blue" />
              Cadastrar Paciente
            </h2>
            <form onSubmit={handleCriarPaciente} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo</label>
                  <input
                    type="text" required
                    value={formPaciente.nome}
                    onChange={(e) => setFormPaciente({ ...formPaciente, nome: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data Nascimento</label>
                  <input
                    type="date" required
                    value={formPaciente.data_nascimento}
                    onChange={(e) => setFormPaciente({ ...formPaciente, data_nascimento: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sexo</label>
                  <select
                    value={formPaciente.sexo}
                    onChange={(e) => setFormPaciente({ ...formPaciente, sexo: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
                  <input
                    type="text" required placeholder="000.000.000-00"
                    value={formPaciente.cpf}
                    onChange={(e) => setFormPaciente({ ...formPaciente, cpf: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                  <input
                    type="text" required
                    value={formPaciente.cidade}
                    onChange={(e) => setFormPaciente({ ...formPaciente, cidade: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>
              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Cadastrar Paciente
              </button>
            </form>
          </div>

          {/* Cadastro Profissional */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-hospital-blue" />
              Cadastrar Profissional de Saúde
            </h2>
            <form onSubmit={handleCriarProfissional} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nome</label>
                <input
                  type="text" required
                  value={formProfissional.nome}
                  onChange={(e) => setFormProfissional({ ...formProfissional, nome: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Registro (CRM/COREN)</label>
                  <input
                    type="text" required
                    value={formProfissional.registro}
                    onChange={(e) => setFormProfissional({ ...formProfissional, registro: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Função</label>
                  <select
                    value={formProfissional.tipo}
                    onChange={(e) => setFormProfissional({ ...formProfissional, tipo: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="medico">Médico(a)</option>
                    <option value="enfermeiro">Enfermeiro(a)</option>
                    <option value="tecnico_enfermagem">Técnico(a) Enfermagem</option>
                    <option value="fisioterapeuta">Fisioterapeuta</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Setor Principal</label>
                  <select
                    value={formProfissional.setor_id}
                    onChange={(e) => setFormProfissional({ ...formProfissional, setor_id: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="">-- Alocar Setor --</option>
                    {lookups?.setores.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Especialidade (Médicos)</label>
                  <select
                    disabled={formProfissional.tipo !== 'medico'}
                    value={formProfissional.especialidade_id}
                    onChange={(e) => setFormProfissional({ ...formProfissional, especialidade_id: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none disabled:bg-slate-200 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Sem Especialidade --</option>
                    {lookups?.especialidades.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Cadastrar Profissional
              </button>
            </form>
          </div>

          {/* Cadastro Leito */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Bed className="w-5 h-5 text-hospital-blue" />
              Criar Novo Leito Físico
            </h2>
            <form onSubmit={handleCriarLeito} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Número do Leito (ex: EG045)</label>
                  <input
                    type="text" required placeholder="EG045"
                    value={formLeito.numero}
                    onChange={(e) => setFormLeito({ ...formLeito, numero: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo do Leito</label>
                  <select
                    required
                    value={formLeito.tipo_id}
                    onChange={(e) => setFormLeito({ ...formLeito, tipo_id: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="">-- Selecione --</option>
                    {lookups?.tipos_leito.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Setor de Alocação</label>
                  <select
                    required
                    value={formLeito.setor_id}
                    onChange={(e) => setFormLeito({ ...formLeito, setor_id: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="">-- Selecione o Setor --</option>
                    {lookups?.setores.map(s => (
                      <option key={s.id} value={s.id}>{s.nome} (Ala {s.ala}, Andar {s.andar}º)</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Criar Leito
              </button>
            </form>
          </div>

          {/* Cadastro Plantão */}
          <div className="card">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-hospital-blue" />
              Escalar Plantão Profissional
            </h2>
            <form onSubmit={handleCriarPlantao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Profissional</label>
                <select
                  required
                  value={formPlantao.profissional_id}
                  onChange={(e) => setFormPlantao({ ...formPlantao, profissional_id: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                >
                  <option value="">-- Selecione o Profissional --</option>
                  {lookups?.profissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.tipo.replace('_',' ')})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Data</label>
                  <input
                    type="date" required
                    value={formPlantao.data}
                    onChange={(e) => setFormPlantao({ ...formPlantao, data: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Turno</label>
                  <select
                    value={formPlantao.turno}
                    onChange={(e) => setFormPlantao({ ...formPlantao, turno: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="manha">Manhã (06h - 14h)</option>
                    <option value="tarde">Tarde (14h - 22h)</option>
                    <option value="noite">Noite (22h - 06h)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Setor de Cobertura</label>
                  <select
                    required
                    value={formPlantao.setor_id}
                    onChange={(e) => setFormPlantao({ ...formPlantao, setor_id: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                  >
                    <option value="">-- Selecione o Setor --</option>
                    {lookups?.setores.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full btn-primary justify-center font-bold">
                Escalar Plantão
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ABA 4: INDICADORES PROJETADOS (CSV EDITOR) */}
      {abaAtiva === 'csv' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card">
            <div>
              <h2 className="text-base font-bold text-slate-800">Controle da Série Histórica de Indicadores (CSV)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Valores mostrados nos gráficos de histórico diário. Edite as células de indicadores fictícios projetados.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                Visualizar:
                <select
                  value={filtroCsvDias}
                  onChange={(e) => setFiltroCsvDias(Number(e.target.value))}
                  className="border border-slate-300 rounded p-1 text-xs"
                >
                  <option value={15}>Últimos 15 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={60}>Últimos 60 dias</option>
                </select>
              </div>
              <button 
                onClick={handleCriarNovaProjecao}
                className="btn-teal py-1.5 text-xs font-bold shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                Nova Linha Diária
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Tabela dos dados */}
            <div className="card xl:col-span-2 overflow-y-auto max-h-[500px]">
              <table className="w-full text-xs text-left border-collapse table-hospital">
                <thead>
                  <tr className="sticky top-0 bg-slate-100 shadow-sm">
                    <th className="p-2 border-b">Data</th>
                    <th className="p-2 border-b">Intern. Ativas</th>
                    <th className="p-2 border-b">Taxa Ocup. (%)</th>
                    <th className="p-2 border-b">Esp. PA (méd)</th>
                    <th className="p-2 border-b">Atend. PA</th>
                    <th className="p-2 border-b">Altas</th>
                    <th className="p-2 border-b">Cirurgias</th>
                    <th className="p-2 border-b">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoCsv.map((row) => (
                    <tr 
                      key={row.data}
                      className={`hover:bg-slate-50 transition-colors ${
                        linhaSelecionada?.data === row.data ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="p-2 font-mono border-b">{row.data}</td>
                      <td className="p-2 font-mono border-b">{row.internacoes_ativas}</td>
                      <td className="p-2 font-mono border-b">{row.taxa_ocupacao_pct}%</td>
                      <td className="p-2 font-mono border-b">{row.tempo_espera_medio_min}m</td>
                      <td className="p-2 font-mono border-b">{row.pacientes_atendidos_pa}</td>
                      <td className="p-2 font-mono border-b">{row.altas_dia}</td>
                      <td className="p-2 font-mono border-b">{row.cirurgias_realizadas}</td>
                      <td className="p-2 border-b">
                        <button
                          onClick={() => handleEditarLinhaCsv(row)}
                          className="px-2 py-0.5 bg-hospital-blue text-white rounded text-[10px] font-bold"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form de edição do dia selecionado */}
            <div className="card h-fit">
              <div className="flex items-center gap-2 mb-4 border-b pb-2">
                <Save className="w-5 h-5 text-hospital-blue" />
                <h3 className="text-sm font-bold text-slate-800">
                  {linhaSelecionada ? `Editar Registro: ${linhaSelecionada.data}` : 'Nenhum dia selecionado'}
                </h3>
              </div>

              {linhaSelecionada ? (
                <form onSubmit={handleSalvarLinhaCsv} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Data de Projeção</label>
                      <input
                        type="text" disabled
                        value={linhaSelecionada.data}
                        className="w-full text-xs border border-slate-200 rounded p-1.5 bg-slate-100 cursor-not-allowed font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Internações Ativas</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.internacoes_ativas}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, internacoes_ativas: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Taxa de Ocupação (%)</label>
                      <input
                        type="number" step="0.1" required
                        value={linhaSelecionada.taxa_ocupacao_pct}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, taxa_ocupacao_pct: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Espera Média PA (min)</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.tempo_espera_medio_min}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, tempo_espera_medio_min: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Atendidos PA (total)</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.pacientes_atendidos_pa}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, pacientes_atendidos_pa: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Altas no Dia</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.altas_dia}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, altas_dia: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cirurgias do Dia</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.cirurgias_realizadas}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, cirurgias_realizadas: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Óbitos no Dia</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.obitos_dia}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, obitos_dia: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Novos Internados</label>
                      <input
                        type="number" required
                        value={linhaSelecionada.novos_internados_dia}
                        onChange={(e) => setLinhaSelecionada({ ...linhaSelecionada, novos_internados_dia: Number(e.target.value) })}
                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 btn-primary justify-center font-bold text-xs py-1.5">
                      Salvar Projeção
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setLinhaSelecionada(null)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Selecione um registro na tabela ao lado para editar ou clique em "Nova Linha Diária" para criar projeções futuras.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ALTA INTERNAÇÃO --- */}
      {modalAlta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 p-6 w-full max-w-md animate-scaleUp">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-base font-bold text-slate-800">Registrar Alta Hospitalar</h3>
              <button onClick={() => setModalAlta(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p><strong>Paciente:</strong> {modalAlta.paciente_nome}</p>
              <p className="mt-1"><strong>Leito:</strong> {modalAlta.leito_numero}</p>
              <p className="mt-1"><strong>Diagnóstico:</strong> {modalAlta.cid} - {modalAlta.diagnostico}</p>
            </div>
            <form onSubmit={handleAltaInternacao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status da Desocupação / Fechamento</label>
                <select
                  value={altaStatus}
                  onChange={(e) => setAltaStatus(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 focus:outline-none"
                >
                  <option value="alta">Alta Clínica (Normal)</option>
                  <option value="obito">Óbito</option>
                  <option value="transferencia">Transferência Interna/Externa</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 btn-primary justify-center font-bold bg-red-600 hover:bg-red-700">
                  Registrar Saída
                </button>
                <button 
                  type="button" 
                  onClick={() => setModalAlta(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-sm hover:bg-slate-300"
                >
                  Fechar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
