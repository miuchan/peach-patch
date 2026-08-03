/**
 * Decodes the worklet's two MIDI transports in wire order: compact 4-byte
 * records first, followed by little-endian length-prefixed packets.
 */
export function decodeRackAudioMidiOutput(records: Uint8Array, packets: Uint8Array): number[][] {
  const messages: number[][] = [];
  for (let offset = 0; offset + 3 < records.length; offset += 4) {
    const size = Math.max(1, Math.min(3, records[offset] || 1));
    messages.push([...records.slice(offset + 1, offset + 1 + size)]);
  }
  for (let offset = 0; offset + 1 < packets.length;) {
    const size = packets[offset] | (packets[offset + 1] << 8);
    const end = offset + 2 + size;
    if (size < 1 || end > packets.length) break;
    messages.push([...packets.slice(offset + 2, end)]);
    offset = end;
  }
  return messages;
}
