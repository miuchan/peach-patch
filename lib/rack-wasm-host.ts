export type WasmExports = {
  memory: WebAssembly.Memory;
  _initialize: () => void;
  rack_web_input_buffer: () => number;
  rack_web_output_buffer: () => number;
  rack_web_light_buffer: () => number;
  rack_web_set_param: (id: number, value: number) => void;
  rack_web_set_input_connected: (id: number, connected: number) => void;
  rack_web_set_input_channels: (id: number, channels: number) => void;
  rack_web_set_output_connected: (id: number, connected: number) => void;
  rack_web_set_polyphony: (channels: number) => void;
  rack_web_set_state: (id: number, value: number) => void;
  rack_web_state_buffer?: (bytes: number) => number;
  rack_web_commit_state_json?: (bytes: number) => number;
  rack_web_seed: (seed: number) => void;
  rack_web_process: (frames: number, sampleRate: number) => void;
};

export type WasmHostState = {
  runtime?: WasmExports;
  randomState?: number;
  clockNanoseconds?: bigint;
};

export function loadWasmStateJson(wasm: WasmExports, value: unknown) {
  if (!wasm.rack_web_state_buffer || !wasm.rack_web_commit_state_json) return;
  const bytes = new TextEncoder().encode(JSON.stringify(value ?? {}));
  const pointer = wasm.rack_web_state_buffer(bytes.length);
  if (!pointer) return;
  new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes);
  wasm.rack_web_commit_state_json(bytes.length);
}

/**
 * The browser runtime intentionally exposes a small, deterministic WASI
 * surface. Unsupported desktop/network syscalls return the same error code
 * instead of leaking browser globals into individual module adapters.
 */
export function browserWasiImports(holder: WasmHostState) {
  const missing = () => -2;
  const unsupported = () => -52;
  return {
    env: {
      emscripten_notify_memory_growth() {},
      _emscripten_system: unsupported,
      getnameinfo: unsupported,
      getaddrinfo: unsupported,
      __syscall_faccessat: missing,
      __syscall_fchmod: unsupported,
      __syscall_chmod: unsupported,
      __syscall_fchown32: unsupported,
      __syscall_ftruncate64: unsupported,
      __syscall_getdents64: missing,
      __syscall_getcwd(buffer: number, size: number) {
        if (!holder.runtime || size < 2) return -34;
        new Uint8Array(holder.runtime.memory.buffer, buffer, 2).set([47, 0]);
        return 2;
      },
      __syscall_readlinkat: missing,
      __syscall_rmdir: missing,
      __syscall_unlinkat: missing,
      __syscall_utimensat: unsupported,
      __syscall_bind: unsupported,
      __syscall_connect: unsupported,
      _emscripten_lookup_name: unsupported,
      __syscall_getsockname: unsupported,
      __syscall_recvfrom: unsupported,
      __syscall_sendto: unsupported,
      __syscall_setsockopt: unsupported,
      __syscall_shutdown: unsupported,
      __syscall_socket: unsupported,
    },
    wasi_snapshot_preview1: {
      proc_exit() {},
      fd_write(_fd: number, iovecs: number, iovecCount: number, written: number) {
        if (!holder.runtime) return 0;
        const view = new DataView(holder.runtime.memory.buffer);
        let bytes = 0;
        for (let index = 0; index < iovecCount; index++)
          bytes += view.getUint32(iovecs + index * 8 + 4, true);
        view.setUint32(written, bytes, true);
        return 0;
      },
      fd_read(_fd: number, _iovecs: number, _count: number, read: number) {
        if (holder.runtime)
          new DataView(holder.runtime.memory.buffer).setUint32(read, 0, true);
        return 0;
      },
      fd_sync() { return 0; },
      fd_seek(_fd: number, _offset: bigint, _whence: number, newOffset: number) {
        if (holder.runtime)
          new DataView(holder.runtime.memory.buffer).setBigUint64(newOffset, 0n, true);
        return 0;
      },
      fd_fdstat_get(_fd: number, status: number) {
        if (holder.runtime)
          new Uint8Array(holder.runtime.memory.buffer, status, 24).fill(0);
        return 0;
      },
      clock_time_get(_clockId: number, _precision: bigint, time: number) {
        if (!holder.runtime) return 0;
        holder.clockNanoseconds = (holder.clockNanoseconds ?? 1_000_000_000n) + 1_000_000n;
        new DataView(holder.runtime.memory.buffer).setBigUint64(time, holder.clockNanoseconds, true);
        return 0;
      },
      random_get(buffer: number, length: number) {
        if (!holder.runtime) return 0;
        const bytes = new Uint8Array(holder.runtime.memory.buffer, buffer, length);
        let state = holder.randomState ?? 0x9e3779b9;
        for (let index = 0; index < length; index++) {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          bytes[index] = state & 255;
        }
        holder.randomState = state >>> 0;
        return 0;
      },
      environ_sizes_get(count: number, size: number) {
        if (!holder.runtime) return 0;
        const view = new DataView(holder.runtime.memory.buffer);
        view.setUint32(count, 0, true);
        view.setUint32(size, 0, true);
        return 0;
      },
      environ_get() { return 0; },
      fd_close() { return 0; },
    },
  };
}
