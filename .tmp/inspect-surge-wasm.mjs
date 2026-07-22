import fs from "node:fs";

Error.stackTraceLimit = 100;
const holder = { exports: null };
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
      const bytes = memory() ? new Uint8Array(memory().buffer) : null;
      if (!bytes || size < 2) return -34;
      bytes[buffer] = 47;
      bytes[buffer + 1] = 0;
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
      let bytes = 0;
      for (let index = 0; data && index < count; index++) bytes += data.getUint32(iovecs + index * 8 + 4, true);
      data?.setUint32(written, bytes, true);
      return 0;
    },
    fd_read(_fd, _iovecs, _count, read) { view()?.setUint32(read, 0, true); return 0; },
    fd_sync() { return 0; },
    fd_seek(_fd, _offset, _whence, newOffset) { view()?.setBigUint64(newOffset, 0n, true); return 0; },
    fd_fdstat_get(_fd, status) { if (memory()) new Uint8Array(memory().buffer, status, 24).fill(0); return 0; },
    clock_time_get(_clock, _precision, time) { view()?.setBigUint64(time, 1_000_000_000n, true); return 0; },
    random_get(buffer, length) { if (memory()) new Uint8Array(memory().buffer, buffer, length).fill(1); return 0; },
    environ_sizes_get(count, size) { view()?.setUint32(count, 0, true); view()?.setUint32(size, 0, true); return 0; },
    environ_get() { return 0; },
    fd_close() { return 0; },
  },
};

const module = new WebAssembly.Module(fs.readFileSync(process.argv[2]));
console.log(WebAssembly.Module.imports(module));
holder.exports = new WebAssembly.Instance(module, imports).exports;
try {
  holder.exports._initialize();
  console.log("initialized");
  if (process.argv.includes("--render")) {
    const runtime = holder.exports;
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(9, 1);
    const decayArgument = process.argv.find(value => value.startsWith("--decay="));
    if (decayArgument) runtime.rack_web_set_param(3, Number(decayArgument.slice("--decay=".length)));
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    inputs[0] = 5;
    const left = [], right = [];
    for (let block = 0; block < 192; block++) {
      runtime.rack_web_process(128, 48000);
      left.push(...outputs.slice(0, 128));
      right.push(...outputs.slice(128, 256));
      inputs.fill(0);
    }
    const peak = values => Math.max(...values.map(Math.abs));
    console.log(JSON.stringify({
      channels: [runtime.rack_web_get_output_channels(0), runtime.rack_web_get_output_channels(1)],
      finite: left.every(Number.isFinite) && right.every(Number.isFinite),
      leftPeak: peak(left), rightPeak: peak(right),
      firstBlockPeak: peak(left.slice(0, 128)),
      tailPeak: peak(left.slice(128)),
      lateTailPeak: peak(left.slice(48_000 / 4)),
      stereoDifferencePeak: peak(left.map((value, index) => value - right[index])),
    }, null, 2));
  }
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
