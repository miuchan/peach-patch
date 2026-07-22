import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Bruer SEQ1 executes through the Rack Web WASM ABI", () => {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL("../public/wasm/bruer-seq1.wasm", import.meta.url)));
  assert.deepEqual(WebAssembly.Module.imports(wasmModule), []);
  const instance = new WebAssembly.Instance(wasmModule, {});
  const runtime = instance.exports;
  runtime._initialize();
  assert.equal(runtime.rack_web_param_count(), 19);
  assert.equal(runtime.rack_web_input_count(), 2);
  assert.equal(runtime.rack_web_output_count(), 4);
  assert.equal(runtime.rack_web_light_count(), 77);

  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 2 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 128);
  runtime.rack_web_seed(42);
  runtime.rack_web_set_param(0, 1);
  runtime.rack_web_set_input_connected(0,1);
  runtime.rack_web_set_input_channels(0,1);
  runtime.rack_web_process(1, 48000);
  inputs[0] = 10;
  runtime.rack_web_process(128, 48000);
  assert.equal(Math.max(...outputs.slice(128, 256)), 10);
  assert.ok(Number.isFinite(outputs[0]));
});

test("Fundamental VCA preserves the Rack port order and gain", () => {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL("../public/wasm/fundamental-vca.wasm", import.meta.url)));
  const runtime = new WebAssembly.Instance(wasmModule, {}).exports;
  runtime._initialize();
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count()], [2, 6, 2]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 128);
  runtime.rack_web_set_input_connected(2, 1);
  inputs[2 * 128] = 7;
  runtime.rack_web_process(128, 48000);
  assert.equal(outputs[0], 7);
});

test("ABI 0.3 carries four independent voices through Fundamental VCA", () => {
  const runtime=loadRuntime("fundamental-vca"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128);
  const outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,4);
  for(let channel=0;channel<4;channel++)inputs[(channel*inputCount+2)*128]=channel+1;
  runtime.rack_web_process(1,48000);
  assert.equal(runtime.rack_web_max_channels(),16);assert.equal(runtime.rack_web_get_output_channels(0),4);
  assert.deepEqual(Array.from({length:4},(_,channel)=>outputs[(channel*outputCount)*128]),[1,2,3,4]);
});

test("Rack poly inputs repeat mono but zero missing channels instead of wrapping voices",()=>{
  const runtime=loadRuntime("fundamental-vca"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,4);runtime.rack_web_set_input_connected(1,1);runtime.rack_web_set_input_channels(1,2);for(let channel=0;channel<4;channel++)inputs[(channel*inputCount+2)*128]=8;inputs[(0*inputCount+1)*128]=10;inputs[(1*inputCount+1)*128]=5;runtime.rack_web_process(1,48000);assert.deepEqual(Array.from({length:4},(_,channel)=>outputs[(channel*outputCount)*128]),[8,4,0,0]);
});

test("Fundamental ADSR produces an envelope from its gate input", () => {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL("../public/wasm/fundamental-adsr.wasm", import.meta.url)));
  const runtime = new WebAssembly.Instance(wasmModule, {}).exports;
  runtime._initialize();
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [9, 6, 1, 5]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 128);
  runtime.rack_web_set_input_connected(4, 1);
  inputs.fill(10, 4 * 128, 5 * 128);
  runtime.rack_web_process(128, 48000);
  assert.ok(outputs[127] > outputs[0]);
  assert.ok(outputs[127] > 0);
});

test("Fundamental ADSR maintains independent four-voice gate state",()=>{
  const runtime=loadRuntime("fundamental-adsr"),inputCount=runtime.rack_web_input_count();
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_input_connected(4,1);runtime.rack_web_set_input_channels(4,4);
  for(const channel of [0,2])inputs.fill(10,(channel*inputCount+4)*128,(channel*inputCount+5)*128);
  runtime.rack_web_process(128,48000);
  assert.equal(runtime.rack_web_get_output_channels(0),4);
  assert.ok(outputs[127]>0&&outputs[2*128+127]>0);assert.equal(outputs[128+127],0);assert.equal(outputs[3*128+127],0);
});

function loadRuntime(name) {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL(`../public/wasm/${name}.wasm`, import.meta.url)));
  assert.deepEqual(WebAssembly.Module.imports(wasmModule), []);
  const runtime = new WebAssembly.Instance(wasmModule, {}).exports;
  runtime._initialize();
  return runtime;
}

function loadDynamicRuntime(plugin, model) {
  return loadDynamicRuntimeWithWasi(plugin, model);
}

function loadDynamicRuntimeWithWasi(plugin, model) {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL(`../public/dynamic-plugins/${plugin}/${model}/module.wasm`, import.meta.url)));
  const holder = { runtime: null };
  let randomState = 0x9e3779b9;
  const memory = () => holder.runtime?.memory;
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
      fd_write(_fd, iovecs, iovecCount, written) {
        const data = view();
        if (!data) return 0;
        let bytes = 0;
        for (let index = 0; index < iovecCount; index++)
          bytes += data.getUint32(iovecs + index * 8 + 4, true);
        data.setUint32(written, bytes, true);
        return 0;
      },
      fd_read(_fd, _iovecs, _count, read) {
        view()?.setUint32(read, 0, true);
        return 0;
      },
      fd_sync() {
        return 0;
      },
      fd_seek(_fd, _offset, _whence, newOffset) {
        view()?.setBigUint64(newOffset, 0n, true);
        return 0;
      },
      fd_fdstat_get(_fd, status) {
        if (memory()) new Uint8Array(memory().buffer, status, 24).fill(0);
        return 0;
      },
      clock_time_get(_clockId, _precision, time) {
        holder.clockNanoseconds = (holder.clockNanoseconds ?? 1_000_000_000n) + 1_000_000n;
        new DataView(holder.runtime.memory.buffer).setBigUint64(time, holder.clockNanoseconds, true);
        return 0;
      },
      random_get(buffer, length) {
        const bytes = new Uint8Array(holder.runtime.memory.buffer, buffer, length);
        for (let index = 0; index < length; index++) {
          randomState ^= randomState << 13;
          randomState ^= randomState >>> 17;
          randomState ^= randomState << 5;
          bytes[index] = randomState & 0xff;
        }
        return 0;
      },
      environ_sizes_get(count, size) {
        const view = new DataView(holder.runtime.memory.buffer);
        view.setUint32(count, 0, true);
        view.setUint32(size, 0, true);
        return 0;
      },
      environ_get() {
        return 0;
      },
      fd_close() {
        return 0;
      },
    },
  };
  const runtime = new WebAssembly.Instance(wasmModule, imports).exports;
  holder.runtime = runtime;
  runtime._initialize();
  return runtime;
}

test("AS TinySine compiles from its official Library URL and runs its legacy Rack port ABI", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "AS/SineOSC");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "d90eed32afe6745454ef6ac6e391e0d5dc90ec4b");
  assert.equal(definition.runtime.strategy, "direct-rack-source-adapter");

  const runtime = loadDynamicRuntime("AS", "SineOSC");
  assert.deepEqual([
    runtime.rack_web_param_count(),
    runtime.rack_web_input_count(),
    runtime.rack_web_output_count(),
    runtime.rack_web_light_count(),
  ], [2, 1, 2, 1]);
  runtime.rack_web_set_output_connected(0, 1);
  runtime.rack_web_process(128, 48000);
  const output = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 128);
  assert.ok([...output].every(Number.isFinite));
  assert.ok(Math.max(...output) > 4.9);
  assert.ok(Math.min(...output) < -4.9);
});

test("HetrickCV AmplitudeShaper links its locked Gamma submodule and preserves four-voice routing", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "HetrickCV/AmplitudeShaper");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "ad0b04c7d7aa0087dbffb9fae32ac98a4b5621fe");
  assert.deepEqual(definition.bypassRoutes, [[0, 0]]);

  const runtime = loadDynamicRuntime("HetrickCV", "AmplitudeShaper");
  assert.deepEqual([
    runtime.rack_web_param_count(),
    runtime.rack_web_input_count(),
    runtime.rack_web_output_count(),
    runtime.rack_web_light_count(),
  ], [7, 4, 5, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 4);
  for (let port = 0; port < 5; port++) runtime.rack_web_set_output_connected(port, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 4 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 5 * 16 * 128);
  [-2, -1, 1, 2].forEach((value, channel) => { inputs[(channel * 4) * 128] = value; });
  runtime.rack_web_process(1, 48000);
  const port = (id) => [...Array(4)].map((_, channel) => outputs[(channel * 5 + id) * 128]);
  assert.deepEqual(port(0), [-2, -1, 1, 2]);
  assert.deepEqual(port(1), [-2, -1, 0, 0]);
  assert.deepEqual(port(2), [0, 0, 1, 2]);
  assert.deepEqual(port(3), [10, 10, 0, 0]);
  assert.deepEqual(port(4), [0, 0, 10, 10]);
});

test("HetrickCV final chaos classes receive a deterministic browser WASI clock", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  for (const model of ["Chaos1Op", "ClockedNoise"]) {
    const definition = catalog.find((item) => item.key === `HetrickCV/${model}`);
    assert.ok(definition);
    assert.equal(definition.localBuild.sourceCommit, "ad0b04c7d7aa0087dbffb9fae32ac98a4b5621fe");
    const runtime = loadDynamicRuntimeWithWasi("HetrickCV", model);
    for (let port = 0; port < runtime.rack_web_output_count(); port++) runtime.rack_web_set_output_connected(port, 1);
    for (let block = 0; block < 16; block++) runtime.rack_web_process(128, 48000);
    const outputCount = runtime.rack_web_output_count();
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), outputCount * 16 * 128);
    assert.ok([...outputs].every(Number.isFinite));
    assert.ok(Math.max(...outputs.map(Math.abs)) > 0.1);
  }
});

test("Bidoo lATe installs from its Library URL with Rack 2.6 timer and implicit port semantics",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/lATe");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.equal(definition.runtime.strategy,"direct-rack-source-adapter");assert.equal(definition.runtime.expander,undefined);assert.equal(definition.runtime.expanderMode,undefined);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[2,3,1,0]);assert.deepEqual(definition.inputs.map(({name,kind,position})=>[name,kind,position]),[["Swing","cv",{x:10,y:130}],["Clock","gate",{x:10,y:283}],["Reset","gate",{x:10,y:236}]]);assert.deepEqual(definition.outputs,[{id:0,name:"Clock",kind:"gate",position:{x:10,y:330}}]);assert.deepEqual(definition.stateKeys,[{key:"themeId",type:"integer"}]);
  const runtime=loadDynamicRuntime("Bidoo","lATe"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),3*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[2,3,1,0]);runtime.rack_web_set_input_connected(1,1);runtime.rack_web_set_input_channels(1,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_process(49,48000);assert.equal(Math.max(...outputs.slice(0,49)),0);inputs[128]=10;runtime.rack_web_process(1,48000);assert.equal(outputs[0],10);runtime.rack_web_process(48,48000);assert.ok([...outputs.slice(0,40)].every(value=>value===10));assert.equal(outputs[47],0)
});

test("Bidoo dTrOY compiles its quantizer helper chain and advances from an external clock",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/dTrOY");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.equal(definition.runtime.strategy,"direct-rack-source-adapter");assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[510,64,13,10,35]);assert.deepEqual(definition.inputs.slice(0,3).map(({name,kind})=>[name,kind]),[["Clock speed","gate"],["Ext. clock","gate"],["Reset","gate"]]);assert.deepEqual(definition.outputs.slice(0,3).map(({name,kind})=>[name,kind]),[["Gate","gate"],["Pitch","cv"],["Step gate","gate"]]);assert.equal(definition.params.filter(param=>param.button).length,25);assert.equal(definition.params.filter(param=>param.hidden).length,7);
  const runtime=loadDynamicRuntime("Bidoo","dTrOY"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),13*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),10*16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[64,13,10,35]);runtime.rack_web_set_input_connected(1,1);runtime.rack_web_set_input_channels(1,1);for(let output=0;output<10;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(1,48000);inputs[128]=10;runtime.rack_web_process(1,48000);assert.equal(outputs[0],10);assert.equal(outputs[128],0);assert.equal([...Array(8)].filter((_,index)=>outputs[(index+2)*128]===10).length,1);assert.ok(outputs.every(Number.isFinite))
});

test("Bidoo BanCau preserves its dual envelope routing and enum-derived port contract",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/BanCau");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[225,14,12,6,2]);assert.deepEqual(definition.inputs.slice(0,6).map(({name,kind})=>[name,kind]),[["Input 1","cv"],["Trigger 1","gate"],["V/Oct 1","cv"],["Rise CV 1","cv"],["Fall CV 1","cv"],["Both CV 1","cv"]]);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Pulse 1","gate"],["End 1","gate"],["Output 1","cv"],["Bipolar 2","cv"],["End 2","gate"],["Output 2","cv"]]);
  const runtime=loadDynamicRuntime("Bidoo","BanCau"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),12*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),6*16*128);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);for(let output=0;output<6;output++)runtime.rack_web_set_output_connected(output,1);inputs[0]=6;runtime.rack_web_process(1,48000);assert.deepEqual([outputs[0],outputs[128],outputs[256],outputs[384]],[10,10,6,-5]);inputs[0]=0;runtime.rack_web_process(1,48000);assert.deepEqual([outputs[0],outputs[128],outputs[256]],[0,10,0]);assert.ok(outputs.every(Number.isFinite))
});

test("Bidoo lIMbO runs its source stereo ladder filter with audio port inference",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/lIMbO");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[120,5,5,2,1]);assert.deepEqual(definition.inputs.slice(0,2).map(({name,kind})=>[name,kind]),[["Input L","audio"],["Input R","audio"]]);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Output L","audio"],["Output R","audio"]]);
  const runtime=loadDynamicRuntime("Bidoo","lIMbO"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),5*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);for(const input of [0,1]){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1)}for(const output of [0,1])runtime.rack_web_set_output_connected(output,1);inputs[0]=5;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,128).map(Math.abs))>.1);assert.equal(Math.max(...outputs.slice(128,256).map(Math.abs)),0)
});

test("Bidoo eDsaroS accepts browser PCM and runs its original polyphonic resampler",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/eDsaroS");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.equal(definition.runtime.strategy,"direct-rack-source-adapter");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});assert.ok(definition.runtime.initialMemory>=16777216);assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[135,21,18,1,1]);assert.deepEqual(definition.inputs.slice(0,2).map(({name,kind})=>[name,kind]),[["Trigger","gate"],["Pitch","cv"]]);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Output","audio"]]);
  const runtime=loadDynamicRuntime("Bidoo","eDsaroS"),frames=4096,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames);assert.equal(runtime.rack_web_asset_capacity(),1920000);for(let frame=0;frame<frames;frame++)asset[frame]=Math.sin(2*Math.PI*frame/64);runtime.rack_web_commit_asset(frames,1,48000);for(const input of [0,1]){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1)}runtime.rack_web_set_output_connected(0,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),18*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);inputs.fill(10,0,128);let peak=0,nonzero=0;for(let block=0;block<12;block++){runtime.rack_web_process(128,48000);for(const value of outputs.slice(0,128)){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));nonzero+=Math.abs(value)>1e-6}}assert.ok(peak>4);assert.ok(nonzero>1000);assert.equal(runtime.rack_web_get_output_channels(0),1)
});

test("Bidoo OUAIve preserves stereo browser PCM, slicing controls, and EOC routing",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/OUAIve");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[135,6,6,3,0]);assert.deepEqual(definition.params.map(param=>param.name),["Number of slices","Trigger Mode","Read Mode","Speed","Slices CV","Speed CV"]);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Output L","audio"],["Output R","audio"],["EOC","gate"]]);
  const runtime=loadDynamicRuntime("Bidoo","OUAIve"),frames=512,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames*2);assert.equal(runtime.rack_web_asset_capacity(),1920000);for(let frame=0;frame<frames;frame++){asset[frame*2]=.25;asset[frame*2+1]=-.5}runtime.rack_web_commit_asset(frames,2,48000);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);for(let output=0;output<3;output++)runtime.rack_web_set_output_connected(output,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),6*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),3*16*128);inputs[0]=10;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.deepEqual([...outputs.slice(0,128)],Array(128).fill(1.25));assert.deepEqual([...outputs.slice(128,256)],Array(128).fill(-2.5));assert.deepEqual([...outputs.slice(256,384)],Array(128).fill(0))
});

test("Bidoo cANARd loads browser PCM and records a live stereo loop without filesystem calls",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/cANARd");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[195,10,12,3,1]);assert.deepEqual(definition.inputs.slice(0,4).map(({name,kind})=>[name,kind]),[["Input L","audio"],["Input R","audio"],["Trigger","gate"],["Gate","gate"]]);assert.equal(definition.inputs[8].kind,"gate");assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Output L","audio"],["Output R","audio"],["EOC","gate"]]);
  const create=()=>loadDynamicRuntime("Bidoo","cANARd"),runtime=create(),frames=512,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames*2);for(let frame=0;frame<frames;frame++){asset[frame*2]=.25;asset[frame*2+1]=-.5}runtime.rack_web_commit_asset(frames,2,48000);runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,1);for(let output=0;output<3;output++)runtime.rack_web_set_output_connected(output,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),12*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),3*16*128);inputs.fill(10,3*128,4*128);runtime.rack_web_process(128,48000);assert.deepEqual([...outputs.slice(0,128)],Array(128).fill(1.25));assert.deepEqual([...outputs.slice(128,256)],Array(128).fill(-2.5));assert.ok(outputs.every(Number.isFinite));
  const recorder=create(),recordInputs=new Float32Array(recorder.memory.buffer,recorder.rack_web_input_buffer(),12*16*128),recordOutputs=new Float32Array(recorder.memory.buffer,recorder.rack_web_output_buffer(),3*16*128);for(const input of [0,1,3,8]){recorder.rack_web_set_input_connected(input,1);recorder.rack_web_set_input_channels(input,1)}for(let output=0;output<3;output++)recorder.rack_web_set_output_connected(output,1);recordInputs[0]=2;recordInputs[128]=-4;recordInputs[8*128]=10;recorder.rack_web_process(1,48000);recordInputs[8*128]=0;recorder.rack_web_process(1,48000);recordInputs[8*128]=10;recorder.rack_web_process(1,48000);recordInputs[8*128]=0;recordInputs[3*128]=10;recorder.rack_web_process(2,48000);assert.deepEqual([recordOutputs[0],recordOutputs[128],recordOutputs[256]],[1,-2,0])
});

test("Bidoo POUPRE loads browser PCM into its original 16-channel poly sampler",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/POUPRE");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[75,10,6,1,7]);assert.deepEqual(definition.params.slice(0,6).map(param=>param.name),["Channel","Start","Len","Loop","Speed","Gate"]);assert.equal(definition.params.filter(param=>param.button).length,4);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Poly","audio"]]);
  const runtime=loadDynamicRuntime("Bidoo","POUPRE"),frames=512,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames*2);for(let frame=0;frame<frames;frame++){asset[frame*2]=.2;asset[frame*2+1]=.6}runtime.rack_web_commit_asset(frames,2,48000);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_output_connected(0,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),6*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);inputs[0]=10;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,128))>1.9);assert.equal(runtime.rack_web_get_output_channels(0),1)
});

test("Bidoo MAGMA loads browser PCM while preserving its source filter and preset controls",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/MAGMA");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[120,14,10,1,7]);assert.deepEqual(definition.params.slice(0,10).map(param=>param.name),["Start","Len","Loop","Speed","Gate","Q","Freq","Filtertype","Channel","Kill"]);assert.equal(definition.params.filter(param=>param.button).length,4);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Poly","audio"]]);
  const runtime=loadDynamicRuntime("Bidoo","MAGMA"),frames=512,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames);asset.fill(.4);runtime.rack_web_commit_asset(frames,1,48000);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_output_connected(0,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),10*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);inputs[0]=10;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,128))>1.9);runtime.rack_web_set_param(7,1);inputs[0]=0;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.equal(runtime.rack_web_get_output_channels(0),1)
});

