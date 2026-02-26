import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Globe, BookOpen, ListChecks, Bell, Search } from "lucide-react"

export const metadata: Metadata = {
  title: "PerfAlly — Auditorias profissionais de performance e SEO para desenvolvedores",
}

// Static metric examples for the hero section — intentionally a bad site
const metrics = [
  { name: "LCP", value: "8,4s", grade: "poor", gradeLabel: "Ruim", label: "Maior Elemento Visível" },
  { name: "INP", value: "920ms", grade: "poor", gradeLabel: "Ruim", label: "Interação até Próxima Pintura" },
  { name: "CLS", value: "0,38", grade: "poor", gradeLabel: "Ruim", label: "Mudança de Layout Acumulada" },
]

const gradeColors = {
  good: "bg-green-100 text-green-700",
  "needs-improvement": "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
} as const

const features = [
  {
    icon: Globe,
    title: "Auditorias em 10 segundos",
    description:
      "Cole a URL do cliente e receba um relatório completo de performance, SEO e acessibilidade em menos de 10 segundos.",
  },
  {
    icon: Search,
    title: "SEO + Acessibilidade incluídos",
    description:
      "Performance, SEO técnico e acessibilidade em uma única auditoria. Tudo o que você precisa para impressionar clientes.",
  },
  {
    icon: ListChecks,
    title: "Plano de ação por IA",
    description:
      "Recomendações priorizadas geradas por IA, específicas para a stack do cliente — entregue relatórios prontos.",
  },
  {
    icon: Bell,
    title: "Monitoramento automático",
    description:
      "Agende auditorias diárias ou por hora. Receba alertas se a performance cair — antes que o cliente perceba.",
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-20 text-center">
        <Badge variant="secondary" className="mb-4">
          Grátis para começar — sem cartão de crédito
        </Badge>

        <h1 className="mx-auto mb-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Auditorias profissionais de performance e SEO{" "}
          <span className="text-primary">para quem vende consultoria</span>
        </h1>

        <p className="text-muted-foreground mx-auto mb-2 max-w-xl text-lg">
          Monitore os sites dos seus clientes. Gere relatórios impressionantes. Cobre como especialista.
        </p>
        <p className="text-muted-foreground mx-auto mb-8 max-w-lg text-sm">
          Você paga R$89/mês. Seus clientes te pagam R$300–1.000/mês por monitoramento.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/sign-up">Analise seu site gratuitamente →</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Entrar</Link>
          </Button>
        </div>

        {/* Mock metric preview */}
        <div className="mx-auto mt-12 max-w-lg rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-medium">minha-loja.com.br</p>
              <p className="text-muted-foreground text-xs">Mobile · há 2 segundos</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold text-red-600">23</span>
              <span className="text-muted-foreground text-sm">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {metrics.map((m) => (
              <div key={m.name} className="rounded-lg border p-3 text-left">
                <p className="text-muted-foreground mb-1 text-xs">{m.name}</p>
                <p className="text-base font-semibold">{m.value}</p>
                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${gradeColors[m.grade as keyof typeof gradeColors]}`}
                >
                  {m.gradeLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 border-t py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight">
            Tudo que você precisa para vender consultoria de performance
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-white p-6 shadow-sm"
              >
                <div className="mb-3 text-primary">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What are Core Web Vitals */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">
            O que são Core Web Vitals?
          </h2>
          <p className="text-muted-foreground mb-6 text-base">
            Os Core Web Vitals do Google são três métricas que medem o quão
            rápido e responsivo seu site parece para os visitantes reais. Eles
            afetam diretamente seu ranqueamento no Google e sua taxa de
            conversão.
          </p>
          <div className="grid gap-4 text-left sm:grid-cols-3">
            {[
              {
                name: "LCP",
                full: "Maior Elemento Visível",
                desc: "Velocidade de carregamento do conteúdo principal.",
                target: "< 2,5s",
              },
              {
                name: "INP",
                full: "Interação até Próxima Pintura",
                desc: "Velocidade de resposta da página aos cliques.",
                target: "< 200ms",
              },
              {
                name: "CLS",
                full: "Mudança de Layout Acumulada",
                desc: "O quanto a página se mexe durante o carregamento.",
                target: "< 0,1",
              },
            ].map((m) => (
              <div key={m.name} className="rounded-lg border p-4">
                <p className="text-primary mb-1 text-lg font-bold">{m.name}</p>
                <p className="mb-1 text-sm font-medium">{m.full}</p>
                <p className="text-muted-foreground mb-2 text-sm">{m.desc}</p>
                <p className="text-xs font-medium text-green-600">
                  Meta: {m.target}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-muted/30 border-t py-16">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">
            Preços simples e transparentes
          </h2>
          <p className="text-muted-foreground mb-8 text-base">
            Comece grátis. Faça upgrade quando precisar de mais.
          </p>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Free */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="mb-2 font-semibold">Grátis</p>
              <p className="mb-3 text-3xl font-bold">
                R$0
                <span className="text-muted-foreground text-sm font-normal">/mês</span>
              </p>
              <ul className="text-muted-foreground mb-6 space-y-1 text-left text-sm">
                <li>✓ 1 projeto</li>
                <li>✓ 5 auditorias manuais/mês</li>
                <li>✓ Performance + SEO + Acessibilidade</li>
                <li>✓ Links de compartilhamento</li>
                <li>✓ Plano de ação estático</li>
              </ul>
              <Button className="w-full" asChild>
                <Link href="/sign-up">Começar gratuitamente</Link>
              </Button>
            </div>

            {/* Freelancer */}
            <div className="rounded-xl border-2 border-black bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">Freelancer</p>
                <span className="rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">Popular</span>
              </div>
              <p className="mb-3 text-3xl font-bold">
                R$89
                <span className="text-muted-foreground text-sm font-normal">/mês</span>
              </p>
              <ul className="text-muted-foreground mb-6 space-y-1 text-left text-sm">
                <li>✓ 5 projetos (clientes)</li>
                <li>✓ Auditorias ilimitadas</li>
                <li>✓ Performance + SEO + Acessibilidade</li>
                <li>✓ Monitoramento diário automático</li>
                <li>✓ Alertas por e-mail</li>
                <li>✓ Histórico de 30 dias</li>
                <li>✓ 5 planos de ação por IA/mês</li>
              </ul>
              <Button className="w-full" asChild>
                <Link href="/sign-up">Começar período grátis</Link>
              </Button>
            </div>

            {/* Studio */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="mb-2 font-semibold">Studio</p>
              <p className="mb-3 text-3xl font-bold">
                R$199
                <span className="text-muted-foreground text-sm font-normal">/mês</span>
              </p>
              <ul className="text-muted-foreground mb-6 space-y-1 text-left text-sm">
                <li>✓ 20 projetos (clientes)</li>
                <li>✓ Auditorias ilimitadas</li>
                <li>✓ Performance + SEO + Acessibilidade</li>
                <li>✓ Monitoramento por hora automático</li>
                <li>✓ Alertas por e-mail + Slack</li>
                <li>✓ Relatórios em PDF</li>
                <li>✓ Histórico de 90 dias</li>
                <li>✓ 30 planos de ação por IA/mês</li>
              </ul>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/sign-up">Começar período grátis</Link>
              </Button>
            </div>

            {/* Agency */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="mb-2 font-semibold">Agência</p>
              <p className="mb-3 text-3xl font-bold">
                R$449
                <span className="text-muted-foreground text-sm font-normal">/mês</span>
              </p>
              <ul className="text-muted-foreground mb-6 space-y-1 text-left text-sm">
                <li>✓ 100 projetos (clientes)</li>
                <li>✓ Auditorias ilimitadas</li>
                <li>✓ Performance + SEO + Acessibilidade</li>
                <li>✓ Monitoramento por hora automático</li>
                <li>✓ Alertas por e-mail + Slack</li>
                <li>✓ PDFs white-label</li>
                <li>✓ Histórico de 1 ano</li>
                <li>✓ Planos de ação por IA ilimitados</li>
              </ul>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/sign-up">Começar período grátis</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">
          Pronto para ver como seu site se sai?
        </h2>
        <p className="text-muted-foreground mb-6">
          Grátis para começar. Sem cartão de crédito.
        </p>
        <Button size="lg" asChild>
          <Link href="/sign-up">Analise seu site agora →</Link>
        </Button>
      </section>
    </>
  )
}
