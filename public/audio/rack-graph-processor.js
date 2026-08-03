function rackWebWasiImports(holder) {
  const memory = () => holder.runtime?.memory;
  const view = () => (memory() ? new DataView(memory().buffer) : null);
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
      __syscall_getcwd(buffer, size) {
        if (!memory() || size < 2) return -34;
        new Uint8Array(memory().buffer, buffer, 2).set([47, 0]);
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
        if (!holder.runtime) return 0;
        holder.clockNanoseconds = (holder.clockNanoseconds ?? 1000000000n) + 1000000n;
        view().setBigUint64(time, holder.clockNanoseconds, true);
        return 0;
      },
      random_get(buffer, length) {
        if (!memory()) return 0;
        const bytes = new Uint8Array(memory().buffer, buffer, length);
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
      environ_sizes_get(count, size) {
        const data = view();
        if (data) {
          data.setUint32(count, 0, true);
          data.setUint32(size, 0, true);
        }
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
}

function rackWebLoadStateJson(runtime, stateJson) {
  if (
    typeof stateJson !== "string" ||
    !runtime.rack_web_state_buffer ||
    !runtime.rack_web_commit_state_json
  )
    return false;
  const encoded = [];
  for (let index = 0; index < stateJson.length; index++) {
    const codepoint = stateJson.codePointAt(index);
    if (codepoint > 0xffff) index++;
    if (codepoint <= 0x7f) encoded.push(codepoint);
    else if (codepoint <= 0x7ff) encoded.push(0xc0 | (codepoint >> 6), 0x80 | (codepoint & 0x3f));
    else if (codepoint <= 0xffff)
      encoded.push(
        0xe0 | (codepoint >> 12),
        0x80 | ((codepoint >> 6) & 0x3f),
        0x80 | (codepoint & 0x3f),
      );
    else
      encoded.push(
        0xf0 | (codepoint >> 18),
        0x80 | ((codepoint >> 12) & 0x3f),
        0x80 | ((codepoint >> 6) & 0x3f),
        0x80 | (codepoint & 0x3f),
      );
  }
  const bytes = Uint8Array.from(encoded),
    pointer = runtime.rack_web_state_buffer(bytes.length);
  if (!pointer) return false;
  new Uint8Array(runtime.memory.buffer, pointer, bytes.length).set(bytes);
  return runtime.rack_web_commit_state_json(bytes.length) === 1;
}

class RackGraphProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.modules = new Map();
    this.order = [];
    this.cables = [];
    this.incoming = new Map();
    this.deviceCables = [];
    this.audioBoundaries = new Map();
    this.expanderChains = new Map();
    this.expanderOwners = new Map();
    this.messageLinks = [];
    this.messageOwners = new Map();
    this.messageGroups = new Map();
    this.messageMode = false;
    this.midiAutomations = new Map();
    this.automationEvents = [];
    this.automationIndex = 0;
    this.automationFrame = 0;
    this.automationEndFrame = 0;
    this.automationActive = false;
    this.monitorModuleId = "";
    this.monitorTick = 0;
    this.visualTick = 0;
    this.visualUpdatesEnabled = true;
    this.plugLights = new Map();
    this.ready = false;
    this.port.onmessage = ({ data }) => {
      if (data.type === "load-graph")
        void this.loadGraph(data).catch((error) =>
          this.port.postMessage({
            type: "error",
            message:
              error instanceof Error ? error.message : "Rack graph AudioWorklet failed to load",
          }),
        );
      else if (data.type === "param") {
        const rackModule = this.modules.get(data.moduleId);
        if (rackModule) rackModule.params[data.id] = data.value;
        else {
          const boundary = this.audioBoundaries.get(data.moduleId);
          if (boundary) boundary.params[data.id] = data.value;
        }
      } else if (data.type === "reset-param") {
        const rackModule = this.modules.get(data.moduleId),
          id = Number(data.id),
          value = Number(data.value);
        if (
          rackModule &&
          Number.isInteger(id) &&
          id >= 0 &&
          id < rackModule.params.length &&
          Number.isFinite(value)
        ) {
          rackModule.params[id] = value;
          if (rackModule.runtime.rack_web_reset_param)
            rackModule.runtime.rack_web_reset_param(id, value);
          else rackModule.runtime.rack_web_set_param(id, value);
        } else {
          const boundary = this.audioBoundaries.get(data.moduleId);
          if (
            boundary &&
            Number.isInteger(id) &&
            id >= 0 &&
            id < boundary.params.length &&
            Number.isFinite(value)
          )
            boundary.params[id] = value;
        }
      } else if (data.type === "momentary-param") {
        const rackModule = this.modules.get(data.moduleId),
          id = Number(data.id);
        if (rackModule && Number.isInteger(id) && id >= 0 && id < rackModule.params.length) {
          if (data.active) {
            rackModule.params[id] = 1;
            rackModule.momentaryReleases.delete(id);
          } else rackModule.momentaryReleases.add(id);
        }
      } else if (data.type === "state") {
        const rackModule = this.modules.get(data.moduleId);
        rackModule?.runtime.rack_web_set_state?.(data.id, data.value);
      } else if (data.type === "load-state-json") {
        const rackModule = this.modules.get(data.moduleId);
        if (rackModule) {
          rackWebLoadStateJson(rackModule.runtime, data.stateJson);
          this.configureMidiMap(rackModule, data.stateJson);
        }
      } else if (data.type === "snapshot-state") {
        const rackModule = this.modules.get(data.moduleId),
          runtime = rackModule?.runtime,
          length = runtime?.rack_web_snapshot_state_json?.() || 0,
          pointer = length ? runtime.rack_web_snapshot_state_buffer?.() || 0 : 0;
        if (pointer && length) {
          const bytes = new Uint8Array(length);
          bytes.set(new Uint8Array(runtime.memory.buffer, pointer, length));
          this.port.postMessage({ type: "state-json", moduleId: data.moduleId, bytes }, [
            bytes.buffer,
          ]);
        }
      } else if (data.type === "bypass") {
        const rackModule = this.modules.get(data.moduleId);
        if (rackModule) rackModule.bypassed = Boolean(data.bypassed);
      } else if (data.type === "monitor-module") {
        this.monitorModuleId = String(data.moduleId || "");
        this.monitorTick = 0;
      } else if (data.type === "visual-updates") {
        this.visualUpdatesEnabled = data.enabled !== false;
        this.monitorTick = 0;
        this.visualTick = 0;
      } else if (data.type === "capture-enable") {
        const rackModule = this.modules.get(data.moduleId);
        rackModule?.runtime.rack_web_set_capture_enabled?.(data.enabled ? 1 : 0);
      } else if (data.type === "trigger-action") {
        const rackModule = this.modules.get(data.moduleId);
        rackModule?.runtime.rack_web_trigger_action?.(Number(data.id) || 0, data.active ? 1 : 0);
      } else if (data.type === "midi-input") {
        const bytes = Array.from(data.bytes || []).slice(0, 3),
          targets = new Set(data.moduleIds || []);
        if (!bytes.length) return;
        for (const rackModule of this.modules.values()) {
          if (targets.size && !targets.has(rackModule.id)) continue;
          rackModule.runtime.rack_web_midi_push?.(
            bytes.length,
            bytes[0] || 0,
            bytes[1] || 0,
            bytes[2] || 0,
          );
          if (rackModule.key === "Core/MIDI-Map") this.applyMidiMap(rackModule, bytes);
        }
      } else if (data.type === "automation-start") {
        this.automationEvents = Array.isArray(data.events)
          ? data.events
              .flatMap((event) => {
                const timeMs = Number(event?.timeMs),
                  moduleId = String(event?.moduleId || ""),
                  paramId = Number(event?.paramId),
                  value = Number(event?.value);
                return Number.isFinite(timeMs) &&
                  timeMs >= 0 &&
                  moduleId &&
                  Number.isInteger(paramId) &&
                  Number.isFinite(value)
                  ? [
                      {
                        frame: Math.round((timeMs * sampleRate) / 1000),
                        moduleId,
                        paramId,
                        value,
                      },
                    ]
                  : [];
              })
              .sort((a, b) => a.frame - b.frame)
          : [];
        this.automationIndex = 0;
        this.automationFrame = 0;
        this.automationEndFrame = Math.max(
          1,
          Math.round((Math.max(0, Number(data.durationMs) || 0) * sampleRate) / 1000),
          this.automationEvents.at(-1)?.frame || 0,
        );
        this.automationActive = this.automationEvents.length > 0;
      } else if (data.type === "automation-stop") {
        this.automationActive = false;
        this.automationEvents = [];
        this.automationIndex = 0;
      } else if (data.type === "stop-captures") {
        for (const rackModule of this.modules.values()) this.finishCapture(rackModule);
        this.port.postMessage({ type: "captures-stopped", requestId: data.requestId });
      }
    };
  }

  async loadGraph(data) {
    this.ready = false;
    this.modules.clear();
    this.order = [];
    this.cables = [];
    this.incoming.clear();
    this.deviceCables = [];
    this.audioBoundaries.clear();
    this.expanderChains.clear();
    this.expanderOwners.clear();
    this.messageLinks = [];
    this.messageOwners.clear();
    this.messageGroups.clear();
    this.messageMode = false;
    this.midiAutomations.clear();
    this.automationEvents = [];
    this.automationIndex = 0;
    this.automationFrame = 0;
    this.automationEndFrame = 0;
    this.automationActive = false;
    this.plugLights.clear();

    for (const boundary of data.audioBoundaries || [])
      this.audioBoundaries.set(boundary.id, {
        id: boundary.id,
        key: boundary.key || "",
        params: boundary.params || [],
      });

    for (const item of data.modules || []) {
      const wasiHolder = { runtime: null };
      const result = await WebAssembly.instantiate(item.wasm, rackWebWasiImports(wasiHolder));
      const runtime = result.instance.exports;
      wasiHolder.runtime = runtime;
      runtime._initialize();
      runtime.rack_web_seed(item.seed || 1);
      runtime.rack_web_set_polyphony(item.polyphony || 1);
      rackWebLoadStateJson(runtime, item.stateJson);
      for (let id = 0; id < (item.state || []).length; id++)
        runtime.rack_web_set_state(id, item.state[id]);
      if (
        item.assets &&
        runtime.rack_web_asset_capacity_for_slot &&
        runtime.rack_web_asset_buffer_for_slot &&
        runtime.rack_web_commit_asset_for_slot
      ) {
        for (let slot = 0; slot < item.assets.length; slot++) {
          const asset = item.assets[slot];
          if (!asset) continue;
          const capacity = runtime.rack_web_asset_capacity_for_slot(slot);
          const samples =
            asset.samples instanceof Float32Array ? asset.samples : new Float32Array(asset.samples);
          const length = Math.min(capacity, samples.length);
          new Float32Array(
            runtime.memory.buffer,
            runtime.rack_web_asset_buffer_for_slot(slot),
            length,
          ).set(samples.subarray(0, length));
          const frames = Math.min(asset.frames, Math.floor(length / Math.max(1, asset.channels)));
          runtime.rack_web_commit_asset_for_slot(slot, frames, asset.channels, asset.sampleRate);
        }
      }
      if (
        item.asset &&
        runtime.rack_web_asset_capacity &&
        runtime.rack_web_asset_buffer &&
        runtime.rack_web_commit_asset
      ) {
        const capacity = runtime.rack_web_asset_capacity();
        const samples =
          item.asset.samples instanceof Float32Array
            ? item.asset.samples
            : new Float32Array(item.asset.samples);
        const length = Math.min(capacity, samples.length);
        new Float32Array(runtime.memory.buffer, runtime.rack_web_asset_buffer(), length).set(
          samples.subarray(0, length),
        );
        const frames = Math.min(
          item.asset.frames,
          Math.floor(length / Math.max(1, item.asset.channels)),
        );
        runtime.rack_web_commit_asset(frames, item.asset.channels, item.asset.sampleRate);
      }
      const inputCount = runtime.rack_web_input_count(),
        outputCount = runtime.rack_web_output_count(),
        lightCount = runtime.rack_web_light_count?.() || 0,
        maxChannels = runtime.rack_web_max_channels(),
        expanderCapacity = runtime.rack_web_expander_capacity?.() || 0,
        captureCapacity = runtime.rack_web_capture_capacity?.() || 0;
      for (let port = 0; port < outputCount; port++)
        runtime.rack_web_set_output_connected(port, item.outputConnections?.[port] ? 1 : 0);
      this.modules.set(item.id, {
        id: item.id,
        key: item.key || "",
        runtime,
        params: item.params || [],
        momentaryReleases: new Set(),
        bypassed: Boolean(item.bypassed),
        bypassRoutes: item.bypassRoutes || [],
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        width: Number(item.width) || 0,
        rackId: Number(item.rackId ?? -1),
        snapParams: item.snapParams || [],
        expander: item.expander || null,
        hostControl: item.hostControl || null,
        hostControlState: null,
        visuals: item.visuals || [],
        captureFormat: item.capture?.format === "midi" ? "midi" : "wav",
        outputConnections: item.outputConnections || [],
        expanderCapacity,
        messageCapacity: runtime.rack_web_message_capacity?.() || 0,
        captureCapacity,
        captureActive: false,
        captureChannels: 0,
        captureFrames: 0,
        capturePending: captureCapacity ? new Float32Array(4096) : null,
        inputCount,
        outputCount,
        lightCount,
        lights:
          lightCount && runtime.rack_web_light_buffer
            ? new Float32Array(runtime.memory.buffer, runtime.rack_web_light_buffer(), lightCount)
            : null,
        maxChannels,
        inputs: new Float32Array(
          runtime.memory.buffer,
          runtime.rack_web_input_buffer(),
          Math.max(1, inputCount) * maxChannels * 128,
        ),
        outputs: new Float32Array(
          runtime.memory.buffer,
          runtime.rack_web_output_buffer(),
          Math.max(1, outputCount) * maxChannels * 128,
        ),
        previous: new Float32Array(Math.max(1, outputCount) * maxChannels * 128),
        previousChannels: new Uint8Array(Math.max(1, outputCount)),
        currentChannels: new Uint8Array(Math.max(1, outputCount)),
        inputChannels: new Uint8Array(Math.max(1, inputCount)),
        expanderInputs: expanderCapacity
          ? new Float32Array(
              runtime.memory.buffer,
              runtime.rack_web_expander_input_buffer(),
              expanderCapacity * 16 * maxChannels * 128,
            )
          : null,
        expanderOutputs: expanderCapacity
          ? new Float32Array(
              runtime.memory.buffer,
              runtime.rack_web_expander_output_buffer(),
              expanderCapacity * 16 * maxChannels * 128,
            )
          : null,
      });
      this.configureMidiMap(this.modules.get(item.id), item.stateJson);
    }

    this.configureExpanderChains();
    this.configureMessageExpanders();

    const executionIds = [...this.modules.keys()].filter(
        (id) => !this.expanderOwners.has(id) && !this.messageOwners.has(id),
      ),
      owner = (id) => this.expanderOwners.get(id) || this.messageOwners.get(id) || id,
      adjacency = new Map(executionIds.map((id) => [id, []]));
    for (const cable of data.cables || []) {
      const source = this.modules.get(cable.fromModule),
        target = this.modules.get(cable.toModule);
      if (!source) continue;
      if (cable.toAudio) {
        if (cable.toPort < 2) this.deviceCables.push({ ...cable, feedback: false });
        continue;
      }
      if (!target || cable.fromPort >= source.outputCount || cable.toPort >= target.inputCount)
        continue;
      const edge = { ...cable, feedback: false };
      this.cables.push(edge);
      if (!this.incoming.has(target.id)) this.incoming.set(target.id, []);
      this.incoming.get(target.id).push(edge);
      const sourceOwner = owner(source.id),
        targetOwner = owner(target.id);
      if (sourceOwner === targetOwner) edge.feedback = true;
      else adjacency.get(sourceOwner).push({ target: targetOwner, cable: edge });
    }
    const state = new Map(executionIds.map((id) => [id, 0]));
    const visit = (id) => {
      state.set(id, 1);
      for (const edge of adjacency.get(id)) {
        const targetState = state.get(edge.target);
        if (targetState === 1) edge.cable.feedback = true;
        else if (targetState === 0) visit(edge.target);
      }
      state.set(id, 2);
    };
    for (const id of executionIds) if (state.get(id) === 0) visit(id);
    const indegree = new Map(executionIds.map((id) => [id, 0]));
    for (const edges of adjacency.values())
      for (const edge of edges)
        if (!edge.cable.feedback) indegree.set(edge.target, indegree.get(edge.target) + 1);
    const queue = executionIds.filter((id) => indegree.get(id) === 0);
    while (queue.length) {
      const id = queue.shift();
      this.order.push(id);
      for (const edge of adjacency.get(id)) {
        if (edge.cable.feedback) continue;
        const next = indegree.get(edge.target) - 1;
        indegree.set(edge.target, next);
        if (next === 0) queue.push(edge.target);
      }
    }
    for (const id of executionIds) if (!this.order.includes(id)) this.order.push(id);
    this.ready = true;
    this.port.postMessage({
      type: "ready",
      modules: this.modules.size,
      cables: this.cables.length + this.deviceCables.length,
      feedbackEdges: this.cables.filter((cable) => cable.feedback).length,
    });
  }

  configureExpanderChains() {
    const positioned = [...this.modules.values()].sort(
        (left, right) => left.y - right.y || left.x - right.x,
      ),
      claimed = new Set();
    for (const base of positioned) {
      const contract = base.expander;
      if (
        contract?.role !== "base" ||
        contract.direction !== "right" ||
        contract.transport !== "object-snapshot" ||
        !base.expanderCapacity
      )
        continue;
      const members = [];
      let rightEdge = base.x + base.width;
      while (members.length < Math.min(contract.maxMembers, base.expanderCapacity)) {
        const member = positioned.find(
          (candidate) =>
            !claimed.has(candidate.id) &&
            candidate.expander?.role === "member" &&
            candidate.expander.family === contract.family &&
            Math.abs(candidate.y - base.y) <= 2 &&
            Math.abs(candidate.x - rightEdge) <= 2,
        );
        if (!member) break;
        claimed.add(member.id);
        this.expanderOwners.set(member.id, base.id);
        members.push({
          module: member,
          paramCache: new Float32Array(member.params.length).fill(Number.NaN),
        });
        rightEdge = member.x + member.width;
      }
      if (!members.length) continue;
      this.expanderChains.set(base.id, members);
      base.runtime.rack_web_set_expander_count(members.length);
      members.forEach(({ module }, index) =>
        base.runtime.rack_web_set_expander_type(index, module.expander.type),
      );
    }
  }

  configureMidiMap(rackModule, stateJson) {
    rackModule.midiMaps = [];
    rackModule.midiMapSmooth = true;
    if (rackModule.key !== "Core/MIDI-Map" || typeof stateJson !== "string") return;
    try {
      const state = JSON.parse(stateJson);
      rackModule.midiMapSmooth = state.smooth !== false;
      rackModule.midiMaps = Array.isArray(state.maps)
        ? state.maps
            .slice(0, 128)
            .map((map) => ({
              cc: Number(map?.cc),
              moduleId: Number(map?.moduleId),
              patchworkModuleId:
                typeof map?.patchworkModuleId === "string" ? map.patchworkModuleId : "",
              paramId: Number(map?.paramId),
            }))
            .filter(
              (map) =>
                Number.isInteger(map.cc) &&
                map.cc >= 0 &&
                map.cc < 128 &&
                Number.isInteger(map.moduleId) &&
                Number.isInteger(map.paramId),
            )
        : [];
    } catch {
      // The WASM JSON bridge already rejects malformed state; keep no maps.
    }
  }

  applyMidiMap(rackModule, bytes) {
    if (bytes.length < 3 || (bytes[0] & 0xf0) !== 0xb0) return;
    const cc = bytes[1] & 0x7f,
      scaled = (bytes[2] & 0x7f) / 127;
    for (const map of rackModule.midiMaps || []) {
      if (map.cc !== cc) continue;
      const target = [...this.modules.values()].find(
        (candidate) =>
          candidate.rackId === map.moduleId ||
          (map.patchworkModuleId && candidate.id === map.patchworkModuleId),
      );
      if (!target || map.paramId < 0 || map.paramId >= target.params.length) continue;
      const minimum = Number(target.runtime.rack_web_get_param_min(map.paramId)),
        maximum = Number(target.runtime.rack_web_get_param_max(map.paramId));
      if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) continue;
      let value = minimum + scaled * (maximum - minimum);
      if (target.snapParams[map.paramId]) value = Math.round(value);
      const key = `${target.id}:${map.paramId}`,
        current = Number(target.params[map.paramId]) || 0,
        currentScaled = maximum === minimum ? 0 : (current - minimum) / (maximum - minimum);
      if (!rackModule.midiMapSmooth || Math.abs(currentScaled - scaled) >= 1) {
        target.params[map.paramId] = value;
        this.midiAutomations.delete(key);
        this.port.postMessage({ type: "midi-param", moduleId: target.id, id: map.paramId, value });
      } else {
        this.midiAutomations.set(key, { target, id: map.paramId, value });
      }
    }
  }

  stepMidiAutomations(frames) {
    const amount = 1 - Math.exp((-30 * frames) / sampleRate);
    for (const [key, automation] of this.midiAutomations) {
      const current = Number(automation.target.params[automation.id]) || 0,
        next = current + (automation.value - current) * amount;
      if (Math.abs(next - automation.value) < 1e-5) {
        automation.target.params[automation.id] = automation.value;
        this.midiAutomations.delete(key);
        this.port.postMessage({
          type: "midi-param",
          moduleId: automation.target.id,
          id: automation.id,
          value: automation.value,
        });
      } else automation.target.params[automation.id] = next;
    }
  }

  configureMessageExpanders() {
    const positioned = [...this.modules.values()].sort(
        (left, right) => left.y - right.y || left.x - right.x,
      ),
      claimedRight = new Set();
    for (const left of positioned) {
      const right = positioned.find(
        (candidate) =>
          candidate.id !== left.id &&
          !claimedRight.has(candidate.id) &&
          Math.abs(candidate.y - left.y) <= 2 &&
          Math.abs(candidate.x - (left.x + left.width)) <= 2,
      );
      if (!right) continue;
      const modelIndex = (module, neighbor) =>
          module.expander?.transport === "message-buffer"
            ? (module.expander.models?.find((model) => model.key === neighbor.key)?.index ?? -1)
            : -1,
        rootId = this.messageOwners.get(left.id) || left.id,
        root = this.modules.get(rootId),
        leftModelIndex = modelIndex(left, right),
        rightModelIndex = modelIndex(right, left),
        rootModelIndex = root && root !== left ? modelIndex(root, right) : -1,
        messageContract = leftModelIndex >= 0 || rightModelIndex >= 0 || rootModelIndex >= 0;
      if (
        !messageContract ||
        !left.messageCapacity ||
        !right.messageCapacity ||
        !left.runtime.rack_web_set_message_neighbor ||
        !right.runtime.rack_web_set_message_neighbor
      )
        continue;
      left.runtime.rack_web_set_message_neighbor(1, leftModelIndex, 1);
      right.runtime.rack_web_set_message_neighbor(0, rightModelIndex, 1);
      claimedRight.add(right.id);
      const group = this.messageGroups.get(rootId) || [root];
      this.messageOwners.set(right.id, rootId);
      if (!group.some((module) => module.id === right.id)) group.push(right);
      this.messageGroups.set(rootId, group);
      this.messageLinks.push({
        left,
        right,
        capacity: Math.min(left.messageCapacity, right.messageCapacity),
      });
    }
    for (const [rootId, group] of this.messageGroups) {
      const root = this.modules.get(rootId);
      if (!root?.runtime.rack_web_set_message_chain_neighbor) continue;
      for (let groupIndex = 2; groupIndex < group.length; groupIndex++) {
        const member = group[groupIndex],
          modelIndex =
            root.expander?.models?.find((model) => model.key === member.key)?.index ?? -1;
        if (modelIndex >= 0)
          root.runtime.rack_web_set_message_chain_neighbor(1, groupIndex - 1, modelIndex, 1);
      }
    }
    this.messageMode = this.messageLinks.length > 0;
  }

  prepareInputs(rackModule, frames) {
    rackModule.inputs.fill(0);
    rackModule.inputChannels.fill(0);
    for (const cable of this.incoming.get(rackModule.id) || []) {
      const source = this.modules.get(cable.fromModule),
        channels = cable.feedback
          ? source.previousChannels[cable.fromPort]
          : source.currentChannels[cable.fromPort];
      rackModule.inputChannels[cable.toPort] = Math.max(
        rackModule.inputChannels[cable.toPort],
        channels,
      );
    }
    for (const cable of this.incoming.get(rackModule.id) || []) {
      const source = this.modules.get(cable.fromModule),
        buffer = cable.feedback ? source.previous : source.outputs,
        channels = cable.feedback
          ? source.previousChannels[cable.fromPort]
          : source.currentChannels[cable.fromPort],
        inputChannels = rackModule.inputChannels[cable.toPort];
      for (let channel = 0; channel < inputChannels; channel++) {
        const sourceChannel = channels === 1 ? 0 : channel;
        if (sourceChannel >= channels) continue;
        for (let frame = 0; frame < frames; frame++)
          rackModule.inputs[(channel * rackModule.inputCount + cable.toPort) * 128 + frame] +=
            buffer[(sourceChannel * source.outputCount + cable.fromPort) * 128 + frame];
      }
    }
    for (let port = 0; port < rackModule.inputCount; port++) {
      rackModule.runtime.rack_web_set_input_connected(
        port,
        rackModule.inputChannels[port] > 0 ? 1 : 0,
      );
      rackModule.runtime.rack_web_set_input_channels(port, rackModule.inputChannels[port]);
    }
  }

  prepareInputFrame(rackModule, frame) {
    rackModule.inputChannels.fill(0);
    for (let port = 0; port < rackModule.inputCount; port++)
      for (let channel = 0; channel < rackModule.maxChannels; channel++)
        rackModule.inputs[(channel * rackModule.inputCount + port) * 128 + frame] = 0;
    for (const cable of this.incoming.get(rackModule.id) || []) {
      const source = this.modules.get(cable.fromModule),
        channels = cable.feedback
          ? source.previousChannels[cable.fromPort]
          : source.currentChannels[cable.fromPort];
      rackModule.inputChannels[cable.toPort] = Math.max(
        rackModule.inputChannels[cable.toPort],
        channels,
      );
    }
    for (const cable of this.incoming.get(rackModule.id) || []) {
      const source = this.modules.get(cable.fromModule),
        buffer = cable.feedback ? source.previous : source.outputs,
        channels = cable.feedback
          ? source.previousChannels[cable.fromPort]
          : source.currentChannels[cable.fromPort],
        inputChannels = rackModule.inputChannels[cable.toPort];
      for (let channel = 0; channel < inputChannels; channel++) {
        const sourceChannel = channels === 1 ? 0 : channel;
        if (sourceChannel >= channels) continue;
        rackModule.inputs[(channel * rackModule.inputCount + cable.toPort) * 128 + frame] +=
          buffer[(sourceChannel * source.outputCount + cable.fromPort) * 128 + frame];
      }
    }
    for (let port = 0; port < rackModule.inputCount; port++) {
      rackModule.runtime.rack_web_set_input_connected(
        port,
        rackModule.inputChannels[port] > 0 ? 1 : 0,
      );
      rackModule.runtime.rack_web_set_input_channels(port, rackModule.inputChannels[port]);
    }
  }

  syncExpanderChain(base, frames) {
    const members = this.expanderChains.get(base.id);
    if (!members) return;
    base.expanderInputs.fill(0);
    members.forEach(({ module, paramCache }, index) => {
      this.prepareInputs(module, frames);
      base.runtime.rack_web_set_expander_bypassed(index, module.bypassed ? 1 : 0);
      for (let id = 0; id < module.params.length; id++)
        if (!Object.is(paramCache[id], module.params[id])) {
          paramCache[id] = module.params[id];
          base.runtime.rack_web_set_expander_param(index, id, module.params[id]);
        }
      for (let port = 0; port < module.inputCount; port++) {
        const channels = module.inputChannels[port];
        base.runtime.rack_web_set_expander_input_connected(index, port, channels > 0 ? 1 : 0);
        base.runtime.rack_web_set_expander_input_channels(index, port, channels);
        for (let channel = 0; channel < channels; channel++)
          for (let frame = 0; frame < frames; frame++)
            base.expanderInputs[((index * 16 + port) * 16 + channel) * 128 + frame] =
              module.inputs[(channel * module.inputCount + port) * 128 + frame];
      }
    });
  }

  syncExpanderChainFrame(base, frame) {
    const members = this.expanderChains.get(base.id);
    if (!members) return;
    members.forEach(({ module, paramCache }, index) => {
      this.prepareInputFrame(module, frame);
      base.runtime.rack_web_set_expander_bypassed(index, module.bypassed ? 1 : 0);
      for (let id = 0; id < module.params.length; id++)
        if (!Object.is(paramCache[id], module.params[id])) {
          paramCache[id] = module.params[id];
          base.runtime.rack_web_set_expander_param(index, id, module.params[id]);
        }
      for (let port = 0; port < 16; port++) {
        const channels = port < module.inputCount ? module.inputChannels[port] : 0;
        base.runtime.rack_web_set_expander_input_connected(index, port, channels > 0 ? 1 : 0);
        base.runtime.rack_web_set_expander_input_channels(index, port, channels);
        for (let channel = 0; channel < 16; channel++)
          base.expanderInputs[((index * 16 + port) * 16 + channel) * 128 + frame] =
            channel < channels
              ? module.inputs[(channel * module.inputCount + port) * 128 + frame]
              : 0;
      }
    });
  }

  copyExpanderOutputs(base, frames) {
    const members = this.expanderChains.get(base.id);
    if (!members) return;
    members.forEach(({ module }, index) => {
      module.outputs.fill(0);
      module.currentChannels.fill(0);
      for (let port = 0; port < module.outputCount; port++) {
        const channels = Math.min(
          module.maxChannels,
          base.runtime.rack_web_get_expander_output_channels(index, port),
        );
        module.currentChannels[port] = channels;
        for (let channel = 0; channel < channels; channel++)
          for (let frame = 0; frame < frames; frame++)
            module.outputs[(channel * module.outputCount + port) * 128 + frame] =
              base.expanderOutputs[((index * 16 + port) * 16 + channel) * 128 + frame];
      }
    });
  }

  copyExpanderOutputFrame(base, frame) {
    const members = this.expanderChains.get(base.id);
    if (!members) return;
    members.forEach(({ module }, index) => {
      for (let port = 0; port < module.outputCount; port++) {
        const channels = Math.min(
          module.maxChannels,
          base.runtime.rack_web_get_expander_output_channels(index, port),
        );
        module.currentChannels[port] = channels;
        for (let channel = 0; channel < module.maxChannels; channel++)
          module.outputs[(channel * module.outputCount + port) * 128 + frame] =
            channel < channels
              ? base.expanderOutputs[((index * 16 + port) * 16 + channel) * 128 + frame]
              : 0;
      }
    });
  }

  copyMessage(
    source,
    sourceSide,
    sourceNeighbor,
    sourceConsumer,
    target,
    targetSide,
    targetNeighbor,
    targetConsumer,
    capacity,
  ) {
    const sourcePointer = source.runtime.rack_web_message_buffer(
        sourceSide,
        sourceNeighbor ? 1 : 0,
        sourceConsumer ? 1 : 0,
      ),
      targetPointer = target.runtime.rack_web_message_buffer(
        targetSide,
        targetNeighbor ? 1 : 0,
        targetConsumer ? 1 : 0,
      );
    if (!sourcePointer || !targetPointer) return;
    new Uint8Array(target.runtime.memory.buffer, targetPointer, capacity).set(
      new Uint8Array(source.runtime.memory.buffer, sourcePointer, capacity),
    );
  }

  finishMessageSide(owner, ownerSide, neighbor, neighborSide, capacity) {
    const proxyRequested = Boolean(
        neighbor.runtime.rack_web_message_flip_requested(neighborSide, 1),
      ),
      ownerRequested = Boolean(owner.runtime.rack_web_message_flip_requested(ownerSide, 0));
    if (!proxyRequested && !ownerRequested) return;
    if (proxyRequested)
      this.copyMessage(
        neighbor,
        neighborSide,
        true,
        false,
        owner,
        ownerSide,
        false,
        false,
        capacity,
      );
    owner.runtime.rack_web_finish_message_flip(ownerSide, 0);
    this.copyMessage(owner, ownerSide, false, true, neighbor, neighborSide, false, true, capacity);
    // Rack exposes the same flipped message through the receiving module's
    // expander and through the sender's typed neighbor proxy. Keep both views
    // coherent because plugins legitimately use either access path.
    this.copyMessage(owner, ownerSide, false, true, neighbor, neighborSide, true, true, capacity);
    neighbor.runtime.rack_web_finish_message_flip(neighborSide, 1);
  }

  finishMessageFrame(groupIds = null) {
    for (const { left, right, capacity } of this.messageLinks) {
      if (groupIds && (!groupIds.has(left.id) || !groupIds.has(right.id))) continue;
      this.finishMessageSide(right, 0, left, 1, capacity);
      this.finishMessageSide(left, 1, right, 0, capacity);
    }
  }

  syncNeighborSnapshot(module, side, neighbor, frame) {
    module.runtime.rack_web_set_neighbor_bypassed(side, neighbor.bypassed ? 1 : 0);
    for (let id = 0; id < neighbor.params.length; id++)
      module.runtime.rack_web_set_neighbor_param(side, id, neighbor.params[id]);
    for (let port = 0; port < neighbor.outputCount; port++)
      module.runtime.rack_web_set_neighbor_output_connected(
        side,
        port,
        neighbor.outputConnections[port] ? 1 : 0,
      );
    for (let port = 0; port < neighbor.inputCount; port++) {
      const channels = neighbor.inputChannels[port];
      if (!channels) module.runtime.rack_web_set_neighbor_input(side, port, 0, 0, 0);
      else
        for (let channel = 0; channel < channels; channel++)
          module.runtime.rack_web_set_neighbor_input(
            side,
            port,
            channels,
            channel,
            neighbor.inputs[(channel * neighbor.inputCount + port) * 128 + frame],
          );
    }
  }

  copyNeighborOutputs(module, side, neighbor, frame) {
    for (let port = 0; port < neighbor.outputCount; port++) {
      const channels = Math.min(
        neighbor.maxChannels,
        module.runtime.rack_web_get_neighbor_output_channels(side, port),
      );
      if (!channels) continue;
      neighbor.currentChannels[port] = channels;
      for (let channel = 0; channel < channels; channel++)
        neighbor.outputs[(channel * neighbor.outputCount + port) * 128 + frame] =
          module.runtime.rack_web_get_neighbor_output_voltage(side, port, channel);
    }
    if (neighbor.lights && module.runtime.rack_web_get_neighbor_light_brightness)
      for (let id = 0; id < neighbor.lightCount; id++)
        neighbor.lights[id] = module.runtime.rack_web_get_neighbor_light_brightness(side, id);
  }

  syncChainNeighborSnapshot(module, side, index, neighbor, frame) {
    const runtime = module.runtime;
    runtime.rack_web_set_chain_neighbor_bypassed(side, index, neighbor.bypassed ? 1 : 0);
    for (let id = 0; id < neighbor.params.length; id++)
      runtime.rack_web_set_chain_neighbor_param(side, index, id, neighbor.params[id]);
    for (let port = 0; port < neighbor.outputCount; port++)
      runtime.rack_web_set_chain_neighbor_output_connected(
        side,
        index,
        port,
        neighbor.outputConnections[port] ? 1 : 0,
      );
    for (let port = 0; port < neighbor.inputCount; port++) {
      const channels = neighbor.inputChannels[port];
      if (!channels) runtime.rack_web_set_chain_neighbor_input(side, index, port, 0, 0, 0);
      else
        for (let channel = 0; channel < channels; channel++)
          runtime.rack_web_set_chain_neighbor_input(
            side,
            index,
            port,
            channels,
            channel,
            neighbor.inputs[(channel * neighbor.inputCount + port) * 128 + frame],
          );
    }
  }

  copyChainNeighborOutputs(module, side, index, neighbor, frame) {
    const runtime = module.runtime;
    for (let port = 0; port < neighbor.outputCount; port++) {
      const channels = Math.min(
        neighbor.maxChannels,
        runtime.rack_web_get_chain_neighbor_output_channels(side, index, port),
      );
      if (!channels) continue;
      neighbor.currentChannels[port] = channels;
      for (let channel = 0; channel < channels; channel++)
        neighbor.outputs[(channel * neighbor.outputCount + port) * 128 + frame] =
          runtime.rack_web_get_chain_neighbor_output_voltage(side, index, port, channel);
    }
    if (neighbor.lights && runtime.rack_web_get_chain_neighbor_light_brightness)
      for (let id = 0; id < neighbor.lightCount; id++)
        neighbor.lights[id] = runtime.rack_web_get_chain_neighbor_light_brightness(side, index, id);
  }

  emitCaptureChunk(rackModule) {
    if (!rackModule.captureFrames || !rackModule.capturePending) return;
    const samples = rackModule.capturePending.slice(
      0,
      rackModule.captureFrames * rackModule.captureChannels,
    );
    this.port.postMessage(
      {
        type: "capture-data",
        moduleId: rackModule.id,
        channels: rackModule.captureChannels,
        sampleRate,
        frames: rackModule.captureFrames,
        samples,
        format: rackModule.captureFormat,
      },
      [samples.buffer],
    );
    rackModule.captureFrames = 0;
  }

  appendCapture(rackModule, samples, frames, channels) {
    if (!rackModule.capturePending || !frames || !channels) return;
    if (rackModule.captureChannels && rackModule.captureChannels !== channels)
      this.emitCaptureChunk(rackModule);
    rackModule.captureChannels = channels;
    let sourceFrame = 0;
    const frameCapacity = Math.floor(rackModule.capturePending.length / channels);
    while (sourceFrame < frames) {
      const writable = Math.min(frameCapacity - rackModule.captureFrames, frames - sourceFrame);
      rackModule.capturePending.set(
        samples.subarray(sourceFrame * channels, (sourceFrame + writable) * channels),
        rackModule.captureFrames * channels,
      );
      rackModule.captureFrames += writable;
      sourceFrame += writable;
      if (rackModule.captureFrames === frameCapacity) this.emitCaptureChunk(rackModule);
    }
  }

  finishCapture(rackModule) {
    if (!rackModule.captureCapacity) return;
    const runtime = rackModule.runtime;
    runtime.rack_web_set_capture_enabled?.(0);
    const channels = Math.max(1, Math.min(2, Number(runtime.rack_web_capture_channels?.()) || 1)),
      available = Math.min(
        rackModule.captureCapacity,
        Math.max(0, Number(runtime.rack_web_capture_frames?.()) || 0),
      );
    if (available) {
      const pointer = Number(runtime.rack_web_capture_buffer?.()) || 0,
        samples = new Float32Array(runtime.memory.buffer, pointer, available * channels);
      this.appendCapture(rackModule, samples, available, channels);
      runtime.rack_web_capture_consume?.(available);
    }
    this.emitCaptureChunk(rackModule);
    if (rackModule.captureActive) {
      rackModule.captureActive = false;
      this.port.postMessage({
        type: "capture-stop",
        moduleId: rackModule.id,
        channels: rackModule.captureChannels || 1,
        sampleRate,
        format: rackModule.captureFormat,
      });
    }
  }

  drainCaptures() {
    for (const rackModule of this.modules.values()) {
      if (!rackModule.captureCapacity) continue;
      const runtime = rackModule.runtime,
        channels = Math.max(1, Math.min(2, Number(runtime.rack_web_capture_channels?.()) || 1)),
        available = Math.min(
          rackModule.captureCapacity,
          Math.max(0, Number(runtime.rack_web_capture_frames?.()) || 0),
        ),
        active = Boolean(runtime.rack_web_capture_active?.());
      if (active && !rackModule.captureActive) {
        rackModule.captureActive = true;
        rackModule.captureChannels = channels;
        rackModule.captureFrames = 0;
        this.port.postMessage({
          type: "capture-start",
          moduleId: rackModule.id,
          channels,
          sampleRate,
          format: rackModule.captureFormat,
        });
      }
      if (available) {
        const samples = new Float32Array(
          runtime.memory.buffer,
          runtime.rack_web_capture_buffer(),
          available * channels,
        ).slice();
        this.appendCapture(rackModule, samples, available, channels);
        runtime.rack_web_consume_capture(available);
      }
      if (!active && rackModule.captureActive) this.finishCapture(rackModule);
    }
  }

  drainMidiOutputs() {
    for (const rackModule of this.modules.values()) {
      const runtime = rackModule.runtime,
        available = Math.min(
          1024,
          Math.max(0, Number(runtime.rack_web_midi_output_available?.()) || 0),
        ),
        pointer = available ? Number(runtime.rack_web_midi_output_buffer?.()) || 0 : 0,
        packetBytes = Math.min(
          64 * 1024,
          Math.max(0, Number(runtime.rack_web_midi_packet_output_available?.()) || 0),
        ),
        packetPointer = packetBytes
          ? Number(runtime.rack_web_midi_packet_output_buffer?.()) || 0
          : 0;
      if (!pointer && !packetPointer) continue;
      const records = new Uint8Array(pointer ? available * 4 : 0),
        packets = new Uint8Array(packetPointer ? packetBytes : 0);
      if (pointer) {
        records.set(new Uint8Array(runtime.memory.buffer, pointer, available * 4));
        runtime.rack_web_consume_midi_output?.(available);
      }
      if (packetPointer) {
        packets.set(new Uint8Array(runtime.memory.buffer, packetPointer, packetBytes));
        runtime.rack_web_consume_midi_packet_output?.(packetBytes);
      }
      this.port.postMessage({ type: "midi-output", moduleId: rackModule.id, records, packets }, [
        records.buffer,
        packets.buffer,
      ]);
    }
  }

  emitMonitoredPortPeaks(frames) {
    if (!this.monitorModuleId || ++this.monitorTick < 16) return;
    this.monitorTick = 0;
    const rackModule = this.modules.get(this.monitorModuleId);
    if (!rackModule) return;
    const collect = (buffer, portCount, channelsByPort) => {
      const peaks = [],
        scopes = [];
      for (let port = 0; port < portCount; port++) {
        let peak = 0;
        const channels = Math.max(0, channelsByPort[port] || 0);
        for (let channel = 0; channel < channels; channel++)
          for (let frame = 0; frame < frames; frame++)
            peak = Math.max(peak, Math.abs(buffer[(channel * portCount + port) * 128 + frame]));
        peaks.push(peak);
        scopes.push(
          Array.from({ length: 32 }, (_, index) =>
            channels ? buffer[port * 128 + Math.min(frames - 1, index * 4)] : 0,
          ),
        );
      }
      return { peaks, scopes };
    };
    const inputs = collect(rackModule.inputs, rackModule.inputCount, rackModule.inputChannels),
      outputs = collect(rackModule.outputs, rackModule.outputCount, rackModule.currentChannels);
    this.port.postMessage({
      type: "port-peaks",
      moduleId: rackModule.id,
      inputs: inputs.peaks,
      outputs: outputs.peaks,
      inputScopes: inputs.scopes,
      outputScopes: outputs.scopes,
    });
  }

  emitVisualSignals(frames) {
    if (++this.visualTick < 16) return;
    this.visualTick = 0;
    const peakForOutput = (rackModule, port) => {
      if (!rackModule || port < 0 || port >= rackModule.outputCount) return 0;
      let peak = 0;
      const channels = Math.max(0, rackModule.currentChannels[port] || 0);
      for (let channel = 0; channel < channels; channel++)
        for (let frame = 0; frame < frames; frame++)
          peak = Math.max(
            peak,
            Math.abs(
              rackModule.outputs[(channel * rackModule.outputCount + port) * 128 + frame] || 0,
            ),
          );
      return peak;
    };
    const cables = {};
    const plugs = {};
    for (const cable of [...this.cables, ...this.deviceCables])
      if (cable.id) {
        const source = this.modules.get(cable.fromModule),
          channels =
            source && cable.fromPort >= 0 && cable.fromPort < source.outputCount
              ? Math.max(0, source.currentChannels[cable.fromPort] || 0)
              : 0;
        cables[cable.id] = peakForOutput(source, cable.fromPort);
        let voltage = 0,
          sumSquares = 0,
          sampleCount = 0;
        if (source && channels > 0) {
          voltage = source.outputs[cable.fromPort * 128 + Math.max(0, frames - 1)] || 0;
          for (let channel = 0; channel < channels; channel++)
            for (let frame = 0; frame < frames; frame++) {
              const sample =
                source.outputs[(channel * source.outputCount + cable.fromPort) * 128 + frame] || 0;
              sumSquares += sample * sample;
              sampleCount++;
            }
        }
        const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0,
          targets =
            channels === 1
              ? [Math.max(0, -voltage / 10), Math.max(0, voltage / 10), 0]
              : channels > 1
                ? [0, 0, Math.max(0, rms / 10)]
                : [0, 0, 0],
          previous = this.plugLights.get(cable.id) || [0, 0, 0],
          // Rack's Light::setBrightnessSmooth() rises immediately and decays
          // with lambda=30. This exponential coefficient is the stable
          // equivalent of applying its per-sample Euler step for 8 blocks.
          decay = 1 - Math.exp((-30 * frames * 8) / sampleRate),
          rgb = targets.map((target, index) => {
            target = Math.min(1, target);
            return target < previous[index]
              ? previous[index] + (target - previous[index]) * decay
              : target;
          });
        this.plugLights.set(cable.id, rgb);
        plugs[cable.id] = { voltage, rms, channels, rgb };
      }
    const scopes = {},
      lights = {};
    for (const rackModule of this.modules.values())
      for (const visual of rackModule.visuals || []) {
        if (scopes[rackModule.id]) continue;
        if (visual.kind === "racknes-screen") {
          rackModule.rackNesVisualTick = (rackModule.rackNesVisualTick || 0) + 1;
          if (rackModule.rackNesVisualTick % 4 !== 1) continue;
          const count = rackModule.runtime.rack_web_visual_count?.() || 0,
            pointer = count ? rackModule.runtime.rack_web_visual_buffer?.() || 0 : 0;
          scopes[rackModule.id] = [
            pointer
              ? Array.from(
                  new Float32Array(rackModule.runtime.memory.buffer, pointer, count),
                  (value) => (Number.isFinite(value) ? value : 0),
                )
              : [],
          ];
          continue;
        }
        if (
          visual.kind === "hex-looper" ||
          visual.kind === "wavetable-display" ||
          visual.kind === "four-view-display" ||
          visual.kind === "phrase-seq-display" ||
          visual.kind === "bouncy-balls" ||
          visual.kind === "full-scope" ||
          visual.kind === "madzine-scope" ||
          visual.kind === "madzine-waveform" ||
          visual.kind === "universal-rhythm" ||
          visual.kind === "madzine-launchpad" ||
          visual.kind === "ml-arpeggiator" ||
          visual.kind === "corrupter-display" ||
          visual.kind === "tapestry-display" ||
          visual.kind === "xy-pad" ||
          visual.kind === "wavetable-editor" ||
          visual.kind === "speck-spectrum" ||
          visual.kind === "td-scope" ||
          visual.kind === "undertow-preview" ||
          visual.kind === "octobir-display" ||
          visual.kind === "rkd-dividers" ||
          visual.kind === "klokspid-dmd"
        ) {
          const count = rackModule.runtime.rack_web_visual_count?.() || 0,
            pointer = count ? rackModule.runtime.rack_web_visual_buffer?.() || 0 : 0;
          scopes[rackModule.id] = [
            pointer
              ? Array.from(
                  new Float32Array(rackModule.runtime.memory.buffer, pointer, count),
                  (value) => (Number.isFinite(value) ? value : 0),
                )
              : [],
          ];
          continue;
        }
        if (visual.kind === "multi-meter") {
          const [leftPort, rightPort, multiPort] = visual.inputs || [0, 1, 2],
            multiChannels = rackModule.inputChannels[multiPort] || 0;
          scopes[rackModule.id] = Array.from({ length: 16 }, (_, channel) =>
            Array.from({ length: 64 }, (_, index) => {
              const frame = Math.min(frames - 1, index * 2),
                multi =
                  channel < multiChannels
                    ? rackModule.inputs[
                        (channel * rackModule.inputCount + multiPort) * 128 + frame
                      ] || 0
                    : 0,
                discrete =
                  channel === 0 && rackModule.inputChannels[leftPort]
                    ? rackModule.inputs[leftPort * 128 + frame] || 0
                    : channel === 1 && rackModule.inputChannels[rightPort]
                      ? rackModule.inputs[rightPort * 128 + frame] || 0
                      : 0;
              return Math.max(-1, Math.min(1, (multi + discrete) * 0.1));
            }),
          );
          continue;
        }
        if (visual.kind === "note-meter") {
          const readings = Array.from({ length: 16 }, () => []);
          for (const port of visual.inputs || []) {
            const channels = Math.max(0, rackModule.inputChannels[port] || 0);
            for (let channel = 0; channel < channels && port + channel < readings.length; channel++)
              readings[port + channel] = [
                rackModule.inputs[
                  (channel * rackModule.inputCount + port) * 128 + Math.max(0, frames - 1)
                ] || 0,
              ];
          }
          scopes[rackModule.id] = readings;
          continue;
        }
        if (
          ![
            "scope",
            "spectrum-analyzer",
            "cella-frequency-analyzer",
            "spectrogram",
            "cv-note",
            "bpm-display",
            "elementary-ca",
          ].includes(visual.kind)
        )
          continue;
        scopes[rackModule.id] = (visual.inputs || []).map((port) =>
          Array.from(
            {
              length:
                visual.kind === "cv-note" ||
                visual.kind === "bpm-display" ||
                visual.kind === "elementary-ca"
                  ? 1
                  : visual.kind === "scope"
                    ? 64
                    : 128,
            },
            (_, index) => {
              if (port >= rackModule.inputCount || !rackModule.inputChannels[port])
                return visual.kind === "elementary-ca" ? Number.NaN : 0;
              const frame =
                visual.kind === "cv-note" ||
                visual.kind === "bpm-display" ||
                visual.kind === "elementary-ca"
                  ? Math.max(0, frames - 1)
                  : visual.kind === "scope"
                    ? Math.min(frames - 1, index * 2)
                    : Math.min(frames - 1, index);
              return rackModule.inputs[port * 128 + frame] || 0;
            },
          ),
        );
      }
    for (const rackModule of this.modules.values())
      if (rackModule.lightCount && rackModule.lights)
        lights[rackModule.id] = Array.from(rackModule.lights, (brightness) =>
          Number.isFinite(brightness) ? brightness : 0,
        );
    this.port.postMessage({
      type: "visual-signals",
      cables,
      plugs,
      scopes,
      lights,
      hostControl: this.rackViewHostControl(frames),
    });
  }

  rackViewHostControl(frames) {
    const rackModule = [...this.modules.values()].find(
      (module) => module.hostControl === "rack-view",
    );
    if (!rackModule) return null;
    const connected = (id) => Boolean(rackModule.inputChannels[id]),
      voltage = (id) =>
        connected(id) ? Number(rackModule.inputs[id * 128 + Math.max(0, frames - 1)]) || 0 : 0,
      previous = rackModule.hostControlState || {
        gates: [false, false, false, false],
        active: [false, false, false, false, false],
        values: [0, 0, 0, 0, 0],
      },
      gates = [0, 1, 2, 3].map((id) => connected(id) && voltage(id) >= 1),
      jumps = gates.map((high, id) => high && !previous.gates[id]),
      continuous = [4, 5, 6, 7, 8],
      values = continuous.map(voltage),
      changed = continuous.map(
        (id, index) =>
          connected(id) &&
          previous.active[index] &&
          Math.abs(values[index] - previous.values[index]) > 1e-6,
      ),
      active = continuous.map(connected);
    rackModule.hostControlState = { gates, active, values };
    return {
      moduleId: rackModule.id,
      jumpUp: jumps[0],
      jumpDown: jumps[1],
      jumpLeft: jumps[2],
      jumpRight: jumps[3],
      ...(changed[0] ? { x: Math.max(0, Math.min(1, values[0] / 10)) } : {}),
      ...(changed[1] ? { y: Math.max(0, Math.min(1, values[1] / 10)) } : {}),
      ...(changed[2] ? { zoom: Math.pow(2, Math.max(-2, Math.min(2, values[2] / 2.5 - 2))) } : {}),
      ...(changed[3] ? { opacity: Math.max(0, Math.min(1, values[3] / 10)) } : {}),
      ...(changed[4] ? { tension: Math.max(0, Math.min(1, values[4] / 10)) } : {}),
      padding: Number(rackModule.params[0]) || 0,
      xStep: Number(rackModule.params[1]) || 0,
      yStep: Number(rackModule.params[2]) || 0,
      lockX: Number(rackModule.params[3]) >= 0.5,
      lockY: Number(rackModule.params[4]) >= 0.5,
      upConnected: connected(0),
      downConnected: connected(1),
      leftConnected: connected(2),
      rightConnected: connected(3),
      xConnected: connected(4),
      yConnected: connected(5),
    };
  }

  processMessageGroup(group, frames, frameOffset = 0) {
    const groupIds = new Set(group.map((module) => module.id));
    for (const rackModule of group)
      for (let id = 0; id < rackModule.params.length; id++)
        rackModule.runtime.rack_web_set_param(id, rackModule.params[id]);
    for (let localFrame = 0; localFrame < frames; localFrame++) {
      const frame = frameOffset + localFrame;
      for (const rackModule of group) this.prepareInputFrame(rackModule, frame);
      for (const { left, right } of this.messageLinks) {
        if (!groupIds.has(left.id) || !groupIds.has(right.id)) continue;
        this.syncNeighborSnapshot(left, 1, right, frame);
        this.syncNeighborSnapshot(right, 0, left, frame);
      }
      const root = group[0];
      if (root.runtime.rack_web_set_chain_neighbor_param)
        for (let groupIndex = 2; groupIndex < group.length; groupIndex++)
          this.syncChainNeighborSnapshot(root, 1, groupIndex - 1, group[groupIndex], frame);
      for (const rackModule of group) {
        const runtime = rackModule.runtime;
        if (rackModule.bypassed) {
          rackModule.currentChannels.fill(0);
          for (let port = 0; port < rackModule.outputCount; port++)
            for (let channel = 0; channel < rackModule.maxChannels; channel++)
              rackModule.outputs[(channel * rackModule.outputCount + port) * 128 + frame] = 0;
          for (const [inputPort, outputPort] of rackModule.bypassRoutes) {
            if (inputPort >= rackModule.inputCount || outputPort >= rackModule.outputCount)
              continue;
            const channels = rackModule.inputChannels[inputPort];
            rackModule.currentChannels[outputPort] = channels;
            for (let channel = 0; channel < channels; channel++)
              rackModule.outputs[(channel * rackModule.outputCount + outputPort) * 128 + frame] =
                rackModule.inputs[(channel * rackModule.inputCount + inputPort) * 128 + frame];
          }
        } else {
          runtime.rack_web_process_frame(frame, sampleRate);
          for (let port = 0; port < rackModule.outputCount; port++)
            rackModule.currentChannels[port] = Math.min(
              rackModule.maxChannels,
              runtime.rack_web_get_output_channels(port),
            );
        }
      }
      for (const { left, right } of this.messageLinks) {
        if (!groupIds.has(left.id) || !groupIds.has(right.id)) continue;
        this.copyNeighborOutputs(left, 1, right, frame);
        this.copyNeighborOutputs(right, 0, left, frame);
      }
      if (root.runtime.rack_web_get_chain_neighbor_output_channels)
        for (let groupIndex = 2; groupIndex < group.length; groupIndex++)
          this.copyChainNeighborOutputs(root, 1, groupIndex - 1, group[groupIndex], frame);
      this.finishMessageFrame(groupIds);
    }
  }

  processGraphFrame(frame) {
    for (const moduleId of this.order) {
      const rackModule = this.modules.get(moduleId),
        runtime = rackModule.runtime;
      const messageGroup = this.messageGroups.get(moduleId);
      if (messageGroup) {
        this.processMessageGroup(messageGroup, 1, frame);
        continue;
      }
      this.prepareInputFrame(rackModule, frame);
      this.syncExpanderChainFrame(rackModule, frame);
      if (rackModule.bypassed) {
        rackModule.currentChannels.fill(1);
        for (let port = 0; port < rackModule.outputCount; port++)
          for (let channel = 0; channel < rackModule.maxChannels; channel++)
            rackModule.outputs[(channel * rackModule.outputCount + port) * 128 + frame] = 0;
        for (const { module } of this.expanderChains.get(rackModule.id) || []) {
          module.currentChannels.fill(0);
          for (let port = 0; port < module.outputCount; port++)
            for (let channel = 0; channel < module.maxChannels; channel++)
              module.outputs[(channel * module.outputCount + port) * 128 + frame] = 0;
        }
        for (const [inputPort, outputPort] of rackModule.bypassRoutes) {
          if (inputPort >= rackModule.inputCount || outputPort >= rackModule.outputCount) continue;
          const channels = rackModule.inputChannels[inputPort];
          rackModule.currentChannels[outputPort] = channels;
          for (let channel = 0; channel < channels; channel++)
            rackModule.outputs[(channel * rackModule.outputCount + outputPort) * 128 + frame] =
              rackModule.inputs[(channel * rackModule.inputCount + inputPort) * 128 + frame];
        }
      } else {
        for (let id = 0; id < rackModule.params.length; id++)
          runtime.rack_web_set_param(id, rackModule.params[id]);
        runtime.rack_web_process_frame(frame, sampleRate);
        for (let port = 0; port < rackModule.outputCount; port++)
          rackModule.currentChannels[port] = Math.min(
            rackModule.maxChannels,
            runtime.rack_web_get_output_channels(port),
          );
        this.copyExpanderOutputFrame(rackModule, frame);
      }
    }
  }

  mixDeviceFrame(left, right, frame) {
    for (const cable of this.deviceCables) {
      const source = this.modules.get(cable.fromModule);
      if (!source || cable.fromPort >= source.outputCount) continue;
      const destination = cable.toPort === 0 ? left : right;
      if (!destination) continue;
      destination[frame] +=
        (source.outputs[cable.fromPort * 128 + frame] / 5) *
        (this.audioBoundaries.get(cable.audioModuleId)?.key === "Core/AudioInterface2"
          ? Number(this.audioBoundaries.get(cable.audioModuleId)?.params[0]) || 0
          : 1);
    }
  }

  process(_inputs, outputs) {
    const left = outputs[0]?.[0],
      right = outputs[0]?.[1] || left,
      frames = left?.length || 128;
    left?.fill(0);
    if (right && right !== left) right.fill(0);
    if (!this.ready) return true;
    const sampleAccurateAutomation = this.automationActive;
    this.stepMidiAutomations(frames);
    if (sampleAccurateAutomation) {
      for (let frame = 0; frame < frames; frame++) {
        while (
          this.automationIndex < this.automationEvents.length &&
          this.automationEvents[this.automationIndex].frame <= this.automationFrame
        ) {
          const event = this.automationEvents[this.automationIndex++],
            rackModule = this.modules.get(event.moduleId),
            boundary = this.audioBoundaries.get(event.moduleId);
          if (rackModule && event.paramId >= 0 && event.paramId < rackModule.params.length) {
            rackModule.params[event.paramId] = event.value;
          } else if (boundary && event.paramId >= 0 && event.paramId < boundary.params.length) {
            boundary.params[event.paramId] = event.value;
          } else continue;
          this.port.postMessage({
            type: "automation-param",
            moduleId: event.moduleId,
            id: event.paramId,
            value: event.value,
          });
        }
        this.processGraphFrame(frame);
        this.mixDeviceFrame(left, right, frame);
        this.automationFrame++;
        if (
          this.automationActive &&
          this.automationIndex >= this.automationEvents.length &&
          this.automationFrame >= this.automationEndFrame
        ) {
          this.automationActive = false;
          this.port.postMessage({ type: "automation-complete" });
        }
      }
    } else {
      for (const moduleId of this.order) {
        const rackModule = this.modules.get(moduleId),
          runtime = rackModule.runtime;
        const messageGroup = this.messageGroups.get(moduleId);
        if (messageGroup) {
          this.processMessageGroup(messageGroup, frames);
          continue;
        }
        this.prepareInputs(rackModule, frames);
        this.syncExpanderChain(rackModule, frames);
        if (rackModule.bypassed) {
          rackModule.outputs.fill(0);
          rackModule.currentChannels.fill(1);
          for (const { module } of this.expanderChains.get(rackModule.id) || []) {
            module.outputs.fill(0);
            module.currentChannels.fill(0);
          }
          for (const [inputPort, outputPort] of rackModule.bypassRoutes) {
            if (inputPort >= rackModule.inputCount || outputPort >= rackModule.outputCount)
              continue;
            const channels = rackModule.inputChannels[inputPort];
            rackModule.currentChannels[outputPort] = channels;
            for (let channel = 0; channel < channels; channel++)
              for (let frame = 0; frame < frames; frame++)
                rackModule.outputs[(channel * rackModule.outputCount + outputPort) * 128 + frame] =
                  rackModule.inputs[(channel * rackModule.inputCount + inputPort) * 128 + frame];
          }
        } else {
          for (let id = 0; id < rackModule.params.length; id++)
            runtime.rack_web_set_param(id, rackModule.params[id]);
          runtime.rack_web_process(frames, sampleRate);
          for (let port = 0; port < rackModule.outputCount; port++)
            rackModule.currentChannels[port] = Math.min(
              rackModule.maxChannels,
              runtime.rack_web_get_output_channels(port),
            );
          this.copyExpanderOutputs(rackModule, frames);
        }
      }
    }
    if (!sampleAccurateAutomation)
      for (let frame = 0; frame < frames; frame++) this.mixDeviceFrame(left, right, frame);
    for (const rackModule of this.modules.values()) {
      rackModule.previous.set(rackModule.outputs);
      rackModule.previousChannels.set(rackModule.currentChannels);
    }
    this.drainCaptures();
    this.drainMidiOutputs();
    if (this.visualUpdatesEnabled) {
      this.emitMonitoredPortPeaks(frames);
      this.emitVisualSignals(frames);
    }
    for (const rackModule of this.modules.values())
      for (const id of rackModule.momentaryReleases) {
        rackModule.params[id] = 0;
        rackModule.momentaryReleases.delete(id);
      }
    return true;
  }
}

registerProcessor("rack-graph-processor", RackGraphProcessor);