test("Bidoo OAI preserves 16 independent browser sample slots and polyphonic trigger routing",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/OAI");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"85c00f2aefa22d72d2a7472a1a937a962be3b07d");assert.deepEqual(definition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,slots:16});assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[120,10,10,1,3]);assert.deepEqual(definition.params.map(param=>param.name),["Start","Len","Loop","Speed","Gate","Q","Freq","Filtertype","Channel","Kill"]);assert.deepEqual(definition.outputs.map(({name,kind})=>[name,kind]),[["Poly","audio"]]);
  const runtime=loadDynamicRuntime("Bidoo","OAI"),frames=512;assert.equal(runtime.rack_web_asset_slot_count(),16);for(const [slot,value] of [[0,.2],[1,-.4]]){const capacity=runtime.rack_web_asset_capacity_for_slot(slot);assert.equal(capacity,1920000);const asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer_for_slot(slot),frames);asset.fill(value);runtime.rack_web_commit_asset_for_slot(slot,frames,1,48000)}runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,2);runtime.rack_web_set_output_connected(0,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),10*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);inputs[0]=10;inputs[10*128]=10;runtime.rack_web_process(128,48000);assert.equal(runtime.rack_web_get_output_channels(0),2);assert.deepEqual([...outputs.slice(0,128)],Array(128).fill(1));assert.deepEqual([...outputs.slice(128,256)],Array(128).fill(-2));assert.ok(outputs.every(Number.isFinite))
});

test("Bidoo SIGMA runs six independent source precision-adder groups",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/SIGMA");assert.ok(definition);assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[75,0,18,6,0]);const runtime=loadDynamicRuntime("Bidoo","SIGMA"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),18*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),6*16*128);for(let input=0;input<3;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=input+1}runtime.rack_web_set_output_connected(0,1);runtime.rack_web_process(1,48000);assert.equal(outputs[0],6);assert.ok(outputs.every(Number.isFinite))
});

test("Bidoo pErCO preserves its official three-band state-variable filter",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/pErCO");assert.ok(definition);assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[120,3,3,3,1]);assert.deepEqual(definition.outputs.map(({name})=>name),["Output Lp","Output Bipolar","Output Hp"]);const runtime=loadDynamicRuntime("Bidoo","pErCO"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),3*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),3*16*128);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);for(let output=0;output<3;output++)runtime.rack_web_set_output_connected(output,1);inputs[0]=5;runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.map(Math.abs))>.1)
});

test("Bidoo ACnE restores source snapshot matrices through Jansson pack and unpack",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bidoo/ACnE");assert.ok(definition);assert.deepEqual([definition.width,definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[510,200,17,8,67]);const create=()=>loadDynamicRuntime("Bidoo","ACnE"),runtime=create(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),17*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),8*16*128);runtime.rack_web_set_param(198,0);runtime.rack_web_set_param(70,.5);runtime.rack_web_set_input_connected(1,1);runtime.rack_web_set_input_channels(1,1);runtime.rack_web_set_output_connected(0,1);inputs[128]=4;runtime.rack_web_process(1,48000);assert.ok(Math.abs(outputs[0]-1.4)<1e-5,`expected 1.4V, received ${outputs[0]}V`);const bytes=runtime.rack_web_snapshot_state_json(),snapshot=new Uint8Array(runtime.memory.buffer,runtime.rack_web_snapshot_state_buffer(),bytes).slice(),restored=create(),target=new Uint8Array(restored.memory.buffer,restored.rack_web_state_buffer(bytes),bytes);target.set(snapshot);assert.equal(restored.rack_web_commit_state_json(bytes),1);assert.ok(Math.abs(restored.rack_web_get_param(70)-.5)<1e-6)
});

test("the next Bidoo utility batch remains executable across browser sample rates",()=>{
  const expected={tOCAnTe:[6,6,11,2],MU:[15,10,5,9],RATEAU:[36,5,8,27],MS:[0,4,4,0],DilEMO:[1,7,7,0],lambda:[0,2,6,0],VOID:[0,0,0,0],mINIBar:[9,2,1,1]},catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8"));for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model);const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),Math.max(1,inputCount)*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),Math.max(1,outputCount)*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=.25}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(128,44100);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}const mu=catalog.find(item=>item.key==="Bidoo/MU");assert.deepEqual(mu.params.slice(1,9).map(param=>param.name),["BPM fine","Step length","Step length fine","Note length","Step probability","Alternate end probability","Number of triggers","Trigger distribution"]);assert.deepEqual(mu.inputs.slice(7,9).map(({name,kind})=>[name,kind]),[["Number of triggers","cv"],["Trigger distribution","cv"]]);assert.deepEqual(mu.outputs.slice(0,2).map(({name,kind})=>[name,kind]),[["End of step","gate"],["Alternate end of step","gate"]])
});

test("Bidoo sequencer, controller, oscillator, and effect batch executes from official source",()=>{
  const expected={ChUTE:[4,4,3,0],bordL:[96,13,11,41],DIKTAT:[4,3,7,0],TiARE:[7,6,4,0],BAFIS:[23,24,1,0],LoURdE:[4,7,1,0],MOiRE:[40,3,16,16],PILOT:[77,19,16,105]},catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8"));for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model);const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),Math.max(1,inputCount)*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),Math.max(1,outputCount)*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=.1}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(128,44100);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}const pilot=catalog.find(item=>item.key==="Bidoo/PILOT");assert.ok(Math.abs(pilot.width-450)<.01);assert.ok(Math.max(...[...pilot.params,...pilot.inputs,...pilot.outputs].map(item=>item.position?.x??0))<pilot.width)
});

test("Bidoo large sequencers and dynamics modules keep legacy source helpers executable",()=>{
  const expected={ZOUMAI:[78,25,32,166],ENCORE:[78,25,32,166],ForK:[11,10,1,0],baR:[9,4,2,1]},catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8"));for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model);const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=.1}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(128,44100);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}
});

test("Bidoo's next filter, utility, mixer, and logic batch executes from official source",()=>{
  const expected={FREIN:[3,4,1,3],rabBIT:[16,18,2,16],BISTROT:[1,11,9,17],HUITre:[33,1,11,51]},catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8"));for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model);const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),Math.max(1,inputCount)*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),Math.max(1,outputCount)*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=.1}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(128,44100);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}
});

test("Bidoo expanders, vocoder, and granular shifter execute with Rack math and window parity",()=>{
  const expected={"ZOUMAI-Expander":[56,56,0,96],"ENCORE-Expander":[56,56,0,96],ziNC:[11,2,1,0],SPORE:[6,5,1,0]},catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8"));for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model);const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),Math.max(1,inputCount)*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),Math.max(1,outputCount)*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1);inputs[input*128]=.2}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);runtime.rack_web_process(128,44100);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}for(const model of ["ZOUMAI-Expander","ENCORE-Expander"]){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.equal(definition.runtime.expander.transport,"message-buffer");assert.equal(definition.runtime.expander.direction,"both");assert.equal(definition.runtime.expander.capacity,16384)}
});

test("Bidoo reverb and pitch modules link their original vendored DSP implementations",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),expected={dFUZE:[7,8,2,0],REI:[9,10,2,1],HCTIP:[1,2,1,0]};for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model)}
  const process=(model,blocks,fill)=>{const runtime=loadDynamicRuntime("Bidoo",model),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);for(let input=0;input<inputCount;input++){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1)}for(let output=0;output<outputCount;output++)runtime.rack_web_set_output_connected(output,1);let peak=0;for(let block=0;block<blocks;block++){fill(inputs,block);runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value),model);peak=Math.max(peak,Math.abs(value))}}return peak};
  assert.ok(process("dFUZE",24,(inputs,block)=>{inputs.fill(0);if(block===0)inputs[0]=5})>1e-6,"dFUZE produced no reverb output");assert.ok(process("REI",24,inputs=>{inputs.fill(0);inputs.fill(.2,0,128);inputs.fill(-.1,128,256)})>1e-6,"REI produced no reverb output");let phase=0;assert.ok(process("HCTIP",40,inputs=>{inputs.fill(0);for(let frame=0;frame<128;frame++)inputs[frame]=Math.sin((phase++)*.05)})>1e-6,"HCTIP produced no shifted output")
});

test("Bidoo image synthesis and the final dynamics batch execute through browser-safe assets",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),expected={EMILE:[8,7,1,4],dUKe:[21,4,4,0],fLAME:[6,1,1,6]};for(const [model,counts] of Object.entries(expected)){const definition=catalog.find(item=>item.key===`Bidoo/${model}`);assert.ok(definition,model);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],counts,model)}const emile=catalog.find(item=>item.key==="Bidoo/EMILE");assert.deepEqual(emile.runtime.asset,{type:"image",maxSamples:4194304,maxSeconds:0,channels:4});
  const runtime=loadDynamicRuntime("Bidoo","EMILE"),frames=1024,channels=4,asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),frames*channels);for(let frame=0;frame<frames;frame++){asset[frame*4]=(frame%32)/31;asset[frame*4+1]=.1;asset[frame*4+2]=.2;asset[frame*4+3]=1}runtime.rack_web_commit_asset(frames,channels,32);runtime.rack_web_set_param(4,1);runtime.rack_web_set_output_connected(0,1);const outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);let peak=0;for(let block=0;block<24;block++){runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value))}}assert.ok(peak>1e-5,`EMILE image oscillator peak was ${peak}`);
  for(const model of ["dUKe","fLAME"]){const instance=loadDynamicRuntime("Bidoo",model),inputCount=instance.rack_web_input_count(),outputCount=instance.rack_web_output_count(),inputs=new Float32Array(instance.memory.buffer,instance.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(instance.memory.buffer,instance.rack_web_output_buffer(),outputCount*16*128);for(let input=0;input<inputCount;input++){instance.rack_web_set_input_connected(input,1);instance.rack_web_set_input_channels(input,1);inputs[input*128]=.2}for(let output=0;output<outputCount;output++)instance.rack_web_set_output_connected(output,1);instance.rack_web_process(128,44100);instance.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite),model)}
});

test("Bidoo antN and liMonADe complete the official plugin through browser URL and wavetable assets",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),
    antNDefinition=catalog.find(item=>item.key==="Bidoo/antN"),
    lemonadeDefinition=catalog.find(item=>item.key==="Bidoo/liMonADe");
  assert.ok(antNDefinition);assert.ok(lemonadeDefinition);
  assert.deepEqual([antNDefinition.params.length,antNDefinition.inputs.length,antNDefinition.outputs.length,antNDefinition.lights],[3,0,2,3]);
  assert.deepEqual(antNDefinition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,url:true});
  assert.deepEqual([lemonadeDefinition.params.length,lemonadeDefinition.inputs.length,lemonadeDefinition.outputs.length,lemonadeDefinition.lights],[32,7,1,2]);
  assert.deepEqual(lemonadeDefinition.runtime.asset,{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2});

  const radio=loadDynamicRuntime("Bidoo","antN"),radioAsset=new Float32Array(radio.memory.buffer,radio.rack_web_asset_buffer(),8);
  radioAsset.set([.5,-.5,1,-1,-.5,.5,-1,1]);radio.rack_web_commit_asset(4,2,48000);
  radio.rack_web_set_output_connected(0,1);radio.rack_web_set_output_connected(1,1);radio.rack_web_set_param(1,1);radio.rack_web_process(4,48000);
  const radioOutput=new Float32Array(radio.memory.buffer,radio.rack_web_output_buffer(),2*16*128);
  assert.deepEqual([...radioOutput.slice(0,4)],[2.5,5,-2.5,-5]);assert.deepEqual([...radioOutput.slice(128,132)],[-2.5,-5,2.5,5]);

  const oscillator=loadDynamicRuntime("Bidoo","liMonADe"),frames=4096,wavetable=new Float32Array(oscillator.memory.buffer,oscillator.rack_web_asset_buffer(),frames);
  for(let frame=0;frame<frames;frame++)wavetable[frame]=Math.sin(2*Math.PI*frame/2048);
  oscillator.rack_web_commit_asset(frames,1,48000);oscillator.rack_web_set_output_connected(0,1);
  const output=new Float32Array(oscillator.memory.buffer,oscillator.rack_web_output_buffer(),16*128);let peak=0;
  for(let block=0;block<8;block++){oscillator.rack_web_process(128,48000);for(const value of output){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));}}
  assert.ok(peak>1e-4,`liMonADe wavetable oscillator peak was ${peak}`);
});

test("Surge XT Waveshaper keeps its official SIMD DSP while replacing desktop storage", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTWaveshaper");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [28, 6, 2]);
  assert.equal(definition.params[2].name, "Gain");
  assert.equal(definition.params[5].name, "Mod 1 to Drive");
  assert.deepEqual(definition.inputs.slice(2).map(({name, kind}) => [name, kind]), [
    ["Modulation Signal 1", "cv"], ["Modulation Signal 2", "cv"],
    ["Modulation Signal 3", "cv"], ["Modulation Signal 4", "cv"],
  ]);
  assert.deepEqual(definition.stateKeys, [{key: "doDCBlock", type: "boolean"}, {key: "displayPolyChannel", type: "integer"}]);

  const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTWaveshaper");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count()], [28, 6, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_output_connected(0, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
  for (let frame = 0; frame < 64; frame++) inputs[frame] = 4 * Math.sin(frame * Math.PI / 8);
  runtime.rack_web_process(64, 48000);
  const normal = [...outputs.slice(0, 16)];
  runtime.rack_web_set_param(0, 24);
  runtime.rack_web_process(64, 48000);
  const driven = [...outputs.slice(0, 16)];
  assert.ok(driven.every(Number.isFinite));
  assert.ok(driven.some((value, index) => Math.abs(value - normal[index]) > 1e-4));
  assert.ok(Math.max(...driven) >= 4.99 && Math.min(...driven) <= -4.99);
});

test("Surge XT Modern VCO runs its official oscillator with 1V/oct and polyphony", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTOSCModern");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [51, 7, 2]);
  assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), [
    "Sawtooth", "Pulse", "Triangle", "Width", "Sync", "Unison Detune", "Unison Voices",
  ]);
  assert.equal(definition.runtime.initialMemory, 20 * 1024 * 1024);

  const render = (pitches) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTOSCModern");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [51, 7, 2]);
    runtime.rack_web_seed(42);
    runtime.rack_web_set_polyphony(pitches.length);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, pitches.length);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 7 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    pitches.forEach((pitch, channel) => inputs.fill(pitch, (channel * 7) * 128, (channel * 7 + 1) * 128));
    const captured = pitches.map(() => []);
    for (let block = 0; block < 240; block++) {
      runtime.rack_web_process(128, 48000);
      if (block >= 160)
        for (let channel = 0; channel < pitches.length; channel++)
          captured[channel].push(...outputs.slice(channel * 2 * 128, channel * 2 * 128 + 128));
    }
    assert.equal(runtime.rack_web_get_output_channels(0), pitches.length);
    assert.ok(captured.flat().every(Number.isFinite));
    assert.ok(Math.max(...captured.flat().map(Math.abs)) > 0.5);
    const snapshotLength = runtime.rack_web_snapshot_state_json();
    const snapshot = JSON.parse(new TextDecoder().decode(new Uint8Array(
      runtime.memory.buffer, runtime.rack_web_snapshot_state_buffer(), snapshotLength,
    )));
    const encoded = new TextEncoder().encode(JSON.stringify(snapshot));
    new Uint8Array(runtime.memory.buffer, runtime.rack_web_state_buffer(encoded.length), encoded.length).set(encoded);
    assert.equal(runtime.rack_web_commit_state_json(encoded.length), 1);
    return captured;
  };
  const frequencies = render([0, 1]).map((samples) => {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    let crossings = 0;
    for (let index = 1; index < samples.length; index++)
      if (samples[index - 1] <= mean && samples[index] > mean) crossings++;
    return crossings * 48000 / (samples.length - 1);
  });
  assert.ok(frequencies[0] > 200 && frequencies[0] < 330, `unexpected base pitch ${frequencies[0]}`);
  assert.ok(frequencies[1] / frequencies[0] > 1.9 && frequencies[1] / frequencies[0] < 2.1);
});

test("Surge XT Wavetable VCO morphs its browser-resident table through official DSP", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTOSCWavetable");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), [
    "Morph", "Skew Vertical", "Saturate", "Formant", "Skew Horizontal", "Unison Detune", "Unison Voices",
  ]);

  const render = (morph) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTOSCWavetable");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [51, 7, 2]);
    runtime.rack_web_seed(73);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(1, morph);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 160; block++) {
      runtime.rack_web_process(128, 48000);
      if (block >= 96) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    assert.ok(Math.max(...captured.map(Math.abs)) > 0.5);
    return captured;
  };
  const sine = render(0), saw = render(1);
  const difference = sine.reduce((sum, value, index) => sum + Math.abs(value - saw[index]), 0) / sine.length;
  assert.ok(difference > 0.1, `wavetable morph did not alter the waveform: ${difference}`);
});

test("Surge XT Classic VCO preserves its BLIT shape and sync controls", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTOSCClassic");
  assert.ok(definition);
  assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), [
    "Shape", "Width 1", "Width 2", "Sub Mix", "Sync", "Unison Detune", "Unison Voices",
  ]);
  const render = (shape) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTOSCClassic");
    runtime.rack_web_seed(19);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(1, shape);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 160; block++) {
      runtime.rack_web_process(128, 48000);
      if (block >= 96) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    assert.ok(Math.max(...captured.map(Math.abs)) > 0.5);
    return captured;
  };
  const first = render(0), second = render(1);
  const difference = first.reduce((sum, value, index) => sum + Math.abs(value - second[index]), 0) / first.length;
  assert.ok(difference > 0.1);
});

test("Surge XT Sine VCO keeps feedback, filter, and unison controls", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTOSCSine");
  assert.ok(definition);
  assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), [
    "Shape", "Feedback", "Behavior", "Low Cut", "High Cut", "Unison Detune", "Unison Voices",
  ]);
  const render = (feedback) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTOSCSine");
    runtime.rack_web_seed(31);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(2, feedback);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 160; block++) {
      runtime.rack_web_process(128, 48000);
      if (block >= 96) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    assert.ok(Math.max(...captured.map(Math.abs)) > 0.5);
    return captured;
  };
  const clean = render(0), feedback = render(0.8);
  const difference = clean.reduce((sum, value, index) => sum + Math.abs(value - feedback[index]), 0) / clean.length;
  assert.ok(difference > 0.05);
});

test("Surge XT FM2 and FM3 expose and run their official phase-modulation engines", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const cases = [
    {
      model: "SurgeXTOSCFM2",
      names: ["M1 Amount", "M1 Ratio", "M2 Amount", "M2 Ratio", "M1/2 Offset", "M1/2 Phase", "Feedback"],
      changedParam: 1,
    },
    {
      model: "SurgeXTOSCFM3",
      names: ["M1 Amount", "M1 Frequency", "M1 Ratio", "M2 Amount", "M2 Frequency", "M2 Ratio", "M3 Amount"],
      changedParam: 1,
    },
  ];

  const render = (model, changedParam, amount) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", model);
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [51, 7, 2]);
    runtime.rack_web_seed(101);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(changedParam, amount);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 192; block++) {
      runtime.rack_web_process(128, 48000);
      if (block >= 128) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    assert.ok(Math.max(...captured.map(Math.abs)) > 0.5);
    return captured;
  };

  for (const {model, names, changedParam} of cases) {
    const definition = catalog.find((item) => item.key === `SurgeXTRack/${model}`);
    assert.ok(definition);
    assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
    assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), names);
    const clean = render(model, changedParam, 0), modulated = render(model, changedParam, 1);
    const difference = clean.reduce((sum, value, index) => sum + Math.abs(value - modulated[index]), 0) / clean.length;
    assert.ok(difference > 0.05, `${model} modulation did not alter the waveform: ${difference}`);
  }
});

