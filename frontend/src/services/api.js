import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 15000 })

export const indicadores = {
  resumo:               () => api.get('/indicadores/resumo'),
  historico:    (dias)  => api.get('/indicadores/historico', { params: { dias } }),
  enfermidades: (p)     => api.get('/indicadores/enfermidades', { params: { periodo: p } }),
  distribuicao:         () => api.get('/indicadores/distribuicao-pacientes'),
}

export const leitos = {
  disponibilidade: () => api.get('/leitos/disponibilidade'),
  resumoTipo:      () => api.get('/leitos/resumo-tipo'),
}

export const fila = {
  resumo:       () => api.get('/fila/resumo'),
  porPrioridade:() => api.get('/fila/por-prioridade'),
  historico: (d)=> api.get('/fila/historico', { params: { dias: d } }),
}

export const estoque = {
  listar:  (s, c) => api.get('/estoque/', { params: { status: s || 'todos', categoria: c } }),
  resumo:  ()     => api.get('/estoque/resumo'),
  alertas: ()     => api.get('/estoque/alertas'),
}

export const profissionais = {
  resumo:       () => api.get('/profissionais/resumo'),
  escala:       () => api.get('/profissionais/escala'),
  dePlantao:    () => api.get('/profissionais/de-plantao-agora'),
}

export const relatorios = {
  excel: (dias) => `/api/relatorios/exportar/excel?dias=${dias}`,
  pdf:   (dias) => `/api/relatorios/exportar/pdf?dias=${dias}`,
}

export const alertasRest = () => api.get('/alertas')

export const alertasApi = {
  listar:    ()   => api.get('/alertas'),
  dispensar: (id) => api.post(`/alertas/${encodeURIComponent(id)}/dispensar`),
  limparDispensados: () => api.delete('/alertas/dispensados'),
}

export const simulador = {
  lookups:            () => api.get('/simulador/lookups'),
  criarPaciente:      (dados) => api.post('/simulador/paciente', dados),
  criarProfissional:  (dados) => api.post('/simulador/profissional', dados),
  criarLeito:         (dados) => api.post('/simulador/leito', dados),
  criarPlantao:       (dados) => api.post('/simulador/plantao', dados),
  entrarNaFila:       (dados) => api.post('/simulador/fila', dados),
  atenderFila:        (dados) => api.post('/simulador/atender-fila', dados),
  criarInternacao:    (dados) => api.post('/simulador/internacao', dados),
  altaInternacao:     (dados) => api.post('/simulador/alta-internacao', dados),
  getHistoricoCsv:    (limit) => api.get('/simulador/historico-csv', { params: { limit } }),
  salvarHistoricoCsv: (dados) => api.post('/simulador/salvar-historico-csv', dados),
}

export default api
