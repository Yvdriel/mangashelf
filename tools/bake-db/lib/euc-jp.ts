// Decode EUC-JP bytes (KRADFILE/RADKFILE are EUC-JP, not UTF-8). Node's built-in
// ICU TextDecoder supports "euc-jp".
const DEC = new TextDecoder("euc-jp");
export function decodeEucJp(bytes: Uint8Array): string {
  return DEC.decode(bytes);
}