test("Surge XT specialty VCOs run SH, string, Plaits, alias, and window DSP", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const cases = [
    {model: "SurgeXTOSCSHNoise", names: ["Correlation", "Width", "Low Cut", "High Cut", "Sync", "Unison Detune", "Unison Voices"], param: 1},
    {model: "SurgeXTOSCString", names: ["Exciter", "Exciter Level", "String 1 Decay", "String 2 Decay", "String 2 Detune", "String Balance", "Stiffness"], param: 7, trigger: true},
    {model: "SurgeXTOSCTwist", names: ["Engine", "Harmonics", "Timbre", "Morph", "Aux Mix", "LPG Response", "LPG Decay"], param: 1, trigger: true},
    {model: "SurgeXTOSCAlias", names: ["Shape", "Wrap", "Mask", "Threshold", "Bitcrush", "Unison Detune", "Unison Voices"], param: 2, paramCount: 67},
    {model: "SurgeXTOSCWindow", names: ["Morph", "Formant", "Window", "Low Cut", "High Cut", "Unison Detune", "Unison Voices"], param: 3},
  ];

  const render = ({model, param, trigger, paramCount}, value) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", model);
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [paramCount ?? 51, 7, 2]);
    runtime.rack_web_seed(211);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(param, value);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 7 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    if (trigger) {
      runtime.rack_web_set_input_connected(1, 1);
      runtime.rack_web_set_input_channels(1, 1);
      inputs.fill(10, 128, 256);
    }
    const captured = [], totalBlocks = trigger ? 96 : 224, captureFrom = trigger ? 1 : 128;
    for (let block = 0; block < totalBlocks; block++) {
      runtime.rack_web_process(128, 48000);
      if (block === 0 && trigger) inputs.fill(0, 128, 256);
      if (block >= captureFrom) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite), `${model} produced non-finite audio`);
    const peak = Math.max(...captured.map(Math.abs));
    assert.ok(peak > 0.0001, `${model} was silent (peak ${peak})`);
    return captured;
  };

  for (const entry of cases) {
    const definition = catalog.find((item) => item.key === `SurgeXTRack/${entry.model}`);
    assert.ok(definition);
    assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
    assert.deepEqual(definition.params.slice(1, 8).map((param) => param.name), entry.names);
    assert.deepEqual(definition.inputs.slice(2, 6).map((input) => input.name), [
      "Modulation Signal 1", "Modulation Signal 2", "Modulation Signal 3", "Modulation Signal 4",
    ]);
    const low = render(entry, 0), high = render(entry, 1);
    const difference = low.reduce((sum, sample, index) => sum + Math.abs(sample - high[index]), 0) / low.length;
    assert.ok(difference > 0.01, `${entry.model} control did not alter its official DSP: ${difference}`);
  }
});

test("Surge XT Digital RingMod keeps its official oversampled CXOR algorithms", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTDigitalRingMod");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [3, 8, 4]);
  assert.deepEqual(definition.params.map(({name, min, max}) => [name, min, max]), [
    ["CXOR 1 Algorithm", 0, 12],
    ["CXOR 2 Algorithm", 0, 12],
    ["Link Second A to First Output", 0, 1],
  ]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1], [4, 2], [5, 3]]);

  const run = (algorithm) => {
    const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTDigitalRingMod");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [3, 8, 4]);
    for (const port of [0, 2]) {
      runtime.rack_web_set_input_connected(port, 1);
      runtime.rack_web_set_input_channels(port, 1);
    }
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(0, algorithm);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 8 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 16 * 128);
    for (let frame = 0; frame < 128; frame++) {
      inputs[frame] = 3 * Math.sin(frame * Math.PI / 8);
      inputs[2 * 128 + frame] = 2 * Math.cos(frame * Math.PI / 11);
    }
    runtime.rack_web_process(128, 48000);
    assert.equal(runtime.rack_web_get_output_channels(0), 1);
    return [...outputs.slice(0, 128)];
  };
  const ring = run(0);
  const continuousXor = run(1);
  assert.ok(ring.every(Number.isFinite) && continuousXor.every(Number.isFinite));
  assert.ok(Math.max(...ring.map(Math.abs)) > 1);
  assert.ok(ring.some((value, index) => Math.abs(value - continuousXor[index]) > 0.1));
});

test("Surge XT VCF runs the official stateful filter kernel in browser WASM", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTVCF");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [27, 6, 2]);
  assert.deepEqual(definition.params.slice(0, 5).map(({name}) => name), [
    "Frequency", "Resonance", "Pre-Filter Gain", "Mix", "Gain",
  ]);
  assert.equal(definition.params[5].name, "Mod 1 to Frequency");
  assert.equal(definition.params[25].name, "Filter Model Type");
  assert.equal(definition.params[26].name, "Filter Model SubType");
  assert.deepEqual(definition.params.slice(0, 5).map(({position}) => position), [
    {x: 48.661, y: 186.024, centered: true},
    {x: 110.669, y: 162.402, centered: true},
    {x: 110.669, y: 209.646, centered: true},
    {x: 152.008, y: 162.402, centered: true},
    {x: 152.008, y: 209.646, centered: true},
  ]);
  assert.ok(definition.params.slice(5, 25).every((param) => param.position === undefined));
  assert.deepEqual(definition.params.slice(25).map(({position}) => position), [
    {x: 90.001, y: 34.252, width: 150.591, height: 13.287, control: "selector", centered: true},
    {x: 90.001, y: 125.788, width: 150.591, height: 13.287, control: "selector", centered: true},
  ]);
  assert.deepEqual(definition.inputs.slice(2).map(({name, kind}) => [name, kind]), [
    ["Modulation Signal 1", "cv"], ["Modulation Signal 2", "cv"],
    ["Modulation Signal 3", "cv"], ["Modulation Signal 4", "cv"],
  ]);
  assert.deepEqual(definition.inputs.map(({position}) => position), [
    {x: 27.992, y: 338.091, centered: true},
    {x: 69.331, y: 338.091, centered: true},
    {x: 27.992, y: 295.748, centered: true},
    {x: 69.331, y: 295.748, centered: true},
    {x: 110.669, y: 295.748, centered: true},
    {x: 152.008, y: 295.748, centered: true},
  ]);
  assert.deepEqual(definition.outputs.map(({position}) => position), [
    {x: 110.669, y: 338.091, centered: true},
    {x: 152.008, y: 338.091, centered: true},
  ]);
  assert.deepEqual(definition.stateKeys, [{key: "modulespecific", path: ["displayPolyChannel"], type: "integer"}]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);

  const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTVCF");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [27, 6, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_output_connected(0, 1);
  runtime.rack_web_set_param(0, -2);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
  inputs[0] = 5;
  const rendered = [];
  for (let block = 0; block < 8; block++) {
    runtime.rack_web_process(128, 48000);
    rendered.push(...outputs.slice(0, 128));
    inputs.fill(0);
  }
  assert.equal(runtime.rack_web_get_output_channels(0), 1);
  assert.ok(rendered.every(Number.isFinite));
  assert.ok(Math.max(...rendered.map(Math.abs)) > 1e-3);
  assert.ok(Math.max(...rendered.slice(128).map(Math.abs)) > 1e-5, "filter impulse response must retain state after the dry impulse ends");
});

test("Surge XT Delay preserves its official sinc buffer and exact 10ms timing", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTDelay");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [51, 7, 2]);
  assert.deepEqual(definition.params.slice(0, 10).map(({name}) => name), [
    "Left Delay", "Right Delay", "Time Tweak", "Feedback", "CrossFeed",
    "LoCut", "HiCut", "ModRate", "ModDepth", "Mix",
  ]);
  assert.equal(definition.params[10].name, "Mod 1 to Left Delay");
  assert.equal(definition.params[49].name, "Mod 4 to Mix");
  assert.deepEqual(definition.inputs.slice(2).map(({name, kind}) => [name, kind]), [
    ["Clock/BPM", "gate"], ["Mod 1", "cv"], ["Mod 2", "cv"],
    ["Mod 3", "cv"], ["Mod 4", "cv"],
  ]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);
  assert.equal(definition.runtime.initialMemory, 8 * 1024 * 1024);

  const wasmModule = new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/SurgeXTRack/SurgeXTDelay/module.wasm", import.meta.url)));
  assert.deepEqual(WebAssembly.Module.imports(wasmModule).map(({module, name}) => [module, name]), [
    ["wasi_snapshot_preview1", "environ_sizes_get"],
    ["wasi_snapshot_preview1", "environ_get"],
    ["wasi_snapshot_preview1", "fd_close"],
  ]);
  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTDelay");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [51, 7, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_output_connected(0, 1);
  runtime.rack_web_set_param(0, Math.log2(0.01));
  runtime.rack_web_set_param(3, 0);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 7 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
  inputs[0] = 5;
  const rendered = [];
  for (let block = 0; block < 12; block++) {
    runtime.rack_web_process(128, 48000);
    rendered.push(...outputs.slice(0, 128));
    inputs.fill(0);
  }
  const peak = Math.max(...rendered.map(Math.abs));
  assert.ok(rendered.every(Number.isFinite));
  assert.ok(peak > 2);
  assert.equal(rendered.findIndex((value) => Math.abs(value) === peak), 480);
});

test("Surge XT Reverb preserves the official stereo tail and decay response", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXReverb");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Pre-Delay", "Room Shape", "Size", "Decay Time", "HF Damping", "Low Cut",
    "Peak Freq", "Peak Gain", "High Cut", "Mix", "Width", "Unused Effect Slot 1",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Enable Low Cut", "Enable High Cut"]);
  assert.deepEqual(definition.inputs.slice(5).map(({name}) => name), [
    "Modulation Signal 1", "Modulation Signal 2", "Modulation Signal 3", "Modulation Signal 4",
  ]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);
  assert.equal(definition.runtime.initialMemory, 20 * 1024 * 1024);

  const renderImpulse = (decay) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXReverb");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(1, 1);
    runtime.rack_web_set_input_channels(1, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(3, decay);
    runtime.rack_web_set_param(9, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    inputs[0] = 5;
    let peak = 0, lateTailPeak = 0, stereoDifferencePeak = 0;
    for (let block = 0; block < 192; block++) {
      runtime.rack_web_process(128, 48000);
      const left = outputs.slice(0, 128), right = outputs.slice(128, 256);
      assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
      for (let index = 0; index < 128; index++) {
        peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
        stereoDifferencePeak = Math.max(stereoDifferencePeak, Math.abs(left[index] - right[index]));
        if (block >= 94) lateTailPeak = Math.max(lateTailPeak, Math.abs(left[index]), Math.abs(right[index]));
      }
      inputs.fill(0);
    }
    assert.deepEqual([runtime.rack_web_get_output_channels(0), runtime.rack_web_get_output_channels(1)], [1, 1]);
    return {peak, lateTailPeak, stereoDifferencePeak};
  };

  const short = renderImpulse(.05), long = renderImpulse(.95);
  assert.ok(short.peak > 1e-3);
  assert.ok(long.peak > 1);
  assert.ok(long.lateTailPeak > short.lateTailPeak * 1000);
  assert.ok(long.stereoDifferencePeak > .1);
});

test("Surge XT Phaser preserves its official stateful stereo sweep", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXPhaser");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Center", "Feedback", "Sharpness", "Depth", "Stereo", "Mix",
    "Width", "Tone", "Rate", "Count", "Spread", "Waveform",
  ]);
  assert.equal(definition.params.at(-1).name, "Enable Tone Filter");
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);

  const render = (center) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXPhaser");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, center);
    runtime.rack_web_set_param(1, .75);
    runtime.rack_web_set_param(3, 1);
    runtime.rack_web_set_param(4, .8);
    runtime.rack_web_set_param(5, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    for (let block = 0; block < 96; block++) {
      for (let index = 0; index < 128; index++) inputs[index] = 3 * Math.sin(2 * Math.PI * 220 * (block * 128 + index) / 48000);
      runtime.rack_web_process(128, 48000);
      if (block >= 32) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const low = render(.15), high = render(.85);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(low.left) > .1 && peak(high.left) > .1);
  assert.ok(peak(low.left.map((value, index) => value - low.right[index])) > .01);
  assert.ok(peak(low.left.map((value, index) => value - high.left[index])) > .1);
});

test("Surge XT Distortion preserves its official drive and waveshaper response", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXDistortion");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Pre EQ Gain", "Pre EQ Frequency", "Pre EQ Bandwidth", "Pre EQ High Cut", "Drive", "Feedback",
    "Post EQ Gain", "Post EQ Frequency", "Post EQ Bandwidth", "Post EQ High Cut", "Output Gain", "Model",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Enable Pre High Cut", "Enable Post High Cut"]);

  const render = (drive) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXDistortion");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(4, drive);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 96; block++) {
      for (let index = 0; index < 128; index++) inputs[index] = Math.sin(2 * Math.PI * 375 * (block * 128 + index) / 48000);
      runtime.rack_web_process(128, 48000);
      if (block >= 64) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const quiet = render(.05), driven = render(.95);
  const rms = (values) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  const difference = driven.map((value, index) => value - quiet[index]);
  assert.ok(rms(quiet) > .01 && rms(driven) > .01);
  assert.ok(rms(difference) > .1);
});

test("Surge XT Chorus preserves its official four-voice modulated delay", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXChorus");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Time", "Rate", "Depth", "Feedback", "Low Cut", "High Cut", "Mix", "Width",
    "Unused Effect Slot 1", "Unused Effect Slot 2", "Unused Effect Slot 3", "Unused Effect Slot 4",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Enable Low Cut", "Enable High Cut"]);

  const renderImpulse = (rate) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXChorus");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, .5);
    runtime.rack_web_set_param(1, rate);
    runtime.rack_web_set_param(2, 1);
    runtime.rack_web_set_param(3, .5);
    runtime.rack_web_set_param(6, 1);
    runtime.rack_web_set_param(7, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    inputs[0] = 5;
    for (let block = 0; block < 96; block++) {
      runtime.rack_web_process(128, 48000);
      left.push(...outputs.slice(0, 128));
      right.push(...outputs.slice(128, 256));
      inputs.fill(0);
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const slow = renderImpulse(.1), fast = renderImpulse(.9);
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(slow.left.slice(128)) > .01);
  assert.ok(peak(slow.left.map((value, index) => value - slow.right[index])) > .01);
  assert.ok(peak(slow.left.map((value, index) => value - fast.left[index])) > .01);
});

test("Surge XT Flanger preserves its official feedback comb response", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXFlanger");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Mode", "Waveform", "Rate", "Depth", "Count", "Base Pitch", "Spacing", "Feedback",
    "HF Damping", "Width", "Mix", "Unused Effect Slot 1",
  ]);

  const renderImpulse = (pitch) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXFlanger");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(2, .6);
    runtime.rack_web_set_param(3, 1);
    runtime.rack_web_set_param(5, pitch);
    runtime.rack_web_set_param(7, .75);
    runtime.rack_web_set_param(9, 1);
    runtime.rack_web_set_param(10, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    inputs[0] = 5;
    for (let block = 0; block < 96; block++) {
      runtime.rack_web_process(128, 48000);
      left.push(...outputs.slice(0, 128));
      right.push(...outputs.slice(128, 256));
      inputs.fill(0);
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const low = renderImpulse(.2), high = renderImpulse(.8);
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(low.left.slice(128)) > .01);
  assert.ok(peak(low.left.map((value, index) => value - low.right[index])) > .01);
  assert.ok(peak(low.left.map((value, index) => value - high.left[index])) > .01);
});

test("Surge XT Rotary Speaker preserves its official Doppler stereo motion", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXRotarySpeaker");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Horn Rate", "Doppler", "Tremolo", "Rotor Rate", "Drive", "Model", "Width", "Mix",
    "Unused Effect Slot 1", "Unused Effect Slot 2", "Unused Effect Slot 3", "Unused Effect Slot 4",
  ]);
  assert.equal(definition.params.at(-1).name, "Enable Drive");

  const render = (rate) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXRotarySpeaker");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, rate);
    runtime.rack_web_set_param(1, 1);
    runtime.rack_web_set_param(2, 1);
    runtime.rack_web_set_param(3, rate);
    runtime.rack_web_set_param(6, 1);
    runtime.rack_web_set_param(7, 1);
    runtime.rack_web_set_param(60, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    for (let block = 0; block < 128; block++) {
      for (let index = 0; index < 128; index++) inputs[index] = 2 * Math.sin(2 * Math.PI * 220 * (block * 128 + index) / 48000);
      runtime.rack_web_process(128, 48000);
      if (block >= 64) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const slow = render(.1), fast = render(.9);
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(slow.left) > .01);
  assert.ok(peak(slow.left.map((value, index) => value - slow.right[index])) > .01);
  assert.ok(peak(slow.left.map((value, index) => value - fast.left[index])) > .01);
});

test("Surge XT Frequency Shifter preserves independent sideband motion", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXFrequencyShifter");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Left", "Right", "Time", "Feedback", "Mix", "Unused Effect Slot 1", "Unused Effect Slot 2",
    "Unused Effect Slot 3", "Unused Effect Slot 4", "Unused Effect Slot 5", "Unused Effect Slot 6", "Unused Effect Slot 7",
  ]);
  assert.equal(definition.params.at(-1).name, "Extend Frequency");

  const render = (leftShift) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXFrequencyShifter");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, leftShift);
    runtime.rack_web_set_param(1, 1 - leftShift);
    runtime.rack_web_set_param(3, .25);
    runtime.rack_web_set_param(4, 1);
    runtime.rack_web_set_param(60, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    for (let block = 0; block < 192; block++) {
      for (let index = 0; index < 128; index++) inputs[index] = 2 * Math.sin(2 * Math.PI * 440 * (block * 128 + index) / 48000);
      runtime.rack_web_process(128, 48000);
      if (block >= 128) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const low = render(.6), high = render(.8);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  const peaks = {lowLeft: peak(low.left), lowRight: peak(low.right), highLeft: peak(high.left), highRight: peak(high.right)};
  assert.ok(peaks.lowLeft > .01, JSON.stringify(peaks));
  assert.ok(peak(low.left.map((value, index) => value - low.right[index])) > .01);
  assert.ok(peak(low.left.map((value, index) => value - high.left[index])) > .01);
});

test("Surge XT FX RingMod preserves its official external sideband path", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXRingMod");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Shape", "Frequency", "Unison Detune", "Unison Voices", "Forward Bias", "Linear Region",
    "Low Cut", "High Cut", "Mix", "Unused Effect Slot 1", "Unused Effect Slot 2", "Unused Effect Slot 3",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Enable Low Cut", "Enable High Cut"]);

  const render = (sidebandFrequency) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXRingMod");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(2, 1);
    runtime.rack_web_set_input_channels(2, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(8, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 96; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 2 * Math.sin(2 * Math.PI * 220 * sample / 48000);
        inputs[2 * 128 + index] = 2 * Math.sin(2 * Math.PI * sidebandFrequency * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 32) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const low = render(110), high = render(330);
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(low) > .01 && peak(high) > .01);
  assert.ok(peak(low.map((value, index) => value - high[index])) > .01);
});

