// Automatically isolated from the original Rack DSP module for Venom/Octaver.
// Source: https://github.com/DaveBenham/VenomModules (src/Octaver.cpp; registered in src/Octaver.cpp)
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


struct Octaver : VenomModule {

  enum ParamId {
    UP1_PARAM,
    DRY_PARAM,
    DOWN1_PARAM,
    DOWN2_PARAM,
    DRIVE_PARAM,
    UP1_CV_PARAM,
    DRY_CV_PARAM,
    DOWN1_CV_PARAM,
    DOWN2_CV_PARAM,
    DRIVE_CV_PARAM,
    MODE_PARAM,
    OVER_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    UP1_CV_INPUT,
    DRY_CV_INPUT,
    DOWN1_CV_INPUT,
    DOWN2_CV_INPUT,
    DRIVE_CV_INPUT,
    SIGNAL_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    SIGNAL_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };
  
  using float_4 = simd::float_4;
  float_4 inState[4]{},
          down1State[4]{-1.f,-1.f,-1.f,-1.f},
          down2State[4]{-1.f,-1.f,-1.f,-1.f},
          level[4]{},
          down1[4]{},
          down2[4]{};
  

  OversampleFilter_4 upSample[4]{},
                     downSample[4]{};
  
  DCBlockFilter_4 inDcBlock[4]{},
                  up1DcBlock[4]{};
  
  int oversample = 0;
  int overVals[3]{2,4,8};
  float sampleRate = 0.f,
        maxRise = 0.f,
        maxFall = 0.f,
        maxSqrRise = 0.f,
        maxSqrFall = 0.f;

