function capitalizeWord(word: string): string {
  const lower = word.toLocaleLowerCase('es-CL')
  return `${lower.charAt(0).toLocaleUpperCase('es-CL')}${lower.slice(1)}`
}

function capitalizeToken(token: string): string {
  return token
    .split(/([-'’])/)
    .map(part => {
      if (part === '-' || part === "'" || part === '’') return part
      return capitalizeWord(part)
    })
    .join('')
}

export function normalizePersonPart(value: string | null | undefined): string {
  const cleaned = (value ?? '').trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(capitalizeToken)
    .join(' ')
}

export function normalizeFirstAndLast(firstName: string | null | undefined, lastName: string | null | undefined): {
  firstName: string
  lastName: string
  fullName: string
} {
  const normalizedFirstName = normalizePersonPart(firstName)
  const normalizedLastName = normalizePersonPart(lastName)
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim()

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName,
  }
}

export function nameFromEmail(email: string | null | undefined): string {
  const localPart = (email ?? '').split('@')[0] ?? ''
  const spaced = localPart.replace(/[._-]+/g, ' ')
  return normalizePersonPart(spaced)
}

export function firstNameOnly(value: string | null | undefined, fallback: string = 'Usuario'): string {
  const normalized = normalizePersonPart(value)
  if (normalized) {
    return normalized.split(' ')[0] ?? fallback
  }

  const normalizedFallback = normalizePersonPart(fallback)
  if (normalizedFallback) {
    return normalizedFallback.split(' ')[0] ?? 'Usuario'
  }

  return 'Usuario'
}

export function firstNameFromParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackEmail?: string | null
): string {
  const normalized = normalizeFirstAndLast(firstName, lastName)
  if (normalized.firstName) return normalized.firstName
  if (normalized.fullName) return firstNameOnly(normalized.fullName)

  const emailName = nameFromEmail(fallbackEmail)
  if (emailName) return firstNameOnly(emailName)

  return 'Usuario'
}