// Automatically isolated from the original Rack DSP module for SurgeXTRack/SurgeXTFXReverb.
// Source: https://github.com/surge-synthesizer/surge-rack/ (src/FX.h; registered in src/FX.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"

#ifndef INFO
#define INFO(...) ((void)0)
#endif
#ifndef WARN
#define WARN(...) ((void)0)
#endif

#include <list>
#include "TemposyncSupport.h"
#include "FxPresetAndClipboardManager.h"
#include "sst/rackhelpers/neighbor_connectable.h"
#include "version.h"

rack::Plugin* pluginInstance = nullptr;
const char* Surge::Build::GitHash = "rack-web";

// Rack's native style implementation is UI-only. The DSP/state layer uses
// these stable serialized enum values, so retain that public contract without
// importing NanoVG, fonts, SVGs, or desktop widgets into WebAssembly.
namespace sst::surgext_rack::style {
struct XTStyle {
  enum Style { DARK = 10001, MID, LIGHT };
  enum LightColor { ORANGE = 900001, YELLOW, GREEN, AQUA, BLUE, PURPLE, PINK, RED, WHITE };
};
}

// VCOConfig exposes panel-layout metadata in its public template even though
// the audio module never consumes it. Keep the type contract lightweight in
// the DSP build instead of importing Rack widgets and NanoVG.
namespace sst::surgext_rack::layout { struct LayoutItem { static LayoutItem createPresetLCDArea() { return {}; } }; }
namespace sst::surgext_rack::vco { template <int oscType> struct VCO; }
namespace sst::surgext_rack::fx {
template <int fxType> struct FX;
struct FXLayoutHelper {
  template <typename T> static void processExtend(T* module, int surgeParam, int rackParam) {
    auto& parameter = module->fxstorage->p[surgeParam];
    const bool enabled = module->params[rackParam].getValue() > .5f;
    if (parameter.extend_range != enabled) parameter.set_extend_range(enabled);
  }
  template <typename T> static void processDeactivate(T* module, int surgeParam, int rackParam) {
    auto& parameter = module->fxstorage->p[surgeParam];
    const bool enabled = module->params[rackParam].getValue() > .5f;
    if ((!parameter.deactivated) != enabled) parameter.deactivated = !enabled;
  }
};
}

#define MAX_POLY 16
#define SURGE_TO_RACK_OSC_MUL 5
#define RACK_TO_SURGE_OSC_MUL 0.2
#define RACK_TO_SURGE_CV_MUL 0.1

#include <cmath>
#include <cstring>
#include "dsp/Effect.h"
#include "DebugHelpers.h"


#include "sst/filters/HalfRateFilter.h"
#include <iostream>
#include <locale>
#include <string>
#include <array>
#include <atomic>
#include <fmt/core.h>
#include <thread>
#include <sst/plugininfra/cpufeatures.h>
#include <map>
#include <vector>

#include "fmt/core.h"
#include "sst/plugininfra/cpufeatures.h"
#include "version.h"

#include <iostream>

#include <locale>

#include <string>

#include <array>

#include <atomic>

#include <thread>

#include <map>

#include <vector>

#include "src/common/dsp/Effect.h"

#include "src/common/DebugHelpers.h"

#include "src/common/dsp/effects/Reverb1Effect.h"

#include "src/common/dsp/vembertech/lipol.h"

#include "libs/fmt/include/fmt/core.h"

#include "libs/sst/sst-plugininfra/include/sst/plugininfra/cpufeatures.h"

#include "src/common/version.h"

#include "src/common/dsp/effects/SurgeSSTFXAdapter.h"

#include "libs/sst/sst-effects/include/sst/effects/Reverb1.h"

#include "src/common/globals.h"

#include "src/common/dsp/utilities/DSPUtils.h"

#include "src/common/ModulationSource.h"

#include "src/common/dsp/Wavetable.h"

#include "libs/sst/sst-plugininfra/libs/tinyxml/include/tinyxml/tinyxml.h"

#include "libs/tuning-library/include/Tunings.h"

#include "src/common/PatchDB.h"

#include "src/common/UserDefaults.h"

#include "libs/sst/sst-basic-blocks/include/sst/basic-blocks/params/ParamMetadata.h"

#include "libs/sst/sst-filters/include/sst/filters/BiquadFilter.h"

#include "src/common/dsp/vembertech/basic_dsp.h"

#include "libs/eurorack/eurorack/plaits/dsp/physical_modelling/string.h"

#include "libs/sst/sst-plugininfra/libs/tinyxml/include/tinyxml/tinystr.h"

#include "libs/sst/sst-cpputils/include/sst/cpputils/algorithms.h"

#include "libs/sst/sst-cpputils/include/sst/cpputils/ring_buffer.h"

#include "libs/sst/sst-plugininfra/include/sst/plugininfra/userdefaults.h"

#include "libs/simde/simde/x86/sse.h"

#include "libs/simde/simde/x86/sse2.h"

#include "libs/simde/simde/simde-f16.h"

#include "libs/eurorack/eurorack/stmlib/dsp/filter.h"

#include "libs/eurorack/eurorack/stmlib/utils/buffer_allocator.h"

#include "libs/eurorack/eurorack/plaits/dsp/physical_modelling/delay_line.h"

#include "libs/sst/sst-filters/include/sst/filters/DiodeLadder.h"

#include "libs/simde/simde/x86/mmx.h"

#include "libs/simde/simde/simde-common.h"

#include "libs/eurorack/eurorack/stmlib/dsp/dsp.h"

#include "libs/sst/sst-filters/include/sst/filters/QuadFilterUnit.h"

#include "libs/sst/sst-filters/include/sst/filters/FilterCoefficientMaker.h"

#include "libs/sst/sst-waveshapers/include/sst/waveshapers/Saturators.h"

#include "libs/sst/sst-waveshapers/include/sst/waveshapers/Harmonics.h"

#include "libs/sst/sst-waveshapers/include/sst/waveshapers/Wavefolders.h"

#include "libs/simde/simde/simde-math.h"

#include "libs/sst/sst-filters/include/sst/filters/TuningProvider.h"

#include "libs/sst/sst-waveshapers/include/sst/waveshapers/WaveshaperTables.h"

#include "libs/sst/sst-waveshapers/include/sst/waveshapers/WaveshaperLUT.h"

#include "libs/simde/simde/mips/msa/types.h"

/*
 * SurgeXT for VCV Rack - a Surge Synth Team product
 *
 * A set of modules expressing Surge XT into the VCV Rack Module Ecosystem
 *
 * Copyright 2019 - 2024, Various authors, as described in the github
 * transaction log.
 *
 * Surge XT for VCV Rack is released under the GNU General Public License
 * 3.0 or later (GPL-3.0-or-later). A copy of the license is in this
 * repository in the file "LICENSE" or at:
 *
 * or at https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * All source for Surge XT for VCV Rack is available at
 * https://github.com/surge-synthesizer/surge-rack/
 */

#ifndef SURGE_XT_RACK_SRC_XTMODULEWIDGET_H
#define SURGE_XT_RACK_SRC_XTMODULEWIDGET_H





// namespace sst::surgext_rack::widgets

#endif

/*
 * SurgeXT for VCV Rack - a Surge Synth Team product
 *
 * A set of modules expressing Surge XT into the VCV Rack Module Ecosystem
 *
 * Copyright 2019 - 2024, Various authors, as described in the github
 * transaction log.
 *
 * Surge XT for VCV Rack is released under the GNU General Public License
 * 3.0 or later (GPL-3.0-or-later). A copy of the license is in this
 * repository in the file "LICENSE" or at:
 *
 * or at https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * All source for Surge XT for VCV Rack is available at
 * https://github.com/surge-synthesizer/surge-rack/
 */

#ifndef SURGE_XT_RACK_SRC_XTMODULE_H
#define SURGE_XT_RACK_SRC_XTMODULE_H
















namespace logger = rack::logger;
using rack::appGet;