test("Surge XT Reverb2 preserves its official diffusion and decay tail", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXReverb2");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Pre-Delay", "Room Size", "Decay Time", "Diffusion", "Buildup", "Modulation",
    "LF Damping", "HF Damping", "Width", "Mix", "Unused Effect Slot 1", "Unused Effect Slot 2",
  ]);

  const renderTail = (decay) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXReverb2");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(2, decay);
    runtime.rack_web_set_param(3, .8);
    runtime.rack_web_set_param(4, .8);
    runtime.rack_web_set_param(8, 1);
    runtime.rack_web_set_param(9, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    let peak = 0, lateTailPeak = 0, stereoDifferencePeak = 0;
    for (let block = 0; block < 768; block++) {
      if (block < 256) {
        for (let index = 0; index < 128; index++) inputs[index] = 2 * Math.sin(2 * Math.PI * 220 * (block * 128 + index) / 48000);
      } else inputs.fill(0);
      runtime.rack_web_process(128, 48000);
      for (let index = 0; index < 128; index++) {
        const left = outputs[index], right = outputs[128 + index];
        assert.ok(Number.isFinite(left) && Number.isFinite(right));
        peak = Math.max(peak, Math.abs(left), Math.abs(right));
        stereoDifferencePeak = Math.max(stereoDifferencePeak, Math.abs(left - right));
        if (block >= 500) lateTailPeak = Math.max(lateTailPeak, Math.abs(left), Math.abs(right));
      }
    }
    return {peak, lateTailPeak, stereoDifferencePeak};
  };

  const short = renderTail(.05), long = renderTail(.95);
  assert.ok(short.peak > 1e-3 && long.peak > 1e-3);
  assert.ok(long.lateTailPeak > short.lateTailPeak * 2, JSON.stringify({short, long}));
  assert.ok(long.stereoDifferencePeak > .01);
});

test("Surge XT Vocoder preserves its official external modulator filter bank", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXVocoder");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Output Gain", "Gate", "Env Follow", "Q", "Unused Effect Slot 1", "Bands",
    "Min Frequency", "Max Frequency", "Input", "Range", "Center", "Mix",
  ]);

  const render = (withModulator) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXVocoder");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    if (withModulator) {
      runtime.rack_web_set_input_connected(2, 1);
      runtime.rack_web_set_input_channels(2, 1);
    }
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(1, 0);
    runtime.rack_web_set_param(2, .7);
    runtime.rack_web_set_param(11, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 192; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 2 * (2 * ((sample * 110 / 48000) % 1) - 1);
        if (withModulator) inputs[2 * 128 + index] = Math.sin(2 * Math.PI * 220 * sample / 48000) >= 0 ? 5 : -5;
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 96) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const silent = render(false), modulated = render(true);
  const peak = (values) => Math.max(...values.map(Math.abs));
  assert.ok(peak(modulated) > .01);
  assert.ok(peak(modulated.map((value, index) => value - silent[index])) > .01);
});

test("Surge XT Neuron preserves its official recurrent distortion and tuned comb", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXNeuron");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Drive", "Squash", "Stab", "Asymmetry", "Bias", "Frequency",
    "Separation", "Waveform", "Rate", "Depth", "Width", "Output Gain",
  ]);

  const render = ({drive, frequency}) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXNeuron");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, drive);
    runtime.rack_web_set_param(1, .8);
    runtime.rack_web_set_param(2, .25);
    runtime.rack_web_set_param(3, .85);
    runtime.rack_web_set_param(4, .35);
    runtime.rack_web_set_param(5, frequency);
    runtime.rack_web_set_param(6, .65);
    runtime.rack_web_set_param(9, 0);
    runtime.rack_web_set_param(10, .75);
    runtime.rack_web_set_param(11, .6);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    for (let block = 0; block < 192; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 2.5 * Math.sin(2 * Math.PI * 220 * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 96) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const soft = render({drive: .15, frequency: .3});
  const driven = render({drive: .95, frequency: .3});
  const retuned = render({drive: .95, frequency: .85});
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(driven.left) > .01);
  assert.ok(peak(driven.left.map((value, index) => value - driven.right[index])) > .001);
  assert.ok(peak(soft.left.map((value, index) => value - driven.left[index])) > .01);
  assert.ok(peak(driven.left.map((value, index) => value - retuned.left[index])) > .01);
});

test("Surge XT Resonator preserves its official three-band filter bank", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXResonator");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [63, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Frequency 1", "Resonance 1", "Gain 1", "Frequency 2", "Resonance 2", "Gain 2",
    "Frequency 3", "Resonance 3", "Gain 3", "Mode", "Output Gain", "Mix",
  ]);
  assert.deepEqual(definition.params.slice(-3).map(({name}) => name), [
    "Extend Band 1 Frequency", "Extend Band 2 Frequency", "Extend Band 3 Frequency",
  ]);

  const render = (center) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXResonator");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [63, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    for (const id of [0, 3, 6]) runtime.rack_web_set_param(id, center);
    for (const id of [1, 4, 7]) runtime.rack_web_set_param(id, .9);
    for (const id of [2, 5, 8]) runtime.rack_web_set_param(id, .8);
    runtime.rack_web_set_param(9, .34);
    runtime.rack_web_set_param(10, .5);
    runtime.rack_web_set_param(11, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 160; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 1.5 * (Math.sin(2 * Math.PI * 110 * sample / 48000) + Math.sin(2 * Math.PI * 1760 * sample / 48000));
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 80) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const low = render(.2), high = render(.85);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(low) > .01 && peak(high) > .01);
  assert.ok(peak(low.map((value, index) => value - high[index])) > .01);
});

test("Surge XT CHOW preserves its official asymmetric flip distortion", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXChow");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 10, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Threshold", "Ratio", "Flip", "Mix", "Unused Effect Slot 1", "Unused Effect Slot 2",
    "Unused Effect Slot 3", "Unused Effect Slot 4", "Unused Effect Slot 5", "Unused Effect Slot 6",
    "Unused Effect Slot 7", "Unused Effect Slot 8",
  ]);
  assert.equal(definition.params.at(-1).name, "Flip It Good");

  const render = (flip) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXChow");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 10, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(0, .35);
    runtime.rack_web_set_param(1, .9);
    runtime.rack_web_set_param(3, 1);
    runtime.rack_web_set_param(60, flip);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 10 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 128; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 5 * Math.sin(2 * Math.PI * 220 * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 64) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const positive = render(0), negative = render(1);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(positive) > .01 && peak(negative) > .01);
  assert.ok(peak(positive.map((value, index) => value - negative[index])) > .01);
  assert.ok(Math.abs(Math.min(...positive)) > Math.max(...positive));
  assert.ok(Math.max(...negative) > Math.abs(Math.min(...negative)));
});

test("Surge XT Exciter preserves its official envelope-driven harmonics", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXExciter");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Drive", "Tone", "Attack", "Release", "Mix", "Unused Effect Slot 1",
    "Unused Effect Slot 2", "Unused Effect Slot 3", "Unused Effect Slot 4", "Unused Effect Slot 5",
    "Unused Effect Slot 6", "Unused Effect Slot 7",
  ]);

  const render = (drive) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXExciter");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_param(0, drive);
    runtime.rack_web_set_param(1, .8);
    runtime.rack_web_set_param(2, .1);
    runtime.rack_web_set_param(3, .7);
    runtime.rack_web_set_param(4, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const captured = [];
    for (let block = 0; block < 160; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        const envelope = (sample % 2400) < 1200 ? 1 : .15;
        inputs[index] = envelope * 5 * Math.sin(2 * Math.PI * 4000 * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 80) captured.push(...outputs.slice(0, 128));
    }
    assert.ok(captured.every(Number.isFinite));
    return captured;
  };

  const subtle = render(.1), driven = render(.95);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(subtle) > .01 && peak(driven) > .01);
  assert.ok(peak(subtle.map((value, index) => value - driven[index])) > .01);
});

test("Surge XT Ensemble preserves its official dual BBD stereo modulation", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXEnsemble");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Anti-Alias Filter", "Frequency 1", "Depth 1", "Frequency 2", "Depth 2", "Type",
    "Clock Rate", "Saturation", "Feedback", "Width", "Mix", "Unused Effect Slot 1",
  ]);

  const render = (depth) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXEnsemble");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, .75);
    runtime.rack_web_set_param(1, .55);
    runtime.rack_web_set_param(2, depth);
    runtime.rack_web_set_param(3, .7);
    runtime.rack_web_set_param(4, depth);
    runtime.rack_web_set_param(5, .5);
    runtime.rack_web_set_param(6, .5);
    runtime.rack_web_set_param(7, .4);
    runtime.rack_web_set_param(8, .55);
    runtime.rack_web_set_param(9, 1);
    runtime.rack_web_set_param(10, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    for (let block = 0; block < 192; block++) {
      for (let index = 0; index < 128; index++) {
        const sample = block * 128 + index;
        inputs[index] = 2 * Math.sin(2 * Math.PI * 220 * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 96) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const shallow = render(.1), deep = render(.9);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(deep.left) > .01);
  assert.ok(peak(deep.left.map((value, index) => value - deep.right[index])) > .01);
  assert.ok(peak(shallow.left.map((value, index) => value - deep.left[index])) > .01);
});

test("Surge XT Combulator preserves its official three-comb feedback network", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXCombulator");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Extra Noise", "Center", "Offset 2", "Offset 3", "Feedback", "Tone",
    "Comb 1", "Comb 2", "Comb 3", "Pan 2", "Pan 3", "Mix",
  ]);
  assert.equal(definition.params.at(-1).name, "Enable Tone Filter");

  const render = (center) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXCombulator");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, 0);
    runtime.rack_web_set_param(1, center);
    runtime.rack_web_set_param(2, .62);
    runtime.rack_web_set_param(3, .38);
    runtime.rack_web_set_param(4, .85);
    runtime.rack_web_set_param(5, .5);
    runtime.rack_web_set_param(6, .8);
    runtime.rack_web_set_param(7, .8);
    runtime.rack_web_set_param(8, .8);
    runtime.rack_web_set_param(9, .9);
    runtime.rack_web_set_param(10, .1);
    runtime.rack_web_set_param(11, 1);
    runtime.rack_web_set_param(60, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    inputs[0] = 5;
    for (let block = 0; block < 256; block++) {
      runtime.rack_web_process(128, 48000);
      left.push(...outputs.slice(0, 128));
      right.push(...outputs.slice(128, 256));
      inputs.fill(0);
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const low = render(.25), high = render(.8);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(low.left.slice(128)) > .01);
  assert.ok(peak(low.left.map((value, index) => value - low.right[index])) > .01);
  assert.ok(peak(low.left.map((value, index) => value - high.left[index])) > .01);
});

test("Surge XT Spring Reverb preserves its official physical spring tail", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXSpringReverb");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [61, 10, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Size", "Decay", "Reflections", "HF Damping", "Spin", "Chaos", "Knock", "Mix",
    "Unused Effect Slot 1", "Unused Effect Slot 2", "Unused Effect Slot 3", "Unused Effect Slot 4",
  ]);
  assert.equal(definition.params.at(-1).name, "Interrupting Cow");
  assert.equal(definition.inputs.at(-1).name, "Trigger to Knock Spring");
  assert.equal(definition.runtime.initialMemory, 116 * 1024 * 1024);
  assert.deepEqual(definition.stateKeys.at(-1), {
    key: "modulespecific", path: ["polyphonicMode"], type: "boolean",
  });

  const render = (decay) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXSpringReverb");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [61, 10, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(1, 1);
    runtime.rack_web_set_input_channels(1, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, .65);
    runtime.rack_web_set_param(1, decay);
    runtime.rack_web_set_param(2, 1);
    runtime.rack_web_set_param(3, .4);
    runtime.rack_web_set_param(4, .7);
    runtime.rack_web_set_param(5, .3);
    runtime.rack_web_set_param(6, 0);
    runtime.rack_web_set_param(7, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 10 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    inputs[0] = 5;
    for (let block = 0; block < 512; block++) {
      runtime.rack_web_process(128, 48000);
      left.push(...outputs.slice(0, 128));
      right.push(...outputs.slice(128, 256));
      inputs.fill(0);
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const short = render(.05), long = render(.95);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  const lateStart = 300 * 128;
  assert.ok(peak(long.left.slice(128)) > .001);
  assert.ok(peak(long.left.slice(lateStart)) > .00001);
  assert.ok(peak(long.left.map((value, index) => value - long.right[index])) > .001);
  assert.ok(peak(long.left.slice(lateStart)) > peak(short.left.slice(lateStart)) * 2);

  const poly = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXSpringReverb");
  poly.rack_web_set_polyphony(16);
  const polyState = new TextEncoder().encode(JSON.stringify({modulespecific: {polyphonicMode: true}}));
  const polyStatePointer = poly.rack_web_state_buffer(polyState.length);
  new Uint8Array(poly.memory.buffer, polyStatePointer, polyState.length).set(polyState);
  assert.equal(poly.rack_web_commit_state_json(polyState.length), 1);
  poly.rack_web_set_input_connected(0, 1);
  poly.rack_web_set_input_channels(0, 16);
  poly.rack_web_set_input_connected(1, 1);
  poly.rack_web_set_input_channels(1, 16);
  poly.rack_web_set_output_connected(0, 1);
  const polyInputs = new Float32Array(poly.memory.buffer, poly.rack_web_input_buffer(), 10 * 16 * 128);
  const polyOutputs = new Float32Array(poly.memory.buffer, poly.rack_web_output_buffer(), 2 * 16 * 128);
  for (let channel = 0; channel < 16; channel++) polyInputs[(channel * 10) * 128] = channel + 1;
  for (let block = 0; block < 8; block++) {
    poly.rack_web_process(128, 48000);
    assert.ok(polyOutputs.every(Number.isFinite));
    polyInputs.fill(0);
  }
  assert.equal(poly.rack_web_get_output_channels(0), 16);
});

test("Surge XT Tree Monster tracks pitch and exposes its analysis outputs", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXTreeMonster");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 9, 4]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Threshold", "Speed", "Low Cut", "High Cut", "Pitch", "Ring Modulation", "Width", "Mix",
    "Unused Effect Slot 1", "Unused Effect Slot 2", "Unused Effect Slot 3", "Unused Effect Slot 4",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Enable Low Cut", "Enable High Cut"]);
  assert.deepEqual(definition.outputs.map(({name}) => name), [
    "Left (or Mono merged)", "Right", "V/Oct Pitch Detection", "Envelope Follower",
  ]);

  const render = (pitch) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXTreeMonster");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 9, 4]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(1, 1);
    runtime.rack_web_set_input_channels(1, 1);
    for (let output = 0; output < 4; output++) runtime.rack_web_set_output_connected(output, 1);
    runtime.rack_web_set_param(0, .5);
    runtime.rack_web_set_param(1, 1);
    runtime.rack_web_set_param(2, 0);
    runtime.rack_web_set_param(3, 1);
    runtime.rack_web_set_param(4, pitch);
    runtime.rack_web_set_param(5, 0);
    runtime.rack_web_set_param(6, .5);
    runtime.rack_web_set_param(7, 1);
    runtime.rack_web_set_param(60, 1);
    runtime.rack_web_set_param(61, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 16 * 128);
    const audio = [], detectedPitch = [], envelope = [];
    let sample = 0;
    for (let block = 0; block < 256; block++) {
      for (let frame = 0; frame < 128; frame++, sample++) {
        const voltage = 5 * Math.sin(2 * Math.PI * 220 * sample / 48000);
        inputs[frame] = voltage;
        inputs[128 + frame] = voltage;
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 128) {
        audio.push(...outputs.slice(0, 128));
        detectedPitch.push(...outputs.slice(256, 384));
        envelope.push(...outputs.slice(384, 512));
      }
    }
    assert.ok(audio.every(Number.isFinite) && detectedPitch.every(Number.isFinite) && envelope.every(Number.isFinite));
    return {audio, detectedPitch, envelope};
  };

  const normal = render(.5), raised = render(.75);
  const crossings = (values) => values.slice(1).reduce((count, value, index) => count + (values[index] < 0 && value >= 0 ? 1 : 0), 0);
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.max(...normal.audio.map(Math.abs)) > .1);
  assert.ok(crossings(raised.audio) > crossings(normal.audio) * 1.5);
  assert.ok(Math.abs(average(normal.detectedPitch) + .25) < .15);
  assert.ok(Math.max(...normal.envelope) > .1);
});

test("Surge XT Bonsai runs the official tape saturation signal path", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXBonsai");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [60, 9, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Input Gain", "Bass Boost", "Bass Distortion", "Bias Filter", "Saturation Type", "Saturation Amount",
    "Noise Sensitivity", "Noise Gain", "Dull", "Output Gain", "Mix", "Unused Effect Slot 1",
  ]);

  const render = (saturation) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXBonsai");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [60, 9, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(1, 1);
    runtime.rack_web_set_input_channels(1, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    runtime.rack_web_set_param(0, .75);
    runtime.rack_web_set_param(1, .5);
    runtime.rack_web_set_param(2, 0);
    runtime.rack_web_set_param(3, 0);
    runtime.rack_web_set_param(4, .34);
    runtime.rack_web_set_param(5, saturation);
    runtime.rack_web_set_param(6, 0);
    runtime.rack_web_set_param(7, 0);
    runtime.rack_web_set_param(8, 0);
    runtime.rack_web_set_param(9, .5);
    runtime.rack_web_set_param(10, 1);
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 9 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    let sample = 0;
    for (let block = 0; block < 96; block++) {
      for (let frame = 0; frame < 128; frame++, sample++) {
        inputs[frame] = 4 * Math.sin(2 * Math.PI * 220 * sample / 48000);
        inputs[128 + frame] = 3 * Math.sin(2 * Math.PI * 330 * sample / 48000);
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 48) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const clean = render(0), saturated = render(1);
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(saturated.left) > .05);
  assert.ok(peak(saturated.left) < 20);
  assert.ok(peak(saturated.left.map((value, index) => value - clean.left[index])) > .05);
  assert.ok(peak(saturated.left.map((value, index) => value - saturated.right[index])) > .05);
});

test("Surge XT Nimbus runs the official granular engine and freeze gate", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTFXNimbus");
  assert.ok(definition);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [62, 11, 2]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Mode", "Quality", "Position", "Size", "Pitch", "Density", "Texture", "Spread",
    "Freeze", "Feedback", "Reverb", "Mix",
  ]);
  assert.deepEqual(definition.params.slice(-2).map(({name}) => name), ["Manual Freeze", "Randomize Engine"]);
  assert.deepEqual(definition.inputs.slice(-2).map(({name}) => name), ["Gate to Freeze", "Trigger"]);

  const render = ({mix, freeze = false}) => {
    const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTFXNimbus");
    assert.deepEqual([
      runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
    ], [62, 11, 2]);
    runtime.rack_web_set_input_connected(0, 1);
    runtime.rack_web_set_input_channels(0, 1);
    runtime.rack_web_set_input_connected(1, 1);
    runtime.rack_web_set_input_channels(1, 1);
    runtime.rack_web_set_input_connected(9, freeze ? 1 : 0);
    runtime.rack_web_set_input_channels(9, 1);
    runtime.rack_web_set_output_connected(0, 1);
    runtime.rack_web_set_output_connected(1, 1);
    [0, 0, .35, .65, .5, .75, .65, .8, 0, .35, .25, mix].forEach((value, id) => {
      runtime.rack_web_set_param(id, value);
    });
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 11 * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
    const left = [], right = [];
    let sample = 0;
    for (let block = 0; block < 384; block++) {
      const frozen = freeze && block >= 192;
      for (let frame = 0; frame < 128; frame++, sample++) {
        const pulse = sample % 4096 < 32 ? 1.5 : 0;
        inputs[frame] = frozen ? 0 : 2.5 * Math.sin(2 * Math.PI * 220 * sample / 48000) + pulse;
        inputs[128 + frame] = frozen ? 0 : 2 * Math.sin(2 * Math.PI * 330 * sample / 48000) - pulse;
        inputs[9 * 128 + frame] = frozen ? 5 : 0;
      }
      runtime.rack_web_process(128, 48000);
      if (block >= 256) {
        left.push(...outputs.slice(0, 128));
        right.push(...outputs.slice(128, 256));
      }
    }
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite));
    return {left, right};
  };

  const dry = render({mix: 0}), wet = render({mix: 1}), frozen = render({mix: 1, freeze: true});
  const peak = (values) => values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  assert.ok(peak(wet.left) > .005);
  assert.ok(peak(wet.left.map((value, index) => value - dry.left[index])) > .01);
  assert.ok(peak(wet.left.map((value, index) => value - wet.right[index])) > .005);
  assert.ok(peak(frozen.left) > .001);
});

