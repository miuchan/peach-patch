// Automatically isolated from the original Rack DSP module for Venom/WaveMangler.
// Source: https://github.com/DaveBenham/VenomModules (src/WaveMangler.cpp; registered in src/WaveMangler.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"

#include "Filter.hpp"
#include "math.hpp"

namespace Venom {
struct VenomModule : Module {

  int currentTheme = 0;
  int defaultTheme = 0;
  int defaultDarkTheme = 0;
  int prevTheme = -1;
  int prevDarkTheme = -1;
  int oversampleStages = 0; // default to 0 = unused
  virtual void setOversample(){};
  bool drawn = false;
  bool paramsInitialized = false;
  bool extProcNeeded = true;
  std::string moduleName = "";bool lockableParams = false;struct ParamExtension {
    bool locked;
    bool initLocked;
    bool lockable;
    bool initDfltValid;
    bool inputLink;
    int  nameLink;
    float min, max, dflt, initDflt, factoryDflt;
    std::string factoryName;
    ParamExtension(){
      locked = false;
      initLocked = false;
      lockable = false;
      initDfltValid = false;
      factoryName = "";
      inputLink = false;
      nameLink = -1;
    }
  };
  
  struct PortExtension {
    int nameLink;
    int portNameLink;
    std::string factoryName;
    PortExtension(){
      factoryName = "";
      nameLink = -1;
      portNameLink = -1;
    }
  };

  void setLock(bool val, int id) {
    ParamExtension* e = &paramExtensions[id];
    if (e->lockable && e->locked != val){
      e->locked = val;
      ParamQuantity* q = paramQuantities[id];
      if (val){
        e->min = q->minValue;
        e->max = q->maxValue;
        e->dflt = q->defaultValue;
        q->description = "Locked";
        q->minValue = q->maxValue = q->defaultValue = q->getValue();
      }
      else {
        q->description = "";
        q->minValue = e->min;
        q->maxValue = e->max;
        q->defaultValue = e->dflt;
      }
    }
  }

  void setLockAll(bool val){
    for (int i=0; i<getNumParams(); i++)
      setLock(val, i);
  }

  std::vector<ParamExtension> paramExtensions;
  std::vector<PortExtension> inputExtensions;
  std::vector<PortExtension> outputExtensions;

  void venomConfig(int paramCnt, int inCnt, int outCnt, int lightCnt){
    config(paramCnt, inCnt, outCnt, lightCnt);
    for (int i=0; i<paramCnt; i++)
      paramExtensions.push_back(ParamExtension());
    for (int i=0; i<inCnt; i++)
      inputExtensions.push_back(PortExtension());
    for (int i=0; i<outCnt; i++)
      outputExtensions.push_back(PortExtension());
  }
  
  // Hack workaround for VCV bug when deleting a module - failure to trigger onExpanderChange()
  // Remove if/when VCV fixes the bug
  void onRemove(const RemoveEvent& e) override {
    if (rack::string::Version("2.5.0") < rack::string::Version(rack::APP_VERSION)) return;
    Module::ExpanderChangeEvent event;
    Module::Expander expander = getRightExpander();
    if (expander.module){
      expander.module->getLeftExpander().module = NULL;
      expander.module->getLeftExpander().moduleId = -1;
      event.side = 0;
      expander.module->onExpanderChange(event);
    }
    expander = getLeftExpander();
    if (expander.module){
      expander.module->getRightExpander().module = NULL;
      expander.module->getRightExpander().moduleId = -1;
      event.side = 1;
      expander.module->onExpanderChange(event);
    }
  }

  void initializeParams() {
    if (drawn && extProcNeeded){
      for (int i=0; i<getNumParams(); i++){
        ParamExtension* e = &paramExtensions[i];
        if (!paramsInitialized){
          ParamQuantity* q = paramQuantities[i];
          e->factoryDflt = q->defaultValue;
          if (e->initDfltValid) q->defaultValue = e->initDflt;
        }
        setLock(e->initLocked, i);
      }
      initialPostDrawnProcess();
      paramsInitialized = true;
      extProcNeeded = false;
    }
  }  

  void process(const ProcessArgs& args) override {
    initializeParams();
  }
  
  void processBypass(const ProcessArgs& args) override {
    initializeParams();
    Module::processBypass(args);
  }
  
  virtual void initialPostDrawnProcess(){}