namespace sst::surgext_rack::modules
{


struct CalculatedName
{
    virtual ~CalculatedName() = default;
    virtual std::string getCalculatedName() = 0;
};





template <int centerOffset> struct VOctParamQuantity : public rack::engine::ParamQuantity
{
    void setDisplayValueString(std::string s) override
    {
        auto f = std::atof(s.c_str());
        if (f > 0)
        {
            auto midiNote = 12 * log2(f / 440) + 69;
            setValue((midiNote - centerOffset) / 12.f);
        }
        else if ((s[0] >= 'A' && s[0] <= 'G') || (s[0] >= 'a' && s[0] <= 'g'))
        {
            int opos = 1;
            int halfOff = 0;
            if (s[1] == '#')
            {
                halfOff = 1;
                opos++;
            }
            if (s[1] == 'b')
            {
                halfOff = -1;
                opos++;
            }
            int octave = std::atoi(s.c_str() + opos);

            int ws = 0;
            switch (std::toupper(s[0]))
            {
            case 'C':
                ws = 0;
                break;
            case 'D':
                ws = 2;
                break;
            case 'E':
                ws = 4;
                break;
            case 'F':
                ws = 5;
                break;
            case 'G':
                ws = 7;
                break;
            case 'A':
                ws = 9;
                break;
            case 'B':
                ws = 11;
                break;
            }
            auto mnote = (octave + 1) * 12 + ws + halfOff;
            setValue((mnote - centerOffset) / 12.f);
        }
        else
        {
            setValue(0);
        }
    }

    virtual std::string getDisplayValueString() override
    {
        auto note = getValue() * 12 + centerOffset;
        auto freq = 440.0 * pow(2.0, (note - 69) / 12);

        auto noteR = std::round(note);
        auto noteO = (int)(noteR) % 12;
        int oct = (int)std::round((noteR - noteO) / 12 - 1);

        static constexpr std::array<char[3], 12> names{"C",  "C#", "D",  "D#", "E",  "F",
                                                       "F#", "G",  "G#", "A",  "A#", "B"};

        return fmt::format("{:6.2f} Hz (~{}{})", freq, names[noteO], oct);
    }
};

template <int centerOffset> struct MidiNoteParamQuantity : public rack::engine::ParamQuantity
{
    void setDisplayValueString(std::string s) override
    {
        auto f = std::atof(s.c_str());
        if (f > 0)
        {
            auto val = 12 * log2(f / 440) + 69 - centerOffset;
            setValue(val);
        }
        else if ((s[0] >= 'A' && s[0] <= 'G') || (s[0] >= 'a' && s[0] <= 'g'))
        {
            int opos = 1;
            int halfOff = 0;
            if (s[1] == '#')
            {
                halfOff = 1;
                opos++;
            }
            if (s[1] == 'b')
            {
                halfOff = -1;
                opos++;
            }
            int octave = std::atoi(s.c_str() + opos);

            int ws = 0;
            switch (std::toupper(s[0]))
            {
            case 'C':
                ws = 0;
                break;
            case 'D':
                ws = 2;
                break;
            case 'E':
                ws = 4;
                break;
            case 'F':
                ws = 5;
                break;
            case 'G':
                ws = 7;
                break;
            case 'A':
                ws = 9;
                break;
            case 'B':
                ws = 11;
                break;
            }
            auto mnote = (octave + 1) * 12 + ws + halfOff;
            setValue(mnote - centerOffset);
        }
        else
        {
            setValue(centerOffset);
        }
    }

    virtual std::string getDisplayValueString() override
    {
        auto note = getValue() + centerOffset;
        auto freq = 440.0 * pow(2.0, (note - 69) / 12);

        auto noteR = std::round(note);
        auto noteO = (int)(noteR) % 12;
        int oct = (int)std::round((noteR - noteO) / 12 - 1);

        static constexpr std::array<char[3], 12> names{"C",  "C#", "D",  "D#", "E",  "F",
                                                       "F#", "G",  "G#", "A",  "A#", "B"};

        return fmt::format("{:6.2f} Hz (~{}{})", freq, names[noteO], oct);
    }
};

struct DecibelParamQuantity : rack::engine::ParamQuantity
{
    static float ampToLinear(float xin)
    {
        auto x = std::max(0.f, xin);
        return x * x * x;
    }
    static __m128 ampToLinearSSE(__m128 xin)
    {
        auto x = _mm_max_ss(xin, _mm_setzero_ps());
        return _mm_mul_ps(x, _mm_mul_ps(x, x));
    }
    static float linearToAmp(float x)
    {
        // display only so don't need an SSE version of this
        return powf(std::max(x, 0.f), 1.f / 3.f);
    }

    std::string getDisplayValueString() override
    {
        auto v = getValue();
        if (v < 0.0001)
            return "-inf dB";
        auto dbv = 6.0 * std::log2(ampToLinear(v));
        return fmt::format("{:.4} dB", dbv);
    }

    void setDisplayValueString(std::string s) override
    {
        if (s.find("-inf") != std::string::npos)
        {
            setValue(0.f);
            return;
        }

        auto q = std::atof(s.c_str());
        auto v = linearToAmp(pow(2.f, q / 6.0));
        if (v >= 0 && v <= 2)
        {
            setValue(v);
            return;
        }

        setValue(1.f);
    }
};

template <typename M> struct DecibelModulatorParamQuantity : rack::ParamQuantity
{
    inline M *xtm() { return static_cast<M *>(module); }
    inline ParamQuantity *under()
    {
        auto m = xtm();
        if (!m)
            return nullptr;

        auto underParamId = m->paramModulatedBy(paramId);
        if (underParamId < 0)
            return nullptr;

        return m->paramQuantities[underParamId];
    }
    std::string getLabel() override
    {
        auto upq = under();
        if (!upq)
            return ParamQuantity::getLabel();
        return ParamQuantity::getLabel() + " to " + upq->getLabel();
    }
};

template <typename M, uint32_t nPar, uint32_t par0, uint32_t nInputs, uint32_t input0>
struct MonophonicModulationAssistant
{
    float f[nPar], fInv[nPar];
    float mu[nPar][nInputs];
    float values alignas(16)[nPar];
    float basevalues alignas(16)[nPar];
    float modvalues alignas(16)[nPar];
    void initialize(M *m)
    {
        for (auto p = 0U; p < nPar; ++p)
        {
            auto pq = m->paramQuantities[p + par0];
            f[p] = (pq->maxValue - pq->minValue);
            fInv[p] = 1.0 / f[p];
        }
        setupMatrix(m);
    }

    void setupMatrix(M *m)
    {
        for (auto p = 0U; p < nPar; ++p)
        {
            for (auto i = 0U; i < nInputs; ++i)
            {
                auto idx = m->modulatorIndexFor(p + par0, i);
                mu[p][i] = m->params[idx].getValue() * f[p];
            }
        }
    }

    void updateValues(M *m)
    {
        float inp[4];
        for (auto i = 0U; i < nInputs; ++i)
        {
            inp[i] = m->inputs[i + input0].isConnected() * m->inputs[i + input0].getVoltage(0) *
                     RACK_TO_SURGE_CV_MUL;
        }
        for (auto p = 0U; p < nPar; ++p)
        {
            // Set up the base values
            auto mv = 0.f;
            for (auto i = 0U; i < nInputs; ++i)
            {
                mv += (mu[p][i] * inp[i]);
            }
            modvalues[p] = mv;
            basevalues[p] = m->params[p + par0].getValue();
            values[p] = mv + basevalues[p];
        }
    }
};

template <typename M, uint32_t nPar, uint32_t par0, uint32_t nInputs, uint32_t input0>
struct ModulationAssistant
{
    float f alignas(16)[nPar], fInv alignas(16)[nPar];
    float mu alignas(16)[nPar][nInputs];
    float values alignas(16)[nPar][MAX_POLY];
    float basevalues alignas(16)[nPar];
    float modvalues alignas(16)[nPar][MAX_POLY];
    __m128 valuesSSE alignas(16)[nPar][MAX_POLY >> 2];
    __m128 muSSE alignas(16)[nPar][nInputs];
    float animValues alignas(16)[nPar];

    bool connected[nInputs];
    bool connectedParameter[nPar];
    bool broadcast[nInputs];
    int chans{1};
    bool anyConnected{false};
    void initialize(M *m)
    {
        for (auto p = 0U; p < nPar; ++p)
        {
            auto pq = m->paramQuantities[p + par0];
            f[p] = (pq->maxValue - pq->minValue);
            fInv[p] = 1.0 / f[p];
        }
        setupMatrix(m);
    }

    void setupMatrix(M *m)
    {
        chans = std::max(1, m->polyChannelCount());

        anyConnected = false;
        for (auto i = 0U; i < nInputs; ++i)
        {
            connected[i] = m->inputs[i + input0].isConnected();
            anyConnected = anyConnected || connected[i];
            if (connected[i])
            {
                auto ch = m->inputs[i + input0].getChannels();
                broadcast[i] = ch == 1 && chans != 1;
            }
            else
            {
                broadcast[i] = false; // to have a value at least
            }
        }

        for (auto p = 0U; p < nPar; ++p)
        {
            auto sm = 0.f;
            for (auto i = 0U; i < nInputs; ++i)
            {
                auto idx = m->modulatorIndexFor(p + par0, i);
                mu[p][i] = m->params[idx].getValue() * f[p];
                sm += fabs(mu[p][i]);
                muSSE[p][i] = _mm_set1_ps(mu[p][i]);
            }
            connectedParameter[p] = (sm > 1e-6f) && anyConnected;
        }
    }

