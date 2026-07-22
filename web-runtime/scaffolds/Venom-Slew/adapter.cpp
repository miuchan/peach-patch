// Automatically isolated from the original Rack DSP module for Venom/Slew.
// Source: https://github.com/DaveBenham/VenomModules (src/Slew.cpp; registered in src/Slew.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"

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


struct Slew : VenomModule { 
  enum ParamId {
    SPEED_PARAM,
    OVER_PARAM,
    RISE_TIME_PARAM,
    FALL_TIME_PARAM,
    RISE_TIME_CV_PARAM,
    FALL_TIME_CV_PARAM,
    RISE_SHAPE_PARAM,
    FALL_SHAPE_PARAM,
    RISE_SHAPE_CV_PARAM,
    FALL_SHAPE_CV_PARAM,
    POLARITY_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    RISE_TIME_CV_INPUT,
    FALL_TIME_CV_INPUT,
    RISE_SHAPE_CV_INPUT,
    FALL_SHAPE_CV_INPUT,
    RAW_INPUT,
    VOCT_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    RISE_OUTPUT,
    FALL_OUTPUT,
    FLAT_OUTPUT,
    SLEW_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };
 
  using float_4 = simd::float_4;

  int oversample=0;
  int oversampleValues[6]{1,2,4,8,16,32};
  OversampleFilter_4 upSample[6][4]{}, downSample[4][4]{};
  int overMinDeltaIndex = 0;
  float overMinDelta[5] {1e-2f,1e-3f,1e-4f,1e-5f,1e-6f};
  float_4 oldOut[4]{};
  

