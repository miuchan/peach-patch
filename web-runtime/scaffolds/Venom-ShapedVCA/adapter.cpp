// Automatically isolated from the original Rack DSP module for Venom/ShapedVCA.
// Source: https://github.com/DaveBenham/VenomModules (src/ShapedVCA.cpp; registered in src/ShapedVCA.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"

#define HARD_CLIP 1
#define SOFT_CLIP 2

#include "math.hpp"
#include "Filter.hpp"

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


struct ShapedVCA : VenomModule {
  enum ParamId {
    RANGE_PARAM,
    MODE_PARAM,
    CLIP_PARAM,
    OVER_PARAM,
    OFFSET_PARAM,
    LEVEL_PARAM,
    BIAS_PARAM,
    CURVE_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    LEVEL_INPUT,
    CURVE_INPUT,
    LEFT_INPUT,
    RIGHT_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    LEFT_OUTPUT,
    RIGHT_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };

//  bool oldLog = false;
  int algo = 0; // 0 = properly scaled with bipolar exp, 1 = unscaled, unipolar exp, 2 = unscaled, unipolar exp and funky log
  int range = -1; // force initialization
  float levelOffset, levelOffsetVals[6] = {0.f, 0.f, 0.f, -1.f, -2.f, -10.f};
  float levelScale, levelScaleVals[6] = {1.f, 2.f, 10.f, 2.f, 4.f, 20.f};
  float levelDefaultVals[6] = {1.f, 0.5f, 0.1f, 1.f, 0.75f, 0.55f};
  float offsetVals[3] = {0.f, -5.f, 5.f};
  float oldOversample = -1; // force initialization
  int oversample, overVals[5] = {1, 4, 8, 16, 32};
  OversampleFilter_4 levelUpSample[4], curveUpSample[4], 
                     leftUpSample[4], rightUpSample[4], 
                     leftDownSample[4], rightDownSample[4];

  ShapedVCA() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    configSwitch<ParamQuantity>(RANGE_PARAM, 0.f, 5.f, 0.f, "Level Range", {"0-1", "0-2", "0-10", "+/- 1", "+/- 2", "+/- 10"});
    configSwitch<ParamQuantity>(MODE_PARAM, 0.f, 3.f, 0.f, "VCA Mode", {
      "Unipolar 0-10V clipped CV (2 quadrant)",
      "Bipolar +/- 10V unclipped CV (4 quadrant)",
      "Unipolar 0-5V clipped CV (2 quadrant)",
      "Bipolar +/- 5V unclipped CV (4 quadrant)"
    });
    configSwitch<ParamQuantity>(CLIP_PARAM, 0.f, 2.f, 0.f, "Output Clipping", {"Off", "Hard clip", "Soft clip"});
    configSwitch<ParamQuantity>(OVER_PARAM, 0.f, 4.f, 0.f, "Oversample", {"Off", "x4", "x8", "x16", "x32"});
    configParam(LEVEL_PARAM, 0.f, 1.f, 1.f, "Level", "x", 0.f, 1.f, 0.f);
    configInput(LEVEL_INPUT, "Level CV")->description = "Normalled to 10 volts";
    configParam(BIAS_PARAM, -0.5f, 0.5f, 0.f, "Level CV bias", " V", 0.f, 10.f, 0.f);
    configParam<ParamQuantity>(CURVE_PARAM, -1.f, 1.f, 0.f, "Response curve", "%", 0.f, 100.f);
    configInput(CURVE_INPUT, "Response curve");
    configInput(LEFT_INPUT, "Left")->description = "Normalled to 10 volts";
    configInput(RIGHT_INPUT, "Right")->description = "Normalled to left input";
    configOutput(LEFT_OUTPUT, "Left");
    configOutput(RIGHT_OUTPUT, "Right");
    configSwitch<ParamQuantity>(OFFSET_PARAM, 0.f, 2.f, 0.f, "Output offset", {"None", "-5 V", "+5 V"});
    configBypass(LEFT_INPUT, LEFT_OUTPUT);
    configBypass(inputs[RIGHT_INPUT].isConnected() ? RIGHT_INPUT : LEFT_INPUT, RIGHT_OUTPUT);
    
