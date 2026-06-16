import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAlertWebSocket } from '../hooks/useWebSocket'

export default function Layout({ titulo, children }) {
  useAlertWebSocket()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-64 overflow-hidden">
        <TopBar titulo={titulo} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