  json_t* dataToJson() override {
    json_t* rootJ = json_object();
    for (int i=0; i<getNumParams(); i++){
      ParamExtension* e = &paramExtensions[i];
      ParamQuantity* pq = paramQuantities[i];
      std::string idStr = std::to_string(i);
      std::string nm = "paramLock"+idStr;
      json_object_set_new(rootJ, nm.c_str(), json_boolean(e->locked));
      nm = "paramDflt"+idStr;
      json_object_set_new(rootJ, nm.c_str(), json_real(e->locked ? e->dflt : pq->defaultValue));
      nm = "paramVal"+idStr;
      json_object_set_new(rootJ, nm.c_str(), json_real(pq->getImmediateValue()));
      nm = "paramName"+idStr;
      json_object_set_new(rootJ, nm.c_str(), json_string(pq->name.c_str()));
    }
    for (int i=0; i<getNumInputs(); i++){
      PortInfo* pi = inputInfos[i];
      std::string nm = "inputName"+std::to_string(i);
      json_object_set_new(rootJ, nm.c_str(), json_string(pi->name.c_str()));
    }
    for (int i=0; i<getNumOutputs(); i++){
      PortInfo* pi = outputInfos[i];
      std::string nm = "outputName"+std::to_string(i);
      json_object_set_new(rootJ, nm.c_str(), json_string(pi->name.c_str()));
    }
    json_object_set_new(rootJ, "currentTheme", json_integer(currentTheme));
    if (oversampleStages)
      json_object_set_new(rootJ, "oversampleStages", json_integer(oversampleStages));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    json_t* val;
    for (int i=0; i<getNumParams(); i++){
      ParamExtension* e = &paramExtensions[i];
      ParamQuantity* pq = paramQuantities[i];
      setLock(false, i);
      std::string idStr = std::to_string(i);
      std::string nm = "paramDflt"+idStr;
      if ((val = json_object_get(rootJ, nm.c_str()))){
        if (paramsInitialized) {
          pq->defaultValue = json_real_value(val);
        }
        else {
          e->initDflt = json_real_value(val);
          e->initDfltValid = true;
        }
      }
      nm = "paramVal"+idStr;
      if ((val = json_object_get(rootJ, nm.c_str())))
        pq->setImmediateValue(json_real_value(val));
      nm = "paramLock"+idStr;
      if ((val = json_object_get(rootJ, nm.c_str())))
        e->initLocked = json_boolean_value(val);
      if (!e->factoryName.size())
        e->factoryName = pq->name;
      nm = "paramName"+idStr;
      if ((val = json_object_get(rootJ, nm.c_str())))
        pq->name = json_string_value(val);
    }
    for (int i=0; i<getNumInputs(); i++){
      PortExtension* e = &inputExtensions[i];
      PortInfo* pi = inputInfos[i];
      std::string nm = "inputName"+std::to_string(i);
      if (!e->factoryName.size())
        e->factoryName = pi->name;
      if ((val = json_object_get(rootJ, nm.c_str())))
        pi->name = json_string_value(val);
    }
    for (int i=0; i<getNumOutputs(); i++){
      PortExtension* e = &outputExtensions[i];
      PortInfo* pi = outputInfos[i];
      std::string nm = "outputName"+std::to_string(i);
      if (!e->factoryName.size())
        e->factoryName = pi->name;
      if ((val = json_object_get(rootJ, nm.c_str())))
        pi->name = json_string_value(val);
    }
    val = json_object_get(rootJ, "currentTheme");
    if (val)
      currentTheme = json_integer_value(val);
    extProcNeeded = true;
    drawn = false;
    if (oversampleStages) {
      val = json_object_get(rootJ, "oversampleStages");
      oversampleStages = val ? json_integer_value(val) : 3;
    }
  }


};


struct WaveMangler : VenomModule {

  enum ParamId {
    DC_IN_PARAM,
    OVER_PARAM,
    CLIP_PARAM,
    DC_OUT_PARAM,
    IN_OFFSET_AMT_PARAM,
    IN_OFFSET_PARAM,
    OUT_OFFSET_AMT_PARAM,
    OUT_OFFSET_PARAM,
    HI_AMP_AMT_PARAM,
    HI_AMP_PARAM,
    HI_THRESH_AMT_PARAM,
    HI_THRESH_PARAM,
    MID_CLIP_PARAM,
    MID_AMP_AMT_PARAM,
    MID_AMP_PARAM,
    LO_THRESH_AMT_PARAM,
    LO_THRESH_PARAM,
    LO_AMP_AMT_PARAM,
    LO_AMP_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    IN_OFFSET_INPUT,
    OUT_OFFSET_INPUT,
    HI_AMP_INPUT,
    HI_THRESH_INPUT,
    MID_AMP_INPUT,
    LO_THRESH_INPUT,
    LO_AMP_INPUT,
    WAVE_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    WAVE_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };
  
