export const supportedEnvironmentPresets = ['DEV', 'FAT', 'TEST', 'UAT', 'PRE', 'PROD']

export function toEnvironmentOptions(codes: Array<string | undefined | null>) {
  const unique = Array.from(new Set(codes.filter((code): code is string => Boolean(code))))
  return unique.map((code) => ({ label: code, value: code }))
}
