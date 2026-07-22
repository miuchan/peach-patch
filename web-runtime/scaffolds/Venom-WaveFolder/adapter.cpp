// Automatically isolated from the original Rack DSP module for Venom/WaveFolder.
// Source: https://github.com/DaveBenham/VenomModules (src/WaveFolder.cpp; registered in src/WaveFolder.cpp)
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


struct WaveFolder : VenomModule {

  enum ParamId {
    STAGES_PARAM,
    OVER_PARAM,
    PRE_PARAM,
    STAGE_PARAM,
    BIAS_PARAM,
    PRE_AMT_PARAM,
    STAGE_AMT_PARAM,
    BIAS_AMT_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    PRE_INPUT,
    STAGE_INPUT,
    BIAS_INPUT,
    POLY_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    POLY_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    PRE_VCA_LIGHT,
    STAGE_VCA_LIGHT,
    ENUMS(PRE_OVER_LIGHT,2),
    ENUMS(STAGE_OVER_LIGHT,2),
    ENUMS(BIAS_OVER_LIGHT,2),
    LIGHTS_LEN
  };
  
  int oversample = 0;
  int oversampleValues[6]{1,2,4,8,16,32};
  OversampleFilter_4 preUpSample[4]{}, stageUpSample[4]{}, biasUpSample[4]{}, upSample[4]{}, downSample[4]{};
  float stageRaw = -1.f;
  simd::float_4 stageParm{};
  bool disableOver[3]{}, bipolar[2]{};