  int oversample = 0;
  float sampleRate = 0;
  int oversampleValues[6]{1,2,4,8,16,32};
  OversampleFilter_4 upSample[8][4]{}, downSample[4]{};
  DCBlockFilter_4 dcBlockInFilter[4]{}, dcBlockOutFilter[4]{};

  WaveMangler() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);

    configSwitch<ParamQuantity>(DC_IN_PARAM, 0.f, 1.f, 0.f, "Input DC block", {"Off", "On"});
    configSwitch<ParamQuantity>(OVER_PARAM, 0.f, 5.f, 0.f, "Oversample", {"Off", "x2", "x4", "x8", "x16", "x32"});
    configSwitch<ParamQuantity>(CLIP_PARAM, 0.f, 3.f, 1.f, "Output clipping", {"Off", "Hard +/- 5V", "Soft +/- 5V", "Soft +/- 6V"});
    configSwitch<ParamQuantity>(DC_OUT_PARAM, 0.f, 1.f, 0.f, "Output DC block", {"Off", "On"});

    configInput(IN_OFFSET_INPUT, "Input offset CV");
    configParam(IN_OFFSET_AMT_PARAM, -1.f, 1.f, 0.f, "Input offset CV amount", "%", 0, 100, 0);
    configParam(IN_OFFSET_PARAM, -5.f, 5.f, 0.f, "Input offset", " V");

    configInput(OUT_OFFSET_INPUT, "Output offset CV");
    configParam(OUT_OFFSET_AMT_PARAM, -1.f, 1.f, 0.f, "Output offset CV amount", "%", 0, 100, 0);
    configParam(OUT_OFFSET_PARAM, -5.f, 5.f, 0.f, "Output offset", " V");

    configInput(HI_AMP_INPUT, "High amplifier CV");
    configParam(HI_AMP_AMT_PARAM, -1.f, 1.f, 0.f, "High amplifier CV amount", "%", 0, 100, 0);
    configParam(HI_AMP_PARAM, -10.f, 10.f, 0.f, "High amplifier", "x");

    configInput(HI_THRESH_INPUT, "High threshold CV");
    configParam(HI_THRESH_AMT_PARAM, -1.f, 1.f, 0.f, "High threshold CV amount", "%", 0, 100, 0);
    configParam(HI_THRESH_PARAM, -5.f, 5.f, 0.f, "High threshold", " V");

    configSwitch<ParamQuantity>(MID_CLIP_PARAM, 0.f, 3.f, 1.f, "Middle clipping", {"Off", "Pre amp", "Post amp", "Pre and post amp"});
    configInput(MID_AMP_INPUT, "Middle amplifier CV");
    configParam(MID_AMP_AMT_PARAM, -1.f, 1.f, 0.f, "Middle amplifier CV amount", "%", 0, 100, 0);
    configParam(MID_AMP_PARAM, -10.f, 10.f, 0.f, "Middle amplifier", "x");

    configInput(LO_THRESH_INPUT, "Low threshold CV");
    configParam(LO_THRESH_AMT_PARAM, -1.f, 1.f, 0.f, "Low threshold CV amount", "%", 0, 100, 0);
    configParam(LO_THRESH_PARAM, -5.f, 5.f, 0.f, "Low threshold", " V");

    configInput(LO_AMP_INPUT, "Low amplifier CV");
    configParam(LO_AMP_AMT_PARAM, -1.f, 1.f, 0.f, "Low amplifier CV amount", "%", 0, 100, 0);
    configParam(LO_AMP_PARAM, -10.f, 10.f, 0.f, "Low amplifier", "x");

    configInput(WAVE_INPUT, "Wave");
    configOutput(WAVE_OUTPUT, "Wave");

    configBypass(WAVE_INPUT, WAVE_OUTPUT);
    