    void updateValues(M *m)
    {
        if (chans == 1)
        {
            // Special case: chans = 1 can skip all the channel loops
            float inp[nInputs];
            for (auto i = 0U; i < nInputs; ++i)
            {
                inp[i] = connected[i] * m->inputs[i + input0].getVoltage(0) * RACK_TO_SURGE_CV_MUL;
            }
            for (auto p = 0U; p < nPar; ++p)
            {
                // Set up the base values
                auto mv = 0.f;
                if (connectedParameter[p])
                {
                    for (auto i = 0U; i < nInputs; ++i)
                    {
                        mv += mu[p][i] * inp[i];
                    }
                }
                modvalues[p][0] = mv;
                basevalues[p] = m->params[p + par0].getValue();
                values[p][0] = mv + basevalues[p];
                valuesSSE[p][0] = _mm_set1_ps(values[p][0]);

                animValues[p] = fInv[p] * mv;
            }
        }
        else
        {
            const auto r2scv = _mm_set1_ps(RACK_TO_SURGE_CV_MUL);
            int polyChans = (chans - 1) / 4 + 1;
            __m128 snapInputs[nInputs][MAX_POLY >> 2];
            for (auto i = 0U; i < nInputs; ++i)
            {
                if (!connected[i])
                {
                    for (int c = 0; c < polyChans; ++c)
                    {
                        snapInputs[i][c] = _mm_setzero_ps();
                    }
                }
                else if (broadcast[i])
                {
                    auto iv = m->inputs[i + input0].getVoltage(0) * RACK_TO_SURGE_CV_MUL;
                    for (int c = 0; c < polyChans; ++c)
                    {
                        snapInputs[i][c] = _mm_set1_ps(iv);
                    }
                }
                else
                {
                    // This loop can SIMD-ize
                    for (int c = 0; c < polyChans; ++c)
                    {
                        auto v = _mm_loadu_ps(m->inputs[i + input0].getVoltages(c * 4));
                        v = _mm_mul_ps(v, r2scv);
                        snapInputs[i][c] = v;
                    }
                }
            }
            for (auto p = 0U; p < nPar; ++p)
            {
                if (!connectedParameter[p])
                {
                    basevalues[p] = m->params[p + par0].getValue();
                    auto v0 = _mm_set1_ps(basevalues[p]);

                    for (int c = 0; c < polyChans; ++c)
                    {
                        _mm_store_ps(&modvalues[p][c * 4], _mm_setzero_ps());
                        valuesSSE[p][c] = v0;
                        _mm_store_ps(&values[p][c * 4], valuesSSE[p][c]);
                    }

                    animValues[p] = fInv[p] * modvalues[p][0];
                }
                else
                {
                    __m128 mv[MAX_POLY >> 2];
                    memset(mv, 0, polyChans * sizeof(__m128));

                    for (auto i = 0U; i < nInputs; ++i)
                    {
                        if (!connected[i])
                            continue;

                        // This is the loop we will simd-4 stride
                        for (int c = 0; c < polyChans; ++c)
                        {
                            mv[c] = _mm_add_ps(mv[c], _mm_mul_ps(muSSE[p][i], snapInputs[i][c]));
                        }
                    }

                    basevalues[p] = m->params[p + par0].getValue();
                    auto v0 = _mm_set1_ps(basevalues[p]);

                    for (int c = 0; c < polyChans; ++c)
                    {
                        _mm_store_ps(&modvalues[p][c * 4], mv[c]);
                        valuesSSE[p][c] = _mm_add_ps(v0, mv[c]);
                        _mm_store_ps(&values[p][c * 4], valuesSSE[p][c]);
                    }

                    animValues[p] = fInv[p] * modvalues[p][0];
                }
            }
        }
    }
};

template <typename T> struct ClockProcessor
{
    enum ClockStyle
    {
        QUARTER_NOTE,
        BPM_VOCT
    } clockStyle{QUARTER_NOTE};

    rack::dsp::SchmittTrigger trig;

    float sampleRate{1}, sampleRateInv{1};
    int timeSinceLast{-1};
    float lastBPM{-1}, lastBPMVolts{-11};
    bool bpmConnected{false};

    inline void process(T *m, int inputId)
    {
        assert(sampleRate > 100);

        if (clockStyle == BPM_VOCT)
        {
            if (!bpmConnected)
                m->activateTempoSync();
            bpmConnected = true;
            auto iv = m->inputs[inputId].getVoltage();
            if (iv != lastBPMVolts)
            {
                auto bpmRatio = pow(2.0, iv);
                m->storage->temposyncratio = bpmRatio;
                m->storage->temposyncratio_inv = 1.f / bpmRatio;
            }
            lastBPMVolts = iv;
        }
        else
        {
            if (trig.process(m->inputs[inputId].getVoltage()))
            {
                // If we have 10bpm don't update BPM. It's probably someone stopping
                // their clock for a while.
                if (timeSinceLast > 0 && timeSinceLast < sampleRate * 6)
                {
                    auto bpm = 60 * sampleRate / timeSinceLast;

                    // OK we are going to make an assumption
                    // that BPM is *probably* integral at least
                    // if we are within a smidge of an integer
                    auto d = std::abs(bpm - std::round(bpm));
                    if (d < 0.015)
                    {
                        bpm = std::round(bpm);
                    }
                    if (bpm != lastBPM)
                    {
                        m->storage->temposyncratio = bpm / 120.f;
                        m->storage->temposyncratio_inv = 120.f / bpm;
                    }
                    lastBPM = bpm;
                }
                else
                {
                    m->activateTempoSync();
                }
                timeSinceLast = 0;
            }
            timeSinceLast += (timeSinceLast >= 0);
        }
    }
    inline void disconnect(T *m)
    {
        if (timeSinceLast >= 0 || bpmConnected)
            m->deactivateTempoSync();

        timeSinceLast = -1;
        bpmConnected = false;
    }

    void setSampleRate(float sr)
    {
        sampleRate = sr;
        sampleRateInv = 1.f / sr;
    }

    void toJson(json_t *onto)
    {
        json_object_set_new(onto, "clockStyle", json_integer((int)clockStyle));
    }

    void fromJson(json_t *modJ)
    {
        auto cs = json_object_get(modJ, "clockStyle");
        if (cs)
        {
            auto csv = json_integer_value(cs);
            clockStyle = static_cast<ClockStyle>(csv);
        }
    }
};

// A block wise single channel DC Blocker
struct DCBlocker
{
    float xN1{0}, yN1{0};
    float fac{0.9995};
    DCBlocker() { reset(); }
    void reset()
    {
        xN1 = 0.f;
        yN1 = 0.f;
    }

    inline void filter(float *x) // BLOCK_SIZE
    {
        for (auto i = 0; i < BLOCK_SIZE; ++i)
        {
            auto dx = x[i] - xN1;
            auto fv = dx + fac * yN1;

            xN1 = x[i];
            yN1 = fv;

            x[i] = fv;
        }
    }
};

// A sample-wise 4-across SIMD dc blocker
struct DCBlockerSIMD4
{
    __m128 fac, xN1, yN1;
    DCBlockerSIMD4()
    {
        fac = _mm_set1_ps(0.9995);
        reset();
    }
    void reset()
    {
        xN1 = _mm_setzero_ps();
        yN1 = _mm_setzero_ps();
    }

    inline __m128 filter(__m128 x) // BLOCK_SIZE
    {
        auto dx = _mm_sub_ps(x, xN1);
        auto fv = _mm_add_ps(dx, _mm_mul_ps(fac, yN1));
        xN1 = x;
        yN1 = fv;
        return fv;
    }
};



struct TypeSwappingParameterQuantity : rack::ParamQuantity, modules::CalculatedName
{
    TypeSwappingParameterQuantity() {}

    virtual int mode() = 0;
    rack::ParamQuantity *under()
    {
        auto m = mode();
        auto f = impls.find(m);
        assert(f != impls.end());
        if (f == impls.end())
            return nullptr;
        if (f->second->module != module)
        {
            f->second->module = module;
            f->second->paramId = paramId;
        }
        return f->second.get();
    }

    std::unordered_map<int, std::unique_ptr<rack::ParamQuantity>> impls;
    template <typename T> void addImplementer(int mode) { impls[mode] = std::make_unique<T>(); }

    std::string getDisplayValueString() override
    {
        const auto u = under();
        if (u)
            return u->getDisplayValueString();
        return {};
    }

    std::string getLabel() override
    {
        const auto u = under();
        if (u)
            return u->getLabel();
        return {};
    }

    void randomize() override
    {
        const auto u = under();
        if (u)
            u->randomize();
    }

    void setDisplayValueString(std::string s) override
    {
        const auto u = under();
        if (u)
            u->setDisplayValueString(s);
    }

    std::string getCalculatedName() override
    {
        const auto u = under();
        const auto cn = dynamic_cast<modules::CalculatedName *>(u);
        if (cn)
            return cn->getCalculatedName();
        if (u)
            return u->name;
        return {};
    }
};

struct CTEnvTimeParamQuantity : rack::ParamQuantity, modules::CalculatedName
{
    static constexpr float defaultEtMin{-8}, defaultEtMax{3.32192809489}; // log2(10)
    float etMin{defaultEtMin}, etMax{defaultEtMax};

    std::string getLabel() override { return getCalculatedName(); }
    std::string getDisplayValueString() override
    {
        auto v = getValue() * (etMax - etMin) + etMin;

        if (getValue() < 0.0001)
        {
            std::string mv;
            if (getMinString(mv))
            {
                return mv;
            }
        }
        if (isTempoSync())
        {
            return temposync_support::temposyncLabel(v);
        }
        auto rs = fmt::format("{:.4f} s", pow(2, v));
        return rs;
    }
    void setDisplayValueString(std::string s) override
    {
        auto q = std::atof(s.c_str());
        auto v = log2(std::clamp(q, pow(2., etMin), pow(2., etMax)));
        auto vn = (v - etMin) / (etMax - etMin);
        setValue(vn);
    }

    virtual bool getMinString(std::string &s) { return false; }
    virtual bool isTempoSync() { return false; }
};

struct ModulateFromToParamQuantity : public rack::ParamQuantity, CalculatedName
{
    int modSource{0}, targetIndex{0};
    void setup(int ms, int ti)
    {
        this->modSource = ms;
        this->targetIndex = ti;
        this->name = getCalculatedName();
    }
    std::string getLabel() override { return getCalculatedName(); }
    std::string getCalculatedName() override
    {
        auto nm = "Mod " + std::to_string(modSource + 1) + " to " +
                  module->paramQuantities[targetIndex]->getLabel();
        return nm;
    }
};

} // namespace sst::surgext_rack::modules
#endif // SCXT_SRC_XTMODULE_H

namespace sst {
namespace surgext_rack {
}
}
namespace sst {
namespace surgext_rack {
}
}
namespace sst {
namespace surgext_rack {
}
}

