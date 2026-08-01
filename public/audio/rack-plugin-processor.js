function rackWebWasiImports(holder) {
  const memory = () => holder.runtime?.memory;
  const view = () => memory() ? new DataView(memory().buffer) : null;
  const missing = () => -2;
  const unsupported = () => -52;
  return {
    env: {
      emscripten_notify_memory_growth() {},
      _emscripten_system: unsupported,
      getnameinfo: unsupported, getaddrinfo: unsupported,
      __syscall_faccessat: missing, __syscall_fchmod: unsupported,
      __syscall_chmod: unsupported, __syscall_fchown32: unsupported,
      __syscall_ftruncate64: unsupported, __syscall_getdents64: missing,
      __syscall_getcwd(buffer, size) {
        if (!memory() || size < 2) return -34;
        new Uint8Array(memory().buffer, buffer, 2).set([47, 0]); return 2;
      },
      __syscall_readlinkat: missing, __syscall_rmdir: missing,
      __syscall_unlinkat: missing, __syscall_utimensat: unsupported,
      __syscall_bind: unsupported, __syscall_connect: unsupported,
      _emscripten_lookup_name: unsupported, __syscall_getsockname: unsupported,
      __syscall_recvfrom: unsupported, __syscall_sendto: unsupported,
      __syscall_setsockopt: unsupported, __syscall_shutdown: unsupported,
      __syscall_socket: unsupported,
    },
    wasi_snapshot_preview1: {
      proc_exit() {},
      fd_write(_fd, iovecs, iovecCount, written) {
        const data = view(); if (!data) return 0; let bytes = 0;
        for (let index = 0; index < iovecCount; index++) bytes += data.getUint32(iovecs + index * 8 + 4, true);
        data.setUint32(written, bytes, true); return 0;
      },
      fd_read(_fd, _iovecs, _count, read) { view()?.setUint32(read, 0, true); return 0; },
      fd_sync() { return 0; },
      fd_seek(_fd, _offset, _whence, newOffset) { view()?.setBigUint64(newOffset, 0n, true); return 0; },
      fd_fdstat_get(_fd, status) { if (memory()) new Uint8Array(memory().buffer, status, 24).fill(0); return 0; },
      clock_time_get(_clockId, _precision, time) {
        if (!holder.runtime) return 0;
        holder.clockNanoseconds = (holder.clockNanoseconds ?? 1000000000n) + 1000000n;
        view().setBigUint64(time, holder.clockNanoseconds, true); return 0;
      },
      random_get(buffer, length) {
        if (!memory()) return 0; const bytes = new Uint8Array(memory().buffer, buffer, length);
        let state = holder.randomState ?? 0x9e3779b9;
        for (let index = 0; index < length; index++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; bytes[index] = state & 255; }
        holder.randomState = state >>> 0; return 0;
      },
      environ_sizes_get(count, size) { const data = view(); if (data) { data.setUint32(count, 0, true); data.setUint32(size, 0, true); } return 0; },
      environ_get() { return 0; }, fd_close() { return 0; },
    },
  };
}

function rackWebLoadStateJson(runtime, stateJson) {
  if (typeof stateJson !== "string" || !runtime.rack_web_state_buffer || !runtime.rack_web_commit_state_json) return false;
  const encoded=[];
  for(let index=0;index<stateJson.length;index++){
    const codepoint=stateJson.codePointAt(index);if(codepoint>0xffff)index++;
    if(codepoint<=0x7f)encoded.push(codepoint);
    else if(codepoint<=0x7ff)encoded.push(0xc0|(codepoint>>6),0x80|(codepoint&0x3f));
    else if(codepoint<=0xffff)encoded.push(0xe0|(codepoint>>12),0x80|((codepoint>>6)&0x3f),0x80|(codepoint&0x3f));
    else encoded.push(0xf0|(codepoint>>18),0x80|((codepoint>>12)&0x3f),0x80|((codepoint>>6)&0x3f),0x80|(codepoint&0x3f));
  }
  const bytes=Uint8Array.from(encoded),pointer = runtime.rack_web_state_buffer(bytes.length);
  if (!pointer) return false;
  new Uint8Array(runtime.memory.buffer, pointer, bytes.length).set(bytes);
  return runtime.rack_web_commit_state_json(bytes.length) === 1;
}

class RackPluginProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.runtime = null;
    this.params = [];
    this.inputConnections = [];
    this.outputConnections = [];
    this.port.onmessage = async ({data}) => {
      if (data.type === "load") {
        const wasiHolder = { runtime: null };
        const result = await WebAssembly.instantiate(data.wasm, rackWebWasiImports(wasiHolder));
        this.runtime = result.instance.exports;
        wasiHolder.runtime = this.runtime;
        this.runtime._initialize();
        this.runtime.rack_web_seed(data.seed || 1);
        this.runtime.rack_web_set_polyphony(data.polyphony || 1);
        rackWebLoadStateJson(this.runtime, data.stateJson);
        if (data.assets && this.runtime.rack_web_asset_capacity_for_slot && this.runtime.rack_web_asset_buffer_for_slot && this.runtime.rack_web_commit_asset_for_slot) {
          for (let slot = 0; slot < data.assets.length; slot++) {
            const asset = data.assets[slot];
            if (!asset) continue;
            const capacity = this.runtime.rack_web_asset_capacity_for_slot(slot);
            const samples = asset.samples instanceof Float32Array ? asset.samples : new Float32Array(asset.samples);
            const length = Math.min(capacity, samples.length);
            new Float32Array(this.runtime.memory.buffer, this.runtime.rack_web_asset_buffer_for_slot(slot), length).set(samples.subarray(0, length));
            const frames = Math.min(asset.frames, Math.floor(length / Math.max(1, asset.channels)));
            this.runtime.rack_web_commit_asset_for_slot(slot, frames, asset.channels, asset.sampleRate);
          }
        }
        if (data.asset && this.runtime.rack_web_asset_capacity && this.runtime.rack_web_asset_buffer && this.runtime.rack_web_commit_asset) {
          const capacity = this.runtime.rack_web_asset_capacity();
          const samples = data.asset.samples instanceof Float32Array ? data.asset.samples : new Float32Array(data.asset.samples);
          const length = Math.min(capacity, samples.length);
          new Float32Array(this.runtime.memory.buffer, this.runtime.rack_web_asset_buffer(), length).set(samples.subarray(0, length));
          const frames = Math.min(data.asset.frames, Math.floor(length / Math.max(1, data.asset.channels)));
          this.runtime.rack_web_commit_asset(frames, data.asset.channels, data.asset.sampleRate);
        }
        this.params = data.params || [];
        for (let id = 0; id < (data.state || []).length; id++) this.runtime.rack_web_set_state(id, data.state[id]);
        this.inputConnections = data.inputConnections || [];
        this.outputConnections = data.outputConnections || [];
        this.port.postMessage({type:"ready"});
      } else if (data.type === "param") {
        this.params[data.id] = data.value;
      }
    };
  }

  process(inputs, outputs) {
    const runtime = this.runtime;
    if (!runtime) return true;
    const frames = outputs[0]?.[0]?.length || inputs[0]?.[0]?.length || 128;
    for (let id = 0; id < this.params.length; id++) runtime.rack_web_set_param(id, this.params[id]);
    const inputCount = runtime.rack_web_input_count();
    const outputCount = runtime.rack_web_output_count();
    const maxChannels = runtime.rack_web_max_channels();
    for (let port = 0; port < outputCount; port++) runtime.rack_web_set_output_connected(port, this.outputConnections[port] ? 1 : 0);
    const rackInputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), Math.max(1,inputCount) * maxChannels * 128);
    rackInputs.fill(0);
    for (let port = 0; port < inputCount; port++) {
      const bus=inputs[port] || [],channels=Math.min(maxChannels,bus.length || (this.inputConnections[port] ? 1 : 0));
      runtime.rack_web_set_input_connected(port, this.inputConnections[port] ? 1 : 0);
      runtime.rack_web_set_input_channels(port,channels);
      for(let channel=0;channel<Math.min(channels,bus.length);channel++)for(let frame=0;frame<frames;frame++)rackInputs[(channel*inputCount+port)*128+frame]=bus[channel][frame]*5;
    }
    runtime.rack_web_process(frames, sampleRate);
    const rackOutputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), Math.max(1,outputCount) * maxChannels * 128);
    for(let port=0;port<Math.min(outputCount,outputs.length);port++){
      const activeChannels=Math.min(runtime.rack_web_get_output_channels(port),outputs[port].length);
      for(let channel=0;channel<outputs[port].length;channel++){const destination=outputs[port][channel];if(channel>=activeChannels){destination.fill(0);continue}for(let frame=0;frame<frames;frame++)destination[frame]=rackOutputs[(channel*outputCount+port)*128+frame]/5;}
    }
    return true;
  }
}

registerProcessor("rack-plugin-processor", RackPluginProcessor);