    oversampleStages = 5;
  }
  
  void setOversample() override {
    if (oversample > 1) {
      for (int s=0; s<4; s++){
        for (int i=0; i<INPUTS_LEN; i++){
          upSample[i][s].setOversample(oversample, oversampleStages);
        }
        downSample[s].setOversample(oversample, oversampleStages);
      }
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);
    using float_4 = simd::float_4;
    // update oversample configuration
    if (oversample != oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())]) {
      oversample = oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())];
      setOversample();
      sampleRate = 0.f;
    }
    // update DC Block configuration
    if (sampleRate != args.sampleRate){
      sampleRate = args.sampleRate;
      for (int i=0; i<4; i++){
        dcBlockInFilter[i].init(oversample, sampleRate);
        dcBlockOutFilter[i].init(oversample, sampleRate);
      }
    }
    // get channel count
    int channels = 1;
    for (int i=0; i<INPUTS_LEN; i++)
      channels = std::max({channels, inputs[i].getChannels()});
    
    float_4 in[INPUTS_LEN]{}, out{}, a, b, hiThresh, loThresh, hiAmp, midAmp, loAmp, inOff, outOff;

    // channel loop
    for (int s=0, c=0; c<channels; s++, c+=4){
      // oversample loop
      for (int o=0; o<oversample; o++) {
        // read inputs
        if (!o) {
          for (int i=0; i<INPUTS_LEN; i++)
            in[i] = inputs[i].getPolyVoltageSimd<float_4>(c);
        }
        // upsample inputs
        if (oversample > 1){
          for (int i=0; i<INPUTS_LEN; i++) {
            if (inputs[i].isConnected())
              in[i] = upSample[i][s].process(o ? float_4::zero() : in[i]*oversample);
          }
        }
        // DC block input
        if (params[DC_IN_PARAM].getValue())
          in[WAVE_INPUT] = dcBlockInFilter[s].process(in[WAVE_INPUT]);
        // compute offsets
        inOff = params[IN_OFFSET_PARAM].getValue() + in[IN_OFFSET_INPUT] * params[IN_OFFSET_AMT_PARAM].getValue();
        outOff = params[OUT_OFFSET_PARAM].getValue() + in[OUT_OFFSET_INPUT] * params[OUT_OFFSET_AMT_PARAM].getValue();
        // compute window
        a = params[HI_THRESH_PARAM].getValue() + in[HI_THRESH_INPUT] * params[HI_THRESH_AMT_PARAM].getValue();
        b = params[LO_THRESH_PARAM].getValue() + in[LO_THRESH_INPUT] * params[LO_THRESH_AMT_PARAM].getValue();
        hiThresh = ifelse(a>b, a, b);
        loThresh = ifelse(a>b, b, a);
        // compute amps
        hiAmp = params[HI_AMP_PARAM].getValue() + in[HI_AMP_INPUT] * params[HI_AMP_AMT_PARAM].getValue();
        midAmp = params[MID_AMP_PARAM].getValue() + in[MID_AMP_INPUT] * params[MID_AMP_AMT_PARAM].getValue();
        loAmp = params[LO_AMP_PARAM].getValue() + in[LO_AMP_INPUT] * params[LO_AMP_AMT_PARAM].getValue();
        // offset input
        in[WAVE_INPUT] += inOff;
        // compute output middle
        switch (static_cast<int>(params[MID_CLIP_PARAM].getValue())) {
          case 0: // clamp off
            out = in[WAVE_INPUT] * midAmp;
            break;
          case 1: // clamp pre amp
            out = clamp(in[WAVE_INPUT], loThresh, hiThresh) * midAmp;
            break;
          case 2: // clamp post amp
            out = clamp(in[WAVE_INPUT] * midAmp, loThresh, hiThresh);
            break;
          default: // 3 clamp pre & post amp
            out = simd::clamp(simd::clamp(in[WAVE_INPUT], loThresh, hiThresh) * midAmp, loThresh, hiThresh);
        }
        // add high and low output
        out += ifelse(in[WAVE_INPUT]>hiThresh, (in[WAVE_INPUT]-hiThresh) * hiAmp, ifelse(in[WAVE_INPUT]<loThresh, (in[WAVE_INPUT]-loThresh) * loAmp, float_4::zero()));
        // clamp output
        switch (static_cast<int>(params[CLIP_PARAM].getValue())) {
          case 1: // hard clip 5V
            out = clamp(out, -5.f, 5.f);
            break;
          case 2: // soft clip 5V
            out = softClip(out*2.f) / 2.f;
            break;
          case 3: // soft clip 6V
            out = softClip(out*1.6667f) / 1.6667f;
            break;
        }
        // offset output
        out += outOff;
        // DC block output
        if (params[DC_OUT_PARAM].getValue())
          out = dcBlockOutFilter[s].process(out);
        // downsample output
        if (oversample > 1)
          out = downSample[s].process(out);
      } // end oversample loop
      // write output
      outputs[WAVE_OUTPUT].setVoltageSimd(out, c);
    } // end channel loop
    // set output channel count
    outputs[WAVE_OUTPUT].setChannels(channels);
  }


  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
};
}

RACK_WEB_EXPORTS(Venom::WaveMangler)