namespace sst::surgext_rack::fx {
/*
 * SurgeXT for VCV Rack - a Surge Synth Team product
 *
 * A set of modules expressing Surge XT into the VCV Rack Module Ecosystem
 *
 * Copyright 2019 - 2024, Various authors, as described in the github
 * transaction log.
 *
 * Surge XT for VCV Rack is released under the GNU General Public License
 * 3.0 or later (GPL-3.0-or-later). A copy of the license is in this
 * repository in the file "LICENSE" or at:
 *
 * or at https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * All source for Surge XT for VCV Rack is available at
 * https://github.com/surge-synthesizer/surge-rack/
 */

template <int fxType> struct FXConfig
{
    typedef sst::surgext_rack::layout::LayoutItem LayoutItem;
    typedef std::vector<LayoutItem> layout_t;
    static layout_t getLayout() { return {LayoutItem::createPresetLCDArea()}; }

    static constexpr int extraInputs() { return 0; }
    static constexpr int extraSchmidtTriggers() { return 1; }
    static void configExtraInputs(FX<fxType> *M) {}
    static void processExtraInputs(FX<fxType> *M, int channel) {}

    static constexpr int extraOutputs() { return 0; }
    static void configExtraOutputs(FX<fxType> *M) {}
    static void populateExtraOutputs(FX<fxType> *M, int chan, Effect *fx) {}

    static constexpr int specificParamCount() { return 0; }
    static void configSpecificParams(FX<fxType> *M) {}
    static void processSpecificParams(FX<fxType> *M) {}
    static void adjustParamsBasedOnState(FX<fxType> *M) {}
    static void loadPresetOntoSpecificParams(FX<fxType> *M,
                                             const Surge::Storage::FxUserPreset::Preset &)
    {
    }
    static bool isDirtyPresetVsSpecificParams(FX<fxType> *M,
                                              const Surge::Storage::FxUserPreset::Preset &)
    {
        return false;
    }

    static constexpr int panelWidthInScrews() { return 12; }
    static constexpr bool usesSideband() { return false; }
    static constexpr bool usesSidebandOversampled() { return false; }
    static constexpr bool usesClock() { return false; }
    static constexpr bool usesPresets() { return true; }
    static constexpr int numParams() { return n_fx_params; }
    static constexpr bool allowsPolyphony() { return true; }

    static constexpr float rescaleInputFactor() { return 1.0; }
    static constexpr bool softclipOutput() { return false; }
    static constexpr bool nanCheckOutput() { return false; }

    
};
}

namespace sst {
namespace surgext_rack {
namespace modules {
/*
 * SurgeXT for VCV Rack - a Surge Synth Team product
 *
 * A set of modules expressing Surge XT into the VCV Rack Module Ecosystem
 *
 * Copyright 2019 - 2024, Various authors, as described in the github
 * transaction log.
 *
 * Surge XT for VCV Rack is released under the GNU General Public License
 * 3.0 or later (GPL-3.0-or-later). A copy of the license is in this
 * repository in the file "LICENSE" or at:
 *
 * or at https://www.gnu.org/licenses/gpl-3.0.en.html
 *
 * All source for Surge XT for VCV Rack is available at
 * https://github.com/surge-synthesizer/surge-rack/
 */

using rack::appGet;




struct XTModule : Module, SurgeStorage::ErrorListener {
    inline static std::mutex xtSurgeCreateMutex;

    XTModule() : rack::Module() { storage.reset(nullptr); }

    std::string getBuildInfo()
    {
        char version[1024];
        snprintf(version, 1023, "os:%s surge:%s buildtime=%s %s",
#if WINDOWS
                 "win",
#elif MAC
                 "macos",
#elif LINUX
                 "linux",
#else
                 "unknown",
#endif
                 Surge::Build::GitHash, __DATE__, __TIME__);
        return std::string(version);
    }

    void showBuildInfo()
    {
        INFO("[SurgeXTRack] Instance: Module=%s BuildInfo=%s", getName().c_str(),
             getBuildInfo().c_str());
    }

    virtual std::string getName() = 0;

    virtual void onSampleRateChange() override
    {
        float sr = APP->engine->getSampleRate();
        if (storage)
        {
            storage->setSamplerate(sr);
            storage->init_tables();
            updateBPMFromClockCV(lastClockCV, storage->samplerate_inv, sr, true);
            moduleSpecificSampleRateChange();
        }
    }

    virtual void moduleSpecificSampleRateChange() {}

    static std::atomic<bool> showedPathsOnce;

    fs::path getRackUserWavetablesDir()
    {
        return fs::path{rack::asset::user("SurgeXTRack/UserWavetables")};
    }

    void guaranteeRackUserWavetablesDir()
    {}

    void setupSurgeCommon(int NUM_PARAMS, bool loadWavetables, bool loadFX)
    {
        SurgeStorage::SurgeStorageConfig config;
        config.suppliedDataPath = SurgeStorage::skipPatchLoadDataPathSentinel;
        config.createUserDirectory = false;

        if (loadWavetables || loadFX)
        {
            config.suppliedDataPath = rack::asset::plugin(pluginInstance, "build/surge-data/");
            config.extraThirdPartyWavetablesPath =
                fs::path{rack::asset::user("SurgeXTRack/SurgeXTRack_ExtraContent")};
            guaranteeRackUserWavetablesDir();
            config.extraUsersWavetablesPath = getRackUserWavetablesDir();
            config.scanWavetableAndPatches = loadWavetables;
        }

        showBuildInfo();
        storage = std::make_unique<SurgeStorage>(config);
        
        storage->getPatch().init_default_values();
        storage->getPatch().copy_globaldata(storage->getPatch().globaldata);
        storage->getPatch().copy_scenedata(storage->getPatch().scenedata[0], 0);
        storage->getPatch().copy_scenedata(storage->getPatch().scenedata[1], 1);

        onSampleRateChange();
    }

    float lastBPM = -1, lastClockCV = -100;
    float dPhase = 0;
    inline bool updateBPMFromClockCV(float clockCV, float sampleTime, float sampleRate,
                                     bool force = false)
    {
        if (!force && clockCV == lastClockCV)
            return false;

        lastClockCV = clockCV;
        float clockTime = powf(2.0f, clockCV);
        dPhase = clockTime * sampleTime;
        float samplesPerBeat = 1.0 / dPhase;
        float secondsPerBeat = samplesPerBeat / sampleRate;
        float beatsPerMinute = 60.0 / secondsPerBeat;

        // Folks can put in insane BPMs if they mis-wire their rack. Lets
        // put in a rack::clamp for well beyond the usable range
        beatsPerMinute = rack::clamp(beatsPerMinute, 1.f, 1024.f);

        lastBPM = beatsPerMinute;

        if (storage.get())
        {
            // FIX ME new API
            storage->temposyncratio = beatsPerMinute / 120.0;
            storage->temposyncratio_inv = 1.f / storage->temposyncratio;
        }
        return true;
    }

    virtual bool isBipolar(int paramId) { return false; }
    virtual float modulationDisplayValue(int paramId) { return 0; }

    void copyScenedataSubset(int scene, int start, int end)
    {
        int s = storage->getPatch().scene_start[scene];
        for (int i = start; i < end; ++i)
        {
            storage->getPatch().scenedata[scene][i - s].i = storage->getPatch().param_ptr[i]->val.i;
        }
    }

    void copyGlobaldataSubset(int start, int end)
    {
        for (int i = start; i < end; ++i)
        {
            storage->getPatch().globaldata[i].i = storage->getPatch().param_ptr[i]->val.i;
        }
    }

    void setupStorageRanges(Parameter *start, Parameter *endIncluding)
    {
        int min_id = 100000, max_id = -1;
        Parameter *oap = start;
        while (oap <= endIncluding)
        {
            if (oap->id >= 0)
            {
                if (oap->id > max_id)
                    max_id = oap->id;
                if (oap->id < min_id)
                    min_id = oap->id;
            }
            oap++;
        }

        storage_id_start = min_id;
        storage_id_end = max_id + 1;
    }

    virtual Parameter *surgeDisplayParameterForParamId(int paramId) { return nullptr; }
    virtual Parameter *surgeDisplayParameterForModulatorParamId(int paramId) { return nullptr; }

    std::unique_ptr<SurgeStorage> storage;
    int storage_id_start, storage_id_end;

    json_t *makeCommonDataJson()
    {
        json_t *rootJ = json_object();
        // For future use
        json_object_set_new(rootJ, "streamingVersion", json_integer(1));
        json_object_set_new(rootJ, "buildInfo", json_string(getBuildInfo().c_str()));
        json_object_set_new(rootJ, "isCoupledToGlobalStyle", json_boolean(isCoupledToGlobalStyle));
        json_object_set_new(rootJ, "localStyle", json_integer(localStyle));
        json_object_set_new(rootJ, "localDisplayRegionColor",
                            json_integer(localDisplayRegionColor));
        json_object_set_new(rootJ, "localModulationColor", json_integer(localModulationColor));
        json_object_set_new(rootJ, "localControlValueColor", json_integer(localControlValueColor));
        json_object_set_new(rootJ, "localPowerButtonColor", json_integer(localPowerButtonColor));
        return rootJ;
    }

    void readCommonDataJson(json_t *commonJ)
    {
        auto icg = json_object_get(commonJ, "isCoupledToGlobalStyle");
        if (icg)
            isCoupledToGlobalStyle = json_boolean_value(icg);

        auto ls = json_object_get(commonJ, "localStyle");
        if (ls)
            localStyle = (style::XTStyle::Style)json_integer_value(ls);
        auto ll = json_object_get(commonJ, "localDisplayRegionColor");
        if (ll)
            localDisplayRegionColor = (style::XTStyle::LightColor)json_integer_value(ll);
        auto lm = json_object_get(commonJ, "localModulationColor");
        if (lm)
            localModulationColor = (style::XTStyle::LightColor)json_integer_value(lm);
        lm = json_object_get(commonJ, "localControlValueColor");
        if (lm)
            localControlValueColor = (style::XTStyle::LightColor)json_integer_value(lm);
        lm = json_object_get(commonJ, "localPowerButtonColor");
        if (lm)
            localPowerButtonColor = (style::XTStyle::LightColor)json_integer_value(lm);
    }

    virtual json_t *makeModuleSpecificJson() { return nullptr; }
    virtual void readModuleSpecificJson(json_t *modJ) {}

    virtual json_t *dataToJson() override
    {
        json_t *commonJ = makeCommonDataJson();
        json_t *moduleSpecificJ = makeModuleSpecificJson();

        json_t *rootJ = json_object();
        if (commonJ)
        {
            json_object_set_new(rootJ, "xtshared", commonJ);
            commonJ = nullptr;
        }
        if (moduleSpecificJ)
        {
            json_object_set_new(rootJ, "modulespecific", moduleSpecificJ);
            moduleSpecificJ = nullptr;
        }
        return rootJ;
    }
    virtual void dataFromJson(json_t *rootJ) override
    {
        auto commonJ = json_object_get(rootJ, "xtshared");
        auto specificJ = json_object_get(rootJ, "modulespecific");
        if (commonJ)
            readCommonDataJson(commonJ);
        if (specificJ)
            readModuleSpecificJson(specificJ);
    }

