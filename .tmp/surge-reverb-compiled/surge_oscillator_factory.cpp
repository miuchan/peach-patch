// Browser-specialized form of Surge XT Oscillator.cpp.
#include "Oscillator.h"
#include "SineOscillator.h"
#include "FxPresetAndClipboardManager.h"
#include "ModulatorPresetManager.h"

Oscillator* spawn_osc(int, SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy, unsigned char* onto) { return new (onto) SineOscillator(storage, oscdata, localcopy); }
Oscillator::Oscillator(SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy) : master_osc(0) { assert(oscdata); this->storage = storage; this->oscdata = oscdata; this->localcopy = localcopy; ticker = 0; }
Oscillator::~Oscillator() {}
int ensemble_stage_count() { return 7; }
int stringosc_excitations_count() { return 15; }
int alias_waves_count() { return 18; }
std::string stringosc_excitation_name(int i) { return "Excitation " + std::to_string(i + 1); }
std::string twist_engine_name(int i) { static const char* names[] = {"Waveforms","Waveshaper","2-Operator FM","Formant/PD","Harmonic","Wavetable","Chords","Vowels/Speech","Granular Cloud","Filtered Noise","Particle Noise","Inharmonic String","Modal Resonator","Analog Kick","Analog Snare","Analog Hi-Hat"}; return i >= 0 && i < 16 ? names[i] : "Error"; }
std::string ensemble_stage_name(int i) { static const char* names[] = {"Digital Delay","BBD 128 Stages","BBD 256 Stages","BBD 512 Stages","BBD 1024 Stages","BBD 2048 Stages","BBD 4096 Stages"}; return i >= 0 && i < 7 ? names[i] : "Error"; }
const char* alias_wave_name[] = {"Sine","Ramp","Pulse","Noise","Alias Mem","Osc Mem","Scene Mem","DAW Chunk Mem","Step Seq Mem","Audio In","TX 2 Wave","TX 3 Wave","TX 4 Wave","TX 5 Wave","TX 6 Wave","TX 7 Wave","TX 8 Wave","Additive"};
int strnatcasecmp(const char* left, const char* right) { return strcasecmp(left, right); }
namespace Surge::Debug { void stackTraceToStdout(int) {} }
namespace Surge::Storage { void FxUserPreset::doPresetRescan(SurgeStorage*, bool) { haveScannedPresets = true; } void ModulatorPreset::forcePresetRescan() { haveScanedPresets = true; } }
