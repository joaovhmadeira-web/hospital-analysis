import { useEffect, useRef } from 'react'
import { useAlertStore } from '../store/alertStore'

const WS_URL = `ws://${window.location.hostname}:8000/ws/alertas`
const RECONNECT_MS = 5000

export function useAlertWebSocket() {
  const { setAlertas, setWsStatus } = useAlertStore()
  const wsRef   = useRef(null)
  const timerRef = useRef(null)

  function conectar() {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setWsStatus('connected')

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setAlertas(data.alertas ?? [])
      }

      ws.onerror = () => setWsStatus('error')

      ws.onclose = () => {
        setWsStatus('disconnected')
        timerRef.current = setTimeout(conectar, RECONNECT_MS)
      }
    } catch {
      setWsStatus('error')
      timerRef.current = setTimeout(conectar, RECONNECT_MS)
    }
  }

  useEffect(() => {
    conectar()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [])
}