  Slew() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);

    configSwitch<ParamQuantity>(SPEED_PARAM, 0.f, 1.f, 0.f, "Speed", {"Slow", "Fast"});
    configSwitch<ParamQuantity>(OVER_PARAM, 0.f, 5.f, 0.f, "Oversample", {"Off", "x2", "x4", "x8", "x16", "x32"});

    configParam(RISE_TIME_PARAM, -5.f, 5.f, 0.f, "Rise time 10V", " msec", 2.0f, 0.25f, 0.f);
    configParam(FALL_TIME_PARAM, -5.f, 5.f, 0.f, "Fall time 10V", " msec", 2.0f, 0.25f, 0.f);

    configParam(RISE_TIME_CV_PARAM, -1.f, 1.f, 0.f, "Rise time CV amount", "%", 0, 100, 0);
    configParam(FALL_TIME_CV_PARAM, -1.f, 1.f, 0.f, "Fall time CV amount", "%", 0, 100, 0);
    
    configInput(RISE_TIME_CV_INPUT, "Rise time CV");
    configInput(FALL_TIME_CV_INPUT, "Fall time CV");
    
    configParam(RISE_SHAPE_PARAM, 0.f, 1.f, 0.f, "Rise shape (curve amount)", "%", 0, 100, 0);
    configParam(FALL_SHAPE_PARAM, 0.f, 1.f, 0.f, "Fall shape (curve amount)", "%", 0, 100, 0);
    
    configParam(RISE_SHAPE_CV_PARAM, -1.f, 1.f, 0.f, "Rise shape CV amount", "%", 0, 100, 0);
    configParam(FALL_SHAPE_CV_PARAM, -1.f, 1.f, 0.f, "Fall shape CV amount", "%", 0, 100, 0);
    
    configInput(RISE_SHAPE_CV_INPUT, "Rise time CV");
    configInput(FALL_SHAPE_CV_INPUT, "Fall time CV");

    configInput(RAW_INPUT, "Raw");
    configInput(VOCT_INPUT, "V/Oct");

    configSwitch<ParamQuantity>(POLARITY_PARAM, 0.f, 1.f, 0.f, "Gate polarity", {"Unipolar", "Bipolar"});

    configOutput(RISE_OUTPUT, "Rise gate");
    configOutput(FALL_OUTPUT, "Fall gate");
    configOutput(FLAT_OUTPUT, "Flat gate");
    configOutput(SLEW_OUTPUT, "Slew");

    configBypass(RAW_INPUT, SLEW_OUTPUT);

    oversampleStages = 5;
  }

  void setOversample() override {
    for (int s=0; s<4; s++){
      for (int i=0; i<INPUTS_LEN; i++){
        upSample[i][s].setOversample(oversample, oversampleStages);
      }
      for (int i=0; i<OUTPUTS_LEN; i++){
        downSample[i][s].setOversample(oversample, oversampleStages);
      }
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);
    // update oversample configuration
    if (oversample != oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())]) {
      oversample = oversampleValues[static_cast<int>(params[OVER_PARAM].getValue())];
      setOversample();
    }
    // gate values
    float lo = params[POLARITY_PARAM].getValue() ? -5.f : 0.f,
          hi = lo ? 5.f : 10.f;
    // slope detector min delta
    float minDelta = oversample>1 ? overMinDelta[overMinDeltaIndex] : 1e-6f;
    // configure time knobs
    bool fast = params[SPEED_PARAM].getValue();
    float msecScale = 1000.f/(fast ? 523.26f : 4.f);
    paramQuantities[RISE_TIME_PARAM]->displayMultiplier = msecScale;
    paramQuantities[FALL_TIME_PARAM]->displayMultiplier = msecScale;
    // speed dependent slew constants    
    float kLin = 10*(fast ? 523.26f : 4.f)/args.sampleRate/oversample;
    float kCurve = fast ? 30.f : 4000.f;
    // get channel count
    int channels = 1;
    for (int i=0; i<INPUTS_LEN; i++)
      channels = std::max({channels, inputs[i].getChannels()});
    float_4 in[INPUTS_LEN]{}, out[OUTPUTS_LEN]{};
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
        // compute outputs
        float_4 riseMult = pow(2.f, in[VOCT_INPUT] - params[RISE_TIME_PARAM].getValue() - in[RISE_TIME_CV_INPUT]*params[RISE_TIME_CV_PARAM].getValue());
        float_4 fallMult = pow(2.f, in[VOCT_INPUT] - params[FALL_TIME_PARAM].getValue() - in[FALL_TIME_CV_INPUT]*params[FALL_TIME_CV_PARAM].getValue());
        float_4 diff = in[RAW_INPUT] - oldOut[s];
        out[RISE_OUTPUT] = ifelse(diff>minDelta, hi, lo);
        out[FALL_OUTPUT] = ifelse(diff<-minDelta, hi, lo);
        out[FLAT_OUTPUT] = ifelse(out[RISE_OUTPUT]+out[FALL_OUTPUT]<=lo, hi, lo);
        float_4 lin = oldOut[s] + ifelse(diff>float_4::zero(), fmin(diff, kLin*riseMult), -fmin(-diff, kLin*fallMult));
        float_4 curve = clamp(oldOut[s] + diff * 48000.f * ifelse(diff>float_4::zero(), riseMult, fallMult) / kCurve / args.sampleRate / oversample, -20.f, 20.f);
        float_4 curveAmt = clamp(ifelse( diff>float_4::zero(), 
                                         params[RISE_SHAPE_PARAM].getValue() + in[RISE_SHAPE_CV_INPUT]*params[RISE_SHAPE_CV_PARAM].getValue()/10.f,
                                         params[FALL_SHAPE_PARAM].getValue() + in[FALL_SHAPE_CV_INPUT]*params[FALL_SHAPE_CV_PARAM].getValue()/10.f ));
        out[SLEW_OUTPUT] = curve*curveAmt + lin*(1-curveAmt);
        //save old slew value
        oldOut[s] = out[SLEW_OUTPUT];
        // downsample output
        if (oversample > 1) {
          for (int i=0; i<OUTPUTS_LEN; i++) {
            if (outputs[i].isConnected())
              out[i] = downSample[i][s].process(out[i]);
          }
        }
      } // end oversample loop
      // write output
      for (int i=0; i<OUTPUTS_LEN; i++)
        outputs[i].setVoltageSimd(out[i], c);
    } // end channel loop
    // set output channel count
    for (int i=0; i<OUTPUTS_LEN; i++)
      outputs[i].setChannels(channels);
  }

  json_t* dataToJson() override {
    json_t* rootJ = VenomModule::dataToJson();
    json_object_set_new(rootJ, "overMinDeltaIndex", json_integer(overMinDeltaIndex));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    VenomModule::dataFromJson(rootJ);
    json_t* val;
    if ((val = json_object_get(rootJ, "overMinDeltaIndex")))
      overMinDeltaIndex = json_integer_value(val);
    else
      overMinDeltaIndex = 4;
  }


  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
  void setState(int id, float value) override {
    json_t* root = dataToJson();
    if (!json_is_object(root)) { json_decref(root); root = json_object(); }
    switch (id) {
      case 0: json_object_set_new(root, "overMinDeltaIndex", json_integer(static_cast<long long>(value))); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
}

RACK_WEB_EXPORTS(Venom::Slew)
