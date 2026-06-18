import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard      from './pages/Dashboard'
import FilaPA        from './pages/FilaPA'
import Leitos        from './pages/Leitos'
import Farmacia      from './pages/Farmacia'
import Escala        from './pages/Escala'
import Relatorios    from './pages/Relatorios'
import Simulacao     from './pages/Simulacao'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/fila-pa"    element={<FilaPA />} />
        <Route path="/leitos"     element={<Leitos />} />
        <Route path="/farmacia"   element={<Farmacia />} />
        <Route path="/escala"     element={<Escala />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/simulacao"  element={<Simulacao />} />
      </Routes>
    </BrowserRouter>
  )
}
