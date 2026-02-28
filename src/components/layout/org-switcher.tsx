"use client"

import { OrganizationSwitcher } from "@clerk/nextjs"

export function OrgSwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal={false}
      afterCreateOrganizationUrl="/dashboard"
      afterLeaveOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      afterSelectPersonalUrl="/dashboard"
      appearance={{
        elements: {
          rootBox: "flex items-center",
          organizationSwitcherTrigger:
            "rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors",
        },
      }}
    />
  )
}
