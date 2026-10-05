const PALETTE = [
  { bg: '#6e4aa8', light: '#f2edfa' }, // violet
  { bg: '#1b8f72', light: '#e9f6f2' }, // sarcelle
  { bg: '#9a4a13', light: '#fff2e8' }, // brun/orange
  { bg: '#164e63', light: '#e6f3f6' }, // bleu-vert
  { bg: '#c0392b', light: '#fdeceb' }, // rouge
  { bg: '#1e5fae', light: '#e8f0fb' }, // bleu
]

export function clientColor(clientId: number | string | undefined) {
  if (clientId === undefined || clientId === null) return PALETTE[0]
  const n = typeof clientId === 'number' ? clientId : parseInt(String(clientId), 10) || 0
  return PALETTE[n % PALETTE.length]
}