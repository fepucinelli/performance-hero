import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

// Routes that require authentication.
// Clerk will redirect to sign-in if a user without a session visits these.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
  "/settings(.*)",
  "/reports(.*)",
])

export default clerkMiddleware(async (auth, req): Promise<NextResponse | void> => {
  if (isProtectedRoute(req)) {
    await auth.protect()
    return
  }

  // Redirect logged-in users away from the landing page to the dashboard
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth()
    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
