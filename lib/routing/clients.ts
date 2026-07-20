const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ClientRouteInput = {
  id: string
  name?: string | null
  trade_name?: string | null
  routeSegment?: string | null
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export function slugifyClientName(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "organization"
}

export function extractClientIdFromRouteSegment(routeSegment: string | null | undefined) {
  const normalizedSegment = routeSegment?.trim().toLowerCase() ?? ""
  if (isUuid(normalizedSegment)) {
    return normalizedSegment
  }

  const parts = normalizedSegment.split("--")
  const possibleId = parts[parts.length - 1] ?? ""

  return isUuid(possibleId) ? possibleId : normalizedSegment
}

export function buildLegacyClientRouteSegment(client: ClientRouteInput) {
  const slugSource = client.trade_name?.trim() || client.name?.trim() || "organization"
  return `${slugifyClientName(slugSource)}--${client.id}`
}

export function buildClientRouteSegment(client: ClientRouteInput) {
  if (client.routeSegment?.trim()) {
    const segment = client.routeSegment.trim()
    if (segment.includes("--")) {
      const legacyParts = segment.split("--")
      return slugifyClientName(legacyParts[0] ?? "")
    }
    return slugifyClientName(segment)
  }

  const slugSource = client.trade_name?.trim() || client.name?.trim() || "organization"
  return slugifyClientName(slugSource)
}

export function matchesClientRouteSegment(client: ClientRouteInput, routeSegment: string | null | undefined) {
  const normalizedSegment = routeSegment?.trim().toLowerCase() ?? ""
  if (!normalizedSegment) return false

  if (isUuid(normalizedSegment)) {
    return client.id.toLowerCase() === normalizedSegment
  }

  const cleanSegment = buildClientRouteSegment(client).toLowerCase()
  if (cleanSegment === normalizedSegment) {
    return true
  }

  return buildLegacyClientRouteSegment(client).toLowerCase() === normalizedSegment
}

export function buildClientPath(client: ClientRouteInput, suffix = "") {
  const normalizedSuffix = suffix
    ? suffix.startsWith("?") || suffix.startsWith("/")
      ? suffix
      : `/${suffix}`
    : ""

  return `/clients/${buildClientRouteSegment(client)}${normalizedSuffix}`
}
