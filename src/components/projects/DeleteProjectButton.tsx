"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteProjectAction } from "@/app/actions/projects"

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteProjectAction(projectId)
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
        <span className="text-red-700">Excluir <strong>{projectName}</strong>?</span>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 px-2 text-xs"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? "Excluindo…" : "Confirmar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
