"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Zap, Loader2 } from "lucide-react"

interface RunAuditButtonProps {
  projectId: string
  pageId: string
  runsUsed?: number
  maxRuns?: number
}

export function RunAuditButton({ projectId, pageId, runsUsed, maxRuns }: RunAuditButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRun() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setError(data.error ?? "Auditoria falhou. Tente novamente.")
        return
      }

      // Refresh Server Component data without full page reload
      router.refresh()
    } catch {
      setError("Erro de rede. Verifique sua conexão e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" onClick={handleRun} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Executando auditoria…
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Executar auditoria
          </>
        )}
      </Button>
      {maxRuns !== undefined && runsUsed !== undefined && (
        <p className={`text-xs ${runsUsed >= maxRuns ? "text-red-600" : "text-muted-foreground"}`}>
          {runsUsed}/{maxRuns} auditorias usadas este mês
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
