// Generate a unique identicon pattern based on wallet address
export function generateIdenticon(address: string): {
  backgroundColor: string;
  pattern: boolean[];
} {
  // Create a hash from the address
  const hash = address.toLowerCase().slice(2); // Remove 0x

  // Generate color from first 6 characters
  const r = parseInt(hash.slice(0, 2), 16);
  const g = parseInt(hash.slice(2, 4), 16);
  const b = parseInt(hash.slice(4, 6), 16);

  // Create a vibrant color by ensuring at least one component is bright
  const max = Math.max(r, g, b);
  const factor = max < 128 ? 255 / max : 1;
  const backgroundColor = `rgb(${Math.min(255, Math.floor(r * factor))}, ${Math.min(255, Math.floor(g * factor))}, ${Math.min(255, Math.floor(b * factor))})`;

  // Generate 5x5 pattern (symmetric, so we only need 3 columns)
  const pattern: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    pattern.push(byte % 2 === 0);
  }

  return { backgroundColor, pattern };
}
