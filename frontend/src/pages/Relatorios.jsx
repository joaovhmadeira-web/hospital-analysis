import { useState } from 'react'
import Layout from '../components/Layout'
import { relatorios } from '../services/api'
import { FileText, FileSpreadsheet, Download, Calendar, Info } from 'lucide-react'

const OPCOES_PERIODO = [
  { dias: 7,   label: 'Últimos 7 dias'    },
  { dias: 15,  label: 'Últimos 15 dias'   },
  { dias: 30,  label: 'Últimos 30 dias'   },
  { dias: 90,  label: 'Últimos 3 meses'   },
  { dias: 180, label: 'Últimos 6 meses'   },
  { dias: 365, label: 'Último ano'         },
]

function CardRelatorio({ titulo, descricao, icone: Icone, cor, secoes, dias, tipo }) {
  const href = tipo === 'excel' ? relatorios.excel(dias) : relatorios.pdf(dias)
  const CORES = {
    green: { ring: 'ring-green-200', icon: 'bg-green-50 text-green-700', btn: 'btn-teal' },
    red:   { ring: 'ring-red-200',   icon: 'bg-red-50 text-red-700',     btn: 'btn-primary' },
  }
  const c = CORES[cor] ?? CORES.green

  return (
    <div className={`card ring-2 ${c.ring}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`p-3 rounded-xl ${c.icon}`}>
          <Icone className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{descricao}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Seções incluídas:
        </p>
        <ul className="space-y-1">
          {secoes.map(s => (
            <li key={s} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-hospital-teal shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center justify-center gap-2 ${c.btn} py-2.5 rounded-lg`}
      >
        <Download className="w-4 h-4" />
        Download ({tipo === 'excel' ? '.xlsx' : '.pdf'})
      </a>
    </div>
  )
}

export default function Relatorios() {
  const [dias, setDias] = useState(30)

  return (
    <Layout titulo="Relatórios Gerenciais">
      {/* Período */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5 text-hospital-blue" />
          <h2 className="font-semibold text-slate-800">Período do Relatório</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {OPCOES_PERIODO.map(op => (
            <button
              key={op.dias}
              onClick={() => setDias(op.dias)}
              className={`px-4 py-2 text-sm rounded-lg font-medium border transition-colors ${
                dias === op.dias
                  ? 'bg-hospital-blue text-white border-hospital-blue'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-hospital-blue hover:text-hospital-blue'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          O período selecionado se aplica a dados transacionais (internações, fila do PA, escala).
          Estoque e censo de leitos refletem sempre a situação atual.
        </p>
      </div>

      {/* Cards de relatório */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardRelatorio
          titulo="Relatório Excel"
          descricao="Planilha com múltiplas abas, ideal para análise de dados e cruzamento de informações."
          icone={FileSpreadsheet}
          cor="green"
          dias={dias}
          tipo="excel"
          secoes={[
            'Censo de Leitos — situação atual por tipo e setor',
            `Internações dos últimos ${dias} dias com CID-10`,
            `Fluxo diário do PA — últimos ${dias} dias`,
            'Farmácia e ALMOX — estoque completo com status',
            'Escala de profissionais — últimos 7 dias',
          ]}
        />

        <CardRelatorio
          titulo="Relatório PDF"
          descricao="Documento formatado para impressão, apresentações e arquivo gerencial."
          icone={FileText}
          cor="red"
          dias={dias}
          tipo="pdf"
          secoes={[
            'Censo de Leitos — taxas de ocupação por tipo',
            'Internações ativas — ranking por diagnóstico (CID-10)',
            `Fluxo do PA — últimos ${dias} dias`,
            'Insumos críticos e esgotados — Farmácia / ALMOX',
          ]}
        />
      </div>

      {/* Dicas */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            titulo: 'Excel — Melhor para',
            itens: ['Análise de dados no Excel / Google Sheets', 'Cruzamento com outras fontes', 'Construção de tabelas dinâmicas', 'Envio interno e arquivamento'],
          },
          {
            titulo: 'PDF — Melhor para',
            itens: ['Relatório para diretoria', 'Impressão e arquivo físico', 'Apresentações e reuniões', 'Conformidade e auditoria'],
          },
          {
            titulo: 'Dica de uso',
            itens: ['Use período de 7 dias para relatório semanal', 'Use 30 dias para reunião mensal de gestão', 'Use 90–365 dias para análise de tendências', 'Exporte Excel para aprofundar análises'],
          },
        ].map(card => (
          <div key={card.titulo} className="card bg-slate-50 border-slate-200">
            <p className="text-xs font-semibold text-hospital-blue uppercase tracking-wide mb-2">{card.titulo}</p>
            <ul className="space-y-1.5">
              {card.itens.map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="text-hospital-teal mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Layout>
  )
}