    template <typename T = rack::ParamQuantity, typename... Args> T *configParamNoRand(Args... args)
    {
        auto *res = configParam<T>(args...);
        res->randomizeEnabled = false;
        return res;
    }

    template <typename T = rack::SwitchQuantity>
    T *configOnOff(int paramId, float defaultValue, const std::string &name)
    {
        return configSwitch<T>(paramId, 0, 1, defaultValue, name, {"Off", "On"});
    }
    template <typename T = rack::SwitchQuantity>
    T *configOnOffNoRand(int paramId, float defaultValue, const std::string &name)
    {
        auto r = configSwitch<T>(paramId, 0, 1, defaultValue, name, {"Off", "On"});
        r->randomizeEnabled = false;
        return r;
    }

    void snapCalculatedNames();

    void onSurgeError(const std::string &msg, const std::string &title,
                      const SurgeStorage::ErrorType &t) override
    {
        WARN("Surge Reported an Error");
        WARN("%s", title.c_str());
        WARN("%s", msg.c_str());
    }

    bool isCoupledToGlobalStyle{true};
    style::XTStyle::Style localStyle{style::XTStyle::LIGHT};
    style::XTStyle::LightColor localDisplayRegionColor{style::XTStyle::ORANGE},
        localModulationColor{style::XTStyle::BLUE}, localControlValueColor{style::XTStyle::ORANGE},
        localPowerButtonColor{style::XTStyle::GREEN};

};
inline void XTModule::snapCalculatedNames()
{
    for (auto *pq : paramQuantities)
    {
        if (auto *s = dynamic_cast<modules::CalculatedName *>(pq))
        {
            pq->name = s->getCalculatedName();
        }
    }
}
}
}
}

namespace sst::surgext_rack::modules {
struct SurgeParameterParamQuantity : public rack::engine::ParamQuantity, CalculatedName
{
    inline XTModule *xtm() { return static_cast<XTModule *>(module); }
    inline Parameter *surgepar()
    {
        auto mc = xtm();
        if (!mc)
        {
            return nullptr;
        }
        auto par = mc->surgeDisplayParameterForParamId(paramId);
        return par;
    }

    std::function<void(SurgeParameterParamQuantity *)> customRandomize{nullptr};
    void randomize() override
    {
        if (customRandomize)
            customRandomize(this);
        else
            ParamQuantity::randomize();
    }

    virtual void setDisplayValueString(std::string s) override
    {
        auto par = surgepar();
        if (!par)
        {
            ParamQuantity::setDisplayValueString(s);
            return;
        }

        std::string emsg;
        par->set_value_from_string(s, emsg);
        setValue(par->get_value_f01());
    }

    virtual std::string getLabel() override
    {
        auto par = surgepar();
        if (!par)
        {
            return ParamQuantity::getLabel();
        }

        return par->get_name();
    }

    std::string getCalculatedName() override
    {
        auto par = surgepar();
        if (!par)
        {
            return "Surge Parameter";
        }

        return par->get_name();
    }

    virtual std::string getDisplayValueString() override
    {
        return getDisplayValueStringForValue(getValue());
    }
    virtual std::string getDisplayValueStringForValue(float f)
    {
        auto par = surgepar();
        if (!par)
        {
            return ParamQuantity::getDisplayValueString();
        }

        /* So the param quantity has the value of the knob but that gets rounded
         * to the nearest temposync in setval_f01. Fine whatever except when stringifying
         * then we need to use the rounded value to match.
         */
        if (par->temposync)
            f = par->get_value_f01();

        char txt[256];
        par->get_display(txt, true, f);
        char talt[256];
        par->get_display_alt(talt, true, f);
        if (strlen(talt))
        {
            if (std::string(talt) == " ")
                return std::string(txt);
            return std::string(txt) + " (" + talt + ")";
        }

        if (par->temposync)
        {
            return std::string(txt) + " @ " +
                   fmt::format("{:.1f}bpm", xtm()->storage->temposyncratio * 120);
        }
        return txt;
    }
};
}

namespace sst::surgext_rack::modules {
struct SurgeParameterModulationQuantity : public rack::engine::ParamQuantity, CalculatedName
{
    bool abbreviate = false;
    inline XTModule *xtm() { return static_cast<XTModule *>(module); }
    inline Parameter *surgepar()
    {
        auto mc = xtm();
        if (!mc)
        {
            return nullptr;
        }
        auto par = mc->surgeDisplayParameterForModulatorParamId(paramId);
        return par;
    }

    virtual void setDisplayValueString(std::string s) override
    {
        auto par = surgepar();
        if (!par)
        {
            ParamQuantity::setDisplayValueString(s);
            return;
        }

        std::string emsg;
        bool valid{false};
        float v = par->calculate_modulation_value_from_string(s, emsg, valid);
        if (valid && par->extend_range)
            v = par->get_extended(v);
        if (valid)
            setValue(v);
    }

    std::string baseName{"MOD_ERROR"};

    virtual std::string getLabel() override
    {
        auto par = surgepar();
        if (!par)
        {
            return ParamQuantity::getLabel() + " SOFTWARE ERROR";
        }

        return getCalculatedName();
    }

    std::string getCalculatedName() override
    {
        auto par = surgepar();
        if (!par)
        {
            return baseName + " to Unkown Surge Parameter";
        }

        return baseName + " to " + par->get_name();
    }

    virtual std::string getDisplayValueString() override
    {
        auto par = surgepar();
        if (!par)
        {
            return ParamQuantity::getDisplayValueString();
        }

        char txt[256], txt2[256];
        ModulationDisplayInfoWindowStrings iw;
        auto norm = surgepar()->val_max.f - surgepar()->val_min.f;
        par->get_display_of_modulation_depth(txt, getValue() * norm, true,
                                             Parameter::ModulationDisplayMode::InfoWindow, &iw);
        par->get_display_of_modulation_depth(txt2, getValue() * norm, true,
                                             Parameter::ModulationDisplayMode::Menu);

        if (iw.val.empty())
            return txt2;

        std::ostringstream oss;
        oss << iw.dvalplus << "\n"
            << iw.val << " @ 0v\n"
            << iw.valplus << " @ 10v\n"
            << iw.valminus << " @ -10v";
        if (abbreviate)
            return iw.dvalplus;
        return oss.str();
    }


};
}

namespace sst {
namespace surgext_rack {
namespace fx {
template <int fxType>
struct FX : modules::XTModule, sst::rackhelpers::module_connector::NeighborConnectable_V1 {
    static constexpr int n_mod_inputs{4};
    static constexpr int n_arbitrary_switches{4};

    enum ParamIds
    {
        FX_PARAM_0 = 0,
        FX_MOD_PARAM_0 = FX_PARAM_0 + n_fx_params,
        FX_SPECIFIC_PARAM_0 = FX_MOD_PARAM_0 + n_fx_params * n_mod_inputs,
        NUM_PARAMS = FX_SPECIFIC_PARAM_0 + FXConfig<fxType>::specificParamCount()
    };

    enum InputIds
    {
        INPUT_L,
        INPUT_R,
        SIDEBAND_L,
        SIDEBAND_R,
        INPUT_CLOCK,
        MOD_INPUT_0,
        INPUT_SPECIFIC_0 = MOD_INPUT_0 + n_mod_inputs,
        NUM_INPUTS = INPUT_SPECIFIC_0 + FXConfig<fxType>::extraInputs()
    };

    enum OutputIds
    {
        OUTPUT_L,
        OUTPUT_R,
        EXTRA_OUTPUT_0,
        NUM_OUTPUTS = EXTRA_OUTPUT_0 + FXConfig<fxType>::extraOutputs()
    };

    enum LightIds
    {
        NUM_LIGHTS
    };

    modules::MonophonicModulationAssistant<FX<fxType>, FXConfig<fxType>::numParams(), FX_PARAM_0,
                                           n_mod_inputs, MOD_INPUT_0>
        modAssist;

    modules::ModulationAssistant<FX<fxType>, FXConfig<fxType>::numParams(), FX_PARAM_0,
                                 n_mod_inputs, MOD_INPUT_0>
        polyModAssist;

    FX() : XTModule(), halfbandIN(6, true)
    {
        std::lock_guard<std::mutex> lgxt(xtSurgeCreateMutex);
        setupSurge();
        config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);

        for (auto &t : extraInputTriggers)
            t.state = false;

        int lastParam{0};
        for (int i = 0; i < n_fx_params; ++i)
        {
            if (fxstorage->p[i].ctrltype != ct_none)
                lastParam = i;
            configParam<modules::SurgeParameterParamQuantity>(FX_PARAM_0 + i, 0, 1,
                                                              fxstorage->p[i].get_value_f01());
        }

        if (lastParam != FXConfig<fxType>::numParams() - 1)
        {
            std::cout << "WARNING: " << fx_type_names[fxType] << " last non-param is "
                      << lastParam + 1 << " not " << FXConfig<fxType>::numParams() << std::endl;
        }

        for (int i = 0; i < n_fx_params * n_mod_inputs; ++i)
        {
            std::string name{"Mod"};
            name += std::to_string(i % 4 + 1);

            configParamNoRand<modules::SurgeParameterModulationQuantity>(FX_MOD_PARAM_0 + i, -1, 1,
                                                                         0, name)
                ->baseName = name;
        }

        FXConfig<fxType>::configSpecificParams(this);