    oversampleStages = 5;
  }

  void onPortChange(const PortChangeEvent& e) override {
    if (e.type == Port::INPUT && e.portId == RIGHT_INPUT)
      bypassRoutes[1].inputId = e.connecting ? RIGHT_INPUT : LEFT_INPUT;
  }
  
  void setOversample() override {
    for (int i=0; i<4; i++){
      levelUpSample[i].setOversample(oversample, oversampleStages);
      curveUpSample[i].setOversample(oversample, oversampleStages);
      leftUpSample[i].setOversample(oversample, oversampleStages);
      rightUpSample[i].setOversample(oversample, oversampleStages);
      leftDownSample[i].setOversample(oversample, oversampleStages);
      rightDownSample[i].setOversample(oversample, oversampleStages);
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);

    // get channels
    int channels = std::max({1, inputs[LEVEL_INPUT].getChannels(), inputs[CURVE_INPUT].getChannels(), inputs[LEFT_INPUT].getChannels(), inputs[RIGHT_INPUT].getChannels()});
    int simdCnt = (channels+3)/4;

    // configure oversample
    if (params[OVER_PARAM].getValue() != oldOversample) {
      oldOversample = params[OVER_PARAM].getValue();
      oversample = overVals[static_cast<int>(oldOversample)];
      setOversample();
    }
    
    // configure level
    if (static_cast<int>(params[RANGE_PARAM].getValue()) != range){
      range = static_cast<int>(params[RANGE_PARAM].getValue());
      ParamQuantity* q = paramQuantities[LEVEL_PARAM];
      q->displayMultiplier = levelScale = levelScaleVals[range];
      q->displayOffset = levelOffset = levelOffsetVals[range];
      q->defaultValue = levelDefaultVals[range];
    }  

    float level = params[LEVEL_PARAM].getValue() * levelScale + levelOffset;
    float curve = params[CURVE_PARAM].getValue();
    float bias = params[BIAS_PARAM].getValue();
    float offset = offsetVals[static_cast<int>(params[OFFSET_PARAM].getValue())];
    int clip = static_cast<int>(params[CLIP_PARAM].getValue());
    using float_4 = simd::float_4;
    float_4 leftIn[4], rightIn[4], levelIn[4], curveIn[4], gain, shape, leftOut[4], rightOut[4];
    bool leftInConnected = inputs[LEFT_INPUT].isConnected(),
         rightInConnected = inputs[RIGHT_INPUT].isConnected(),
         levelConnected = inputs[LEVEL_INPUT].isConnected(),
         curveConnected = inputs[CURVE_INPUT].isConnected(),
         leftOutConnected = outputs[LEFT_OUTPUT].isConnected(),
         rightOutConnected = outputs[RIGHT_OUTPUT].isConnected(),
         ringMod = (static_cast<int>(params[MODE_PARAM].getValue())%2),
         half = params[MODE_PARAM].getValue()>1.5f;

    for( int o=0; o<oversample; o++){
      for( int s=0, c=0; s<simdCnt; s++, c+=4){
        curveIn[s] = curveConnected && !o ? inputs[CURVE_INPUT].getPolyVoltageSimd<float_4>(c) * oversample : float_4::zero(); // normal value is 0.f, so this simpler logic works
        levelIn[s] = levelConnected ? (o ? float_4::zero() : inputs[LEVEL_INPUT].getPolyVoltageSimd<float_4>(c)/10.f * oversample) : 1.f; // normal is non-zero, so a bit more logic needed
        leftIn[s] = leftInConnected ? (o ? float_4::zero() : inputs[LEFT_INPUT].getPolyVoltageSimd<float_4>(c) * oversample) : 10.f; // normal is non-zero, so a bit more logic needed
        if (rightInConnected) rightIn[s] = o ? float_4::zero() : inputs[RIGHT_INPUT].getPolyVoltageSimd<float_4>(c) * oversample; // normal is left, so set later if not connected
        if (oversample>1) {
          if (curveConnected) curveIn[s] = curveUpSample[s].process(curveIn[s]);
          if (levelConnected) levelIn[s] = levelUpSample[s].process(levelIn[s]);
          if (leftInConnected) leftIn[s] = leftUpSample[s].process(leftIn[s]);
          if (rightInConnected) rightIn[s] = rightUpSample[s].process(rightIn[s]);
        } 
        if (!rightInConnected) rightIn[s] = leftIn[s];
        levelIn[s] += bias;
        if (!ringMod) levelIn[s] = clamp(levelIn[s]);
        shape = clamp(curveIn[s]/10.f + curve, -1.f, 1.f);
        if (algo == 2 && !half) // oldlog and unscaled, unipolar exp
          gain = crossfade(levelIn[s], ifelse(shape>0.f, 11.f*levelIn[s]/(10.f*levelIn[s]+1.f), simd::pow(levelIn[s],4)), ifelse(shape>0.f, shape, -shape));
        else if (algo == 1 && !half)
          gain = crossfade(levelIn[s], ifelse(shape>0.f, 11.f*levelIn[s]/(10.f*simd::abs(levelIn[s])+1.f), simd::pow(levelIn[s],4)), ifelse(shape>0.f, shape, -shape));
        else {
          if (half && levelConnected)
            levelIn[s]*=2.f;
          gain = crossfade(levelIn[s], ifelse(shape>0.f, 11.f*levelIn[s]/(10.f*simd::abs(levelIn[s])+1.f), simd::sgn(levelIn[s])*simd::pow(levelIn[s],4)), ifelse(shape>0.f, shape, -shape));
        }
        leftOut[s] = leftIn[s] * gain * level;
        rightOut[s] = rightIn[s] * gain * level;
        if (clip == HARD_CLIP){
          leftOut[s] = clamp(leftOut[s], -10.f, 10.f);
          rightOut[s] = clamp(rightOut[s], -10.f, 10.f);
        }
        if (clip == SOFT_CLIP){
          leftOut[s] = softClip(leftOut[s]);
          rightOut[s] = softClip(rightOut[s]);
        }
        if (oversample>1) {
          if (leftOutConnected) leftOut[s] = leftDownSample[s].process(leftOut[s]);
          if (rightOutConnected) rightOut[s] = rightDownSample[s].process(rightOut[s]);
        }
      }
    }
    for (int s=0, c=0; s<simdCnt; s++, c+=4){
      outputs[LEFT_OUTPUT].setVoltageSimd(leftOut[s]+offset, c);
      outputs[RIGHT_OUTPUT].setVoltageSimd(rightOut[s]+offset, c);
    }
    outputs[LEFT_OUTPUT].setChannels(channels);
    outputs[RIGHT_OUTPUT].setChannels(channels);
  }

  json_t* dataToJson() override {
    json_t* rootJ = VenomModule::dataToJson();
    json_object_set_new(rootJ, "algo", json_integer(algo));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    VenomModule::dataFromJson(rootJ);
    json_t* val;
    if ((val = json_object_get(rootJ, "algo")))
      algo = json_integer_value(val);
    else if ((val = json_object_get(rootJ, "oldLog")))
      algo = json_boolean_value(val) ? 2 : 1;
    else
      algo = 2;
  }


  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
  void setState(int id, float value) override {
    json_t* root = dataToJson();
    if (!json_is_object(root)) { json_decref(root); root = json_object(); }
    switch (id) {
      case 0: json_object_set_new(root, "algo", json_integer(static_cast<long long>(value))); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
}

RACK_WEB_EXPORTS(Venom::ShapedVCA)