test("Surge XT tuned delay follows v/oct and broadcasts mono to four voices", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTDelayLineByFreq");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.equal(definition.width, 90);
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [2, 3, 2]);
  assert.deepEqual(definition.params.map(({name, min, max, default: initial}) => [name, min, max, initial]), [
    ["V/Oct Center", -5, 5, 0],
    ["Sample Correction", 0, 20, 0],
  ]);
  assert.deepEqual(definition.inputs.map(({name, kind}) => [name, kind]), [
    ["In Left", "audio"], ["In Right", "audio"],
    ["Delay Time as Frequency in v/oct", "cv"],
  ]);
  assert.deepEqual(definition.outputs.map(({name, kind}) => [name, kind]), [
    ["Out Left", "audio"], ["Out Right", "audio"],
  ]);
  assert.deepEqual(definition.params.map(({position}) => position), [
    {x: 45, y: 82.677, centered: true},
    {x: 45, y: 153.543, centered: true},
  ]);
  assert.deepEqual(definition.inputs.map(({position}) => position), [
    {x: 24.331, y: 295.748, centered: true},
    {x: 65.669, y: 295.748, centered: true},
    {x: 45, y: 219.98, centered: true},
  ]);
  assert.deepEqual(definition.outputs.map(({position}) => position), [
    {x: 24.331, y: 338.091, centered: true},
    {x: 65.669, y: 338.091, centered: true},
  ]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);

  const runtime = loadDynamicRuntime("SurgeXTRack", "SurgeXTDelayLineByFreq");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [2, 3, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_input_connected(2, 1);
  runtime.rack_web_set_input_channels(2, 4);
  runtime.rack_web_set_output_connected(0, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 3 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
  inputs[0] = 5;
  const rendered = Array.from({length: 4}, () => []);
  for (let block = 0; block < 4; block++) {
    for (let channel = 0; channel < 4; channel++) {
      inputs.fill(channel, (channel * 3 + 2) * 128, (channel * 3 + 3) * 128);
    }
    runtime.rack_web_process(128, 48000);
    for (let channel = 0; channel < 4; channel++) {
      rendered[channel].push(...outputs.slice(channel * 2 * 128, (channel * 2 + 1) * 128));
    }
    inputs.fill(0);
  }
  const peaks = rendered.map((voice) => {
    const peak = Math.max(...voice.map(Math.abs));
    assert.ok(voice.every(Number.isFinite));
    assert.ok(peak > 2);
    return voice.findIndex((value) => Math.abs(value) === peak);
  });
  assert.equal(runtime.rack_web_get_output_channels(0), 4);
  assert.deepEqual(peaks, [183, 92, 46, 23]);
});

test("Surge XT Tuned Delay Plus preserves modulation, filtering, and corrected timing", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTDelayLineByFreqExpanded");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [40, 10, 2]);
  assert.deepEqual(definition.params.slice(0, 11).map(({name}) => name), [
    "V/Oct Center", "Fine Left Tune", "Fine Right Tune", "Feedback Level",
    "LP Cutoff to Pitch Offset", "HP Cutoff to Pitch Offset", "Signal/Filter Wet/Dry Mix",
    "LowPass Filter Active", "HighPass Filter Active", "Sample Correction", "Feedback Range",
  ]);
  assert.equal(definition.params[11].name, "Mod 1 to V/Oct Center");
  assert.equal(definition.params[38].name, "Mod 4 to Signal/Filter Wet/Dry Mix");
  assert.equal(definition.params[39].name, "Clamp Behavior");
  assert.deepEqual(definition.inputs.slice(6).map(({name, kind}) => [name, kind]), [
    ["Mod 1", "cv"], ["Mod 2", "cv"], ["Mod 3", "cv"], ["Mod 4", "cv"],
  ]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);

  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTDelayLineByFreqExpanded");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [40, 10, 2]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_input_connected(2, 1);
  runtime.rack_web_set_input_channels(2, 4);
  runtime.rack_web_set_output_connected(0, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 10 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 16 * 128);
  inputs[0] = 5;
  const rendered = Array.from({length: 4}, () => []);
  for (let block = 0; block < 4; block++) {
    for (let channel = 0; channel < 4; channel++) {
      inputs.fill(channel, (channel * 10 + 2) * 128, (channel * 10 + 3) * 128);
    }
    runtime.rack_web_process(128, 48000);
    for (let channel = 0; channel < 4; channel++) {
      rendered[channel].push(...outputs.slice(channel * 2 * 128, (channel * 2 + 1) * 128));
    }
    inputs.fill(0);
  }
  const peaks = rendered.map((voice) => {
    const peak = Math.max(...voice.map(Math.abs));
    assert.ok(voice.every(Number.isFinite));
    assert.ok(peak > 2);
    return voice.findIndex((value) => Math.abs(value) === peak);
  });
  assert.equal(runtime.rack_web_get_output_channels(0), 4);
  assert.deepEqual(peaks, [182, 91, 45, 22]);
});

test("Surge XT Mixer keeps stereo normalization, mute routing, and ring modulation", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTMixer");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [52, 10, 2]);
  assert.deepEqual(definition.params.slice(0, 20).map(({name}) => name), [
    "Input 1 Level", "Input 2 Level", "Input 3 Level", "Noise Level",
    "RingMod 1x2 Level", "RingMod 2x3 Level", "Noise Color", "Gain",
    "Input 1 Mute", "Input 2 Mute", "Input 3 Mute", "Noise Mute",
    "RingMod 1x2 Mute", "RingMod 2x3 Mute", "Input 1 Solo", "Input 2 Solo",
    "Input 3 Solo", "Noise Solo", "RingMod 1x2 Solo", "RingMod 2x3 Solo",
  ]);
  assert.equal(definition.params[20].name, "Mod 1 to Input 1");
  assert.equal(definition.params[51].name, "Mod 4 to Gain");
  assert.deepEqual(definition.inputs.map(({name, kind}) => [name, kind]), [
    ["Input 1 Left", "audio"], ["Input 1 Right", "audio"],
    ["Input 2 Left", "audio"], ["Input 2 Right", "audio"],
    ["Input 3 Left", "audio"], ["Input 3 Right", "audio"],
    ["Modulator 1", "cv"], ["Modulator 2", "cv"],
    ["Modulator 3", "cv"], ["Modulator 4", "cv"],
  ]);
  assert.deepEqual(definition.stateKeys, [{key: "vuChannel", type: "integer"}]);

  const unity = loadDynamicRuntime("SurgeXTRack", "SurgeXTMixer");
  unity.rack_web_set_input_connected(0, 1);
  unity.rack_web_set_input_channels(0, 4);
  unity.rack_web_set_output_connected(0, 1);
  unity.rack_web_set_output_connected(1, 1);
  const unityInputs = new Float32Array(unity.memory.buffer, unity.rack_web_input_buffer(), 10 * 16 * 128);
  const unityOutputs = new Float32Array(unity.memory.buffer, unity.rack_web_output_buffer(), 2 * 16 * 128);
  for (let channel = 0; channel < 4; channel++) unityInputs[(channel * 10) * 128] = channel + 1;
  unity.rack_web_process(1, 48000);
  assert.equal(unity.rack_web_get_output_channels(0), 4);
  assert.deepEqual(Array.from({length: 4}, (_, channel) => unityOutputs[(channel * 2) * 128]), [1, 2, 3, 4]);
  assert.deepEqual(Array.from({length: 4}, (_, channel) => unityOutputs[(channel * 2 + 1) * 128]), [1, 2, 3, 4]);

  const ring = loadDynamicRuntime("SurgeXTRack", "SurgeXTMixer");
  for (const port of [0, 2]) {
    ring.rack_web_set_input_connected(port, 1);
    ring.rack_web_set_input_channels(port, 1);
  }
  ring.rack_web_set_output_connected(0, 1);
  const ringInputs = new Float32Array(ring.memory.buffer, ring.rack_web_input_buffer(), 10 * 16 * 128);
  const ringOutputs = new Float32Array(ring.memory.buffer, ring.rack_web_output_buffer(), 2 * 16 * 128);
  ring.rack_web_process(9, 48000);
  ring.rack_web_set_param(8, 1);
  ring.rack_web_set_param(12, 0);
  ring.rack_web_set_param(4, 1);
  ringInputs[0] = 5;
  ringInputs[2 * 128] = 5;
  ring.rack_web_process(1, 48000);
  assert.equal(ringOutputs[0], 5);
});

test("Surge XT EGxVCA triggers an already-high polyphonic gate and preserves inactive voices", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTEGxVCA");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [44, 8, 4]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Level", "Pan", "Linear/Exponential", "Attack", "Decay", "Sustain", "Release", "Curve",
    "Attack Curve", "Decay Curve", "Release Curve", "Mode",
  ]);
  assert.equal(definition.params[12].name, "Mod 1 to Level");
  assert.equal(definition.params[39].name, "Mod 4 to Release");
  assert.deepEqual(definition.inputs.map(({name, kind}) => [name, kind]), [
    ["Left", "audio"], ["Right", "audio"], ["Gate/Trig", "gate"], ["Clock", "gate"],
    ["Mod Input 1", "cv"], ["Mod Input 2", "cv"], ["Mod Input 3", "cv"], ["Mod Input 4", "cv"],
  ]);
  assert.deepEqual(definition.outputs.map(({name}) => name), ["Left", "Right", "Envelope", "End of Cycle"]);
  assert.deepEqual(definition.stateKeys, [{key: "clockStyle", type: "integer"}]);
  assert.deepEqual(definition.bypassRoutes, [[0, 0], [1, 1]]);

  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTEGxVCA");
  const inputCount = runtime.rack_web_input_count();
  const outputCount = runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(), inputCount, outputCount], [44, 8, 4]);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_input_connected(2, 1);
  runtime.rack_web_set_input_channels(2, 4);
  for (let port = 0; port < outputCount; port++) runtime.rack_web_set_output_connected(port, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), inputCount * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), outputCount * 16 * 128);
  const envelopes = Array.from({length: 4}, () => []);
  const vcaLeft = Array.from({length: 4}, () => []);
  for (let block = 0; block < 8; block++) {
    inputs.fill(5, 0, 128);
    for (const channel of [0, 2]) {
      inputs.fill(10, (channel * inputCount + 2) * 128, (channel * inputCount + 3) * 128);
    }
    runtime.rack_web_process(128, 48000);
    for (let channel = 0; channel < 4; channel++) {
      envelopes[channel].push(...outputs.slice((channel * outputCount + 2) * 128, (channel * outputCount + 3) * 128));
      vcaLeft[channel].push(...outputs.slice((channel * outputCount) * 128, (channel * outputCount + 1) * 128));
    }
    inputs.fill(0);
  }
  assert.deepEqual(Array.from({length: 4}, (_, port) => runtime.rack_web_get_output_channels(port)), [4, 4, 4, 4]);
  assert.ok(envelopes.flat().every(Number.isFinite));
  for (const channel of [0, 2]) {
    assert.ok(Math.max(...envelopes[channel]) >= 9.9);
    assert.ok(envelopes[channel].at(-1) > 4.9 && envelopes[channel].at(-1) < 5.1);
  }
  assert.ok(Math.max(...vcaLeft[0]) > 0.1);
  assert.equal(Math.max(...vcaLeft[2].map(Math.abs)), 0);
  for (const channel of [1, 3]) {
    assert.equal(Math.max(...envelopes[channel].map(Math.abs)), 0);
    assert.equal(Math.max(...vcaLeft[channel].map(Math.abs)), 0);
  }

  runtime.rack_web_set_state(0, 1);
  const snapshotLength = runtime.rack_web_snapshot_state_json();
  const snapshot = JSON.parse(new TextDecoder().decode(new Uint8Array(
    runtime.memory.buffer, runtime.rack_web_snapshot_state_buffer(), snapshotLength,
  )));
  assert.equal(snapshot.modulespecific.clockStyle, 1);
});

test("Surge XT Quad LFO runs four official shapes and restores forced polyphony", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTQuadLFO");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [49, 8, 4]);
  assert.deepEqual(definition.params.slice(0, 8).map(({name}) => name), [
    "LFO 1 Rate", "LFO 2 Rate", "LFO 3 Rate", "LFO 4 Rate",
    "LFO 1 Deform", "LFO 2 Deform", "LFO 3 Deform", "LFO 4 Deform",
  ]);
  assert.equal(definition.params[16].name, "Mod 1 to LFO 1 Rate");
  assert.equal(definition.params[47].name, "Mod 4 to LFO 4 Deform");
  assert.deepEqual(definition.inputs.map(({name, kind}) => [name, kind]), [
    ["Trigger 1", "gate"], ["Trigger 2", "gate"], ["Trigger 3", "gate"], ["Trigger 4", "gate"],
    ["Mod 1", "cv"], ["Mod 2", "cv"], ["Mod 3", "cv"], ["Mod 4", "cv"],
  ]);
  assert.deepEqual(definition.outputs.map(({name}) => name), ["LFO 1", "LFO 2", "LFO 3", "LFO 4"]);
  assert.deepEqual(definition.stateKeys, [{key: "forcePolyphony", type: "integer"}]);

  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTQuadLFO");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [49, 8, 4]);
  for (let port = 0; port < 4; port++) runtime.rack_web_set_output_connected(port, 1);
  [0, 1, 3, 4].forEach((shape, port) => runtime.rack_web_set_param(8 + port, shape));
  runtime.rack_web_set_state(0, 4);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 16 * 128);
  const rendered = [[], [], [], []];
  for (let block = 0; block < 256; block++) {
    runtime.rack_web_process(128, 48000);
    for (let port = 0; port < 4; port++) rendered[port].push(...outputs.slice(port * 128, (port + 1) * 128));
  }
  assert.deepEqual(Array.from({length: 4}, (_, port) => runtime.rack_web_get_output_channels(port)), [4, 4, 4, 4]);
  assert.ok(rendered.flat().every(Number.isFinite));
  assert.ok(rendered.every((signal) => Math.max(...signal) - Math.min(...signal) > 6));
  assert.ok(rendered[0].some((value, index) => Math.abs(value - rendered[1][index]) > 0.1));
});

test("Surge XT full LFO runs official wave, envelope, modulation, and step-sequencer DSP", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTLFO");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual([definition.params.length, definition.inputs.length, definition.outputs.length], [97, 8, 6]);
  assert.deepEqual(definition.params.slice(0, 12).map(({name}) => name), [
    "Rate", "Phase", "Deform", "Amplitude", "Envelope Delay", "Envelope Attack",
    "Envelope Hold", "Envelope Decay", "Envelope Sustain", "Envelope Release", "Shape", "Unipolar",
  ]);
  assert.equal(definition.params[12].name, "Mod 1 to Rate");
  assert.equal(definition.params[51].name, "Mod 4 to Envelope Release");
  assert.equal(definition.params[58].name, "Step 1");
  assert.equal(definition.params[89].name, "Step Trigger 16");
  assert.deepEqual(definition.inputs.slice(4).map(({name}) => name), [
    "Modulation Signal 1", "Modulation Signal 2", "Modulation Signal 3", "Modulation Signal 4",
  ]);

  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTLFO");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [97, 8, 6]);
  for (let port = 0; port < 6; port++) runtime.rack_web_set_output_connected(port, 1);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 1);
  runtime.rack_web_set_input_connected(4, 1);
  runtime.rack_web_set_input_channels(4, 1);
  runtime.rack_web_set_param(12, 0.5);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 8 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 6 * 16 * 128);
  const wave = [], envelope = [], mixed = [];
  for (let block = 0; block < 256; block++) {
    inputs.fill(10, 0, 128);
    inputs.fill(block < 128 ? 5 : -5, 4 * 128, 5 * 128);
    runtime.rack_web_process(128, 48000);
    wave.push(...outputs.slice(128, 256));
    envelope.push(...outputs.slice(2 * 128, 3 * 128));
    mixed.push(...outputs.slice(0, 128));
  }
  assert.ok([...wave, ...envelope, ...mixed].every(Number.isFinite));
  assert.ok(Math.max(...wave) - Math.min(...wave) > 2);
  assert.ok(Math.max(...envelope) > 1);
  assert.ok(Math.max(...mixed.map(Math.abs)) > 0.1);

  runtime.rack_web_set_param(10, definition.params[10].max);
  runtime.rack_web_set_param(58, -1);
  runtime.rack_web_set_param(59, 1);
  runtime.rack_web_set_input_connected(2, 1);
  runtime.rack_web_set_input_channels(2, 1);
  inputs.fill(0);
  runtime.rack_web_process(128, 48000);
  const stepped = [];
  for (let block = 0; block < 256; block++) {
    inputs.fill(0);
    inputs.fill(10, 0, 128);
    inputs.fill(block % 8 === 0 ? 10 : 0, 2 * 128, 3 * 128);
    runtime.rack_web_process(128, 48000);
    stepped.push(...outputs.slice(128, 256));
  }
  assert.ok(stepped.every(Number.isFinite));
  assert.ok(Math.max(...stepped) - Math.min(...stepped) > 2);
});