        configInput(INPUT_L, "Left");
        configInput(INPUT_R, "Right");
        configInput(INPUT_CLOCK, "Clock/Tempo CV");

        configInput(SIDEBAND_L, "Left Sideband");
        configInput(SIDEBAND_R, "Right Sideband");

        for (int m = 0; m < n_mod_inputs; ++m)
        {
            auto s = std::string("Modulation Signal ") + std::to_string(m + 1);
            configInput(MOD_INPUT_0 + m, s);
        }
        FXConfig<fxType>::configExtraInputs(this);
        configOutput(OUTPUT_L, "Left (or Mono merged)");
        configOutput(OUTPUT_R, "Right");
        FXConfig<fxType>::configExtraOutputs(this);

        modAssist.initialize(this);
        polyModAssist.initialize(this);
        if (maxPresets > 0)
            loadPreset(0, false, true);

        configBypass(INPUT_L, OUTPUT_L);
        configBypass(INPUT_R, OUTPUT_R);
        snapCalculatedNames();
    }

    void moduleSpecificSampleRateChange() override
    {
        clockProc.setSampleRate(APP->engine->getSampleRate());
    }
    typedef modules::ClockProcessor<FX<fxType>> clockProcessor_t;
    clockProcessor_t clockProc;

    // If you need em you have a scnmidt trigger for extra inputs
    // add one since 0 length arrays are gross and its just memory smidges
    // this could obviously be better with complicated specializations and enable ifs
    rack::dsp::SchmittTrigger extraInputTriggers[FXConfig<fxType>::extraSchmidtTriggers()];

    float modScales[n_fx_params];
    std::atomic<int> loadedPreset{-1}, maxPresets{0};
    std::atomic<bool> presetIsDirty{false};
    std::vector<Surge::Storage::FxUserPreset::Preset> presets;

    std::atomic<bool> polyphonicMode{false};

    sst::filters::HalfRate::HalfRateFilter halfbandIN;
    std::atomic<bool> sidebandAttached{false};

    void setupSurge()
    {
        setupSurgeCommon(NUM_PARAMS, false, true);

        fxstorage = &(storage->getPatch().fx[0]);
        // Surge proper defaults this to true then uses the patch loader to set it to false
        // based on version. We don't do the patch load here so...
        for (int i = 0; i < n_fx_params; ++i)
            fxstorage->p[i].deactivated = false;
        fxstorage->type.val.i = fxType;

        setupStorageRanges(&(fxstorage->type), &(fxstorage->p[n_fx_params - 1]));
        copyGlobaldataSubset(storage_id_start, storage_id_end);

        surge_effect.reset(
            spawn_effect(fxType, storage.get(), fxstorage, storage->getPatch().globaldata));
        surge_effect->init();
        surge_effect->init_ctrltypes();
        surge_effect->init_default_values();

        // This is a micro-hack to stop ranges blowing up
        fxstorage->return_level.id = -1;

        for (int i = 0; i < n_fx_params; ++i)
        {
            modScales[i] = fxstorage->p[i].val_max.f - fxstorage->p[i].val_min.f;
        }

        memset(processedL, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);
        memset(processedR, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);

        if (FXConfig<fxType>::usesPresets())
        {
            auto sect = storage->getSnapshotSection("fx");
            if (sect)
            {
                auto type = sect->FirstChildElement();
                while (type)
                {
                    int i;

                    if (type->Value() && strcmp(type->Value(), "type") == 0 &&
                        type->QueryIntAttribute("i", &i) == TIXML_SUCCESS && i == fxType)
                    {
                        auto kid = type->FirstChildElement();
                        while (kid)
                        {
                            if (strcmp(kid->Value(), "snapshot") == 0)
                            {
                                auto p = Surge::Storage::FxUserPreset::Preset();
                                p.type = fxType;
                                for (int q = 0; q < n_fx_params; ++q)
                                {
                                    // Set up with default values remember q index
                                    if (fxstorage->p[q].valtype == vt_float)
                                    {
                                        p.p[q] = fxstorage->p[q].val.f;
                                    }
                                    if (fxstorage->p[q].valtype == vt_int)
                                    {
                                        p.p[q] = fxstorage->p[q].val.i;
                                    }
                                    if (fxstorage->p[q].valtype == vt_bool)
                                    {
                                        p.p[q] = fxstorage->p[q].val.b;
                                    }
                                }
                                storage->fxUserPreset->readFromXMLSnapshot(p, kid);
                                p.isFactory = true;
                                presets.push_back(p);
                            }
                            kid = kid->NextSiblingElement();
                        }
                    }
                    type = type->NextSiblingElement();
                }
            }
            auto xtrapresets = storage->fxUserPreset->getPresetsForSingleType(fxType);
            for (auto p : xtrapresets)
                presets.push_back(p);
            maxPresets = presets.size();
        }
    }

    Parameter *surgeDisplayParameterForParamId(int paramId) override
    {
        if (paramId < FX_PARAM_0 || paramId >= FX_PARAM_0 + n_fx_params)
            return nullptr;

        return &fxstorage->p[paramId - FX_PARAM_0];
    }

    static int paramModulatedBy(int modIndex)
    {
        int offset = modIndex - FX_MOD_PARAM_0;
        if (offset >= n_mod_inputs * (n_fx_params + 1) || offset < 0)
            return -1;
        return offset / n_mod_inputs;
    }

    Parameter *surgeDisplayParameterForModulatorParamId(int modParamId) override
    {
        auto paramId = paramModulatedBy(modParamId);
        if (paramId < FX_PARAM_0 || paramId >= FX_PARAM_0 + n_fx_params)
            return nullptr;

        return &fxstorage->p[paramId - FX_PARAM_0];
    }

    static int modulatorIndexFor(int baseParam, int modulator)
    {
        int offset = baseParam - FX_PARAM_0;
        return FX_MOD_PARAM_0 + offset * n_mod_inputs + modulator;
    }

    float modulationDisplayValue(int paramId) override
    {
        int idx = paramId - FX_PARAM_0;
        if (idx < 0 || idx >= n_fx_params)
            return 0;
        if (polyphonicMode)
            return polyModAssist.modvalues[idx][0];
        else
            return modAssist.modvalues[idx];
    }

    bool isBipolar(int paramId) override
    {
        if (paramId >= FX_PARAM_0 && paramId <= FX_PARAM_0 + n_fx_params)
        {
            return fxstorage->p[paramId - FX_PARAM_0].is_bipolar();
        }
        return false;
    }

    float value01for(int i, float f)
    {
        const auto &p = fxstorage->p[i];
        if (p.ctrltype == ct_none)
            return 0;

        if (p.valtype == vt_float)
        {
            return (f - p.val_min.f) / (p.val_max.f - p.val_min.f);
        }
        if (p.valtype == vt_int)
        {
            return Parameter::intScaledToFloat(f, p.val_max.i, p.val_min.i);
        }
        if (p.valtype == vt_bool)
        {
            return f > 0.5 ? 1 : 0;
        }
        return 0;
    }

    

    void loadPreset(int which, bool recordHistory = true, bool resetDefaults = false)
    {
        

        const auto &ps = presets[which];

        for (int i = 0; i < n_fx_params; ++i)
        {
            paramQuantities[FX_PARAM_0 + i]->setValue(value01for(i, ps.p[i]));
            if (resetDefaults)
            {
                paramQuantities[FX_PARAM_0 + i]->defaultValue =
                    paramQuantities[FX_PARAM_0 + i]->getValue();
            }
        }

        FXConfig<fxType>::loadPresetOntoSpecificParams(this, ps);

        loadedPreset = (int)which;
        presetIsDirty = false;
    }

    std::string getName() override { return std::string("FX<") + fx_type_names[fxType] + ">"; }

    int bufferPos{0};
    uint32_t lastNanCheck{0};
    float bufferL alignas(16)[MAX_POLY][BLOCK_SIZE], bufferR alignas(16)[MAX_POLY][BLOCK_SIZE];
    float modulatorL alignas(16)[MAX_POLY][BLOCK_SIZE], modulatorR
        alignas(16)[MAX_POLY][BLOCK_SIZE];
    float processedL alignas(16)[MAX_POLY][BLOCK_SIZE], processedR
        alignas(16)[MAX_POLY][BLOCK_SIZE];

    float extraOutputs alignas(
        16)[std::max(1, FXConfig<fxType>::extraOutputs())][MAX_POLY][BLOCK_SIZE];

