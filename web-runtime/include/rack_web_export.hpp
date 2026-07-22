#pragma once

#include "rack_web.hpp"

// Each plugin is compiled as its own WASM module, so this deliberately exports
// one fixed symbol table per translation unit. Buffers are port-major blocks.
#define RACK_WEB_EXPORTS(ModuleType) \
  static ModuleType rackWebModule; \
  static constexpr int rackWebBlockSize = 128; \
  static constexpr int rackWebMaxChannels = 16; \
  static constexpr int rackWebMaxExpanderPorts = 16; \
  static float* rackWebExpanderInputBuffer = rackWebModule.rackWebExpanderCapacity() ? new float[rackWebModule.rackWebExpanderCapacity() * rackWebMaxExpanderPorts * rackWebMaxChannels * rackWebBlockSize]{} : nullptr; \
  static float* rackWebExpanderOutputBuffer = rackWebModule.rackWebExpanderCapacity() ? new float[rackWebModule.rackWebExpanderCapacity() * rackWebMaxExpanderPorts * rackWebMaxChannels * rackWebBlockSize]{} : nullptr; \
  static int rackWebInputChannels[(ModuleType::NUM_INPUTS ? ModuleType::NUM_INPUTS : 1)]{}; \
  static float rackWebInputBuffer[(ModuleType::NUM_INPUTS ? ModuleType::NUM_INPUTS : 1) * rackWebMaxChannels * rackWebBlockSize]{}; \
  static float rackWebOutputBuffer[(ModuleType::NUM_OUTPUTS ? ModuleType::NUM_OUTPUTS : 1) * rackWebMaxChannels * rackWebBlockSize]{}; \
  static float rackWebLightBuffer[(ModuleType::NUM_LIGHTS ? ModuleType::NUM_LIGHTS : 1)]{}; \
  static float rackWebSampleRate = 0.f; \
  static int64_t rackWebFrameCounter = 0; \
  static void rackWebProcessFrameAt(int frame, float sampleRate) { \
    if (frame < 0 || frame >= rackWebBlockSize) return; \
    rack::rackWebEngine.sampleRate = sampleRate; \
    if (rackWebSampleRate != sampleRate) { rackWebSampleRate = sampleRate; SampleRateChangeEvent event{sampleRate, 1.f / sampleRate}; static_cast<rack::Module&>(rackWebModule).onSampleRateChange(event); rackWebModule.rackWebNotifyNeighborSampleRateChange(event); } \
    ProcessArgs args{sampleRate, 1.f / sampleRate, rackWebFrameCounter++}; \
    for (int port = 0; port < ModuleType::NUM_INPUTS; port++) { \
      rackWebModule.inputs[port].setChannels(rackWebInputChannels[port]); \
      for (int channel = 0; channel < rackWebInputChannels[port]; channel++) rackWebModule.inputs[port].setVoltage(rackWebInputBuffer[(channel * ModuleType::NUM_INPUTS + port) * rackWebBlockSize + frame], channel); \
    } \
    if (rackWebExpanderInputBuffer) rackWebModule.rackWebSyncExpanderFrame(frame, rackWebExpanderInputBuffer, rackWebBlockSize); \
    rackWebModule.rackWebProcessNeighbors(args); \
    rackWebModule.process(args); \
    if (rackWebExpanderOutputBuffer) rackWebModule.rackWebCopyExpanderOutputFrame(frame, rackWebExpanderOutputBuffer, rackWebBlockSize); \
    for (int port = 0; port < ModuleType::NUM_OUTPUTS; port++) for (int channel = 0; channel < rackWebMaxChannels; channel++) rackWebOutputBuffer[(channel * ModuleType::NUM_OUTPUTS + port) * rackWebBlockSize + frame] = channel < rackWebModule.outputs[port].getChannels() ? rackWebModule.outputs[port].getVoltage(channel) : 0.f; \
    for (int id = 0; id < ModuleType::NUM_LIGHTS; id++) rackWebLightBuffer[id] = rackWebModule.lights[id].getBrightness(); \
  } \
  extern "C" { \
  __attribute__((used)) int rack_web_param_count() { return ModuleType::NUM_PARAMS; } \
  __attribute__((used)) int rack_web_input_count() { return ModuleType::NUM_INPUTS; } \
  __attribute__((used)) int rack_web_output_count() { return ModuleType::NUM_OUTPUTS; } \
  __attribute__((used)) int rack_web_light_count() { return ModuleType::NUM_LIGHTS; } \
  __attribute__((used)) int rack_web_max_channels() { return rackWebMaxChannels; } \
  __attribute__((used)) float* rack_web_input_buffer() { return rackWebInputBuffer; } \
  __attribute__((used)) float* rack_web_output_buffer() { return rackWebOutputBuffer; } \
  __attribute__((used)) float* rack_web_light_buffer() { return rackWebLightBuffer; } \
  __attribute__((used)) void rack_web_set_param(int id, float value) { if (id >= 0 && id < ModuleType::NUM_PARAMS) rackWebModule.params[id].setValue(value); } \
  __attribute__((used)) float rack_web_get_param(int id) { return id >= 0 && id < ModuleType::NUM_PARAMS ? rackWebModule.params[id].getValue() : 0.f; } \
  __attribute__((used)) float rack_web_get_param_min(int id) { auto* quantity = rackWebModule.getParamQuantity(id); return quantity ? quantity->getMinValue() : 0.f; } \
  __attribute__((used)) float rack_web_get_param_max(int id) { auto* quantity = rackWebModule.getParamQuantity(id); return quantity ? quantity->getMaxValue() : 1.f; } \
  __attribute__((used)) void rack_web_set_input_connected(int id, int connected) { if (id >= 0 && id < ModuleType::NUM_INPUTS) { bool next = connected != 0; bool changed = rackWebModule.inputs[id].connected != next; rackWebModule.inputs[id].connected = next; if (next && rackWebInputChannels[id] == 0) rackWebInputChannels[id] = 1; if (changed) rackWebModule.onPortChange(typename ModuleType::PortChangeEvent{next, rack::Port::INPUT, id}); } } \
  __attribute__((used)) void rack_web_set_output_connected(int id, int connected) { if (id >= 0 && id < ModuleType::NUM_OUTPUTS) { bool next = connected != 0; bool changed = rackWebModule.outputs[id].connected != next; rackWebModule.outputs[id].connected = next; if (changed) rackWebModule.onPortChange(typename ModuleType::PortChangeEvent{next, rack::Port::OUTPUT, id}); } } \
  __attribute__((used)) void rack_web_set_input_channels(int id, int channels) { if (id >= 0 && id < ModuleType::NUM_INPUTS) rackWebInputChannels[id] = channels < 0 ? 0 : (channels > rackWebMaxChannels ? rackWebMaxChannels : channels); } \
  __attribute__((used)) int rack_web_get_output_channels(int id) { return id >= 0 && id < ModuleType::NUM_OUTPUTS ? rackWebModule.outputs[id].getChannels() : 0; } \
  __attribute__((used)) void rack_web_set_polyphony(int channels) { rackWebModule.polyphony = channels < 1 ? 1 : (channels > rackWebMaxChannels ? rackWebMaxChannels : channels); } \
  __attribute__((used)) void rack_web_set_state(int id, float value) { rackWebModule.setState(id, value); } \
  __attribute__((used)) uint8_t* rack_web_state_buffer(int bytes) { return rackWebModule.rackWebStateBuffer(bytes); } \
  __attribute__((used)) int rack_web_commit_state_json(int bytes) { return rackWebModule.rackWebCommitStateJson(bytes); } \
  __attribute__((used)) int rack_web_snapshot_state_json() { return rackWebModule.rackWebSnapshotStateJson(); } \
  __attribute__((used)) uint8_t* rack_web_snapshot_state_buffer() { return rackWebModule.rackWebSnapshotStateBuffer(); } \
  __attribute__((used)) void rack_web_trigger_action(int id, int active) { rackWebModule.rackWebTriggerAction(id, active != 0); } \
  __attribute__((used)) void rack_web_midi_push(int size, int status, int data1, int data2) { rackWebModule.rackWebPushMidi(size, status, data1, data2); } \
  __attribute__((used)) int rack_web_midi_output_available() { return rackWebModule.rackWebMidiOutputAvailable(); } \
  __attribute__((used)) uint8_t* rack_web_midi_output_buffer() { return rackWebModule.rackWebMidiOutputBuffer(); } \
  __attribute__((used)) void rack_web_consume_midi_output(int count) { rackWebModule.rackWebConsumeMidiOutput(count); } \
  __attribute__((used)) int rack_web_asset_capacity() { return rackWebModule.assetCapacity(); } \
  __attribute__((used)) float* rack_web_asset_buffer() { return rackWebModule.assetBuffer(); } \
  __attribute__((used)) void rack_web_commit_asset(int frames, int channels, float sampleRate) { rackWebModule.commitAsset(frames, channels, sampleRate); } \
  __attribute__((used)) int rack_web_asset_slot_count() { return rackWebModule.assetSlotCount(); } \
  __attribute__((used)) int rack_web_asset_capacity_for_slot(int slot) { return rackWebModule.assetCapacityForSlot(slot); } \
  __attribute__((used)) float* rack_web_asset_buffer_for_slot(int slot) { return rackWebModule.assetBufferForSlot(slot); } \
  __attribute__((used)) void rack_web_commit_asset_for_slot(int slot, int frames, int channels, float sampleRate) { rackWebModule.commitAssetForSlot(slot, frames, channels, sampleRate); } \
  __attribute__((used)) int rack_web_capture_capacity() { return rackWebModule.rackWebCaptureCapacity(); } \
  __attribute__((used)) float* rack_web_capture_buffer() { return rackWebModule.rackWebCaptureBuffer(); } \
  __attribute__((used)) int rack_web_capture_frames() { return rackWebModule.rackWebCaptureFrames(); } \
  __attribute__((used)) int rack_web_capture_channels() { return rackWebModule.rackWebCaptureChannels(); } \
  __attribute__((used)) int rack_web_capture_active() { return rackWebModule.rackWebCaptureActive() ? 1 : 0; } \
  __attribute__((used)) void rack_web_consume_capture(int frames) { rackWebModule.rackWebConsumeCapture(frames); } \
  __attribute__((used)) void rack_web_set_capture_enabled(int enabled) { rackWebModule.rackWebSetCaptureEnabled(enabled != 0); } \
  __attribute__((used)) int rack_web_expander_capacity() { return rackWebModule.rackWebExpanderCapacity(); } \
  __attribute__((used)) float* rack_web_expander_input_buffer() { return rackWebExpanderInputBuffer; } \
  __attribute__((used)) float* rack_web_expander_output_buffer() { return rackWebExpanderOutputBuffer; } \
  __attribute__((used)) void rack_web_set_expander_count(int count) { rackWebModule.rackWebSetExpanderCount(count); } \
  __attribute__((used)) void rack_web_set_expander_type(int index, int type) { rackWebModule.rackWebSetExpanderType(index, type); } \
  __attribute__((used)) void rack_web_set_expander_bypassed(int index, int bypassed) { rackWebModule.rackWebSetExpanderBypassed(index, bypassed != 0); } \
  __attribute__((used)) void rack_web_set_expander_param(int index, int id, float value) { rackWebModule.rackWebSetExpanderParam(index, id, value); } \
  __attribute__((used)) void rack_web_set_expander_input_connected(int index, int id, int connected) { rackWebModule.rackWebSetExpanderInputConnected(index, id, connected != 0); } \
  __attribute__((used)) void rack_web_set_expander_input_channels(int index, int id, int channels) { rackWebModule.rackWebSetExpanderInputChannels(index, id, channels); } \
  __attribute__((used)) int rack_web_get_expander_output_channels(int index, int port) { return rackWebModule.rackWebExpanderOutputChannels(index, port); } \
  __attribute__((used)) int rack_web_message_capacity() { return ModuleType::rackWebMessageCapacity; } \
  __attribute__((used)) void rack_web_set_message_neighbor(int side, int modelIndex, int connected) { rackWebModule.rackWebSetMessageNeighbor(side, modelIndex, connected != 0); } \
  __attribute__((used)) void rack_web_set_message_chain_neighbor(int side, int index, int modelIndex, int connected) { rackWebModule.rackWebSetMessageChainNeighbor(side, index, modelIndex, connected != 0); } \
  __attribute__((used)) void rack_web_set_chain_neighbor_bypassed(int side, int index, int bypassed) { rackWebModule.rackWebSetChainNeighborBypassed(side, index, bypassed != 0); } \
  __attribute__((used)) void rack_web_set_chain_neighbor_param(int side, int index, int id, float value) { rackWebModule.rackWebSetChainNeighborParam(side, index, id, value); } \
  __attribute__((used)) void rack_web_set_chain_neighbor_input(int side, int index, int id, int channels, int channel, float value) { rackWebModule.rackWebSetChainNeighborInput(side, index, id, channels, channel, value); } \
  __attribute__((used)) void rack_web_set_chain_neighbor_output_connected(int side, int index, int id, int connected) { rackWebModule.rackWebSetChainNeighborOutputConnected(side, index, id, connected != 0); } \
  __attribute__((used)) int rack_web_get_chain_neighbor_output_channels(int side, int index, int id) { return rackWebModule.rackWebChainNeighborOutputChannels(side, index, id); } \
  __attribute__((used)) float rack_web_get_chain_neighbor_output_voltage(int side, int index, int id, int channel) { return rackWebModule.rackWebChainNeighborOutputVoltage(side, index, id, channel); } \
  __attribute__((used)) void rack_web_set_neighbor_bypassed(int side, int bypassed) { rackWebModule.rackWebSetNeighborBypassed(side, bypassed != 0); } \
  __attribute__((used)) void rack_web_set_neighbor_param(int side, int id, float value) { rackWebModule.rackWebSetNeighborParam(side, id, value); } \
  __attribute__((used)) void rack_web_set_neighbor_input(int side, int id, int channels, int channel, float value) { rackWebModule.rackWebSetNeighborInput(side, id, channels, channel, value); } \
  __attribute__((used)) void rack_web_set_neighbor_output_connected(int side, int id, int connected) { rackWebModule.rackWebSetNeighborOutputConnected(side, id, connected != 0); } \
  __attribute__((used)) int rack_web_get_neighbor_output_channels(int side, int id) { return rackWebModule.rackWebNeighborOutputChannels(side, id); } \
  __attribute__((used)) float rack_web_get_neighbor_output_voltage(int side, int id, int channel) { return rackWebModule.rackWebNeighborOutputVoltage(side, id, channel); } \
  __attribute__((used)) uint8_t* rack_web_message_buffer(int side, int neighbor, int consumer) { return static_cast<uint8_t*>(rackWebModule.rackWebMessagePointer(side, neighbor != 0, consumer != 0)); } \
  __attribute__((used)) int rack_web_message_flip_requested(int side, int neighbor) { return rackWebModule.rackWebMessageFlipRequested(side, neighbor != 0) ? 1 : 0; } \
  __attribute__((used)) void rack_web_finish_message_flip(int side, int neighbor) { rackWebModule.rackWebFinishMessageFlip(side, neighbor != 0); } \
  __attribute__((used)) void rack_web_seed(uint32_t seed) { rack::random::seed(seed); } \
  __attribute__((used)) void rack_web_process_frame(int frame, float sampleRate) { rackWebProcessFrameAt(frame, sampleRate); } \
  __attribute__((used)) void rack_web_process(int frames, float sampleRate) { \
    if (frames > rackWebBlockSize) frames = rackWebBlockSize; \
    for (int frame = 0; frame < frames; frame++) rackWebProcessFrameAt(frame, sampleRate); \
  } \
  }