  Octaver() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);

    configSwitch<ParamQuantity>(MODE_PARAM, 0.f, 1.f, 0.f, "Sub-octave mode", {"Inversion (Pearl)", "Square (Boss)"});
    configSwitch<ParamQuantity>(OVER_PARAM, 0.f, 2.f, 0.f, "Oversample", {"x2", "x4", "x8"});

    configParam(UP1_PARAM, 0.f, 1.f, 0.f, "Octave +1 Mix", "%", 0.f, 100.f);
    configParam(UP1_CV_PARAM, -0.1f, 0.1f, 0.f, "Octave +1 Mix CV", "%", 0.f, 1000.f);
    configInput(UP1_CV_INPUT, "Octave +1 Mix CV");

    configParam(DRY_PARAM, 0.f, 1.f, 0.f, "Dry Mix", "%", 0.f, 100.f);
    configParam(DRY_CV_PARAM, -0.1f, 0.1f, 0.f, "Dry Mix CV", "%", 0.f, 1000.f);
    configInput(DRY_CV_INPUT, "Dry Mix CV");

    configParam(DOWN1_PARAM, 0.f, 1.f, 0.f, "Octave -1 Mix", "%", 0.f, 100.f);
    configParam(DOWN1_CV_PARAM, -0.1f, 0.1f, 0.f, "Octave -1 Mix CV", "%", 0.f, 1000.f);
    configInput(DOWN1_CV_INPUT, "Octave -1 Mix CV");

    configParam(DOWN2_PARAM, 0.f, 1.f, 0.f, "Octave -2 Mix", "%", 0.f, 100.f);
    configParam(DOWN2_CV_PARAM, -0.1f, 0.1f, 0.f, "Octave -2 Mix CV", "%", 0.f, 1000.f);
    configInput(DOWN2_CV_INPUT, "Octave -2 Mix CV");
    
    configParam(DRIVE_PARAM, 0.f, 5.f, 1.f, "Drive", "");
    configParam(DRIVE_CV_PARAM, -1.f, 1.f, 0.f, "Drive CV", "%", 0.f, 100.f);
    configInput(DRIVE_CV_INPUT, "Drive CV");
    
    configInput(SIGNAL_INPUT, "Signal");
    configOutput(SIGNAL_OUTPUT, "Signal");

    configBypass(SIGNAL_INPUT, SIGNAL_OUTPUT);

  }
  
  void setOversample() override {
    for (int i=0; i<4; i++){
      upSample[i].setOversample(oversample, 5);
      downSample[i].setOversample(oversample, 5);
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);
    if (oversample != overVals[static_cast<int>(params[OVER_PARAM].getValue())]){
      oversample = overVals[static_cast<int>(params[OVER_PARAM].getValue())];
      setOversample();
      sampleRate = 0.f;
    }
    if (sampleRate != args.sampleRate){
      sampleRate = args.sampleRate;
      for (int i=0; i<4; i++) {
        inDcBlock[i].init(oversample, sampleRate);
        up1DcBlock[i].init(oversample, sampleRate);
      }
      maxRise = 1280.f / sampleRate / oversample;
      maxFall = -40.f / sampleRate / oversample;
      maxSqrRise = 10000.f / sampleRate / oversample;
      maxSqrFall = -maxSqrRise;
    }
    int mode = params[MODE_PARAM].getValue(),
        channels = inputs[SIGNAL_INPUT].getChannels();
    for (int s=0, c=0; c < channels; s++, c+=4) {
      float_4 in = inputs[SIGNAL_INPUT].getPolyVoltageSimd<float_4>(c) * oversample,
              out{},
              inAmt = clamp(params[DRY_PARAM].getValue() + params[DRY_CV_PARAM].getValue() * inputs[DRY_CV_INPUT].getPolyVoltageSimd<float_4>(c)),
              up1Amt = clamp(params[UP1_PARAM].getValue() + params[UP1_CV_PARAM].getValue() * inputs[UP1_CV_INPUT].getPolyVoltageSimd<float_4>(c)),
              dn1Amt = clamp(params[DOWN1_PARAM].getValue() + params[DOWN1_CV_PARAM].getValue() * inputs[DOWN1_CV_INPUT].getPolyVoltageSimd<float_4>(c)),
              dn2Amt = clamp(params[DOWN2_PARAM].getValue() + params[DOWN2_CV_PARAM].getValue() * inputs[DOWN2_CV_INPUT].getPolyVoltageSimd<float_4>(c)),
              drive = clamp(params[DRIVE_PARAM].getValue() + params[DRIVE_CV_PARAM].getValue() * inputs[DRIVE_CV_INPUT].getPolyVoltageSimd<float_4>(c), 0.f, 10.f);
      for (int o=0; o<oversample; o++) {
        in = upSample[s].process(o ? 0.f : in);
        in = inDcBlock[s].process(in);
        float_4 up1 = abs(in) * 2.f,
                dn1,
                dn2;
        if (mode) {
          float_4 diff = up1 - level[s];
          diff = ifelse( diff > maxRise, maxRise, diff);
          diff = ifelse (diff < maxFall, maxFall, diff);
          level[s] += diff;
        }
        up1 = up1DcBlock[s].process(up1);
        float_4 newInState = ifelse( in>0.f, 1.f, 0.f),
                newDown1State = ifelse((newInState>0.f) & (newInState!=inState[s]), down1State[s]*-1.f, down1State[s]);
        down2State[s] = ifelse((newDown1State>0.f) & (newDown1State!=down1State[s]), down2State[s]*-1.f, down2State[s]);
        down1State[s] = newDown1State;
        inState[s] = newInState;
        if (mode) {
          dn1 = down1State[s] * level[s] * 0.5;
          float_4 diff = dn1 - down1[s];
          diff = ifelse( diff > maxSqrRise, maxSqrRise, diff);
          diff = ifelse( diff < maxSqrFall, maxSqrFall, diff);
          down1[s] += diff;
          dn1 = down1[s];
          dn2 = down2State[s] * level[s] * 0.5f;
          diff = dn2 - down2[s];
          diff = ifelse( diff > maxSqrRise, maxSqrRise, diff);
          diff = ifelse( diff < maxSqrFall, maxSqrFall, diff);
          down2[s] += diff;
          dn2 = down2[s];
        }
        else {
          dn1 = in * down1State[s];
          dn2 = (dn1 + dn1 * down2State[s]) * 0.5f;
        }
        out = in * inAmt
            + up1 * up1Amt
            + dn1 * dn1Amt
            + dn2 * dn2Amt;
        out = softClip(out*10.f/6.f * drive) * 6.f/10.f;
        out = downSample[s].process(out);
      }
      outputs[SIGNAL_OUTPUT].setVoltageSimd(out, c);
    }
    outputs[SIGNAL_OUTPUT].setChannels(channels);
  }
  

  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
};
}

RACK_WEB_EXPORTS(Venom::Octaver)
