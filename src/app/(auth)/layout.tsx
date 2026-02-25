import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Entrar",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-2">
        <span className="text-primary text-xl font-semibold tracking-tight">
          ⚡ PerfAlly
        </span>
      </div>
      {children}
    </div>
  )
}