test("Surge XT utility family runs slider mixer, modulation matrix, Quad AD, and unison DSP", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definitions = Object.fromEntries(catalog.filter((item) => [
    "SurgeXTMixerSlider", "SurgeXTModMatrix", "SurgeXTQuadAD", "SurgeXTUnisonHelper",
  ].includes(item.model)).map((item) => [item.model, item]));
  assert.deepEqual(Object.keys(definitions).sort(), [
    "SurgeXTMixerSlider", "SurgeXTModMatrix", "SurgeXTQuadAD", "SurgeXTUnisonHelper",
  ]);
  for (const definition of Object.values(definitions)) {
    assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  }
  assert.deepEqual(definitions.SurgeXTMixerSlider.inputs.map(({name}) => name), [
    "Input 1 Left", "Input 1 Right", "Input 2 Left", "Input 2 Right", "Input 3 Left", "Input 3 Right",
    "Modulator 1", "Modulator 2", "Modulator 3", "Modulator 4",
  ]);
  assert.deepEqual(definitions.SurgeXTModMatrix.outputs.map(({name}) => name), Array.from({length: 8}, (_, index) => `Modulated Target ${index + 1}`));
  assert.equal(definitions.SurgeXTModMatrix.params.at(-1).name, "Mod 4 to Target 8");
  assert.deepEqual(definitions.SurgeXTQuadAD.inputs.map(({name}) => name), [
    "Trigger/Gate 1", "Trigger/Gate 2", "Trigger/Gate 3", "Trigger/Gate 4", "Mod 1", "Mod 2", "Mod 3", "Mod 4",
  ]);
  assert.equal(definitions.SurgeXTQuadAD.params.at(-1).name, "Mod 4 to Decay 4");
  assert.deepEqual(definitions.SurgeXTUnisonHelper.outputs.map(({name}) => name), [
    "Left", "Right", "V/Oct to Sub VCO 1", "V/Oct to Sub VCO 2", "V/Oct to Sub VCO 3", "V/Oct to Sub VCO 4",
  ]);

  const mixer = loadDynamicRuntime("SurgeXTRack", "SurgeXTMixerSlider");
  mixer.rack_web_set_input_connected(0, 1);
  mixer.rack_web_set_input_channels(0, 1);
  mixer.rack_web_set_output_connected(0, 1);
  const mixerInputs = new Float32Array(mixer.memory.buffer, mixer.rack_web_input_buffer(), 10 * 16 * 128);
  const mixerOutputs = new Float32Array(mixer.memory.buffer, mixer.rack_web_output_buffer(), 2 * 16 * 128);
  mixerInputs.fill(2, 0, 128);
  mixer.rack_web_process(128, 48000);
  assert.ok(mixerOutputs.slice(0, 128).every(Number.isFinite));
  assert.ok(Math.max(...mixerOutputs.slice(0, 128).map(Math.abs)) > 0.1);

  const matrix = loadDynamicRuntime("SurgeXTRack", "SurgeXTModMatrix");
  matrix.rack_web_set_input_connected(0, 1);
  matrix.rack_web_set_input_channels(0, 1);
  matrix.rack_web_set_output_connected(0, 1);
  matrix.rack_web_set_param(0, 1.5);
  matrix.rack_web_set_param(8, 0.5);
  const matrixInputs = new Float32Array(matrix.memory.buffer, matrix.rack_web_input_buffer(), 4 * 16 * 128);
  const matrixOutputs = new Float32Array(matrix.memory.buffer, matrix.rack_web_output_buffer(), 8 * 16 * 128);
  matrixInputs.fill(2, 0, 128);
  matrix.rack_web_process(128, 48000);
  assert.equal(matrix.rack_web_get_output_channels(0), 1);
  assert.ok(matrixOutputs[127] > 1.5);

  const quadAd = loadDynamicRuntime("SurgeXTRack", "SurgeXTQuadAD");
  quadAd.rack_web_set_input_connected(0, 1);
  quadAd.rack_web_set_input_channels(0, 1);
  quadAd.rack_web_set_output_connected(0, 1);
  const quadInputs = new Float32Array(quadAd.memory.buffer, quadAd.rack_web_input_buffer(), 8 * 16 * 128);
  const quadOutputs = new Float32Array(quadAd.memory.buffer, quadAd.rack_web_output_buffer(), 4 * 16 * 128);
  quadInputs.fill(10, 0, 128);
  quadAd.rack_web_process(128, 48000);
  assert.ok(quadOutputs.slice(0, 128).every(Number.isFinite));
  assert.ok(Math.max(...quadOutputs.slice(0, 128)) > 0);

  const unison = loadDynamicRuntime("SurgeXTRack", "SurgeXTUnisonHelper");
  unison.rack_web_set_input_connected(0, 1);
  unison.rack_web_set_input_channels(0, 1);
  unison.rack_web_set_input_connected(1, 1);
  unison.rack_web_set_input_channels(1, 3);
  unison.rack_web_set_output_connected(0, 1);
  unison.rack_web_set_output_connected(2, 1);
  unison.rack_web_set_param(4, 3);
  const unisonInputs = new Float32Array(unison.memory.buffer, unison.rack_web_input_buffer(), 9 * 16 * 128);
  const unisonOutputs = new Float32Array(unison.memory.buffer, unison.rack_web_output_buffer(), 6 * 16 * 128);
  for (let voice = 0; voice < 3; voice++) unisonInputs.fill(1 + voice, (voice * 9 + 1) * 128, (voice * 9 + 2) * 128);
  unison.rack_web_process(128, 48000);
  assert.equal(unison.rack_web_get_output_channels(2), 3);
  assert.ok(unisonOutputs.every(Number.isFinite));
  assert.ok(Math.max(...unisonOutputs.slice(0, 128).map(Math.abs)) > 0.1);
});

test("Surge XT Unison Helper CV Expander routes polyphonic CV from its exact-source neighbor", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const definition = catalog.find((item) => item.key === "SurgeXTRack/SurgeXTUnisonHelperCVExpander");
  assert.ok(definition);
  assert.equal(definition.localBuild.sourceCommit, "640153d4e70896a707bc3a7cbff1d375c44581b6");
  assert.deepEqual(definition.inputs.map(({name}) => name), ["CV 1", "CV 2"]);
  assert.deepEqual(definition.outputs.map(({name}) => name), [
    "CV 1 to Sub VCO 1", "CV 1 to Sub VCO 2", "CV 1 to Sub VCO 3", "CV 1 to Sub VCO 4",
    "CV 2 to Sub VCO 1", "CV 2 to Sub VCO 2", "CV 2 to Sub VCO 3", "CV 2 to Sub VCO 4",
  ]);
  assert.deepEqual(definition.runtime.expander.models.map(({key}) => key), [
    "SurgeXTRack/SurgeXTUnisonHelper", "SurgeXTRack/SurgeXTUnisonHelperCVExpander",
  ]);

  const runtime = loadDynamicRuntimeWithWasi("SurgeXTRack", "SurgeXTUnisonHelperCVExpander");
  assert.deepEqual([
    runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(),
  ], [0, 2, 8]);
  runtime.rack_web_set_message_neighbor(0, 0, 1);
  runtime.rack_web_set_neighbor_param(0, 4, 3);
  runtime.rack_web_set_neighbor_input(0, 0, 2, 0, 0);
  runtime.rack_web_set_neighbor_input(0, 0, 2, 1, 1);
  runtime.rack_web_set_neighbor_input(0, 1, 6, 0, 0);
  runtime.rack_web_set_neighbor_output_connected(0, 2, 1);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_channels(0, 2);
  runtime.rack_web_set_output_connected(0, 1);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 2 * 16 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 8 * 16 * 128);
  inputs.fill(2, 0, 128);
  inputs.fill(7, 2 * 128, 3 * 128);
  runtime.rack_web_process(4, 48000);
  assert.equal(runtime.rack_web_get_output_channels(0), 6);
  assert.deepEqual(Array.from({length: 6}, (_, channel) => outputs[(channel * 8) * 128 + 3]), [2, 2, 2, 7, 7, 7]);
  assert.ok(outputs.every(Number.isFinite));
});

const newlyCompiledVenomModels = [
  "AD_ASR", "AuxClone", "BenjolinVoltsExpander", "BernoulliSwitch", "CloneMerge",
  "Compare2", "CrossFade3D", "LinearBeats", "Merge4x2", "MergeSplit", "MousePad",
  "MultiMerge", "MultiSplit", "NORSIQChord2Scale", "NORS_IQ", "NullCable", "Oscillator",
  "Pan3D", "PolyClone", "PolyFade", "PolyMute", "PolyOffset", "PolyPrune", "PolySHASR",
  "PolyScale", "PolyUnison", "QuadVCPolarizer", "REXCV", "Recurse", "RecurseStereo",
  "SphereToXYZ", "Split4x2", "VCOUnit", "WaveMultiplier", "WinComp",
];

test("the 35-model Venom exact-source batch remains executable at 44.1 and 48 kHz", () => {
  const catalog = JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json", import.meta.url), "utf8"));
  const catalogModels = new Set(catalog.filter((item) => item.plugin === "Venom").map((item) => item.model));
  assert.ok(newlyCompiledVenomModels.every((model) => catalogModels.has(model)));

  for (const model of newlyCompiledVenomModels) {
    const runtime = loadDynamicRuntime("Venom", model);
    const inputCount = runtime.rack_web_input_count();
    const outputCount = runtime.rack_web_output_count();
    const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), inputCount * 16 * 128);
    const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), outputCount * 16 * 128);
    for (let port = 0; port < inputCount; port++) {
      runtime.rack_web_set_input_connected(port, 1);
      runtime.rack_web_set_input_channels(port, 1);
    }
    for (let port = 0; port < outputCount; port++) runtime.rack_web_set_output_connected(port, 1);
    let frame = 0;
    for (const sampleRate of [44100, 48000]) {
      for (let block = 0; block < 4; block++) {
        for (let port = 0; port < inputCount; port++) {
          for (let index = 0; index < 128; index++) {
            inputs[port * 128 + index] = 5 * Math.sin((frame + index) * 2 * Math.PI * (110 + port * 7) / sampleRate);
          }
        }
        runtime.rack_web_process(128, sampleRate);
        assert.ok(outputs.every(Number.isFinite), `${model} emitted a non-finite sample at ${sampleRate} Hz`);
        frame += 128;
      }
    }
  }
});

test("C1 ChanOut runs all four official character engines as a disconnected-expander module",()=>{
  const wasmModule=new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/C1-ChannelStrip/ChanOut/module.wasm",import.meta.url)));
  assert.deepEqual(WebAssembly.Module.imports(wasmModule),[]);
  const runtime=new WebAssembly.Instance(wasmModule,{}).exports;runtime._initialize();
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[7,2,2,36]);
  for(let port=0;port<2;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1);runtime.rack_web_set_output_connected(port,1)}
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),2*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);
  for(let mode=0;mode<4;mode++){
    runtime.rack_web_set_state(1,mode);let frame=0;
    for(let block=0;block<12;block++){for(let index=0;index<128;index++){inputs[index]=.6*Math.sin((frame+index)*2*Math.PI*440/48000);inputs[128+index]=.45*Math.sin((frame+index)*2*Math.PI*660/48000)}runtime.rack_web_process(128,48000);frame+=128}
    const stereo=[...outputs.slice(0,256)];assert.ok(stereo.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,128).map(Math.abs))>.1);assert.ok(Math.max(...outputs.slice(128,256).map(Math.abs))>.1);assert.ok(stereo.filter(value=>Math.abs(value)>1e-7).length>=255)
  }
});

test("Bogaudio VCO preserves its official four-wave polyphonic oscillator",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bogaudio/Bogaudio-VCO");
  assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"656eaae458e045602dc974bae82e15a11e104958");
  const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-VCO"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[7,4,4,0]);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,4);for(let port=0;port<4;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128),crossings=[0,0,0,0],previous=[0,0,0,0];
  for(let block=0;block<16;block++){for(let channel=0;channel<4;channel++)inputs.fill(channel,(channel*inputCount)*128,(channel*inputCount+1)*128);runtime.rack_web_process(128,48000);for(let channel=0;channel<4;channel++)for(let frame=0;frame<128;frame++){const value=outputs[(channel*outputCount+3)*128+frame];assert.ok(Number.isFinite(value));if((previous[channel]<0&&value>=0)||(previous[channel]>0&&value<=0))crossings[channel]++;previous[channel]=value}}
  assert.equal(runtime.rack_web_get_output_channels(3),4);for(let channel=1;channel<4;channel++)assert.ok(crossings[channel]>crossings[channel-1]*1.9&&crossings[channel]<crossings[channel-1]*2.1);
});

test("Bogaudio LFO runs all six official wave outputs with browser WASI randomness",()=>{
  const runtime=loadDynamicRuntimeWithWasi("Bogaudio","Bogaudio-LFO"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[7,6,6,0]);for(let port=0;port<outputCount;port++)runtime.rack_web_set_output_connected(port,1);
  const outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128),peaks=Array(outputCount).fill(0);
  for(let block=0;block<32;block++){runtime.rack_web_process(128,48000);for(let port=0;port<outputCount;port++)for(let frame=0;frame<128;frame++){const value=outputs[port*128+frame];assert.ok(Number.isFinite(value));peaks[port]=Math.max(peaks[port],Math.abs(value))}}
  assert.ok(peaks.every(peak=>peak>.01),`expected six moving LFO outputs, got ${peaks.join(", ")}`);
});

test("Bogaudio DADSRH advances its official delayed envelope after a trigger edge",()=>{
  const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-DADSRH"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[14,1,3,14]);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);for(let port=0;port<outputCount;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);runtime.rack_web_process(128,48000);inputs.fill(10,0,128);runtime.rack_web_process(128,48000);
  assert.ok(outputs[127]>0);assert.ok(Number.isFinite(outputs[127]));assert.ok(Math.abs(outputs[127]+outputs[128+127]-10)<1e-5);
});

test("Bogaudio Arp turns an official clocked note into pitch and gate output",()=>{
  const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Arp"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[3,4,2,7]);for(const port of [0,2,3]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<outputCount;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);inputs.fill(2,2*128,3*128);runtime.rack_web_process(1,48000);inputs[3*128]=10;runtime.rack_web_process(1,48000);inputs[0]=10;runtime.rack_web_process(1,48000);
  assert.equal(outputs[0],2);assert.equal(outputs[128],5);
});

test("Bogaudio Analyzer performs its FFT synchronously without a browser thread trap",()=>{
  const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Analyzer"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[6,4,4,7]);runtime.rack_web_set_state(0,1);runtime.rack_web_set_state(2,2);for(let port=0;port<inputCount;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<outputCount;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);let frame=0;
  for(let block=0;block<64;block++){for(let port=0;port<inputCount;port++)for(let index=0;index<128;index++)inputs[port*128+index]=Math.sin((frame+index)*2*Math.PI*(220+port*110)/48000);runtime.rack_web_process(128,48000);frame+=128}
  for(let port=0;port<outputCount;port++)assert.equal(runtime.rack_web_get_output_channels(port),1);assert.ok(outputs.every(Number.isFinite));
});

test("Bogaudio VCF preserves its conditional template filter and string bandwidth state",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Bogaudio/Bogaudio-VCF");assert.ok(definition);assert.deepEqual(definition.stateKeys,[{key:"bandwidthMode",type:"string-enum",values:["linear","pitched"]}]);
  const run=state=>{const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-VCF"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[6,6,1,0]);runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(0,.6);runtime.rack_web_set_param(3,.8);runtime.rack_web_set_param(4,2);runtime.rack_web_set_param(5,1);runtime.rack_web_set_state(0,state);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);inputs[3*128]=5;let energy=0;for(let block=0;block<16;block++){runtime.rack_web_process(128,48000);for(const value of outputs.slice(0,128)){assert.ok(Number.isFinite(value));energy+=value*value}inputs[3*128]=0}assert.equal(runtime.rack_web_get_output_channels(0),1);return energy},linear=run(0),pitched=run(1);
  assert.ok(linear>pitched*5,`expected bandwidth modes to differ, got ${linear} and ${pitched}`);
});

test("Bogaudio extended exact-source family keeps oscillator, filter-bank, delay, low-CPU VCF, and blank contracts",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),models=["Bogaudio-Additator","Bogaudio-FFB","Bogaudio-CVD","Bogaudio-LVCF","Bogaudio-Blank3"];for(const model of models)assert.ok(catalog.some(item=>item.key===`Bogaudio/${model}`),`${model} missing from catalog`);
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Additator"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[11,10,1,2]);runtime.rack_web_set_output_connected(0,1);let peak=0,nonzero=0;for(let block=0;block<32;block++){runtime.rack_web_process(128,48000);for(const value of outputs.slice(0,128)){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));nonzero+=Math.abs(value)>1e-7}}assert.ok(peak>1&&nonzero===4096)}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-FFB"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),2*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),3*16*128),energy=[0,0,0];assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[15,2,3,0]);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);for(let port=0;port<3;port++)runtime.rack_web_set_output_connected(port,1);inputs[0]=5;for(let block=0;block<32;block++){runtime.rack_web_process(128,48000);for(let port=0;port<3;port++)for(const value of outputs.slice(port*128,(port+1)*128)){assert.ok(Number.isFinite(value));energy[port]+=value*value}inputs[0]=0}assert.ok(energy.every(value=>value>1e-6))}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-CVD"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),3*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[3,3,1,0]);runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(0,0);runtime.rack_web_set_param(1,0);runtime.rack_web_set_param(2,1);inputs[2*128]=5;runtime.rack_web_process(128,48000);assert.equal(outputs[0],0);assert.equal(outputs[1],5);assert.ok(outputs.every(Number.isFinite))}
  {const run=state=>{const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-LVCF"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),2*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[4,2,1,4]);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(0,.5);runtime.rack_web_set_param(2,.7);runtime.rack_web_set_param(3,2);runtime.rack_web_set_state(0,4);runtime.rack_web_set_state(1,state);inputs[0]=5;let energy=0;for(let block=0;block<16;block++){runtime.rack_web_process(128,48000);for(const value of outputs.slice(0,128)){assert.ok(Number.isFinite(value));energy+=value*value}inputs[0]=0}return energy},linear=run(0),pitched=run(1);assert.ok(linear>pitched*100)}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Blank3");assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[0,1,0,0]);runtime.rack_web_process(256,48000)}
});

test("Bogaudio template-base modules preserve poly constants, matrix routing, and addressable sequencing",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),models=["Bogaudio-PolyCon","Bogaudio-Matrix88","Bogaudio-AddrSeq"];for(const model of models){const definition=catalog.find(item=>item.key===`Bogaudio/${model}`);assert.ok(definition,`${model} missing from catalog`);assert.equal(definition.localBuild.sourceCommit,"656eaae458e045602dc974bae82e15a11e104958")}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-PolyCon"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[17,1,1,16]);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(0,3);runtime.rack_web_set_param(1,.1);runtime.rack_web_set_param(2,.2);runtime.rack_web_set_param(3,-.3);runtime.rack_web_process(1,48000);assert.equal(runtime.rack_web_get_output_channels(0),3);assert.deepEqual([outputs[0],outputs[128],outputs[256]],[1,2,-3])}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Matrix88"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),8*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),8*16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[64,8,8,0]);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(0,.5);inputs[0]=2;for(let block=0;block<4;block++)runtime.rack_web_process(128,48000);assert.equal(runtime.rack_web_get_output_channels(0),1);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.abs(outputs[0])>.3);for(let port=1;port<8;port++)assert.equal(Math.max(...outputs.slice(port*128,(port+1)*128).map(Math.abs)),0)}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-AddrSeq"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[11,3,1,8]);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_param(3,.25);runtime.rack_web_process(1,48000);assert.equal(runtime.rack_web_get_output_channels(0),1);assert.equal(outputs[0],2.5);assert.ok(outputs.every(Number.isFinite))}
});

test("Bogaudio Mix8 and Mix8x preserve their exact-source mixer DSP and bidirectional message-expander ABI",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),contract={transport:"message-buffer",direction:"both",capacity:16384,models:[{key:"Bogaudio/Bogaudio-Mix8",symbol:"modelMix8",index:0},{key:"Bogaudio/Bogaudio-Mix8x",symbol:"modelMix8x",index:1}]};for(const key of ["Bogaudio/Bogaudio-Mix8","Bogaudio/Bogaudio-Mix8x"]){const definition=catalog.find(item=>item.key===key);assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"656eaae458e045602dc974bae82e15a11e104958");assert.deepEqual(definition.runtime.expander,contract)}
  {const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Mix8"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),25*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[27,25,2,0]);assert.ok(Math.abs(runtime.rack_web_get_param(0)-10/11)<1e-6);assert.ok(Math.abs(runtime.rack_web_get_param(24)-10/11)<1e-6);assert.equal(runtime.rack_web_message_capacity(),16384);runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,1);for(let port=0;port<2;port++)runtime.rack_web_set_output_connected(port,1);inputs.fill(2,2*128,3*128);for(let block=0;block<4;block++)runtime.rack_web_process(128,48000);assert.equal(runtime.rack_web_get_output_channels(0),1);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,256).map(Math.abs))>1);runtime.rack_web_set_message_neighbor(1,1,1);runtime.rack_web_process(1,48000);assert.equal(runtime.rack_web_message_flip_requested(1,1),1)}
  const runtime=loadDynamicRuntime("Bogaudio","Bogaudio-Mix8x"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[58,21,2,0]);assert.equal(runtime.rack_web_message_capacity(),16384);runtime.rack_web_set_message_neighbor(0,0,1);for(let port=0;port<2;port++)runtime.rack_web_set_output_connected(port,1);runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.map(Math.abs))<1e-3);assert.equal(runtime.rack_web_message_flip_requested(0,1),1);
});