    void process(const typename rack::Module::ProcessArgs &args) override
    {
        // auto fpuguard = sst::plugininfra::cpufeatures::FPUStateGuard();

        if constexpr (FXConfig<fxType>::usesClock())
        {
            if (inputs[INPUT_CLOCK].isConnected())
                clockProc.process(this, INPUT_CLOCK);
            else
                clockProc.disconnect(this);
        }

        if (polyphonicMode)
        {
            processPoly(args);
        }
        else
        {
            processMono(args);
        }
    }
    void processMono(const typename rack::Module::ProcessArgs &args)
    {
        static constexpr float scaleFac{FXConfig<fxType>::rescaleInputFactor()},
            unscaleFac{1.0f / scaleFac};
        float inl = inputs[INPUT_L].getVoltageSum() * RACK_TO_SURGE_OSC_MUL * scaleFac;
        float inr = inputs[INPUT_R].getVoltageSum() * RACK_TO_SURGE_OSC_MUL * scaleFac;

        outputs[OUTPUT_L].setChannels(1);
        outputs[OUTPUT_R].setChannels(1);

        for (int i = 0; i < FXConfig<fxType>::extraOutputs(); ++i)
            outputs[EXTRA_OUTPUT_0 + i].setChannels(1);

        if (inputs[INPUT_L].isConnected() && !inputs[INPUT_R].isConnected())
        {
            bufferL[0][bufferPos] = inl;
            bufferR[0][bufferPos] = inl;
        }
        else
        {
            bufferL[0][bufferPos] = inl;
            bufferR[0][bufferPos] = inr;
        }

        if constexpr (FXConfig<fxType>::usesSideband())
        {
            if (inputs[SIDEBAND_L].isConnected() && !inputs[SIDEBAND_R].isConnected())
            {
                float ml = inputs[SIDEBAND_L].getVoltageSum() * RACK_TO_SURGE_OSC_MUL;
                modulatorL[0][bufferPos] = ml;
                modulatorR[0][bufferPos] = ml;
            }
            else
            {
                modulatorL[0][bufferPos] =
                    inputs[SIDEBAND_L].getVoltageSum() * RACK_TO_SURGE_OSC_MUL;
                modulatorR[0][bufferPos] =
                    inputs[SIDEBAND_R].getVoltageSum() * RACK_TO_SURGE_OSC_MUL;
            }
            bool wasSB = sidebandAttached;
            sidebandAttached = inputs[SIDEBAND_L].isConnected() || inputs[SIDEBAND_R].isConnected();
            if (FXConfig<fxType>::usesSidebandOversampled())
            {
                if (sidebandAttached && !wasSB)
                {
                    halfbandIN.reset();
                }
            }
        }
        bufferPos++;

        if (bufferPos >= BLOCK_SIZE)
        {
            modAssist.setupMatrix(this);
            modAssist.updateValues(this);

            std::memcpy(processedL, bufferL, BLOCK_SIZE * sizeof(float));
            std::memcpy(processedR, bufferR, BLOCK_SIZE * sizeof(float));

            if constexpr (FXConfig<fxType>::usesSideband())
            {
                std::memcpy(storage->audio_in_nonOS[0], modulatorL, BLOCK_SIZE * sizeof(float));
                std::memcpy(storage->audio_in_nonOS[1], modulatorR, BLOCK_SIZE * sizeof(float));
                if (FXConfig<fxType>::usesSidebandOversampled())
                {
                    halfbandIN.process_block_U2(modulatorL[0], modulatorR[0], storage->audio_in[0],
                                                storage->audio_in[1], BLOCK_SIZE_OS);
                }
            }
            if constexpr (FXConfig<fxType>::specificParamCount() > 0)
            {
                FXConfig<fxType>::processSpecificParams(this);
            }

            for (int i = 0; i < FXConfig<fxType>::numParams(); ++i)
            {
                fxstorage->p[i].set_value_f01(modAssist.basevalues[i]);
            }

            FXConfig<fxType>::processExtraInputs(this, 0);
            FXConfig<fxType>::adjustParamsBasedOnState(this);

            copyGlobaldataSubset(storage_id_start, storage_id_end);

            auto *oap = &fxstorage->p[0];
            auto *eap = &fxstorage->p[FXConfig<fxType>::numParams() - 1];
            auto &pt = storage->getPatch().globaldata;
            int idx = 0;
            while (oap <= eap)
            {
                if (oap->valtype == vt_float)
                {
                    pt[oap->id].f += modAssist.modvalues[idx] * modScales[idx];
                }
                idx++;
                oap++;
            }

            surge_effect->process_ringout(processedL[0], processedR[0], true);

            FXConfig<fxType>::populateExtraOutputs(this, 0, surge_effect.get());

            if constexpr (FXConfig<fxType>::nanCheckOutput())
            {
                if (lastNanCheck == 0)
                {
                    bool isNumber{true};
                    for (int ns = 0; ns < BLOCK_SIZE; ++ns)
                    {
                        isNumber = isNumber && std::isfinite(processedL[0][ns]);
                        isNumber = isNumber && std::isfinite(processedR[0][ns]);
                    }

                    if (!isNumber)
                    {
                        reinitialize();
                    }
                }
                lastNanCheck = (lastNanCheck + 1) % 32;
            }

            bufferPos = 0;
        }

        float outl = processedL[0][bufferPos] * unscaleFac;
        float outr = processedR[0][bufferPos] * unscaleFac;

        if constexpr (FXConfig<fxType>::softclipOutput())
        {
            // FIXME we can do this simd-wise of course
            outl = std::clamp(outl, -1.5f, 1.5f);
            outr = std::clamp(outr, -1.5f, 1.5f);
            outl = outl - 4.0 / 27.0 * outl * outl * outl;
            outr = outr - 4.0 / 27.0 * outr * outr * outr;
        }

        outl *= SURGE_TO_RACK_OSC_MUL;
        outr *= SURGE_TO_RACK_OSC_MUL;
        if (outputs[OUTPUT_L].isConnected() && !outputs[OUTPUT_R].isConnected())
        {
            outputs[OUTPUT_L].setVoltage(0.5 * (outl + outr));
        }
        else
        {
            outputs[OUTPUT_L].setVoltage(outl);
            outputs[OUTPUT_R].setVoltage(outr);
        }

        for (int i = 0; i < FXConfig<fxType>::extraOutputs(); ++i)
        {
            outputs[EXTRA_OUTPUT_0 + i].setVoltage(extraOutputs[i][0][bufferPos]);
        }
    }

    int lastNChan{-1};

    void reinitialize(int c = -1)
    {
        if (c == -1)
        {
            // Re-initialize everything
            surge_effect->init();
            halfbandIN.reset();
            for (const auto &s : surge_effect_poly)
                if (s)
                {
                    s->init();
                }

            // We are just starting over so clear all the buffers
            bufferPos = 0;

            memset(processedL, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);
            memset(processedR, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);
            memset(bufferL, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);
            memset(bufferR, 0, sizeof(float) * MAX_POLY * BLOCK_SIZE);
        }
        else
        {
            // poly nan case
            surge_effect_poly[c]->init();

            // Other buffers are fine. Just clear mine. And don't change
            // pos since the zeros wont hurt me.
            memset(processedL[c], 0, sizeof(float) * BLOCK_SIZE);
            memset(processedR[c], 0, sizeof(float) * BLOCK_SIZE);
            memset(bufferL[c], 0, sizeof(float) * BLOCK_SIZE);
            memset(bufferR[c], 0, sizeof(float) * BLOCK_SIZE);
        }
    }

    void guaranteePolyFX(int chan)
    {
        for (int i = 0; i < chan; ++i)
        {
            if (!surge_effect_poly[i])
            {
                surge_effect_poly[i].reset(
                    spawn_effect(fxType, storage.get(), fxstorage, storage->getPatch().globaldata));
                surge_effect_poly[i]->init();
            }
        }
    }

    void processPoly(const typename rack::Module::ProcessArgs &args)
    {
        static constexpr float scaleFac{FXConfig<fxType>::rescaleInputFactor()},
            unscaleFac{1.0f / scaleFac};

        auto chan = std::max({1, inputs[INPUT_L].getChannels(), inputs[INPUT_R].getChannels()});

        if (chan != lastNChan)
        {
            lastNChan = chan;
            guaranteePolyFX(chan);
            reinitialize();
        }

        outputs[OUTPUT_L].setChannels(chan);
        outputs[OUTPUT_R].setChannels(chan);

        for (int i = 0; i < FXConfig<fxType>::extraOutputs(); ++i)
            outputs[EXTRA_OUTPUT_0 + i].setChannels(chan);

        for (int c = 0; c < chan; ++c)
        {
            float inl = inputs[INPUT_L].getVoltage(c) * RACK_TO_SURGE_OSC_MUL * scaleFac;
            float inr = inputs[INPUT_R].getVoltage(c) * RACK_TO_SURGE_OSC_MUL * scaleFac;

            if (inputs[INPUT_L].isConnected() && !inputs[INPUT_R].isConnected())
            {
                bufferL[c][bufferPos] = inl;
                bufferR[c][bufferPos] = inl;
            }
            else
            {
                bufferL[c][bufferPos] = inl;
                bufferR[c][bufferPos] = inr;
            }
        }

        // FIXME make this poly
        if constexpr (FXConfig<fxType>::usesSideband())
        {
            if (inputs[SIDEBAND_L].isConnected() && !inputs[SIDEBAND_R].isConnected())
            {
                float ml = inputs[SIDEBAND_L].getVoltageSum();
                modulatorL[0][bufferPos] = ml;
                modulatorR[0][bufferPos] = ml;
            }
            else
            {
                modulatorL[0][bufferPos] = inputs[SIDEBAND_L].getVoltageSum();
                modulatorR[0][bufferPos] = inputs[SIDEBAND_R].getVoltageSum();
            }
        }

        bufferPos++;

        if (bufferPos >= BLOCK_SIZE)
        {
            polyModAssist.setupMatrix(this);
            polyModAssist.updateValues(this);

            if constexpr (FXConfig<fxType>::specificParamCount() > 0)
            {
                FXConfig<fxType>::processSpecificParams(this);
            }

            for (int i = 0; i < FXConfig<fxType>::numParams(); ++i)
            {
                fxstorage->p[i].set_value_f01(polyModAssist.basevalues[i]);
            }

            for (int c = 0; c < chan; ++c)
            {
                FXConfig<fxType>::processExtraInputs(this, c);

                std::memcpy(processedL[c], bufferL[c], BLOCK_SIZE * sizeof(float));
                std::memcpy(processedR[c], bufferR[c], BLOCK_SIZE * sizeof(float));

                if constexpr (FXConfig<fxType>::usesSideband())
                {
                    std::memcpy(storage->audio_in_nonOS[0], modulatorL, BLOCK_SIZE * sizeof(float));
                    std::memcpy(storage->audio_in_nonOS[1], modulatorR, BLOCK_SIZE * sizeof(float));
                }

                copyGlobaldataSubset(storage_id_start, storage_id_end);

                auto *oap = &fxstorage->p[0];
                auto *eap = &fxstorage->p[FXConfig<fxType>::numParams() - 1];
                auto &pt = storage->getPatch().globaldata;
                int idx = 0;
                while (oap <= eap)
                {
                    if (oap->valtype == vt_float)
                    {
                        pt[oap->id].f += polyModAssist.modvalues[idx][c] * modScales[idx];
                    }
                    idx++;
                    oap++;
                }

                surge_effect_poly[c]->process_ringout(processedL[c], processedR[c], true);

                FXConfig<fxType>::populateExtraOutputs(this, c, surge_effect_poly[c].get());
            }

            if constexpr (FXConfig<fxType>::nanCheckOutput())
            {
                if (lastNanCheck == 0)
                {
                    for (int c = 0; c < chan; ++c)
                    {

                        bool isNumber{true};
                        for (int ns = 0; ns < BLOCK_SIZE; ++ns)
                        {
                            isNumber = isNumber && std::isfinite(processedL[c][ns]);
                            isNumber = isNumber && std::isfinite(processedR[c][ns]);
                        }

                        if (!isNumber)
                        {
                            reinitialize(c);
                        }
                    }
                }
                lastNanCheck = (lastNanCheck + 1) % 32;
            }
            bufferPos = 0;
        }

        bool mono = outputs[OUTPUT_L].isConnected() && !outputs[OUTPUT_R].isConnected();
        for (int c = 0; c < chan; ++c)
        {
            float outl = processedL[c][bufferPos] * unscaleFac;
            float outr = processedR[c][bufferPos] * unscaleFac;

            if constexpr (FXConfig<fxType>::softclipOutput())
            {
                // FIXME we can do this simd-wise of course
                outl = std::clamp(outl, -1.5f, 1.5f);
                outr = std::clamp(outr, -1.5f, 1.5f);
                outl = outl - 4.0 / 27.0 * outl * outl * outl;
                outr = outr - 4.0 / 27.0 * outr * outr * outr;
            }
            outl *= SURGE_TO_RACK_OSC_MUL;
            outr *= SURGE_TO_RACK_OSC_MUL;

            if (mono)
            {
                outputs[OUTPUT_L].setVoltage(0.5 * (outl + outr), c);
            }
            else
            {
                outputs[OUTPUT_L].setVoltage(outl, c);
                outputs[OUTPUT_R].setVoltage(outr, c);
            }

            for (int i = 0; i < FXConfig<fxType>::extraOutputs(); ++i)
            {
                outputs[EXTRA_OUTPUT_0 + i].setVoltage(extraOutputs[i][c][bufferPos], c);
            }
        }
    }

