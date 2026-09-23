import "server-only";
export class RequestLimits {
  private starts: number[] = [];
  private active = 0;
  private cache = new Map<string, { expires: number; analysis: string }>();
  constructor(private now = () => Date.now()) {}
  acquire() {
    const now = this.now();
    this.starts = this.starts.filter((t) => now - t < 60_000);
    if (this.active >= 2 || this.starts.length >= 6) return false;
    this.starts.push(now);
    this.active++;
    return true;
  }
  release() {
    this.active = Math.max(0, this.active - 1);
  }
  get(key: string) {
    const item = this.cache.get(key);
    if (item && item.expires > this.now()) return item.analysis;
    this.cache.delete(key);
  }
  set(key: string, analysis: string) {
    for (const [k, v] of this.cache)
      if (v.expires <= this.now()) this.cache.delete(k);
    if (this.cache.size >= 100)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { analysis, expires: this.now() + 600_000 });
  }
}
export const limits = new RequestLimits();
export async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 8192)
    throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("json");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new Error("size");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
