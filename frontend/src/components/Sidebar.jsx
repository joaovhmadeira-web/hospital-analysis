import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, BedDouble, Package,
  Stethoscope, FileText, Cross, Sliders
} from 'lucide-react'

const ITENS = [
  { to: '/',               icon: LayoutDashboard, label: 'Painel de Indicadores' },
  { to: '/fila-pa',        icon: Users,            label: 'Fila do PA'            },
  { to: '/leitos',         icon: BedDouble,        label: 'Censo de Leitos'       },
  { to: '/farmacia',       icon: Package,          label: 'Farmácia / ALMOX'      },
  { to: '/escala',         icon: Stethoscope,      label: 'Escala de Profissionais'},
  { to: '/relatorios',     icon: FileText,         label: 'Relatórios Gerenciais' },
]

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-hospital-navy text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-9 h-9 bg-hospital-blue rounded-lg shadow">
          <Cross className="w-5 h-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="font-bold text-sm tracking-wide">HGPUB</p>
          <p className="text-xs text-blue-300">Sistema de Indicadores</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
          Operacional
        </p>
        {ITENS.slice(0, 3).map(({ to, icon: Icon, label }) => (
          <NavItem key={to} to={to} Icon={Icon} label={label} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
          Gerencial
        </p>
        {ITENS.slice(3).map(({ to, icon: Icon, label }) => (
          <NavItem key={to} to={to} Icon={Icon} label={label} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
          Desenvolvimento
        </p>
        <NavItem to="/simulacao" Icon={Sliders} label="Centro de Simulação" />
      </nav>

      {/* Rodapé */}
      <div className="px-5 py-3 border-t border-white/10 text-[10px] text-blue-400">
        v1.0 · Dados sintéticos
      </div>
    </aside>
  )
}

function NavItem({ to, Icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-hospital-blue text-white font-semibold'
            : 'text-blue-100 hover:bg-white/10'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}