    int polyChannelCount()
    {
        if (polyphonicMode)
            return std::max(inputs[INPUT_L].getChannels(), 1);
        else
            return 1; // these arent' polyphonic fx
    }

    void activateTempoSync()
    {
        auto p = &fxstorage->p[0];
        auto pe = &fxstorage->p[n_fx_params - 1];
        while (p <= pe)
        {
            if (p->can_temposync())
                p->temposync = true;
            ++p;
        }
    }
    void deactivateTempoSync()
    {
        auto p = &fxstorage->p[0];
        auto pe = &fxstorage->p[n_fx_params - 1];
        while (p <= pe)
        {
            if (p->can_temposync())
                p->temposync = false;
            ++p;
        }
    }

    json_t *makeModuleSpecificJson() override
    {
        auto fx = json_object();
        if (FXConfig<fxType>::usesPresets())
        {
            if (loadedPreset >= 0)
            {
                json_object_set_new(fx, "loadedPreset", json_integer(loadedPreset));
                json_object_set_new(fx, "presetName",
                                    json_string(presets[loadedPreset].name.c_str()));
                json_object_set_new(fx, "presetIsDirty", json_boolean(presetIsDirty));
            }
        }
        if (FXConfig<fxType>::usesClock())
        {
            clockProc.toJson(fx);
        }

        if (FXConfig<fxType>::allowsPolyphony())
        {
            json_object_set_new(fx, "polyphonicMode", json_boolean(polyphonicMode));
        }

        // A little bit of defensive code I added in 2.2 in case we change int bounds in the
        // future. I don't read this yet but I do write it
        auto *paramNatural = json_array();
        for (int i = 0; i < n_fx_params; ++i)
        {
            const auto &p = fxstorage->p[i];
            auto *parJ = json_object();

            json_object_set(parJ, "index", json_integer(i));
            json_object_set(parJ, "valtype", json_integer(p.valtype));
            switch (p.valtype)
            {
            case vt_float:
                json_object_set(parJ, "val_f", json_real(p.val.f));
                break;
            case vt_int:
                json_object_set(parJ, "val_i", json_integer(p.val.i));
                break;
            case vt_bool:
                json_object_set(parJ, "val_b", json_boolean(p.val.b));
                break;
            }
            json_array_append_new(paramNatural, parJ);
        }

        json_object_set_new(fx, "paramNatural", paramNatural);

        return fx;
    }

    void readModuleSpecificJson(json_t *modJ) override
    {
        if (FXConfig<fxType>::usesPresets())
        {
            auto lp = json_object_get(modJ, "loadedPreset");
            auto pn = json_object_get(modJ, "presetName");
            auto pd = json_object_get(modJ, "presetIsDirty");
            if (lp && pn && pd)
            {
                auto lpc = json_integer_value(lp);
                auto pnc = std::string(json_string_value(pn));
                auto pdc = json_boolean_value(pd);
                if (lpc >= 0 && lpc < (int)presets.size() && presets[lpc].name == pnc)
                {
                    loadedPreset = lpc;
                    presetIsDirty = pdc;
                }
            }
        }
        if (FXConfig<fxType>::usesClock())
        {
            clockProc.fromJson(modJ);
        }

        if (FXConfig<fxType>::allowsPolyphony())
        {
            auto pm = json_object_get(modJ, "polyphonicMode");
            if (pm)
            {
                auto pmv = json_boolean_value(pm);
                polyphonicMode = pmv;
            }
        }
    }

    std::unique_ptr<Effect> surge_effect;
    std::array<std::unique_ptr<Effect>, MAX_POLY> surge_effect_poly;
    FxStorage *fxstorage{nullptr};

  void setState(int id, float value) override {
    json_t* root = dataToJson();
    if (!json_is_object(root)) { json_decref(root); root = json_object(); }
    switch (id) {
      case 0: json_object_set_new(root, "streamingVersion", json_integer(static_cast<long long>(value))); break;
      case 1: json_object_set_new(root, "isCoupledToGlobalStyle", json_boolean(value != 0.f)); break;
      case 2: json_object_set_new(root, "localStyle", json_integer(static_cast<long long>(value))); break;
      case 3: json_object_set_new(root, "localDisplayRegionColor", json_integer(static_cast<long long>(value))); break;
      case 4: json_object_set_new(root, "localModulationColor", json_integer(static_cast<long long>(value))); break;
      case 5: json_object_set_new(root, "localControlValueColor", json_integer(static_cast<long long>(value))); break;
      case 6: json_object_set_new(root, "localPowerButtonColor", json_integer(static_cast<long long>(value))); break;
      case 7: json_object_set_new(root, "clockStyle", json_integer(static_cast<long long>(value))); break;
      case 8: json_object_set_new(root, "loadedPreset", json_integer(static_cast<long long>(value))); break;
      case 9: json_object_set_new(root, "presetIsDirty", json_boolean(value != 0.f)); break;
      case 10: json_object_set_new(root, "polyphonicMode", json_boolean(value != 0.f)); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
template <> constexpr int FXConfig<fxt_reverb>::numParams() { return 11; }

template <> constexpr int FXConfig<fxt_reverb>::specificParamCount() { return 2; }

template <> void FXConfig<fxt_reverb>::configSpecificParams(FX<fxt_reverb> *m)
{
    typedef FX<fxt_reverb> fx_t;
    m->configOnOff(fx_t::FX_SPECIFIC_PARAM_0, 1, "Enable Low Cut");
    m->configOnOff(fx_t::FX_SPECIFIC_PARAM_0 + 1, 1, "Enable High Cut");
}

template <> void FXConfig<fxt_reverb>::processSpecificParams(FX<fxt_reverb> *m)
{
    typedef FX<fxt_reverb> fx_t;
    FXLayoutHelper::processDeactivate(m, Reverb1Effect::rev1_lowcut, fx_t::FX_SPECIFIC_PARAM_0);
    FXLayoutHelper::processDeactivate(m, Reverb1Effect::rev1_highcut,
                                      fx_t::FX_SPECIFIC_PARAM_0 + 1);
}

template <>
void FXConfig<fxt_reverb>::loadPresetOntoSpecificParams(
    FX<fxt_reverb> *m, const Surge::Storage::FxUserPreset::Preset &ps)
{
    typedef FX<fxt_reverb> fx_t;
    typedef Reverb1Effect sx_t;
    m->params[fx_t::FX_SPECIFIC_PARAM_0].setValue(ps.da[sx_t::rev1_lowcut] ? 0 : 1);
    m->params[fx_t::FX_SPECIFIC_PARAM_0 + 1].setValue(ps.da[sx_t::rev1_highcut] ? 0 : 1);
}

template <>
bool FXConfig<fxt_reverb>::isDirtyPresetVsSpecificParams(
    FX<fxt_reverb> *m, const Surge::Storage::FxUserPreset::Preset &ps)
{
    typedef FX<fxt_reverb> fx_t;
    typedef Reverb1Effect sx_t;
    auto p0 = m->params[fx_t::FX_SPECIFIC_PARAM_0].getValue() > 0.5;
    auto p1 = m->params[fx_t::FX_SPECIFIC_PARAM_0 + 1].getValue() > 0.5;
    return !(p0 == !ps.da[sx_t::rev1_lowcut] && p1 == !ps.da[sx_t::rev1_highcut]);
}
}
}
}

using RackWebModule = sst::surgext_rack::fx::FX<fxt_reverb>;
RACK_WEB_EXPORTS(RackWebModule)
