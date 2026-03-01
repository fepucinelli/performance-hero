"use client"

import { UserButton } from "@clerk/nextjs"

export function UserMenu() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "h-8 w-8",
        },
      }}
      userProfileMode="navigation"
      userProfileUrl="/settings"
    />
  )
}
