// Automatically isolated from the original Rack DSP module for Venom/SVF.
// Source: https://github.com/DaveBenham/VenomModules (src/SVF.cpp; registered in src/SVF.cpp)
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


struct SVF : VenomModule {
 
  enum ParamId {
    FREQ_PARAM,
    SLOPE_PARAM,
    RANGE_PARAM,
    FREQ_CV_PARAM,
    RES_PARAM,
    RES_CV_PARAM,
    DRIVE_PARAM,
    DRIVE_CV_PARAM,
    SPREAD_PARAM,
    SPREAD_DIR_PARAM,
    SPREAD_MONO_PARAM,
    SPREAD_CV_PARAM,
    FDBK_PARAM,
    FDBK_CV_PARAM,
    MORPH_PARAM,
    MORPH_MODE_PARAM,
    MORPH_CV_PARAM,
    VCA_PARAM,
    INPUT_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    VOCT_INPUT,
    FREQ_CV_INPUT,
    RES_CV_INPUT,
    DRIVE_CV_INPUT,
    SPREAD_CV_INPUT,
    FDBK_CV_INPUT,
    MORPH_CV_INPUT,
    L_INPUT,
    R_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    L_MORPH_OUTPUT,
    R_MORPH_OUTPUT,
    L_LOW_OUTPUT,
    R_LOW_OUTPUT,
    L_HIGH_OUTPUT,
    R_HIGH_OUTPUT,
    L_BAND_OUTPUT,
    R_BAND_OUTPUT,
    L_NOTCH_OUTPUT,
    R_NOTCH_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };
  
  std::string freqName[2] {"Cutoff frequency", "Cutoff frequency left"};
  std::string spreadName[2] {"Cutoff spread", "Cutoff frequency right"};

  using float_4 = simd::float_4;
  float maxFreq;
  float sampleRate;
  float rangeFreq[2] {dsp::FREQ_C4, 2.f};
  float rangeMaxFreq[2][8] {
 //sample rate 11kHz 12kHz 22kHz 24kHz 44kHz  48kHz  88kHz  96kHz+
              {3750, 4000, 7500, 8000, 15000, 16000, 30000, 32000},
              {1250, 1250, 2500, 2500,  5000,  5000, 10000, 10000}
        };
  int oversample = 4,
      range = 0;
  int rangeOver[2] {4,1};
  bool disableDCBlock = false;
  float_4 state[4][8]{}, 
          modeState[4][7][4][8]{},
          fdbkOld[8]{};
  OversampleFilter_4 stereoUpSample[8]{},
                     lowDownSample[8]{},
                     morphDownSample[8]{},
                     bandDownSample[8]{},
                     highDownSample[8]{},
                     notchDownSample[8]{};

  DCBlockFilter_4 dcBlockFilter[6][8]{};

  #define LOW 0
  #define HIGH 1
  #define BAND 2
  #define NOTCH 3
  #define MORPH 4
  #define STEREOIN 5

  struct FreqQuantity:ParamQuantity {
    float maxFreq = 0;
    float getDisplayValue() override {
      float rtn = ParamQuantity::getDisplayValue();
      return rtn>maxFreq ? maxFreq : rtn;
    }
  };

  struct SpreadQuantity:ParamQuantity {
    float maxFreq = 0;
    float getDisplayValue() override {
      if (displayBase == 2.f) {
        float rtn = pow(2.f, getValue()*2.5f + 1.f) * displayMultiplier;
        return rtn>maxFreq ? maxFreq : rtn;
      }
      else
        return ParamQuantity::getDisplayValue();
    }
    void setDisplayValue(float v) override {
      if (displayBase == 2.f)
        setValue(clamp((std::log2f(v / displayMultiplier)-1.f) / 2.5f, -2.f, 2.f));
      else
        ParamQuantity::setDisplayValue(v);
    }
  };

