"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Loader2, X } from "lucide-react"
import { addPageAction, removePageAction } from "@/app/actions/projects"
import type { PlanName } from "@/types"

interface Page {
  id: string
  url: string
  label: string | null
}

interface PageTabsProps {
  pages: Page[]
  selectedPageId: string
  projectId: string
  maxPages: number
  userPlan: PlanName
}

function pathLabel(url: string): string {
  try {
    const { pathname } = new URL(url)
    return pathname === "/" ? "/" : pathname
  } catch {
    return url
  }
}

export function PageTabs({
  pages,
  selectedPageId,
  projectId,
  maxPages,
  userPlan,
}: PageTabsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [removingPageId, setRemovingPageId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const canAddPage = maxPages === -1 || pages.length < maxPages
  const atLimit = !canAddPage
  const canRemove = pages.length > 1

  function handleRemove(pageId: string) {
    setRemovingPageId(pageId)
    startTransition(async () => {
      const result = await removePageAction(projectId, pageId)
      setRemovingPageId(null)

      if (result && "error" in result && result.error) {
        // surface error inline — simple alert for now
        alert(result.error)
        return
      }

      // If the removed page was selected, redirect to the first remaining one
      if (pageId === selectedPageId) {
        const remaining = pages.find((p) => p.id !== pageId)
        if (remaining) {
          router.push(`?page=${remaining.id}`)
        } else {
          router.push("?")
        }
      }
      router.refresh()
    })
  }

  function handleAddClick() {
    if (atLimit) return
    setShowForm((v) => !v)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    startTransition(async () => {
      const result = await addPageAction(
        projectId,
        newUrl.trim(),
        newLabel.trim() || undefined
      )

      if (!result) {
        setFormError("Erro desconhecido")
        return
      }

      if ("error" in result && result.error) {
        setFormError(result.error)
        return
      }

      if ("pageId" in result && result.pageId) {
        setNewUrl("")
        setNewLabel("")
        setShowForm(false)
        router.refresh()
        router.push(`?page=${result.pageId}`)
      }
    })
  }

  // Plan label for upgrade message
  const upgradeMap: Record<PlanName, string> = {
    free: "Freelancer",
    starter: "Studio",
    pro: "Agência",
    agency: "Agência",
  }
  const upgradeTo = upgradeMap[userPlan] ?? "superior"

  return (
    <div className="space-y-2">
      {/* Tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {pages.map((page) => {
          const isActive = page.id === selectedPageId
          const isRemoving = removingPageId === page.id
          return (
            <span
              key={page.id}
              className={`shrink-0 inline-flex items-center gap-1 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Link
                href={`?page=${page.id}`}
                title={page.url}
                className={`px-3 py-1.5 ${
                  !isActive ? "hover:text-foreground" : ""
                }`}
              >
                {page.label ?? pathLabel(page.url)}
              </Link>
              {canRemove && (
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() => handleRemove(page.id)}
                  title={`Remover ${page.label ?? pathLabel(page.url)}`}
                  className={`pr-2 py-1.5 transition-opacity ${
                    isActive
                      ? "text-primary-foreground/70 hover:text-primary-foreground"
                      : "text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  {isRemoving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </span>
          )
        })}

        {/* Add page button */}
        {atLimit ? (
          <span
            className="shrink-0 cursor-default rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground"
            title={`Limite atingido. Faça upgrade para o plano ${upgradeTo}.`}
          >
            + Adicionar página (plano {upgradeTo})
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAddClick}
            className="shrink-0 flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar página
          </button>
        )}
      </div>

      {/* Inline add-page form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border bg-muted/40 p-4 space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-page-url" className="text-sm">
              URL da página
            </Label>
            <Input
              id="new-page-url"
              type="url"
              placeholder="https://seu-site.com/sobre"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-page-label" className="text-sm">
              Rótulo <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="new-page-label"
              type="text"
              placeholder="Ex: Página de Produtos"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Adicionando…
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setFormError(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
