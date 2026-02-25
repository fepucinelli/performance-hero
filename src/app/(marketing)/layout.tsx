import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border/40 sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            ⚡ PerfAlly
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Cadastre-se gratuitamente</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-border/40 border-t py-8">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-muted-foreground text-center text-sm">
            © {new Date().getFullYear()} PerfAlly. Built for founders.
          </p>
        </div>
      </footer>
    </div>
  )
}