  struct FdbkQuantity:ParamQuantity {
    float getDisplayValue() override {
      float rtn = ParamQuantity::getDisplayValue();
      return rtn<0.001f ? 0.f : rtn;
    }
  };

  SVF() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);

    configParam<FreqQuantity>(FREQ_PARAM, -4.f, 6.f, 0.f, freqName[0], " Hz", 2.f, rangeFreq[range], 0.f);
    configSwitch<ParamQuantity>(SLOPE_PARAM, 0.f, 7.f, 0.f, "Slope", {"12dB", "24dB", "36dB", "48dB", "60dB", "72dB", "84dB", "96dB"});
    configSwitch<ParamQuantity>(RANGE_PARAM, 0.f, 1.f, 0.f, "Frequency range", {"Audio rate", "Low frequency"});
    configInput(VOCT_INPUT, "V/Oct");
    configParam(FREQ_CV_PARAM, -1.f, 1.f, 0.f, "Cutoff CV amount", "%", 0.f, 100.f, 0.f);
    configInput(FREQ_CV_INPUT, "Cutoff CV");

    configParam(RES_PARAM, 0.f, 1.f, 0.f, "Resonance");
    configParam(RES_CV_PARAM, -1.f, 1.f, 0.f, "Resonance CV amount", "%", 0.f, 100.f, 0.f);
    configInput(RES_CV_INPUT, "Resonance CV");

    configParam(DRIVE_PARAM, 0.f, 10.f, 1.f, "Gain");
    configSwitch<ParamQuantity>(VCA_PARAM, 0.f, 1.f, 0.f, "Gain VCA polarity", {"Unipolar", "Bipolar"});
    configParam(DRIVE_CV_PARAM, -1.f, 1.f, 0.f, "Gain CV amount", "%", 0.f, 100.f, 0.f);
    configInput(DRIVE_CV_INPUT, "Gain CV");
    
    configParam<SpreadQuantity>(SPREAD_PARAM, -2.f, 2.f, 0.f, spreadName[0], "");
    configSwitch<ParamQuantity>(SPREAD_DIR_PARAM, 0.f, 2.f, 0.f, "Spread direction", {"Bipolar (both)", "Unipolar (right)", "Right absolute"});
    configSwitch<ParamQuantity>(SPREAD_MONO_PARAM, 0.f, 1.f, 0.f, "Spread mono mode", {"Additive", "Subtractive"});
    configParam(SPREAD_CV_PARAM, -1.f, 1.f, 0.f, "Cutoff spread CV amount", "%", 0.f, 100.f, 0.f);
    configInput(SPREAD_CV_INPUT, "Cutoff spread CV");

    configParam<FdbkQuantity>(FDBK_PARAM, -10.f, 0.f, -10.f, "Feedback", "", 2.f, 1.f, 0.f);
    configParam(FDBK_CV_PARAM, -1.f, 1.f, 0.f, "Feedback CV amount", "%", 0.f, 100.f, 0.f);
    configInput(FDBK_CV_INPUT, "Feedback CV");

    configParam(MORPH_PARAM, 0.f, 1.f, 0.5f, "Morph", "");
    configSwitch<ParamQuantity>(MORPH_MODE_PARAM, 0.f, 8.f, 2.f, "Morph mode", {"LP <-> BP", "LP <-> BP <-> HP", "LP <-> HP", "BP <-> HP", "BP <-> Notch", 
                                                                                      "Dry <-> Wet LP", "Dry <-> Wet HP", "Dry <-> Wet BP", "Dry <-> Wet Notch"});
    configParam(MORPH_CV_PARAM, -1.f, 1.f, 0.f, "Morph CV Amount", "%", 0.f, 100.f, 0.f);
    configInput(MORPH_CV_INPUT, "Morph CV");

    configSwitch<ParamQuantity>(INPUT_PARAM, 0.f, 1.f, 0.f, "Input coupling", {"DC", "AC"});
    configInput(L_INPUT, "Left");
    configInput(R_INPUT, "Right");
    configOutput(L_MORPH_OUTPUT, "Left morph");
    configOutput(R_MORPH_OUTPUT, "Right morph");

    configOutput(L_LOW_OUTPUT, "Left low pass");
    configOutput(R_LOW_OUTPUT, "Right low pass");
    configOutput(L_HIGH_OUTPUT, "Left high pass");
    configOutput(R_HIGH_OUTPUT, "Right high pass");
   
    configOutput(L_BAND_OUTPUT, "Left band pass");
    configOutput(R_BAND_OUTPUT, "Right band pass");
    configOutput(L_NOTCH_OUTPUT, "Left notch");
    configOutput(R_NOTCH_OUTPUT, "Right notch");
    
    for (int i=0; i<OUTPUTS_LEN; i+=2){
      configBypass(L_INPUT,i);
      configBypass(R_INPUT,i+1);
    }
    
    setOversample();
  }

  void setOversample() override {
    for (int i=0; i<8; i++){
      stereoUpSample[i].setOversample(oversample, 5);
      morphDownSample[i].setOversample(oversample, 5);
      lowDownSample[i].setOversample(oversample, 5);
      bandDownSample[i].setOversample(oversample, 5);
      highDownSample[i].setOversample(oversample, 5);
      notchDownSample[i].setOversample(oversample, 5);
    }
  }

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);

    int slope = params[SLOPE_PARAM].getValue(),
        dir = params[SPREAD_DIR_PARAM].getValue(),
        mono = params[SPREAD_MONO_PARAM].getValue(),
        mode = params[MORPH_MODE_PARAM].getValue(),
        inputMode = params[INPUT_PARAM].getValue();

    SpreadQuantity *spreadQuantity = static_cast<SpreadQuantity*>(paramQuantities[SPREAD_PARAM]);
    FreqQuantity *freqQuantity = static_cast<FreqQuantity*>(paramQuantities[FREQ_PARAM]);

    // update range
    if (range != static_cast<int>(params[RANGE_PARAM].getValue())) {
      range = static_cast<int>(params[RANGE_PARAM].getValue());
      oversample = rangeOver[range];
      freqQuantity->displayMultiplier = rangeFreq[range];
      if (dir == 2)
        spreadQuantity->displayMultiplier = rangeFreq[range];
      sampleRate = 0.f;
    }
    // update sampleRate
    if (sampleRate != args.sampleRate){
      sampleRate = args.sampleRate;
      maxFreq = rangeMaxFreq[range][
                    sampleRate<12000 ? 0
                  : sampleRate<22000 ? 1
                  : sampleRate<24000 ? 2
                  : sampleRate<44000 ? 3
                  : sampleRate<48000 ? 4
                  : sampleRate<88000 ? 5
                  : sampleRate<96000 ? 6
                  : 7];
      freqQuantity->maxFreq = maxFreq;
      spreadQuantity->maxFreq = maxFreq;
      for (int i=0; i<6; i++)
        for (int j=0; j<8; j++)
          dcBlockFilter[i][j].init(oversample, sampleRate);
    }

    if ((dir==2) != (spreadQuantity->displayBase==2.f)) {
      ParamExtension *freqExt = &paramExtensions[FREQ_PARAM];
      ParamExtension *spreadExt = &paramExtensions[SPREAD_PARAM];
      if (dir==2) {
        if (freqQuantity->name == freqExt->factoryName)
          freqQuantity->name = freqName[1];
        freqExt->factoryName = freqName[1];
        if (spreadQuantity->name == spreadExt->factoryName)
          spreadQuantity->name = spreadName[1];
        spreadExt->factoryName = spreadName[1];
        spreadQuantity->unit = " Hz";
        spreadQuantity->displayBase = 2.f;
        spreadQuantity->displayMultiplier = rangeFreq[range];
      } else {
        if (freqQuantity->name == freqExt->factoryName)
          freqQuantity->name = freqName[0];
        freqExt->factoryName = freqName[0];
        if (spreadQuantity->name == spreadExt->factoryName)
          spreadQuantity->name = spreadName[0];
        spreadExt->factoryName = spreadName[0];
        spreadQuantity->unit = "";
        spreadQuantity->displayBase = 0.f;
        spreadQuantity->displayMultiplier = 1.f;
      }
    }
    
    float resParam = params[RES_PARAM].getValue(),
          driveParam = params[DRIVE_PARAM].getValue(),
          fdbkParam = params[FDBK_PARAM].getValue(),
          morphParam = params[MORPH_PARAM].getValue(),
          freqCVAmt = params[FREQ_CV_PARAM].getValue(),
          resCVAmt = params[RES_CV_PARAM].getValue() / 10.f,
          driveCVAmt = params[DRIVE_CV_PARAM].getValue(),
          spreadCVAmt = params[SPREAD_CV_PARAM].getValue(),
          fdbkCVAmt = params[FDBK_CV_PARAM].getValue(),
          morphCVAmt = params[MORPH_CV_PARAM].getValue() / 10.f,
          sampleTimePi = M_PI * args.sampleTime / oversample,
          minGain = params[VCA_PARAM].getValue() ? -10.f : 0.f;

    float_4 spreadParam{},
            freqParam{},
            voctIn{},
            freqIn{},
            resIn{},
            driveIn{},
            spreadIn{},
            fdbkIn{},
            morphIn{},
            stereoIn{},
            voct{},
            freq{},
            res{},
            drive{},
            fdbkAmt{},
            stereo{},
            f{},
            q{},
            low{},
            band{},
            high{},
            notch{},
            morph{},
            morphARatio{},
            morphBRatio{},
            morphBHigh{},
            morphA,
            morphB;

    bool stereoConnected = inputs[L_INPUT].isConnected() || inputs[R_INPUT].isConnected(),
         outConnected[5]{ outputs[L_LOW_OUTPUT].isConnected() || outputs[R_LOW_OUTPUT].isConnected(),
                          outputs[L_HIGH_OUTPUT].isConnected() || outputs[R_HIGH_OUTPUT].isConnected(),
                          outputs[L_BAND_OUTPUT].isConnected() || outputs[R_BAND_OUTPUT].isConnected(),
                          outputs[L_NOTCH_OUTPUT].isConnected() || outputs[R_NOTCH_OUTPUT].isConnected(),
                          outputs[L_MORPH_OUTPUT].isConnected() || outputs[R_MORPH_OUTPUT].isConnected() },
         rightConnected[5]{ outputs[R_LOW_OUTPUT].isConnected(),
                            outputs[R_HIGH_OUTPUT].isConnected(),
                            outputs[R_BAND_OUTPUT].isConnected(),
                            outputs[R_NOTCH_OUTPUT].isConnected(),
                            outputs[R_MORPH_OUTPUT].isConnected() };

    switch (dir) {
      case 0: // bipolar
        freqParam = params[FREQ_PARAM].getValue();
        spreadParam[0] = spreadParam[2] = params[SPREAD_PARAM].getValue()*-0.5f;
        spreadParam[1] = spreadParam[3] = -spreadParam[0];
        break;
      case 1: // unipolar
        freqParam = params[FREQ_PARAM].getValue();
        spreadParam[1] = spreadParam[3] = params[SPREAD_PARAM].getValue();
        break;
      case 2: // unipolar absolute
        freqParam[0] = freqParam[2] = params[FREQ_PARAM].getValue();
        spreadParam[1] = spreadParam[3] = params[SPREAD_PARAM].getValue()*2.5f + 1.f;
        break;
    }

    // get channel count
    int channels=1;
    for (int i=0; i<INPUTS_LEN; i++){
      if(inputs[i].getChannels() > channels)
        channels = inputs[i].getChannels();
    }

    for (int s=0, c1=0, c2=1; c1<channels; s++, c1+=2, c2+=2) { // poly channel loop
      resIn[0] = inputs[RES_CV_INPUT].getPolyVoltage(c1);
      resIn[1] = resIn[0];
      resIn[2] = inputs[RES_CV_INPUT].getPolyVoltage(c2);
      resIn[3] = resIn[2];
      driveIn[0] = inputs[DRIVE_CV_INPUT].getPolyVoltage(c1);
      driveIn[1] = driveIn[0];
      driveIn[2] = inputs[DRIVE_CV_INPUT].getPolyVoltage(c2);
      driveIn[3] = driveIn[2];
      switch (dir) {
        case 0: // bipolar
          voctIn[0] = voctIn[1] = inputs[VOCT_INPUT].getPolyVoltage(c1);
          voctIn[2] = voctIn[3] = inputs[VOCT_INPUT].getPolyVoltage(c2);
          freqIn[0] = freqIn[1] = inputs[FREQ_CV_INPUT].getPolyVoltage(c1);
          freqIn[2] = freqIn[2] = inputs[FREQ_CV_INPUT].getPolyVoltage(c2);
          spreadIn[0] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c1)*-0.5f;
          spreadIn[2] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c2)*-0.5f;
          spreadIn[1] = -spreadIn[0];
          spreadIn[3] = -spreadIn[2];
          break;
        case 1: // unipolar
          voctIn[0] = voctIn[1] = inputs[VOCT_INPUT].getPolyVoltage(c1);
          voctIn[2] = voctIn[3] = inputs[VOCT_INPUT].getPolyVoltage(c2);
          freqIn[0] = freqIn[1] = inputs[FREQ_CV_INPUT].getPolyVoltage(c1);
          freqIn[2] = freqIn[2] = inputs[FREQ_CV_INPUT].getPolyVoltage(c2);
          spreadIn[1] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c1);
          spreadIn[3] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c2);
          break;
        case 2: // unipolar absolute
          voctIn[0] = inputs[VOCT_INPUT].getPolyVoltage(c1);
          voctIn[2] = inputs[VOCT_INPUT].getPolyVoltage(c2);
          freqIn[0] = inputs[FREQ_CV_INPUT].getPolyVoltage(c1);
          freqIn[2] = inputs[FREQ_CV_INPUT].getPolyVoltage(c2);
          spreadIn[1] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c1);
          spreadIn[3] = inputs[SPREAD_CV_INPUT].getPolyVoltage(c2);
          break;
      }
      fdbkIn[0] = inputs[FDBK_CV_INPUT].getPolyVoltage(c1);
      fdbkIn[1] = fdbkIn[0];
      fdbkIn[2] = inputs[FDBK_CV_INPUT].getPolyVoltage(c2);
      fdbkIn[3] = fdbkIn[2];

      morphIn[0] = inputs[MORPH_CV_INPUT].getPolyVoltage(c1);
      morphIn[1] = morphIn[0];
      morphIn[2] = inputs[MORPH_CV_INPUT].getPolyVoltage(c2);
      morphIn[3] = morphIn[2];

      stereoIn[0] = inputs[L_INPUT].getPolyVoltage(c1);
      stereoIn[1] = inputs[R_INPUT].getNormalPolyVoltage(stereoIn[0], c1);
      stereoIn[2] = inputs[L_INPUT].getPolyVoltage(c2);
      stereoIn[3] = inputs[R_INPUT].getNormalPolyVoltage(stereoIn[2], c2);
      if (inputMode)
        stereoIn = dcBlockFilter[STEREOIN][s].process(stereoIn);
      stereoIn *= 10.f;
      freq = pow(2.f, freqParam + voctIn + freqIn*freqCVAmt + spreadParam + spreadIn*spreadCVAmt) * rangeFreq[range];
      freq = ifelse(freq>maxFreq, maxFreq, freq);
      res = clamp(resParam + resIn * resCVAmt) * 4.5f;
      drive = clamp(driveParam + driveIn * driveCVAmt, minGain, 10.f);
      fdbkAmt = clamp(pow(2.f, fdbkParam + fdbkIn*fdbkCVAmt));
      fdbkAmt = ifelse(fdbkAmt<0.001f, 0.f, fdbkAmt);
      if (range==0)
        fdbkAmt *= 0.5;
      f = 2.f * sin(sampleTimePi * freq);
      q = (slope==0) ? 1.f / pow(2.f, res) : 1.f;
      if (outConnected[MORPH]){
        morphBRatio = clamp(morphParam + morphIn*morphCVAmt);
        if (mode==1){
          morphBRatio *= 2.f;
          morphBHigh = morphBRatio > 1.f;
          morphBRatio = ifelse(morphBHigh, morphBRatio - 1.f, morphBRatio);
        }
        morphARatio = 1.f - morphBRatio;
      }
      for (int o=0; o<oversample; o++){ // oversample loop
        if (oversample>1 && stereoConnected) {
          stereoIn = stereoUpSample[s].process(o ? 0.f : stereoIn*oversample);
        }
        stereo = (stereoIn * drive) + (1e-4f * (2.f*random::uniform() - 1.f)) + (fdbkOld[s] * fdbkAmt);
        notch = state[NOTCH][s] = q * state[BAND][s] - stereo;
        high = state[HIGH][s] = -(state[NOTCH][s] + state[LOW][s]);
        band = state[BAND][s] = state[BAND][s] + f * state[HIGH][s];
        low = state[LOW][s] = state[LOW][s] + f * state[BAND][s];
        for (int i=0; i<slope; i++){ // slope loop
          if (i==slope-1)
            q = 1.f / pow(2.f, res);
          int b=LOW;
          if (outConnected[b] || outConnected[MORPH]){
            stereo = low;
            modeState[b][i][NOTCH][s] = q * modeState[b][i][BAND][s] - stereo;
            modeState[b][i][HIGH][s] = -(modeState[b][i][NOTCH][s] + modeState[b][i][LOW][s]);
            modeState[b][i][BAND][s] = modeState[b][i][BAND][s] + f * modeState[b][i][HIGH][s];
            low = modeState[b][i][LOW][s] = modeState[b][i][LOW][s] + f * modeState[b][i][BAND][s];
          }
          b=HIGH;
          if (outConnected[b] || outConnected[MORPH]){
            stereo = high;
            modeState[b][i][NOTCH][s] = q * modeState[b][i][BAND][s] - stereo;
            high = modeState[b][i][HIGH][s] = -(modeState[b][i][NOTCH][s] + modeState[b][i][LOW][s]);
            modeState[b][i][BAND][s] = modeState[b][i][BAND][s] + f * modeState[b][i][HIGH][s];
            modeState[b][i][LOW][s] = modeState[b][i][LOW][s] + f * modeState[b][i][BAND][s];
          }
          b=BAND;
          // always compute band states for feedback
            stereo = band;
            modeState[b][i][NOTCH][s] = q * modeState[b][i][BAND][s] - stereo;
            modeState[b][i][HIGH][s] = -(modeState[b][i][NOTCH][s] + modeState[b][i][LOW][s]);
            band = modeState[b][i][BAND][s] = modeState[b][i][BAND][s] + f * modeState[b][i][HIGH][s];
            modeState[b][i][LOW][s] = modeState[b][i][LOW][s] + f * modeState[b][i][BAND][s];
          //
          b=NOTCH;
          if (outConnected[b]){
            stereo = notch;
            notch = modeState[b][i][NOTCH][s] = q * modeState[b][i][BAND][s] - stereo;
            modeState[b][i][HIGH][s] = -(modeState[b][i][NOTCH][s] + modeState[b][i][LOW][s]);
            modeState[b][i][BAND][s] = modeState[b][i][BAND][s] + f * modeState[b][i][HIGH][s];
            modeState[b][i][LOW][s] = modeState[b][i][LOW][s] + f * modeState[b][i][BAND][s];
          }
        } // end slope loop
        fdbkOld[s] = softClip(band/10.f);
        if (outConnected[MORPH]){
          switch (mode){
            case 0:
              morphA = low;
              morphB = band * (slope%4==1 ? -1.f : 1.f);
              break;
            case 1:
              morphA = ifelse(morphBHigh, band * (slope%4==1 ? -1.f : 1.f), low);
              morphB = ifelse(morphBHigh, high, band * (slope%4==1 ? -1.f : 1.f));
              break;
            case 2:
              morphA = low;
              morphB = high * (slope%2 ? 1.f : -1.f);
              break;
            case 3:
              morphA = band * (slope%4==1 ? -1.f : 1.f);
              morphB = high;
              break;
            case 4:
              morphA = band;
              morphB = notch * (slope%2 ? 1.f : -1.f);
              break;
            case 5:
              morphA = stereoIn;
              morphB = low;
              break;
            case 6:
              morphA = stereoIn;
              morphB = high;
              break;
            case 7:
              morphA = stereoIn;
              morphB = band;
              break;
            case 8:
              morphA = stereoIn;
              morphB = notch * (slope%2 ? 1.f : -1.f);
          }
          if (mode<5){
            morph = morphA * morphARatio + morphB * morphBRatio;
            if (!rightConnected[MORPH]){
              morph[0] = mono ? morph[0]-morph[1] : (morph[0]+morph[1])/2.f;
              morph[2] = mono ? morph[2]-morph[3] : (morph[2]+morph[3])/2.f;
            }
            morph = softClip(morph*0.1f);
          }
          else {
            if (!rightConnected[MORPH]){
              morphB[0] = mono ? morphB[0]-morphB[1] : (morphB[0]+morphB[1])/2.f;
              morphB[2] = mono ? morphB[2]-morphB[3] : (morphB[2]+morphB[3])/2.f;
            }
            morph = morphA*morphARatio*0.1f + softClip(morphB*0.1f)*morphBRatio;
          }
          if (oversample>1)
            morph = morphDownSample[s].process(morph);
        }
        if (outConnected[LOW]){
          if (!rightConnected[LOW]){
            low[0] = mono ? low[0]-low[1] : (low[0]+low[1])/2.f;
            low[2] = mono ? low[2]-low[3] : (low[2]+low[3])/2.f;
            low[1] = low[3] = 0.f;
          }
          low = softClip(low*0.1f);
          if (oversample>1)
            low = lowDownSample[s].process(low);
        }
        if (outConnected[HIGH]){
          if (!rightConnected[HIGH]){
            high[0] = mono ? high[0]-high[1] : (high[0]+high[1])/2.f;
            high[2] = mono ? high[2]-high[3] : (high[2]+high[3])/2.f;
            high[1] = high[3] = 0.f;
          }
          high = softClip(high*0.1f);
          if (oversample>1)
            high = highDownSample[s].process(high);
        }
        if (outConnected[BAND]){
          if (!rightConnected[BAND]){
            band[0] = mono ? band[0]-band[1] : (band[0]+band[1])/2.f;
            band[2] = mono ? band[2]-band[3] : (band[2]+band[3])/2.f;
            band[1] = band[3] = 0.f;
          }
          band = softClip(band*0.1f);
          if (oversample>1)
            band = bandDownSample[s].process(band);
        }
        if (outConnected[NOTCH]){
          if (!rightConnected[NOTCH]){
            notch[0] = mono ? notch[0]-notch[1] : (notch[0]+notch[1])/2.f;
            notch[2] = mono ? notch[2]-notch[3] : (notch[2]+notch[3])/2.f;
            notch[1] = notch[3] = 0.f;
          }
          notch = softClip(notch*0.1f * (slope%2 ? 1.f : -1.f));
          if (oversample>1)
            notch = notchDownSample[s].process(notch);
        }
      } // end oversample loop
      if (range==0 && !disableDCBlock){
        if (outConnected[MORPH])
          morph = dcBlockFilter[MORPH][s].process(morph);
        if (outConnected[LOW])
          low = dcBlockFilter[LOW][s].process(low);
        if (outConnected[HIGH])
          high = dcBlockFilter[HIGH][s].process(high);
        if (outConnected[BAND])
          band = dcBlockFilter[BAND][s].process(band);
        if (outConnected[NOTCH])
          notch = dcBlockFilter[NOTCH][s].process(notch);
      }
      outputs[L_MORPH_OUTPUT].setVoltage(morph[0], c1);
      outputs[R_MORPH_OUTPUT].setVoltage(morph[1], c1);
      outputs[L_MORPH_OUTPUT].setVoltage(morph[2], c2);
      outputs[R_MORPH_OUTPUT].setVoltage(morph[3], c2);
      
      outputs[L_LOW_OUTPUT].setVoltage(low[0], c1);
      outputs[R_LOW_OUTPUT].setVoltage(low[1], c1);
      outputs[L_LOW_OUTPUT].setVoltage(low[2], c2);
      outputs[R_LOW_OUTPUT].setVoltage(low[3], c2);

      outputs[L_HIGH_OUTPUT].setVoltage(high[0], c1);
      outputs[R_HIGH_OUTPUT].setVoltage(high[1], c1);
      outputs[L_HIGH_OUTPUT].setVoltage(high[2], c2);
      outputs[R_HIGH_OUTPUT].setVoltage(high[3], c2);

      outputs[L_BAND_OUTPUT].setVoltage(band[0], c1);
      outputs[R_BAND_OUTPUT].setVoltage(band[1], c1);
      outputs[L_BAND_OUTPUT].setVoltage(band[2], c2);
      outputs[R_BAND_OUTPUT].setVoltage(band[3], c2);

      outputs[L_NOTCH_OUTPUT].setVoltage(notch[0], c1);
      outputs[R_NOTCH_OUTPUT].setVoltage(notch[1], c1);
      outputs[L_NOTCH_OUTPUT].setVoltage(notch[2], c2);
      outputs[R_NOTCH_OUTPUT].setVoltage(notch[3], c2);
     
    } // end poly channel loop
    outputs[L_MORPH_OUTPUT].setChannels(channels);
    outputs[L_LOW_OUTPUT].setChannels(channels);
    outputs[L_HIGH_OUTPUT].setChannels(channels);
    outputs[L_BAND_OUTPUT].setChannels(channels);
    outputs[L_NOTCH_OUTPUT].setChannels(channels);
    outputs[R_MORPH_OUTPUT].setChannels(channels);
    outputs[R_LOW_OUTPUT].setChannels(channels);
    outputs[R_HIGH_OUTPUT].setChannels(channels);
    outputs[R_BAND_OUTPUT].setChannels(channels);
    outputs[R_NOTCH_OUTPUT].setChannels(channels);
  }

  json_t* dataToJson() override {
    json_t* rootJ = VenomModule::dataToJson();
    json_object_set_new(rootJ, "disableDCBlock", json_boolean(disableDCBlock));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    VenomModule::dataFromJson(rootJ);
    json_t* val;
    if ((val = json_object_get(rootJ, "disableDCBlock"))) {
      disableDCBlock = json_boolean_value(val);
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
      case 0: json_object_set_new(root, "disableDCBlock", json_boolean(value != 0.f)); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
}

RACK_WEB_EXPORTS(Venom::SVF)