test("Count Modula macro-configured Switch8To1 advances and routes its official shared source",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="CountModula/Switch8To1");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"30b3c6c46fc0589f5e0ece7ad79abbe0293e70fd");assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[5,14,1,21]);assert.deepEqual([definition.params[0].min,definition.params[0].max,definition.params[0].default],[1,8,8]);assert.deepEqual(definition.stateKeys,[{key:"moduleVersion",type:"integer"},{key:"currentStep",type:"integer"},{key:"direction",type:"integer"},{key:"clockState",type:"boolean"},{key:"runState",type:"boolean"},{key:"theme",type:"integer"}]);
  const runtime=loadDynamicRuntime("CountModula","Switch8To1"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),14*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128),lights=new Float32Array(runtime.memory.buffer,runtime.rack_web_light_buffer(),21);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[5,14,1,21]);for(const port of [1,6,7]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}runtime.rack_web_set_output_connected(0,1);inputs[6*128]=2;inputs[7*128]=7;inputs[1*128]=10;runtime.rack_web_process(1,48000);assert.equal(outputs[0],2);assert.equal(lights[0],1);inputs[1*128]=0;runtime.rack_web_process(1,48000);inputs[1*128]=10;runtime.rack_web_process(1,48000);assert.equal(outputs[0],7);assert.equal(lights[1],1);assert.ok(outputs.every(Number.isFinite));
});

test("Impromptu Clocked preserves official timing, parameter ranges, and stopped-output state",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="ImpromptuModular/Clocked");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"5ba4ccd49cd657d04bb73b9143daa7ab490baf2b");assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[20,7,7,8]);assert.deepEqual(definition.params[0],{id:0,name:"Master clock",min:30,max:300,default:120});assert.deepEqual(definition.params[1],{id:1,name:"Clk 1 ratio",min:-34,max:34,default:0});assert.deepEqual(definition.outputs.slice(0,4).map(output=>output.name),["Master clock","Clock 1","Clock 2","Clock 3"]);assert.equal(definition.stateKeys.length,13);
  const runtime=loadDynamicRuntime("ImpromptuModular","Clocked"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),7*16*128);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[20,7,7,8]);assert.deepEqual([runtime.rack_web_get_param(0),runtime.rack_web_get_param_min(0),runtime.rack_web_get_param_max(0)],[120,30,300]);runtime.rack_web_set_output_connected(0,1);let previous=0,rises=0,falls=0;for(let block=0;block<375;block++){runtime.rack_web_process(128,48000);for(const voltage of outputs.slice(0,128)){if(voltage>1&&previous<=1)rises++;if(voltage<=1&&previous>1)falls++;previous=voltage;assert.ok(voltage===0||voltage===10)}}assert.equal(rises,2);assert.equal(falls,2);runtime.rack_web_set_state(7,0);runtime.rack_web_set_state(2,0);runtime.rack_web_process(128,48000);assert.equal(Math.max(...outputs.slice(0,128)),0);assert.equal(Math.max(...outputs.slice(5*128,6*128)),0);
});

test("Impromptu Foundry restores its nested 4-track sequence JSON through the WASM ABI",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="ImpromptuModular/Foundry");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"5ba4ccd49cd657d04bb73b9143daa7ab490baf2b");assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[79,13,12,143]);assert.equal(definition.params.filter(param=>param.button).length,59);assert.equal(definition.params[14].button,true);assert.equal(definition.params[78].button,undefined);assert.deepEqual(definition.inputs.slice(1,5).map(input=>input.name),["Track A CV","Track B CV","Track C CV","Track D CV"]);assert.deepEqual(definition.outputs.slice(0,4).map(output=>output.name),["Track A CV","Track B CV","Track C CV","Track D CV"]);
  const runtime=loadDynamicRuntime("ImpromptuModular","Foundry"),zeros=count=>Array(count).fill(0),data={running:true,stepIndexEdit:0,phraseIndexEdit:0,trackIndexEdit:0,id0_pulsesPerStep:1,id0_delay:0,id0_runModeSong:0,id0_songBeginIndex:0,id0_songEndIndex:0,id0_phrases:zeros(99),id0_sequences:[1,...zeros(63)],id0_seqSaved:[1,...zeros(63)],id0_cv:[1.75,...zeros(31)],id0_attributes:[17445476,...zeros(31)],id0_seqIndexEdit:0};for(let track=1;track<4;track++){data[`id${track}_sequences`]=[1,...zeros(63)];data[`id${track}_seqSaved`]=zeros(64);data[`id${track}_cv`]=[];data[`id${track}_attributes`]=[]}
  const bytes=new TextEncoder().encode(JSON.stringify(data)),pointer=runtime.rack_web_state_buffer(bytes.length);new Uint8Array(runtime.memory.buffer,pointer,bytes.length).set(bytes);assert.equal(runtime.rack_web_commit_state_json(bytes.length),1);runtime.rack_web_set_output_connected(0,1);for(let block=0;block<4;block++)runtime.rack_web_process(128,48000);const outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),12*16*128);assert.equal(outputs[0],1.75);assert.equal(outputs[127],1.75);runtime.rack_web_set_param(14,1);runtime.rack_web_process(128,48000);runtime.rack_web_set_param(14,0);runtime.rack_web_process(128,48000);const snapshotLength=runtime.rack_web_snapshot_state_json(),snapshotPointer=runtime.rack_web_snapshot_state_buffer(),snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(runtime.memory.buffer,snapshotPointer,snapshotLength)));assert.equal(snapshot.id0_cv[0],1.75);assert.equal(Boolean(snapshot.id0_attributes[0]&0x01000000),false);
});

test("TC Wurl exact-source physical model responds to a polyphonic note gate",()=>{
  const runtime=loadDynamicRuntime("TC-Wurl","TC-Wurl"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[23,8,2,0]);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  for(const port of [0,1,2]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<2;port++)runtime.rack_web_set_output_connected(port,1);
  inputs.fill(8,2*128,3*128);runtime.rack_web_process(128,48000);inputs.fill(10,1*128,2*128);let frame=128,peak=0;
  for(let block=0;block<48;block++){runtime.rack_web_process(128,48000);peak=Math.max(peak,...outputs.slice(0,256).map(Math.abs));frame+=128}
  assert.equal(frame,6272);assert.ok([...outputs.slice(0,256)].every(Number.isFinite));assert.ok(peak>.001,`expected a sounding electric-piano voice, got ${peak}`);
});

test("Submarine TD-202 exact source preserves its zero-I/O visual module ABI",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="SubmarineFree/TD-202");
  assert.ok(definition);assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights],[0,0,0,2]);assert.equal(definition.localBuild.sourceCommit,"16796663a6e75a9d8fd003961329e98c531e848f");
  const runtime=loadDynamicRuntime("SubmarineFree","TD-202");assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[0,0,0,2]);runtime.rack_web_process(256,48000);assert.deepEqual([...new Float32Array(runtime.memory.buffer,runtime.rack_web_light_buffer(),2)],[0,0]);
});

test("Venom Mix4Stereo preserves channel order and oversampled clipping without adjacent expanders",()=>{
  const wasmModule=new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/Venom/Mix4Stereo/module.wasm",import.meta.url)));
  assert.deepEqual(WebAssembly.Module.imports(wasmModule),[]);
  const runtime=new WebAssembly.Instance(wasmModule,{}).exports;runtime._initialize();
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[8,8,2,0]);
  for(let port=0;port<8;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<2;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),8*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);
  for(let frame=0;frame<128;frame++)for(let channel=0;channel<4;channel++){inputs[channel*128+frame]=.1*(channel+1);inputs[(channel+4)*128+frame]=.15*(channel+1)}
  runtime.rack_web_process(128,48000);assert.ok(Math.abs(outputs[127]-1)<1e-6);assert.ok(Math.abs(outputs[255]-1.5)<1e-6);
  runtime.rack_web_set_param(6,3);for(let block=0;block<12;block++)runtime.rack_web_process(128,48000);const stereo=[...outputs.slice(0,256)];assert.ok(stereo.every(Number.isFinite));assert.equal(stereo.filter(value=>Math.abs(value)>1e-7).length,256);assert.ok(outputs[127]>.9&&outputs[255]>1.4)
});

test("Venom Mix4 preserves its mono sum through the inherited biquad path",()=>{
  const wasmModule=new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/Venom/Mix4/module.wasm",import.meta.url))),runtime=new WebAssembly.Instance(wasmModule,{}).exports;runtime._initialize();
  assert.deepEqual(WebAssembly.Module.imports(wasmModule),[]);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[8,4,1,0]);
  for(let port=0;port<4;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}runtime.rack_web_set_output_connected(0,1);const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),4*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);for(let frame=0;frame<128;frame++)for(let port=0;port<4;port++)inputs[port*128+frame]=.1*(port+1);runtime.rack_web_process(128,48000);assert.ok(Math.abs(outputs[127]-1)<1e-6);runtime.rack_web_set_param(6,3);for(let block=0;block<12;block++)runtime.rack_web_process(128,48000);assert.ok([...outputs.slice(0,128)].every(Number.isFinite));assert.equal([...outputs.slice(0,128)].filter(value=>Math.abs(value)>1e-7).length,128);assert.ok(outputs[127]>1)
});

test("Venom VCAMix4 preserves its inherited VCA, direct-out, chain, and mix routing",()=>{
  const wasmModule=new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/Venom/VCAMix4/module.wasm",import.meta.url))),runtime=new WebAssembly.Instance(wasmModule,{}).exports;runtime._initialize();
  assert.deepEqual(WebAssembly.Module.imports(wasmModule),[]);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[10,10,5,0]);
  for(const port of [0,5,6,7,8,9]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<5;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),10*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),5*16*128);
  inputs.fill(5,0,128);for(let frame=0;frame<128;frame++){inputs[5*128+frame]=2;inputs[6*128+frame]=.2;inputs[7*128+frame]=.3;inputs[8*128+frame]=.4;inputs[9*128+frame]=.25}
  runtime.rack_web_process(128,48000);assert.ok(Math.abs(outputs[127]-1)<1e-6);assert.ok(Math.abs(outputs[255]-.2)<1e-6);assert.ok(Math.abs(outputs[383]-.3)<1e-6);assert.ok(Math.abs(outputs[511]-.4)<1e-6);assert.ok(Math.abs(outputs[639]-2.15)<1e-5);
});

test("Venom VCAMix4Stereo preserves normalled stereo VCA mixes and port-change callbacks",()=>{
  const wasmModule=new WebAssembly.Module(fs.readFileSync(new URL("../public/dynamic-plugins/Venom/VCAMix4Stereo/module.wasm",import.meta.url))),runtime=new WebAssembly.Instance(wasmModule,{}).exports;runtime._initialize();
  assert.deepEqual(WebAssembly.Module.imports(wasmModule),[]);assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[10,15,10,0]);
  for(let port=0;port<10;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}for(let port=0;port<10;port++)runtime.rack_web_set_output_connected(port,1);
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),15*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),10*16*128);
  for(let frame=0;frame<128;frame++){for(let channel=0;channel<4;channel++){inputs[channel*128+frame]=.1*(channel+1);inputs[(channel+4)*128+frame]=.5+.1*channel}inputs[8*128+frame]=.25;inputs[9*128+frame]=.75}
  runtime.rack_web_process(128,48000);assert.deepEqual([...Array(8)].map((_,port)=>Number(outputs[port*128+127].toFixed(6))),[.1,.2,.3,.4,.5,.6,.7,.8]);assert.ok(Math.abs(outputs[8*128+127]-1.25)<1e-6);assert.ok(Math.abs(outputs[9*128+127]-3.35)<1e-5);
  runtime.rack_web_set_input_connected(4,0);runtime.rack_web_set_input_connected(4,1);runtime.rack_web_process(128,48000);assert.ok([...outputs].every(Number.isFinite));
});

test("Venom ShapedVCA preserves mono-normalled stereo gain and CV response",()=>{
  const runtime=loadDynamicRuntime("Venom","ShapedVCA"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),4*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[8,4,2,0]);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_input_connected(2,1);runtime.rack_web_set_input_channels(2,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_output_connected(1,1);inputs.fill(5,0,128);inputs.fill(2,2*128,3*128);runtime.rack_web_process(128,48000);assert.ok(Math.abs(outputs[127]-1)<1e-6);assert.ok(Math.abs(outputs[255]-1)<1e-6);
});

test("Venom SVF emits finite normalled stereo morph and four filter pairs",()=>{
  const runtime=loadDynamicRuntime("Venom","SVF"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),9*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),10*16*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[19,9,10,0]);runtime.rack_web_set_input_connected(7,1);runtime.rack_web_set_input_channels(7,1);for(let port=0;port<10;port++)runtime.rack_web_set_output_connected(port,1);let frame=0;for(let block=0;block<12;block++){for(let index=0;index<128;index++)inputs[7*128+index]=3*Math.sin((frame+index)*2*Math.PI*220/48000);runtime.rack_web_process(128,48000);frame+=128}assert.ok([...outputs].every(Number.isFinite));for(let pair=0;pair<5;pair++){assert.ok(Math.max(...outputs.slice(pair*2*128,(pair*2+1)*128).map(Math.abs))>.01);assert.deepEqual([...outputs.slice(pair*2*128,(pair*2+1)*128)],[...outputs.slice((pair*2+1)*128,(pair*2+2)*128)])}
});

test("Venom wave processors fold and remap an active poly signal",()=>{
  for(const [model,inputCount,inputPort,params] of [["WaveFolder",4,3,[]],["WaveMangler",8,7,[[2,0],[11,5],[14,1],[16,-5]]]]){const runtime=loadDynamicRuntime("Venom",model),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);runtime.rack_web_set_input_connected(inputPort,1);runtime.rack_web_set_input_channels(inputPort,1);runtime.rack_web_set_output_connected(0,1);for(const [id,value] of params)runtime.rack_web_set_param(id,value);let frame=0;for(let block=0;block<8;block++){for(let index=0;index<128;index++)inputs[inputPort*128+index]=3*Math.sin((frame+index)*2*Math.PI*220/48000);runtime.rack_web_process(128,48000);frame+=128}assert.ok([...outputs.slice(0,128)].every(Number.isFinite));assert.equal([...outputs.slice(0,128)].filter(value=>Math.abs(value)>1e-7).length,128)}
});

test("Venom Octaver dry path and Slew gates remain active and finite",()=>{
  const octaver=loadDynamicRuntime("Venom","Octaver"),octIn=new Float32Array(octaver.memory.buffer,octaver.rack_web_input_buffer(),6*16*128),octOut=new Float32Array(octaver.memory.buffer,octaver.rack_web_output_buffer(),16*128);octaver.rack_web_set_param(1,1);octaver.rack_web_set_input_connected(5,1);octaver.rack_web_set_input_channels(5,1);for(let index=0;index<128;index++)octIn[5*128+index]=2*Math.sin(index*2*Math.PI*220/48000);octaver.rack_web_process(128,48000);assert.ok([...octOut.slice(0,128)].every(Number.isFinite));assert.ok(Math.max(...octOut.slice(0,128).map(Math.abs))>1);
  const slew=loadDynamicRuntime("Venom","Slew"),slewIn=new Float32Array(slew.memory.buffer,slew.rack_web_input_buffer(),6*16*128),slewOut=new Float32Array(slew.memory.buffer,slew.rack_web_output_buffer(),4*16*128);slew.rack_web_set_input_connected(4,1);slew.rack_web_set_input_channels(4,1);slewIn.fill(10,4*128,5*128);slew.rack_web_process(128,48000);assert.ok([...slewOut.slice(0,4*128)].every(Number.isFinite));assert.equal(Math.max(...slewOut.slice(0,128)),10);assert.ok(slewOut[3*128+127]>0&&slewOut[3*128+127]<10);
});

test("Venom Logic executes integer SIMD truth operations from exact source",()=>{
  const runtime=loadDynamicRuntime("Venom","Logic"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  assert.deepEqual([runtime.rack_web_param_count(),inputCount,outputCount,runtime.rack_web_light_count()],[24,20,9,0]);
  runtime.rack_web_set_param(15,2); // Channel 1 OR
  for(const port of [2,11]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}
  inputs[2*128]=10;inputs[11*128]=0;runtime.rack_web_process(1,48000);assert.equal(outputs[0],10);
  inputs[2*128]=0;runtime.rack_web_process(1,48000);assert.equal(outputs[0],0);
});

test("Audible Links preserves its multiple and precision-adder port order", () => {
  const runtime = loadRuntime("audible-links");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [0, 6, 6, 6]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 6 * 128);
  for(let port=0;port<6;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}
  inputs[0] = 3;
  inputs[128] = 2;
  inputs[256] = -5;
  inputs[384] = 1;
  inputs[512] = 2;
  inputs[640] = 4;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128], outputs[256], outputs[384], outputs[512], outputs[640]], [3, 3, 3, -3, -3, 7]);
});

test("Audible Kinks matches sign, logic, noise, and sample-and-hold semantics", () => {
  const runtime = loadRuntime("audible-kinks");
  assert.deepEqual([runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [5, 7, 6]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 5 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 7 * 128);
  runtime.rack_web_seed(42);
  for(let port=0;port<5;port++){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}
  inputs[0] = -3;
  inputs[128] = 2;
  inputs[256] = 5;
  inputs[384] = 4;
  inputs[512] = 0;
  runtime.rack_web_process(1, 48000);
  inputs[512] = 10;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128], outputs[256], outputs[384], outputs[512], outputs[768]], [3, 0, 3, 5, 2, 4]);
  assert.ok(Number.isFinite(outputs[640]));
});

test("Audible Shades honors output connections for cascading mix groups", () => {
  const runtime = loadRuntime("audible-shades");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count()], [6, 3, 3]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 3 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 3 * 128);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_output_connected(0, 1);
  runtime.rack_web_set_output_connected(1, 1);
  runtime.rack_web_set_output_connected(2, 1);
  runtime.rack_web_set_param(0, 1);
  inputs[0] = 2;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128], outputs[256]], [2, 0, 0]);
});

test("Audible Branches routes a rising gate using Rack's non-interleaved output IDs", () => {
  const runtime = loadRuntime("audible-branches");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [4, 4, 4, 4]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 4 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 128);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_connected(1, 1);
  runtime.rack_web_set_param(0, 1);
  inputs[0] = 10;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128], outputs[256], outputs[384]], [0, 0, 10, 0]);
});

test("Fundamental SEQ3 advances on external clock and emits the selected row CV", () => {
  const runtime = loadRuntime("fundamental-seq3");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [39, 5, 16, 27]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 5 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 16 * 128);
  runtime.rack_web_set_input_connected(1, 1);
  runtime.rack_web_set_param(5, 2.5);
  for (let id = 2; id < 10; id++) runtime.rack_web_set_state(id, 0);
  runtime.rack_web_set_state(3, 1);
  runtime.rack_web_process(1, 48000);
  inputs[128] = 10;
  runtime.rack_web_process(1, 48000);
  assert.equal(outputs[128], 2.5);
  assert.equal(outputs[5 * 128], 10);
  assert.equal(outputs[0], 10);
});

test("Rack Core Blank provides a zero-port compatibility artifact", () => {
  const runtime = loadRuntime("core-blank");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [0, 0, 0, 0]);
  runtime.rack_web_process(128, 48000);
});

