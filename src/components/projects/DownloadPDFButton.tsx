"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Props {
  projectId: string
  canGeneratePDF: boolean
}

export function DownloadPDFButton({ projectId, canGeneratePDF }: Props) {
  const [loading, setLoading] = useState(false)

  if (!canGeneratePDF) {
    return (
      <Button variant="outline" size="sm" disabled title="Disponível no plano Studio ou Agência">
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
        PDF
      </Button>
    )
  }

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/reports`, { method: "POST" })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? "Erro ao gerar PDF")
      }

      const contentType = res.headers.get("Content-Type") ?? ""
      if (contentType.includes("application/pdf")) {
        // Streamed directly (no Blob token configured)
        const disposition = res.headers.get("Content-Disposition") ?? ""
        const match = /filename="([^"]+)"/.exec(disposition)
        const filename = match?.[1] ?? "relatorio.pdf"
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = objectUrl
        a.download = filename
        a.click()
        URL.revokeObjectURL(objectUrl)
      } else {
        const { url } = (await res.json()) as { url: string }
        window.open(url, "_blank")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileDown className="mr-1.5 h-3.5 w-3.5" />
      )}
      {loading ? "Gerando…" : "PDF"}
    </Button>
  )
}
