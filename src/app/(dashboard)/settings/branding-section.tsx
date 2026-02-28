"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateBrandingAction } from "@/app/actions/branding"

interface BrandingSectionProps {
  initial: {
    agencyName: string | null
    agencyContact: string | null
    agencyAccentColor: string | null
    agencyLogoUrl: string | null
  }
}

export function BrandingSection({ initial }: BrandingSectionProps) {
  const [agencyName, setAgencyName] = useState(initial.agencyName ?? "")
  const [agencyContact, setAgencyContact] = useState(initial.agencyContact ?? "")
  const [agencyAccentColor, setAgencyAccentColor] = useState(
    initial.agencyAccentColor ?? "#6366f1"
  )
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(initial.agencyLogoUrl ?? "")
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoError(null)
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setLogoError(json.error ?? "Erro ao enviar logo")
      } else {
        setAgencyLogoUrl(json.url)
      }
    } catch {
      setLogoError("Falha ao enviar logo. Tente novamente.")
    } finally {
      setLogoUploading(false)
    }
  }

  function handleSave() {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await updateBrandingAction({
        agencyName,
        agencyContact,
        agencyAccentColor,
        agencyLogoUrl,
      })
      if (result.success) {
        setSaveMessage("Configurações salvas!")
      } else {
        setSaveMessage(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marca da Agência</CardTitle>
        <CardDescription>
          Personalize os relatórios PDF com a identidade da sua agência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo</Label>
          {agencyLogoUrl && (
            <div className="mb-2">
              <Image
                src={agencyLogoUrl}
                alt="Logo da agência"
                width={80}
                height={40}
                className="rounded border object-contain"
                unoptimized
              />
            </div>
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleLogoUpload}
            disabled={logoUploading}
            className="text-sm"
          />
          {logoUploading && (
            <p className="text-muted-foreground text-xs">Enviando...</p>
          )}
          {logoError && <p className="text-xs text-red-500">{logoError}</p>}
          <p className="text-muted-foreground text-xs">PNG, JPEG ou SVG, máx. 2MB</p>
        </div>

        {/* Agency name */}
        <div className="space-y-1.5">
          <Label htmlFor="agency-name">Nome da Agência</Label>
          <Input
            id="agency-name"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Minha Agência Digital"
          />
          <p className="text-muted-foreground text-xs">
            Exibido no cabeçalho do PDF e no rodapé das páginas.
          </p>
        </div>

        {/* Contact info */}
        <div className="space-y-1.5">
          <Label htmlFor="agency-contact">Contato / Rodapé</Label>
          <textarea
            id="agency-contact"
            value={agencyContact}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setAgencyContact(e.target.value)
            }
            placeholder="agencia.com · contato@agencia.com"
            rows={2}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-muted-foreground text-xs">
            Aparece no rodapé da capa do PDF.
          </p>
        </div>

        {/* Accent color */}
        <div className="space-y-1.5">
          <Label htmlFor="accent-color">Cor de Destaque</Label>
          <div className="flex items-center gap-3">
            <input
              id="accent-color"
              type="color"
              value={agencyAccentColor}
              onChange={(e) => setAgencyAccentColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border p-0.5"
            />
            <span className="text-muted-foreground text-sm font-mono">
              {agencyAccentColor}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Barra de cor no topo de cada página do PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isPending || logoUploading}>
            {isPending ? "Salvando..." : "Salvar configurações"}
          </Button>
          {saveMessage && (
            <span
              className={
                saveMessage === "Configurações salvas!"
                  ? "text-sm text-green-600"
                  : "text-sm text-red-500"
              }
            >
              {saveMessage}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