test("Rack Core MIDI-CV consumes Web MIDI notes, polyphony, and transport pulses", () => {
  const runtime=loadRuntime("core-midi-cv"),outputCount=runtime.rack_web_output_count(),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  const state=new TextEncoder().encode(JSON.stringify({channels:2,polyMode:0,pwRange:2,clockDivision:24,midi:{channel:-1}})),pointer=runtime.rack_web_state_buffer(state.length);new Uint8Array(runtime.memory.buffer,pointer,state.length).set(state);assert.equal(runtime.rack_web_commit_state_json(state.length),1);
  runtime.rack_web_midi_push(3,0x90,69,100);runtime.rack_web_process(1,48000);
  assert.equal(runtime.rack_web_get_output_channels(0),2);assert.ok(Math.abs(outputs[0]-.75)<1e-6);assert.equal(outputs[128],10);assert.ok(Math.abs(outputs[2*128]-100/127*10)<1e-5);assert.equal(outputs[6*128],10);
  runtime.rack_web_midi_push(1,0xf8,0,0);runtime.rack_web_process(1,48000);assert.equal(outputs[7*128],10);assert.equal(outputs[8*128],10);
  runtime.rack_web_midi_push(3,0x80,69,64);runtime.rack_web_process(1,48000);assert.equal(outputs[128],0);
});

test("Rack Core CV-MIDI emits browser-drainable note, CC, and clock records", () => {
  const runtime=loadRuntime("core-cv-midi"),inputCount=runtime.rack_web_input_count(),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128);
  for(const port of [0,1,6]){runtime.rack_web_set_input_connected(port,1);runtime.rack_web_set_input_channels(port,1)}
  inputs[0]=.75;inputs[128]=10;inputs[6*128]=10;runtime.rack_web_process(1,48000);
  const count=runtime.rack_web_midi_output_available(),records=new Uint8Array(runtime.memory.buffer,runtime.rack_web_midi_output_buffer(),count*4),messages=Array.from({length:count},(_,index)=>[...records.slice(index*4,index*4+4)]);
  assert.ok(messages.some(record=>record[1]===0x90&&record[2]===69&&record[3]===100));assert.ok(messages.some(record=>record[0]===1&&record[1]===0xf8));runtime.rack_web_consume_midi_output(count);assert.equal(runtime.rack_web_midi_output_available(),0);
});

test("Rack Core MIDI CC and gate grids preserve learned mappings in JSON", () => {
  const cc=loadRuntime("core-midi-cc-cv"),ccOut=new Float32Array(cc.memory.buffer,cc.rack_web_output_buffer(),16*128);cc.rack_web_midi_push(3,0xb0,1,127);cc.rack_web_process(1,48000);assert.equal(ccOut[0],10);cc.rack_web_process(128,48000);assert.equal(ccOut[127],10);
  const gate=loadRuntime("core-midi-gate"),gateOut=new Float32Array(gate.memory.buffer,gate.rack_web_output_buffer(),16*128);gate.rack_web_midi_push(3,0x90,48,64);gate.rack_web_process(1,48000);assert.equal(gateOut[0],10);gate.rack_web_midi_push(3,0x80,48,0);gate.rack_web_process(1,48000);assert.equal(gateOut[0],10);for(let block=0;block<2;block++)gate.rack_web_process(128,48000);assert.equal(gateOut[127],0);
  gate.rack_web_snapshot_state_json();const snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(gate.memory.buffer,gate.rack_web_snapshot_state_buffer(),gate.rack_web_snapshot_state_json())));assert.equal(snapshot.notes[0],48);assert.equal(snapshot.midi.channel,-1);
});

test("Befaco Mixer sums four levels and emits the inverted pair", () => {
  const runtime = loadRuntime("befaco-mixer");
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 4 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 128);
  runtime.rack_web_set_param(0, .5);
  runtime.rack_web_set_param(1, 1);
  runtime.rack_web_set_input_connected(0, 1);
  runtime.rack_web_set_input_connected(1, 1);
  inputs[0] = 4;
  inputs[128] = -1;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128]], [1, -1]);
});

test("Fundamental VCO emits finite bipolar oscillator signals", () => {
  const runtime = loadRuntime("fundamental-vco");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [8, 4, 4, 5]);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 4 * 128);
  runtime.rack_web_process(128, 48000);
  assert.ok(outputs.every(Number.isFinite));
  assert.ok(Math.max(...outputs.slice(0, 128)) - Math.min(...outputs.slice(0, 128)) > 1);
});

test("Fundamental VCO produces independently pitched polyphonic output buffers", () => {
  const runtime=loadRuntime("fundamental-vco"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128);
  const outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,4);
  for(let channel=0;channel<4;channel++)inputs[(channel*inputCount)*128]=channel*.5;
  runtime.rack_web_process(128,48000);
  assert.equal(runtime.rack_web_get_output_channels(0),4);
  const endings=Array.from({length:4},(_,channel)=>outputs[(channel*outputCount)*128+127]);
  assert.ok(endings.every(Number.isFinite));assert.equal(new Set(endings.map(value=>value.toFixed(4))).size,4);
});

test("Fundamental VCF produces lowpass and highpass responses to an impulse", () => {
  const runtime = loadRuntime("fundamental-vcf");
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 4 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 128);
  runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,1);
  inputs[3 * 128] = 5;
  runtime.rack_web_process(128, 48000);
  assert.ok(outputs.every(Number.isFinite));
  assert.ok(Math.max(...outputs.slice(0, 128).map(Math.abs)) > 0);
  assert.ok(Math.max(...outputs.slice(128, 256).map(Math.abs)) > 0);
});

test("Fundamental Delay returns a 1ms wet impulse at the expected port", () => {
  const runtime = loadRuntime("fundamental-delay");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [8, 6, 2, 1]);
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 6 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 128);
  runtime.rack_web_set_param(0, 0);
  runtime.rack_web_set_param(2, .5);
  runtime.rack_web_set_input_connected(4, 1);
  inputs[4 * 128] = 5;
  runtime.rack_web_process(128, 48000);
  assert.ok(Math.max(...outputs.slice(128, 256).map(Math.abs)) > 0);
});

test("Rack Core Audio-8 exposes the exact browser boundary port counts", () => {
  const runtime = loadRuntime("core-audio8");
  assert.deepEqual([runtime.rack_web_param_count(), runtime.rack_web_input_count(), runtime.rack_web_output_count(), runtime.rack_web_light_count()], [0, 8, 8, 16]);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 8 * 128);
  runtime.rack_web_process(128, 48000);
  assert.ok(outputs.every((value) => value === 0));
});

test("Rack Core Audio-2, Audio-16, and Notes preserve their exact browser contracts",()=>{
  const audio2=loadRuntime("core-audio2"),audio16=loadRuntime("core-audio16"),notes=loadRuntime("core-notes");assert.deepEqual([audio2.rack_web_param_count(),audio2.rack_web_input_count(),audio2.rack_web_output_count(),audio2.rack_web_light_count()],[1,2,2,12]);assert.deepEqual([audio16.rack_web_param_count(),audio16.rack_web_input_count(),audio16.rack_web_output_count(),audio16.rack_web_light_count()],[0,16,16,32]);
  const state=new TextEncoder().encode(JSON.stringify({text:"Patch notes 音序"})),pointer=notes.rack_web_state_buffer(state.length);new Uint8Array(notes.memory.buffer,pointer,state.length).set(state);assert.equal(notes.rack_web_commit_state_json(state.length),1);const length=notes.rack_web_snapshot_state_json(),snapshot=JSON.parse(new TextDecoder().decode(new Uint8Array(notes.memory.buffer,notes.rack_web_snapshot_state_buffer(),length)));assert.deepEqual(snapshot,{text:"Patch notes 音序"});
});

test("Fundamental Scope preserves both pass-through channels", () => {
  const runtime = loadRuntime("fundamental-scope");
  const inputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_input_buffer(), 3 * 128);
  const outputs = new Float32Array(runtime.memory.buffer, runtime.rack_web_output_buffer(), 2 * 128);
  runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);
  runtime.rack_web_set_input_connected(1,1);runtime.rack_web_set_input_channels(1,1);
  inputs[0] = 3;
  inputs[128] = -2;
  runtime.rack_web_process(1, 48000);
  assert.deepEqual([outputs[0], outputs[128]], [3, -2]);
});

test("Audible Braids browser adapter emits its macro oscillator", () => {
  const runtime=loadRuntime("audible-braids"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count()],[7,5,1]);
  runtime.rack_web_process(128,48000);
  assert.ok(outputs.every(Number.isFinite));
  assert.ok(Math.max(...outputs)-Math.min(...outputs)>1);
});

test("Audible Tides browser adapter emits gate, unipolar, and bipolar phases", () => {
  const runtime=loadRuntime("audible-tides"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),4*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[7,9,4,6]);
  runtime.rack_web_process(128,48000);
  assert.ok(Math.max(...outputs.slice(0,128))===5);
  assert.ok(outputs.every(Number.isFinite));
});

test("Audible Rings browser adapter rings after a strum", () => {
  const runtime=loadRuntime("audible-rings"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),8*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[12,8,2,4]);
  runtime.rack_web_set_input_connected(5,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_output_connected(1,1);runtime.rack_web_process(1,48000);inputs[5*128]=10;runtime.rack_web_process(128,48000);inputs.fill(0);
  let peak=0;for(let block=0;block<4;block++){runtime.rack_web_process(128,48000);peak=Math.max(peak,...outputs.map(Math.abs));}
  assert.ok(peak>0);
});

test("Audible Elements browser adapter excites its stereo resonator", () => {
  const runtime=loadRuntime("audible-elements"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[28,16,2,3]);
  runtime.rack_web_set_input_connected(2,1);inputs.fill(10,2*128,3*128);runtime.rack_web_process(128,48000);
  assert.ok(Math.max(...outputs.map(Math.abs))>0);
});

test("Befaco SpringReverb browser adapter produces a delayed wet tail", () => {
  const runtime=loadRuntime("befaco-spring-reverb"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),5*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[4,5,2,8]);
  runtime.rack_web_set_input_connected(2,1);inputs[2*128]=5;runtime.rack_web_process(128,48000);inputs.fill(0);let peak=0;for(let block=0;block<35;block++){runtime.rack_web_process(128,48000);peak=Math.max(peak,...outputs.slice(128,256).map(Math.abs));}
  assert.ok(peak>0);
});

test("Valley Plateau loads from its official Library revision and preserves the plate tail",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),definition=catalog.find(item=>item.key==="Valley/Plateau");assert.ok(definition);assert.equal(definition.localBuild.sourceCommit,"86f02e431136a7f5c96a872b99b7115b7e133e05");assert.equal(definition.runtime.strategy,"direct-rack-source-adapter");assert.deepEqual([definition.params.length,definition.params.filter(param=>!param.hidden).length,definition.inputs.length,definition.outputs.length,definition.lights],[31,30,17,2,5]);assert.deepEqual(definition.params.slice(0,3).map(param=>param.name),["Dry level","Wet level","Pre-delay"]);assert.deepEqual(definition.inputs.slice(0,2).map(input=>input.name),["Left","Right"]);assert.ok([...definition.params.filter(param=>!param.hidden),...definition.inputs,...definition.outputs].every(control=>control.position));
  const runtime=loadDynamicRuntime("Valley","Plateau"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),17*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*16*128);for(const param of definition.params)runtime.rack_web_set_param(param.id,param.default);runtime.rack_web_set_param(0,0);runtime.rack_web_set_param(1,1);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);runtime.rack_web_set_output_connected(0,1);runtime.rack_web_set_output_connected(1,1);inputs[0]=5;runtime.rack_web_process(128,48000);inputs.fill(0);let peak=0;for(let block=0;block<48;block++){runtime.rack_web_process(128,48000);assert.ok(outputs.every(Number.isFinite));peak=Math.max(peak,...outputs.map(Math.abs))}assert.ok(peak>.01);
});

test("Valley sequencers, SIMD filters, synth voices, and embedded wavetable ROMs run from one official revision",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../public/dynamic-plugins/catalog.json",import.meta.url),"utf8")),commit="86f02e431136a7f5c96a872b99b7115b7e133e05",contracts={Topograph:[10,10,6,5,4194304],uGraph:[10,10,6,5,4194304],Feline:[17,12,3,0,16777216],Amalgam:[14,13,12,1,4194304],Interzone:[43,14,15,2,67108864],Dexter:[141,57,7,43,16777216],Terrorform:[51,29,8,16,33554432]},definitions={};for(const [model,contract] of Object.entries(contracts)){const definition=catalog.find(item=>item.key===`Valley/${model}`);assert.ok(definition,`${model} missing from catalog`);definitions[model]=definition;assert.equal(definition.localBuild.sourceCommit,commit);assert.equal(definition.runtime.strategy,"direct-rack-source-adapter");assert.deepEqual([definition.params.length,definition.inputs.length,definition.outputs.length,definition.lights,definition.runtime.initialMemory],contract)}assert.ok(definitions.Topograph.params.every(param=>param.position));assert.ok(definitions.uGraph.inputs.every(input=>input.position));assert.ok([...definitions.Dexter.params.filter(param=>!param.hidden),...definitions.Dexter.inputs.filter(input=>!input.hidden),...definitions.Dexter.outputs.filter(output=>!output.hidden)].every(control=>control.position));assert.equal(definitions.Amalgam.inputs[6].hidden,true);assert.equal(definitions.Interzone.inputs[9].hidden,true);assert.ok(fs.statSync(new URL("../public/dynamic-plugins/Valley/Dexter/module.wasm",import.meta.url)).size>1000000);
  const create=model=>{const definition=definitions[model],runtime=loadDynamicRuntime("Valley",model);for(const param of definition.params)runtime.rack_web_set_param(param.id,param.default);for(let output=0;output<definition.outputs.length;output++)runtime.rack_web_set_output_connected(output,1);return{definition,runtime,inputs:new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),definition.inputs.length*16*128),outputs:new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),definition.outputs.length*16*128)}};
  for(const model of ["Topograph","uGraph"]){const {runtime,inputs,outputs}=create(model);for(const input of [0,9]){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1)}let peak=0,nonzero=0;for(let block=0;block<64;block++){inputs.fill(0);for(let frame=0;frame<128;frame++)inputs[frame]=Math.sin((block*128+frame)*.04)*2;if(block%8===0)inputs.fill(10,9*128,9*128+2);runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));nonzero+=Math.abs(value)>1e-6}}assert.equal(peak,10);assert.ok(nonzero>100)}
  {const {runtime,inputs,outputs}=create("Feline");runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,1);let peak=0;for(let block=0;block<24;block++){for(let frame=0;frame<128;frame++)inputs[frame]=Math.sin((block*128+frame)*.03)*4;runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value))}}assert.ok(peak>1)}
  {const {runtime,inputs,outputs}=create("Amalgam");for(const input of [0,2]){runtime.rack_web_set_input_connected(input,1);runtime.rack_web_set_input_channels(input,1)}let peak=0;for(let block=0;block<16;block++){for(let frame=0;frame<128;frame++){inputs[frame]=Math.sin((block*128+frame)*.05)*3;inputs[2*128+frame]=Math.cos((block*128+frame)*.03)*2}runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value))}}assert.ok(peak>1)}
  {const {runtime,inputs,outputs}=create("Interzone");runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,1);let peak=0;for(let block=0;block<24;block++){inputs.fill(10,3*128,4*128);runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value))}}assert.ok(peak>4&&peak<20)}
  for(const model of ["Dexter","Terrorform"]){const {runtime,outputs}=create(model);let peak=0,nonzero=0;for(let block=0;block<24;block++){runtime.rack_web_process(128,48000);for(const value of outputs){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));nonzero+=Math.abs(value)>1e-6}}assert.ok(peak>4&&peak<20);assert.ok(nonzero>1000)}
});

test("Fundamental Wavetable VCO morphs a finite audio-rate table",()=>{
  const runtime=loadRuntime("fundamental-wtvco"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[7,4,1,5]);
  runtime.rack_web_set_param(3,.8);runtime.rack_web_process(128,48000);
  assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs)-Math.min(...outputs)>1);
});

test("Fundamental Wavetable VCO carries four pitch voices",()=>{
  const runtime=loadRuntime("fundamental-wtvco"),inputCount=runtime.rack_web_input_count();
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),16*128);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_input_connected(3,1);runtime.rack_web_set_input_channels(3,4);
  for(let channel=0;channel<4;channel++)inputs.fill(channel*.5,(channel*inputCount+3)*128,(channel*inputCount+4)*128);
  runtime.rack_web_process(128,48000);assert.equal(runtime.rack_web_get_output_channels(0),4);
  assert.equal(new Set(Array.from({length:4},(_,channel)=>outputs[channel*128+127].toFixed(4))).size,4);
});

test("Fundamental LFO preserves removed slots and emits four waveforms",()=>{
  const runtime=loadRuntime("fundamental-lfo"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),4*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[7,5,4,5]);
  runtime.rack_web_set_param(2,8);runtime.rack_web_process(128,48000);
  assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.slice(0,128))-Math.min(...outputs.slice(0,128))>.1);
});

test("Fundamental LFO modulates four voices independently",()=>{
  const runtime=loadRuntime("fundamental-lfo"),inputCount=runtime.rack_web_input_count(),outputCount=runtime.rack_web_output_count();
  const inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),inputCount*16*128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),outputCount*16*128);
  runtime.rack_web_set_polyphony(4);runtime.rack_web_set_param(3,1);runtime.rack_web_set_input_connected(0,1);runtime.rack_web_set_input_channels(0,4);
  for(let channel=0;channel<4;channel++)inputs.fill(channel*.5,(channel*inputCount)*128,(channel*inputCount+1)*128);
  runtime.rack_web_process(128,48000);assert.equal(runtime.rack_web_get_output_channels(0),4);
  assert.equal(new Set(Array.from({length:4},(_,channel)=>outputs[(channel*outputCount)*128+127].toFixed(4))).size,4);
});

test("Fundamental Noise emits seven distinct finite colors",()=>{
  const runtime=loadRuntime("fundamental-noise"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),7*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[0,0,7,0]);
  runtime.rack_web_seed(99);runtime.rack_web_process(128,48000);
  assert.ok(outputs.every(Number.isFinite));assert.notDeepEqual([...outputs.slice(0,32)],[...outputs.slice(128,160)]);
});

test("Voxglitch Looper starts with an immediate resettable stereo loop",()=>{
  const runtime=loadRuntime("voxglitch-looper"),inputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_input_buffer(),128),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*128);
  assert.deepEqual([runtime.rack_web_param_count(),runtime.rack_web_input_count(),runtime.rack_web_output_count(),runtime.rack_web_light_count()],[1,1,2,0]);
  runtime.rack_web_set_input_connected(0,1);inputs[0]=10;runtime.rack_web_process(128,48000);
  assert.ok(outputs.every(Number.isFinite));assert.ok(Math.max(...outputs.map(Math.abs))>.1);assert.notDeepEqual([...outputs.slice(0,128)],[...outputs.slice(128,256)]);
});

test("Voxglitch Looper accepts interleaved browser PCM through ABI 0.3",()=>{
  const runtime=loadRuntime("voxglitch-looper"),outputs=new Float32Array(runtime.memory.buffer,runtime.rack_web_output_buffer(),2*128);
  assert.equal(runtime.rack_web_asset_capacity(),1920000);
  const asset=new Float32Array(runtime.memory.buffer,runtime.rack_web_asset_buffer(),8);asset.set([.5,-.5,1,-1,-.5,.5,-1,1]);
  runtime.rack_web_commit_asset(4,2,48000);runtime.rack_web_process(4,48000);
  assert.deepEqual([...outputs.slice(0,4)],[2.5,5,-2.5,-5]);assert.deepEqual([...outputs.slice(128,132)],[-2.5,-5,2.5,5]);
});
