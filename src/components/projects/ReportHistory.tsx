"use client"

import { FileDown, FileText } from "lucide-react"
import type { Report } from "@/lib/db/schema"

interface ReportHistoryProps {
  reports: Pick<Report, "id" | "blobUrl" | "createdAt">[]
}

export function ReportHistory({ reports }: ReportHistoryProps) {
  if (reports.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum relatório gerado ainda.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li
          key={report.id}
          className="flex items-center justify-between rounded-lg border bg-white px-4 py-2.5"
        >
          <div className="flex items-center gap-2.5">
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-sm">
              {new Date(report.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <a
            href={report.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" />
            Baixar
          </a>
        </li>
      ))}
    </ul>
  )
}
