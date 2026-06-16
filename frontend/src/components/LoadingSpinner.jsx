export default function LoadingSpinner({ texto = 'Carregando dados…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-hospital-blue rounded-full animate-spin" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}
