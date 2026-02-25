import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Entrar",
}

export default function SignInPage() {
  return <SignIn />
}
