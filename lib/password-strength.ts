export enum PasswordStrength {
  VeryWeak,
  Weak,
  Moderate,
  Strong,
  VeryStrong,
  ExtremelyStrong,
}

export function checkPasswordEntropy(password: string): PasswordStrength {
  if (!password) return PasswordStrength.VeryWeak
  const uniqueCharacters = new Set(password)
  const entropy = parseInt(
    Math.log2(
      Math.pow(parseInt(uniqueCharacters.size.toString()), password.length)
    ).toFixed(2)
  )
  if (entropy < 16) return PasswordStrength.VeryWeak
  if (entropy < 31) return PasswordStrength.Weak
  if (entropy < 46) return PasswordStrength.Moderate
  if (entropy < 61) return PasswordStrength.Strong
  if (entropy < 76) return PasswordStrength.VeryStrong
  return PasswordStrength.ExtremelyStrong
}

export function getPasswordStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VeryWeak:
      return "Très faible"
    case PasswordStrength.Weak:
      return "Faible"
    case PasswordStrength.Moderate:
      return "Moyen"
    case PasswordStrength.Strong:
      return "Fort"
    case PasswordStrength.VeryStrong:
      return "Très fort"
    case PasswordStrength.ExtremelyStrong:
      return "Extrêmement fort"
  }
}

export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VeryWeak:
    case PasswordStrength.Weak:
      return "bg-red-500"
    case PasswordStrength.Moderate:
      return "bg-yellow-500"
    case PasswordStrength.Strong:
      return "bg-lime-500"
    case PasswordStrength.VeryStrong:
    case PasswordStrength.ExtremelyStrong:
      return "bg-green-500"
  }
}

export function getPasswordStrengthWidth(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VeryWeak:
      return "w-1/6"
    case PasswordStrength.Weak:
      return "w-2/6"
    case PasswordStrength.Moderate:
      return "w-3/6"
    case PasswordStrength.Strong:
      return "w-4/6"
    case PasswordStrength.VeryStrong:
      return "w-5/6"
    case PasswordStrength.ExtremelyStrong:
      return "w-full"
  }
}
