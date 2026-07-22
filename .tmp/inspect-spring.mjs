import fs from "node:fs";

const bytes = fs.readFileSync(".rack-web-cache/SurgeXTRack-SurgeXTFXSpringReverb-debug3/module.wasm");
const holder = {exports: null, randomState: 0x9e3779b9};
const memory = () => holder.exports?.memory;
const view = () => memory() ? new DataView(memory().buffer) : null;
const missing = () => -2;
const unsupported = () => -52;
const imports = {
  env: {
    __syscall_faccessat: missing,
    __syscall_fchmod: unsupported,
    __syscall_chmod: unsupported,
    __syscall_fchown32: unsupported,
    __syscall_ftruncate64: unsupported,
    __syscall_getdents64: missing,
    __syscall_getcwd(buffer, size) {
      if (!memory() || size < 2) return -34;
      new Uint8Array(memory().buffer, buffer, 2).set([47, 0]);
      return 2;
    },
    __syscall_readlinkat: missing,
    __syscall_rmdir: missing,
    __syscall_unlinkat: missing,
    __syscall_utimensat: unsupported,
  },
  wasi_snapshot_preview1: {
    fd_write(_fd, iovecs, count, written) {
      const data = view();
      if (!data) return 0;
      let total = 0;
      for (let index = 0; index < count; index++) total += data.getUint32(iovecs + index * 8 + 4, true);
      data.setUint32(written, total, true);
      return 0;
    },
    fd_read(_fd, _iovecs, _count, read) { view()?.setUint32(read, 0, true); return 0; },
    fd_sync() { return 0; },
    fd_seek(_fd, _offset, _whence, next) { view()?.setBigUint64(next, 0n, true); return 0; },
    fd_fdstat_get(_fd, status) { if (memory()) new Uint8Array(memory().buffer, status, 24).fill(0); return 0; },
    clock_time_get(_clock, _precision, time) {
      holder.clock = (holder.clock ?? 1_000_000_000n) + 1_000_000n;
      view()?.setBigUint64(time, holder.clock, true);
      return 0;
    },
    random_get(buffer, length) {
      const output = new Uint8Array(memory().buffer, buffer, length);
      for (let index = 0; index < length; index++) {
        holder.randomState ^= holder.randomState << 13;
        holder.randomState ^= holder.randomState >>> 17;
        holder.randomState ^= holder.randomState << 5;
        output[index] = holder.randomState & 255;
      }
      holder.randomState >>>= 0;
      return 0;
    },
    environ_sizes_get(count, size) { view()?.setUint32(count, 0, true); view()?.setUint32(size, 0, true); return 0; },
    environ_get() { return 0; },
    fd_close() { return 0; },
  },
};

try {
  holder.exports = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports).exports;
  holder.exports._initialize();
  console.log("initialized");
  holder.exports.rack_web_set_input_connected(0, 1);
  holder.exports.rack_web_set_input_channels(0, 1);
  holder.exports.rack_web_set_output_connected(0, 1);
  holder.exports.rack_web_set_output_connected(1, 1);
  const inputs = new Float32Array(holder.exports.memory.buffer, holder.exports.rack_web_input_buffer(), 10 * 16 * 128);
  inputs[0] = 5;
  holder.exports.rack_web_process(128, 48000);
  console.log("processed");
} catch (error) {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
}
