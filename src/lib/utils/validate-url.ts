export interface UrlValidation {
  valid: boolean
  error?: string
  normalized?: string // lowercase, trailing-slash-stripped
}

const PRIVATE_PREFIXES = [
  "localhost",
  "127.",
  "0.",
  "192.168.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "::1",
  // Link-local — covers AWS/GCP metadata endpoint (169.254.169.254)
  "169.254.",
]

/** Returns true if hostname is in the RFC 6598 shared/CGNAT range (100.64.0.0/10). */
function isCgnatAddress(hostname: string): boolean {
  const parts = hostname.split(".")
  if (parts.length < 2) return false
  const first = Number(parts[0])
  const second = Number(parts[1])
  return first === 100 && second >= 64 && second <= 127
}

export function validateAuditUrl(rawUrl: string): UrlValidation {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { valid: false, error: "Please enter a URL" }
  }

  // Auto-prepend https:// if no protocol given
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return {
      valid: false,
      error: "Please enter a valid URL (e.g. https://yoursite.com)",
    }
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { valid: false, error: "URL must use http or https" }
  }

  const hostname = url.hostname

  if (
    PRIVATE_PREFIXES.some((r) => hostname === r || hostname.startsWith(r)) ||
    isCgnatAddress(hostname)
  ) {
    return {
      valid: false,
      error: "Cannot audit local or private network URLs",
    }
  }

  if (!hostname.includes(".")) {
    return { valid: false, error: "Please enter a full domain (e.g. yoursite.com)" }
  }

  return {
    valid: true,
    normalized: withProtocol.replace(/\/$/, ""),
  }
}