  WaveFolder() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);

    configSwitch<ParamQuantity>(STAGES_PARAM, 0.f, 4.f, 1.f, "Stages", {"2", "3", "4", "5", "6"});
    configSwitch<ParamQuantity>(OVER_PARAM, 0.f, 5.f, 2.f, "Oversample", {"Off", "x2", "x4", "x8", "x16", "x32"});

    configParam(PRE_PARAM, 0.f, 10.f, 1.f, "Pre-amp");
    configParam(STAGE_PARAM, -0.30103f, 1.f, 0.f, "Stage amp", "", 10, 1, 0);  // 0.5 - 10 range
    configParam(BIAS_PARAM, -5.f, 5.f, 0.f, "Bias", "V");
    
    configParam(PRE_AMT_PARAM, -1.f, 1.f, 0.f, "Pre-amp CV amount", "%", 0, 100, 0);
    configParam(STAGE_AMT_PARAM, -1.f, 1.f, 0.f, "Stage amp CV amount", "%", 0, 100, 0);
    configParam(BIAS_AMT_PARAM, -1.f, 1.f, 0.f, "Bias CV amount", "%", 0, 100, 0);

    configInput(PRE_INPUT, "Pre-amp CV");
    configLight(PRE_OVER_LIGHT, "Pre-amp CV oversample indicator")->description = "off = none, yellow = oversampled, red = disabled";
    configLight(PRE_VCA_LIGHT, "Pre-amp bipolar VCA indicator");

    configInput(STAGE_INPUT, "Stage amp CV");
    configLight(STAGE_OVER_LIGHT, "Stage amp CV oversample indicator")->description = "off = none, yellow = oversampled, red = disabled";
    configLight(STAGE_VCA_LIGHT, "Stage amp bipolar VCA indicator");

    configInput(BIAS_INPUT, "Bias CV");
    configLight(BIAS_OVER_LIGHT, "Bias CV oversample indicator")->description = "off = none, yellow = oversampled, red = disabled";

    configInput(POLY_INPUT, "Poly");
    configOutput(POLY_OUTPUT, "Poly");

    configBypass(POLY_INPUT, POLY_OUTPUT);
    
    oversampleStages = 5;
  }
  
  void setOversample() override {
    if (oversample > 1) {
      for (int i=0; i<4; i++){
        preUpSample[i].setOversample(oversample, oversampleStages);
        stageUpSample[i].setOversample(oversample, oversampleStages);
        biasUpSample[i].setOversample(oversample, oversampleStages);
        upSample[i].setOversample(oversample, oversampleStages);
        downSample[i].setOversample(oversample, oversampleStages);
      }
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);
    
    using float_4 = simd::float_4;
    float limit = 10.f / 6.f;
    if (oversample != oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())]) {
      oversample = oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())];
      setOversample();
    }
    
    if (stageRaw != params[STAGE_PARAM].getValue()) {
      stageRaw = params[STAGE_PARAM].getValue();
      stageParm = pow(10.f, stageRaw);
    }
    float preParm = params[PRE_PARAM].getValue(),
          preAmt = params[PRE_AMT_PARAM].getValue(),
          stageAmt = params[STAGE_AMT_PARAM].getValue(),
          biasParm = params[BIAS_PARAM].getValue(),
          biasAmt = params[BIAS_AMT_PARAM].getValue();
    bool preOver = inputs[PRE_INPUT].isConnected() && !disableOver[PRE_INPUT] && oversample>1,
         stageOver = inputs[STAGE_INPUT].isConnected() && !disableOver[STAGE_INPUT] && oversample>1,
         biasOver = inputs[BIAS_INPUT].isConnected() && !disableOver[BIAS_INPUT] && oversample>1;
    
    int stages = static_cast<int>(params[STAGES_PARAM].getValue())+2;
    int channels = 1;
    for (int i=0; i<INPUTS_LEN; i++)
      channels = std::max({channels, inputs[i].getChannels()});
    
    float_4 in[4]{}, out[4]{}, pre[4]{}, stage[4]{}, bias[4]{};
    for (int o=0; o<oversample; o++) {
      for (int i=0, c=0; c<channels; i++, c+=4){
        if (!o) {
          pre[i] = inputs[PRE_INPUT].getPolyVoltageSimd<float_4>(c);
          stage[i] = inputs[STAGE_INPUT].getPolyVoltageSimd<float_4>(c);
          bias[i] = inputs[BIAS_INPUT].getPolyVoltageSimd<float_4>(c);
          in[i] = inputs[POLY_INPUT].getPolyVoltageSimd<float_4>(c) * oversample;
        }
        if (oversample > 1) {
          in[i] = upSample[i].process(o ? float_4::zero() : in[i]);
        if (preOver)
            pre[i] = preUpSample[i].process(o ? float_4::zero() : pre[i]*oversample);
        if (stageOver)
          stage[i] = stageUpSample[i].process(o ? float_4::zero() : stage[i]*oversample);
        if (biasOver)
          bias[i] = biasUpSample[i].process(o ? float_4::zero() : bias[i]*oversample);
        }
        if (!o || preOver) {
          pre[i] = pre[i] * preAmt + preParm;
          if (!bipolar[PRE_INPUT])
            pre[i] = ifelse(pre[i]<0.f, 0.f, pre[i]);
        }
        if (!o || stageOver) {
          stage[i] = stage[i] * stageAmt + stageParm;
          if (!bipolar[STAGE_INPUT])
            stage[i] = ifelse(stage[i]<0.f, 0.f, stage[i]);
        }
        if (!o || biasOver)
          bias[i] = bias[i] * biasAmt + biasParm;
        out[i] = (in[i] + bias[i]) * pre[i];
        for (int s=0; s<stages; s++)
          out[i] = simd::clamp( out[i] * stage[i], -5.f, 5.f) * 2.f - out[i];
        out[i] = softClip(out[i]*limit) / limit;
        if (oversample > 1)
          out[i] = downSample[i].process(out[i]);
      }
    }
    for (int i=0, c=0; c<channels; i++, c+=4)
      outputs[POLY_OUTPUT].setVoltageSimd(out[i], c);
    outputs[POLY_OUTPUT].setChannels(channels);
  }

  json_t* dataToJson() override {
    json_t* rootJ = VenomModule::dataToJson();
    json_object_set_new(rootJ, "preAmpDisableOver", json_boolean(disableOver[PRE_INPUT]));
    json_object_set_new(rootJ, "preAmpBipolar", json_boolean(bipolar[PRE_INPUT]));
    json_object_set_new(rootJ, "stageAmpDisableOver", json_boolean(disableOver[STAGE_INPUT]));
    json_object_set_new(rootJ, "stageAmpBipolar", json_boolean(bipolar[STAGE_INPUT]));
    json_object_set_new(rootJ, "biasDisableOver", json_boolean(disableOver[BIAS_INPUT]));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    VenomModule::dataFromJson(rootJ);
    json_t* val;
    if ((val = json_object_get(rootJ, "preAmpDisableOver"))) {
      disableOver[PRE_INPUT] = json_boolean_value(val);
    }
    if ((val = json_object_get(rootJ, "preAmpBipolar"))) {
      bipolar[PRE_INPUT] = json_boolean_value(val);
    }

    if ((val = json_object_get(rootJ, "stageAmpDisableOver"))) {
      disableOver[STAGE_INPUT] = json_boolean_value(val);
    }
    if ((val = json_object_get(rootJ, "stageAmpBipolar"))) {
      bipolar[STAGE_INPUT] = json_boolean_value(val);
    }

    if ((val = json_object_get(rootJ, "biasDisableOver"))) {
      disableOver[BIAS_INPUT] = json_boolean_value(val);
    }
  }


  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
  void setState(int id, float value) override {
    json_t* root = dataToJson();
    if (!json_is_object(root)) { json_decref(root); root = json_object(); }
    switch (id) {
      case 0: json_object_set_new(root, "preAmpDisableOver", json_boolean(value != 0.f)); break;
      case 1: json_object_set_new(root, "preAmpBipolar", json_boolean(value != 0.f)); break;
      case 2: json_object_set_new(root, "stageAmpDisableOver", json_boolean(value != 0.f)); break;
      case 3: json_object_set_new(root, "stageAmpBipolar", json_boolean(value != 0.f)); break;
      case 4: json_object_set_new(root, "biasDisableOver", json_boolean(value != 0.f)); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
}

RACK_WEB_EXPORTS(Venom::WaveFolder)
