import { Sidebar } from "@/components/layout/sidebar"
import { UserMenu } from "@/components/layout/user-menu"
import { auth } from "@clerk/nextjs/server"
import { getUserPlan } from "@/lib/utils/get-plan"
import { OrgSwitcher } from "@/components/layout/org-switcher"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  const plan = userId ? await getUserPlan(userId) : "free"

  return (
    <div className="fixed inset-0 flex">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="border-border/40 flex h-14 shrink-0 items-center justify-end gap-3 border-b bg-white px-4">
          {plan === "agency" && <OrgSwitcher />}
          <UserMenu />
        </header>

        {/* Page content */}
        <main className="bg-muted/30 flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
