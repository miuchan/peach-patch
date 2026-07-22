// Automatically isolated from the original Rack DSP module for Venom/VCAMix4Stereo.
// Source: https://github.com/DaveBenham/VenomModules (src/VCAMix4Stereo.cpp; registered in src/VCAMix4Stereo.cpp)
// License: GPL-3.0-or-later

#include "rack_web_export.hpp"

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


struct MixModule : VenomModule {
  
  enum MixTypeId {
    MIX4_TYPE,
    MIX4ST_TYPE,
    VCAMIX4_TYPE,
    VCAMIX4ST_TYPE,
    MIXFADE_TYPE,
    MIXFADE2_TYPE,
    MIXMUTE_TYPE,
    MIXOFFSET_TYPE,
    MIXPAN_TYPE,
    MIXSEND_TYPE,
    MIXSOLO_TYPE
  };
  
  // all
  int mixType=-1;
  bool baseMod = false;
  bool stereo = false;

  // base only
  bool softMute = true;
  bool toggleMute = false;
  int monoPanLaw=2;    // +3 dB side
  int stereoPanLaw=10; // Follow mono law

  // expander only
  bool connected = false;

  enum ExpLightId {
    EXP_LIGHT,
    EXP_LIGHTS_LEN
  };
  
  enum FadeParamId {
    ENUMS(FADE_TIME_PARAM,4),
    FADE_MIX_TIME_PARAM,
    ENUMS(FADE_SHAPE_PARAM,4),
    FADE_MIX_SHAPE_PARAM,
    FADE_PARAMS_LEN
  };
  enum FadeInputId {
    FADE_INPUTS_LEN
  };
  enum FadeOutputId {
    ENUMS(FADE_OUTPUT,4),
    FADE_MIX_OUTPUT,
    FADE_OUTPUTS_LEN
  };
  
  enum Fade2ParamId {
    ENUMS(RISE_TIME_PARAM,4),
    ENUMS(FALL_TIME_PARAM,4),
    MIX_RISE_TIME_PARAM,
    MIX_FALL_TIME_PARAM,
    ENUMS(FADE2_SHAPE_PARAM,4),
    FADE2_MIX_SHAPE_PARAM,
    FADE2_PARAMS_LEN
  };
  enum Fade2InputId {
    FADE2_INPUTS_LEN
  };
  enum Fade2OutputId {
    ENUMS(FADE2_OUTPUT,4),
    FADE2_MIX_OUTPUT,
    FADE2_OUTPUTS_LEN
  };

  enum MuteParamId {
    ENUMS(MUTE_PARAM,4),
    MUTE_MIX_PARAM,
    MUTE_PARAMS_LEN
  };
  enum MuteInputId {
    ENUMS(MUTE_INPUT,4),
    MUTE_MIX_INPUT,
    MUTE_INPUTS_LEN
  };
  enum MuteOutputId {
    MUTE_OUTPUTS_LEN
  };
  enum MuteLightId {
    MUTE_EXP_LIGHT,
    ENUMS(MUTE_LIGHT,4),
    MUTE_MIX_LIGHT,
    MUTE_LIGHTS_LEN
  };
  
  enum OffsetParamId {
    ENUMS(PRE_OFFSET_PARAM,4),
    PRE_MIX_OFFSET_PARAM,
    ENUMS(POST_OFFSET_PARAM,4),
    POST_MIX_OFFSET_PARAM,
    OFFSET_PARAMS_LEN
  };
  enum OffsetInputId {
    OFFSET_INPUTS_LEN
  };
  enum OffsetOutputId {
    OFFSET_OUTPUTS_LEN
  };
  
  enum PanParamId {
    ENUMS(PAN_PARAM,4),
    ENUMS(PAN_CV_PARAM,4),
    PAN_PARAMS_LEN
  };
  enum PanInputId {
    ENUMS(PAN_INPUT,4),
    PAN_INPUTS_LEN
  };
  enum PanOutputId {
    PAN_OUTPUTS_LEN
  };
  
  enum SendParamId {
    ENUMS(SEND_PARAM,4),
    RETURN_PARAM,
    SEND_MUTE_PARAM,
    SEND_CHAIN_PARAM,
    SEND_PARAMS_LEN
  };
  enum SendInputId {
    LEFT_RETURN_INPUT,
    RIGHT_RETURN_INPUT,
    SEND_INPUTS_LEN
  };
  enum SendOutputId {
    LEFT_SEND_OUTPUT,
    RIGHT_SEND_OUTPUT,
    SEND_OUTPUTS_LEN
  };
  enum SendLightId {
    RETURN_EXP_LIGHT,
    RETURN_MUTE_LIGHT,
    SEND_LIGHTS_LEN
  };
  
  enum SoloParamId {
    ENUMS(SOLO_PARAM,4),
    SOLO_PARAMS_LEN
  };
  enum SoloInputId {
    ENUMS(SOLO_INPUT,4),
    SOLO_INPUTS_LEN
  };
  enum SoloOutputId {
    SOLO_OUTPUTS_LEN
  };
  enum SoloLightId {
    SOLO_EXP_LIGHT,
    ENUMS(SOLO_LIGHT,4),
    SOLO_LIGHTS_LEN
  };
  
  MixModule* leftExpander = NULL;
  MixModule* rightExpander = NULL;
  dsp::SchmittTrigger muteCV[5], soloCV[4];
  dsp::SlewLimiter fade[5];

  void onExpanderChange(const ExpanderChangeEvent& e) override {
    if (e.side)
      rightExpander = dynamic_cast<MixModule*>(getRightExpander().module);
    else
      leftExpander = dynamic_cast<MixModule*>(getLeftExpander().module);
  }


};


struct MixBaseModule : MixModule {
  bool mutePresent = false;
  bool offsetPresent = false;
  bool panPresent = false;
  bool sendPresent = true;
  bool soloPresent = false;
  bool fadePresent = false;
  MixModule* offsetExpander = NULL;
  MixModule* muteSoloExpander = NULL;
  MixModule* fadeExpander = NULL;
  MixModule* expanders[16]{};
  unsigned int expandersCnt = 0;

  void process(const ProcessArgs& args) override {
    VenomModule::process(args);

    mutePresent = false;
    offsetPresent = false;
    panPresent = false;
    sendPresent = false;
    soloPresent = false;
    fadePresent = false;
    
    // Clear expanders
    offsetExpander = NULL;
    muteSoloExpander = NULL;
    fadeExpander = NULL;
    expandersCnt=0;
    unsigned int maxExpandersCnt=16;
    // Load expanders
    for (MixModule* mod = rightExpander; mod && expandersCnt<maxExpandersCnt; mod = mod->rightExpander) {
      if (mod->mixType == MIXMUTE_TYPE && !mutePresent && (!soloPresent || mod->leftExpander->mixType == MIXSOLO_TYPE)) {
        mutePresent = true;
        if (soloPresent) {
          if (!mod->isBypassed()) muteSoloExpander = mod;
        }
        else
          expanders[expandersCnt++] = mod;
      }
      else if ((mod->mixType == MIXFADE_TYPE || mod->mixType == MIXFADE2_TYPE) && !fadePresent && (mod->leftExpander->mixType == MIXMUTE_TYPE || mod->leftExpander->mixType == MIXSOLO_TYPE)) {
        fadePresent = true;
        if (!mod->isBypassed()) fadeExpander = mod;
      }  
      else if (mod->mixType == MIXOFFSET_TYPE && rightExpander == mod) {
        offsetPresent = true;
        if (!mod->isBypassed()) offsetExpander = mod;
      }
      else if (mod->mixType == MIXPAN_TYPE && stereo && !panPresent) {
        panPresent = true;
        if (!mod->isBypassed()) expanders[expandersCnt++]=mod;
        else maxExpandersCnt--;
      }
      else if (mod->mixType == MIXSEND_TYPE) {
        sendPresent = true;
        if (!mod->isBypassed()) expanders[expandersCnt++]=mod;
        else maxExpandersCnt--;
      }
      else if (mod->mixType == MIXSOLO_TYPE && !soloPresent && (!mutePresent || mod->leftExpander->mixType == MIXMUTE_TYPE)) {
        soloPresent = true;
        if (mutePresent) {
          if (!mod->isBypassed()) muteSoloExpander = mod;
        }
        else
          expanders[expandersCnt++]=mod;
      }
      else
        break;
    }
  }

  json_t* dataToJson() override {
    json_t* rootJ = VenomModule::dataToJson();
    json_object_set_new(rootJ, "softMute", json_boolean(softMute));
    json_object_set_new(rootJ, "toggleMute", json_boolean(toggleMute));
    json_object_set_new(rootJ, "monoPanLaw", json_integer(monoPanLaw));
    json_object_set_new(rootJ, "stereoPanLaw", json_integer(stereoPanLaw));
    return rootJ;
  }

  void dataFromJson(json_t* rootJ) override {
    VenomModule::dataFromJson(rootJ);
    json_t* val;
    if ((val = json_object_get(rootJ, "softMute")))
      softMute = json_boolean_value(val);
    if ((val = json_object_get(rootJ, "toggleMute")))
      toggleMute = json_boolean_value(val);
    if ((val = json_object_get(rootJ, "monoPanLaw")))
      monoPanLaw = json_integer_value(val);
    if ((val = json_object_get(rootJ, "stereoPanLaw")))
      stereoPanLaw = json_integer_value(val);
    setOversample();
  }


};


struct VCAMix4Stereo : MixBaseModule {
  enum ParamId {
    ENUMS(LEVEL_PARAMS, 4),
    MIX_LEVEL_PARAM,
    MODE_PARAM,
    CLIP_PARAM,
    DCBLOCK_PARAM,
    VCAMODE_PARAM,
    EXCLUDE_PARAM,
    PARAMS_LEN
  };
  enum InputId {
    ENUMS(LEFT_INPUTS, 4),
    ENUMS(RIGHT_INPUTS, 4),
    LEFT_CHAIN_INPUT,
    RIGHT_CHAIN_INPUT,
    ENUMS(CV_INPUTS, 4),
    MIX_CV_INPUT,
    INPUTS_LEN
  };
  enum OutputId {
    ENUMS(LEFT_OUTPUTS, 4),
    ENUMS(RIGHT_OUTPUTS, 4),
    LEFT_MIX_OUTPUT,
    RIGHT_MIX_OUTPUT,
    OUTPUTS_LEN
  };
  enum LightId {
    LIGHTS_LEN
  };

  int mode = -1;
  bool connected[4] = {false, false, false, false};
  float normal = 0.f;
  float scale = 1.f;
  float offset = 0.f;
  int oversample = 4, sampleRate = 0;
  OversampleFilter_4 leftUpSample[4]{}, leftDownSample[4]{}, 
                     rightUpSample[4]{}, rightDownSample[4]{},
                     cvVcaBandlimit[5][4]{},
                     inLeftVcaBandlimit[5][4]{}, inRightVcaBandlimit[5][4]{},
                     outLeftVcaBandlimit[5][4]{}, outRightVcaBandlimit[5][4]{};
  DCBlockFilter_4 leftDcBlockBeforeFilter[4]{}, leftDcBlockAfterFilter[4]{}, 
                  rightDcBlockBeforeFilter[4]{}, rightDcBlockAfterFilter[4]{};

  VCAMix4Stereo() {
    venomConfig(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    mixType = VCAMIX4ST_TYPE;
    baseMod = true;
    stereo = true;
    for (int i=0; i < 4; i++){
      configInput(CV_INPUTS+i, string::f("Channel %d CV", i + 1));
      configParam(LEVEL_PARAMS+i, 0.f, 2.f, 1.f, string::f("Channel %d level", i + 1), " dB", -10.f, 20.f);
      configInput(LEFT_INPUTS+i, string::f("Left channel %d", i + 1));
      configInput(RIGHT_INPUTS+i, string::f("Right channel %d", i + 1))->description = string::f("Normalled to left channel %d input", i+1);
      configOutput(LEFT_OUTPUTS+i, string::f("Left channel %d", i + 1));
      configOutput(RIGHT_OUTPUTS+i, string::f("Right channel %d", i + 1));
    }
    configInput(MIX_CV_INPUT, "Mix CV");
    configParam(MIX_LEVEL_PARAM, 0.f, 2.f, 1.f, "Mix level", " dB", -10.f, 20.f);
    configSwitch<ParamQuantity>(MODE_PARAM, 0.f, 4.f, 0.f, "Level Mode", {
      "Unipolar dB (audio x2)", "Unipolar poly sum dB (audio x2)", "Bipolar % (CV)", "Bipolar x2 (CV)", "Bipolar x10 (CV)"
    });
    configSwitch<ParamQuantity>(VCAMODE_PARAM, 0.f, 5.f, 0.f, "VCA Mode", {
      "Unipolar linear - CV clamped 0-10V", "Unipolar exponential - CV clamped 0-10V",
      "Bipolar linear - CV unclamped", "Bipolar exponential - CV unclamped",
      "Bipolar linear band limited - CV unclamped", "Bipolar exponential band limited - CV unclamped"
    });
    configSwitch<ParamQuantity>(DCBLOCK_PARAM, 0.f, 3.f, 0.f, "Mix DC Block", {"Off", "Before clipping", "Before and after clipping", "After clipping"});
    configSwitch<ParamQuantity>(CLIP_PARAM, 0.f, 7.f, 0.f, "Mix Clipping", {"Off", "Hard post-level at 10V", "Soft post-level at 10V", "Soft oversampled post-levl at 10V", 
                                                                                         "Hard pre-level at 10V", "Soft pre-level at 10V", "Soft oversampled pre-level at 10V",
                                                                                         "Saturate (Soft oversampled post-level at 6V)"});
    configSwitch<ParamQuantity>(EXCLUDE_PARAM, 0.f, 1.f, 0.f, "Exclude Patched Outs from Mix", {"Off", "On"});
    configInput(LEFT_CHAIN_INPUT, "Left chain");
    configInput(RIGHT_CHAIN_INPUT, "Right chain")->description = "Normalled to left chain input";
    configOutput(LEFT_MIX_OUTPUT, "Left mix");
    configOutput(RIGHT_MIX_OUTPUT, "Right mix");
    for (int i=0; i<4; i++){
      configBypass(LEFT_INPUTS+i, LEFT_OUTPUTS+i);
    }
    for (int i=0; i<4; i++){
      configBypass(inputs[RIGHT_INPUTS+i].isConnected() ? RIGHT_INPUTS+i : LEFT_INPUTS+i, RIGHT_OUTPUTS+i);
    }
    oversampleStages = 5;
    setOversample();
  }

  void setOversample() override {
    for (int i=0; i<4; i++){
      leftUpSample[i].setOversample(oversample, oversampleStages);
      leftDownSample[i].setOversample(oversample, oversampleStages);
      rightUpSample[i].setOversample(oversample, oversampleStages);
      rightDownSample[i].setOversample(oversample, oversampleStages);
      for (int j=0; j<5; j++){
        cvVcaBandlimit[j][i].setOversample(oversample, oversampleStages);
        inLeftVcaBandlimit[j][i].setOversample(oversample, oversampleStages);
        outLeftVcaBandlimit[j][i].setOversample(oversample, oversampleStages);
        inRightVcaBandlimit[j][i].setOversample(oversample, oversampleStages);
        outRightVcaBandlimit[j][i].setOversample(oversample, oversampleStages);
      }
    }
  }

  void onReset(const ResetEvent& e) override {
    mode = -1;
    setOversample();
    Module::onReset(e);
  }

  void onPortChange(const PortChangeEvent& e) override {
    if (e.type == Port::INPUT && e.portId >= RIGHT_INPUTS && e.portId < RIGHT_INPUTS+4)
      bypassRoutes[e.portId].inputId = e.connecting ? e.portId : e.portId - 4;
  }

  void process(const ProcessArgs& args) override {
    MixBaseModule::process(args);
    if (args.sampleRate != sampleRate){
      sampleRate = args.sampleRate;
      for (int i=0; i<4; i++){
        leftDcBlockBeforeFilter[i].init(oversample, sampleRate);
        leftDcBlockAfterFilter[i].init(oversample, sampleRate);
        rightDcBlockBeforeFilter[i].init(oversample, sampleRate);
        rightDcBlockAfterFilter[i].init(oversample, sampleRate);
      }
    }
    if( static_cast<int>(params[MODE_PARAM].getValue()) != mode ||
      connected[0] != (inputs[LEFT_INPUTS + 0].isConnected() || inputs[RIGHT_INPUTS + 0].isConnected()) ||
      connected[1] != (inputs[LEFT_INPUTS + 1].isConnected() || inputs[RIGHT_INPUTS + 1].isConnected()) ||
      connected[2] != (inputs[LEFT_INPUTS + 2].isConnected() || inputs[RIGHT_INPUTS + 2].isConnected()) ||
      connected[3] != (inputs[LEFT_INPUTS + 3].isConnected() || inputs[RIGHT_INPUTS + 3].isConnected())
    ){
      mode = static_cast<int>(params[MODE_PARAM].getValue());
      ParamQuantity* q;
      for (int i=0; i<4; i++) {
        connected[i] = inputs[LEFT_INPUTS + i].isConnected() || inputs[RIGHT_INPUTS + i].isConnected();
        q = paramQuantities[LEVEL_PARAMS + i];
        q->unit = mode <= 1 ? " dB" : !connected[i] ? " V" : mode == 2 ? "%" : "x";
        q->displayBase = mode <= 1 ? -10.f : 0.f;
        q->displayMultiplier = mode <= 1 ? 20.f : (mode == 2 && connected[i]) ? 100.f : (mode == 3 && connected[i]) ? 2.f : 10.f;
        q->displayOffset = mode <= 1 ? 0.f : (mode == 2 && connected[i]) ? -100.f : (mode == 3 && connected[i]) ? -2.f : -10.f;
      }
      q = paramQuantities[MIX_LEVEL_PARAM];
      q->unit = mode <= 1 ? " dB" : mode == 2 ? "%" : "x";
      q->displayBase = mode <= 1 ? -10.f : 0.f;
      q->displayMultiplier = mode <= 1 ? 20.f : mode == 2 ? 100.f : mode == 3 ? 2.f : 10.f;
      q->displayOffset = mode <= 1 ? 0.f : mode == 2 ? -100.f : mode == 3 ? -2.f : -10.f;
      q->defaultValue = mode <= 1 ? 1.f : mode == 2 ? 2.f : mode == 3 ? 1.5f : 1.1f;
      normal = mode <= 1 ? 0.f : mode == 2 ? 10.f : mode == 3 ? 5.f : 1.f;
      scale = mode == 4 ? 10.f : mode == 3 ? 2.f : 1.f;
      offset = mode <= 1 ? 0.f : -1.f;
    }
    int clip = static_cast<int>(params[CLIP_PARAM].getValue());
    int dcBlock = static_cast<int>(params[DCBLOCK_PARAM].getValue());
    int vcaMode = static_cast<int>(params[VCAMODE_PARAM].getValue());
    bool exclude = static_cast<bool>(params[EXCLUDE_PARAM].getValue());
    float preOff[4], postOff[4];
    for (int ch=0; ch<4; ch++) {
      int Cnt = mode == 1 ? std::max({1, inputs[LEFT_INPUTS+ch].getChannels(), inputs[RIGHT_INPUTS+ch].getChannels()}) : 1;
      preOff[ch] = offsetExpander ? offsetExpander->params[PRE_OFFSET_PARAM+ch].getValue() * Cnt : 0.f;
      postOff[ch] = offsetExpander ? offsetExpander->params[POST_OFFSET_PARAM+ch].getValue() * Cnt : 0.f;
    }

    int inChannels[4];
    int channels = mode == 1 ? 1 : std::max({1, inputs[LEFT_CHAIN_INPUT].getChannels(), inputs[RIGHT_CHAIN_INPUT].getChannels(), inputs[MIX_CV_INPUT].getChannels()});
    int loopChannels = channels;
    for (int i=0; i<4; i++){
      inChannels[i] = mode == 1 ? 1 : std::max({
        1, inputs[CV_INPUTS+i].getChannels(),
        inputs[LEFT_INPUTS+i].getChannels(), inputs[RIGHT_INPUTS+i].getChannels()
      });
      if (inChannels[i] > channels) {
        loopChannels = inChannels[i];
        if (!exclude || (!outputs[LEFT_OUTPUTS+i].isConnected() && !outputs[RIGHT_OUTPUTS+i].isConnected()))
          channels = inChannels[i];
      }
    }
    simd::float_4 leftOut, rightOut, leftRtn, rightRtn, cv, leftChannel[4]{}, rightChannel[4]{};
    bool sendChain;
    float channelScale;
    float fadeLevel[5];
    fadeLevel[4] = 1.f; //initialize final mix fade factor
    bool isFadeType = fadeExpander && fadeExpander->mixType == MIXFADE_TYPE;
    for (int c=0; c<loopChannels; c+=4){
      int vcaOversample = 0;
      leftOut = mode==1 ? inputs[LEFT_CHAIN_INPUT].getVoltageSum() : inputs[LEFT_CHAIN_INPUT].getPolyVoltageSimd<simd::float_4>(c);
      if (inputs[RIGHT_CHAIN_INPUT].isConnected())
        rightOut = mode==1 ? inputs[RIGHT_CHAIN_INPUT].getVoltageSum() : inputs[RIGHT_CHAIN_INPUT].getPolyVoltageSimd<simd::float_4>(c);
      else
        rightOut = leftOut;
      for (int i=0; i<4; i++){
        cv = inputs[CV_INPUTS+i].isConnected() ? (mode==1 ? inputs[CV_INPUTS+i].getVoltageSum()/10.f : inputs[CV_INPUTS+i].getPolyVoltageSimd<simd::float_4>(c)/10.f) : 1.0f;
        if (inputs[RIGHT_INPUTS+i].isConnected()) {
          leftChannel[i] = (mode==1 ? inputs[LEFT_INPUTS+i].getVoltageSum() : inputs[LEFT_INPUTS+i].getPolyVoltageSimd<simd::float_4>(c)) + preOff[i];
          rightChannel[i] = (mode==1 ? inputs[RIGHT_INPUTS+i].getVoltageSum() : inputs[RIGHT_INPUTS+i].getPolyVoltageSimd<simd::float_4>(c)) + preOff[i];
        }
        else {
          leftChannel[i] = (mode==1 ? inputs[LEFT_INPUTS+i].getVoltageSum() : inputs[LEFT_INPUTS+i].getNormalPolyVoltageSimd<simd::float_4>(normal, c)) + preOff[i];
          rightChannel[i] = leftChannel[i];
        }
        vcaOversample = vcaMode>=4 && inputs[CV_INPUTS+i].isConnected() && (inputs[LEFT_INPUTS+i].isConnected() || inputs[RIGHT_INPUTS+i].isConnected()) ? 4 : 1;
        channelScale = (params[LEVEL_PARAMS+i].getValue()+offset)*scale;
        for (int s=0; s<vcaOversample; s++) {
          if (vcaOversample > 1) {
            cv = cvVcaBandlimit[i][c/4].process(s ? 0.f : cv*vcaOversample);
            leftChannel[i] = inLeftVcaBandlimit[i][c/4].process(s ? 0.f : leftChannel[i]*vcaOversample);
            rightChannel[i] = inRightVcaBandlimit[i][c/4].process(s ? 0.f : rightChannel[i]*vcaOversample);
          }
          if (vcaMode <= 1)
            cv = simd::clamp(cv, 0.f, 1.f);
          if (vcaMode == 1 || vcaMode == 3 || vcaMode == 5)
            cv = simd::sgn(cv)*simd::pow(simd::abs(cv), 4);
          leftChannel[i] *= channelScale*cv;
          rightChannel[i] *= channelScale*cv;
          if (vcaOversample > 1){
            leftChannel[i] = outLeftVcaBandlimit[i][c/4].process(leftChannel[i]);
            rightChannel[i] = outRightVcaBandlimit[i][c/4].process(rightChannel[i]);
          }
        }
        leftChannel[i] += postOff[i];
        outputs[LEFT_OUTPUTS+i].setVoltageSimd(leftChannel[i], c);
        if (exclude && outputs[LEFT_OUTPUTS+i].isConnected())
          leftChannel[i] = 0.f;
        rightChannel[i] += postOff[i];
        outputs[RIGHT_OUTPUTS+i].setVoltageSimd(rightChannel[i], c);
        if (exclude && outputs[RIGHT_OUTPUTS+i].isConnected())
          rightChannel[i] = 0.f;
      }
      for (unsigned int x=0; x<expandersCnt; x++){
        MixModule* exp = expanders[x];
        MixModule* soloMod = NULL;
        MixModule* muteMod = NULL;
        float shape;
        switch(exp->mixType) {
          case MIXMUTE_TYPE:
            muteMod = exp;
            soloMod = muteSoloExpander;
            break;
          case MIXSOLO_TYPE:
            muteMod = muteSoloExpander;
            soloMod = exp;
            break;
          case MIXPAN_TYPE:
            for (int i=0; i<4; i++) {
              simd::float_4 pan = simd::clamp(exp->params[PAN_PARAM+i].getValue() + exp->inputs[PAN_INPUT+i].getPolyVoltageSimd<simd::float_4>(c)*exp->params[PAN_CV_PARAM+i].getValue()/5.f, -1.f, 1.f);
              int panLaw = !inputs[RIGHT_INPUTS+i].isConnected() || stereoPanLaw==10 ? monoPanLaw : stereoPanLaw;
              switch (panLaw) {
                case 0: // 0 dB
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f);
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f);
                  break;
                case 1: // +1.5 dB side
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.25f);
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.25f);
                  break;
                case 2: // +3 dB side
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.5f);
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.5f);
                  break;
                case 3: // +4.5 dB side
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.75f);
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.75f);
                  break;
                case 4: // +6 dB side
                  leftChannel[i]  *= 1 - pan;
                  rightChannel[i] *= 1 + pan;
                  break;
                case 5: // -1.5 dB center
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.25f) * 0.875f;
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.25f) * 0.875f;
                  break;
                case 6: // -3 dB center
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.5f) * 0.75f;
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.5f) * 0.75f;
                  break;
                case 7: // -4.5 dB center
                  leftChannel[i]  *= simd::ifelse(pan>0, 1.f - pan, 1.f - pan*0.75f) * 0.625f;
                  rightChannel[i] *= simd::ifelse(pan<0, 1.f + pan, 1.f + pan*0.75f) * 0.625f;
                  break;
                case 8: // -6 dB center
                  leftChannel[i]  *= (1 - pan)*0.5f;
                  rightChannel[i] *= (1 + pan)*0.5f;
                  break;
                case 9: // True stereo pan
                  rightChannel[i] += simd::ifelse(pan>0, leftChannel[i] * pan, simd::float_4::zero());
                  rightChannel[i] *= 1.f + simd::ifelse(pan>0, simd::float_4::zero(), pan);
                  leftChannel[i] += simd::ifelse(pan>0, simd::float_4::zero(), rightChannel[i] * -pan);
                  leftChannel[i] *= 1.f - simd::ifelse(pan>0, pan, simd::float_4::zero());
              }
            }
            break;
          case MIXSEND_TYPE:
            if (!c) {
              if (softMute)
                exp->fade[0].process(args.sampleTime, !exp->params[SEND_MUTE_PARAM].getValue());
              else
                exp->fade[0].out = !exp->params[SEND_MUTE_PARAM].getValue();
            }
            leftRtn = exp->inputs[LEFT_RETURN_INPUT].getPolyVoltageSimd<simd::float_4>(c);
            rightRtn = exp->inputs[RIGHT_RETURN_INPUT].getPolyVoltageSimd<simd::float_4>(c);
            sendChain = exp->params[SEND_CHAIN_PARAM].getValue();
            exp->outputs[LEFT_SEND_OUTPUT].setVoltageSimd(
              (  leftChannel[0] * exp->params[SEND_PARAM+0].getValue()
               + leftChannel[1] * exp->params[SEND_PARAM+1].getValue()
               + leftChannel[2] * exp->params[SEND_PARAM+2].getValue()
               + leftChannel[3] * exp->params[SEND_PARAM+3].getValue()
               + (sendChain ? leftRtn : simd::float_4::zero())
              ) * exp->fade[0].out
              ,c
            );
            exp->outputs[RIGHT_SEND_OUTPUT].setVoltageSimd(
              (  rightChannel[0] * exp->params[SEND_PARAM+0].getValue()
               + rightChannel[1] * exp->params[SEND_PARAM+1].getValue()
               + rightChannel[2] * exp->params[SEND_PARAM+2].getValue()
               + rightChannel[3] * exp->params[SEND_PARAM+3].getValue()
               + (sendChain ? rightRtn : simd::float_4::zero())
              ) * exp->fade[0].out
              ,c
            );
            if (channels-c <= 4) {
              exp->outputs[LEFT_SEND_OUTPUT].setChannels(channels);
              exp->outputs[RIGHT_SEND_OUTPUT].setChannels(channels);
            }
            if (!sendChain) {
              leftOut  += leftRtn * exp->params[RETURN_PARAM].getValue();
              rightOut += rightRtn * exp->params[RETURN_PARAM].getValue();
            }
            break;
        }
        if (!c && muteMod && !muteMod->isBypassed()) {
          for (int i=0; i<5; i++) { //assumes MUTE_MIX_PARAM and MUTE_MIX_INPUT follow MUTE_PARAM AND MUTE_MIX_INPUT arrays
            int evnt = muteMod->muteCV[i].processEvent(muteMod->inputs[MUTE_INPUT+i].getVoltage(), 0.1f, 1.f);
            if (toggleMute && evnt>0)
              muteMod->params[MUTE_PARAM+i].setValue(!muteMod->params[MUTE_PARAM+i].getValue());
            if (!toggleMute && evnt)
              muteMod->params[MUTE_PARAM+i].setValue(muteMod->muteCV[i].isHigh());
          }
        }  
        if (!c && soloMod && !soloMod->isBypassed()) {
          for (int i=0; i<4; i++) {
            int evnt = soloMod->soloCV[i].processEvent(soloMod->inputs[SOLO_INPUT+i].getVoltage(), 0.1f, 1.f);
            if (toggleMute && evnt>0)
              soloMod->params[SOLO_PARAM+i].setValue(!soloMod->params[SOLO_PARAM+i].getValue());
            if (!toggleMute && evnt)
              soloMod->params[SOLO_PARAM+i].setValue(soloMod->soloCV[i].isHigh());
          }
        }  
        if (soloMod && !soloMod->isBypassed() && (
             soloMod->params[SOLO_PARAM+0].getValue() || soloMod->params[SOLO_PARAM+1].getValue() || 
             soloMod->params[SOLO_PARAM+2].getValue() || soloMod->params[SOLO_PARAM+3].getValue()
           )){
          for (int i=0; i<4; i++){
            if (!c) {
              if (fadeExpander && !fadeExpander->isBypassed()) {
                fade[i].rise = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[(isFadeType ? static_cast<int>(FADE_TIME_PARAM) : static_cast<int>(RISE_TIME_PARAM))+i].getValue());
                fade[i].fall = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[(isFadeType ? static_cast<int>(FADE_TIME_PARAM) : static_cast<int>(FALL_TIME_PARAM))+i].getValue());
                fade[i].process(args.sampleTime, soloMod->params[SOLO_PARAM+i].getValue());
                shape = fadeExpander->params[(isFadeType ? static_cast<int>(FADE_SHAPE_PARAM) : static_cast<int>(FADE2_SHAPE_PARAM))+i].getValue();
                fadeLevel[i] = crossfade(fade[i].out, shape>0.f ? 11.f*fade[i].out/(10.f*fade[i].out+1.f) : pow(fade[i].out,4), shape>0.f ? shape : -shape);
                fadeExpander->outputs[FADE_OUTPUT+i].setVoltage(fadeLevel[i]*10.f); // fade & fade2 outputs match
              }  
              else if (softMute){
                fade[i].rise = fade[i].fall = 40.f;
                fadeLevel[i] = fade[i].process(args.sampleTime, soloMod->params[SOLO_PARAM+i].getValue());
              }
              else
                fadeLevel[i] = fade[i].out = soloMod->params[SOLO_PARAM+i].getValue();
            }  
            leftChannel[i] *= fadeLevel[i];
            rightChannel[i] *= fadeLevel[i];
          }
        }
        else if (muteMod && !muteMod->isBypassed()) {
          for (int i=0; i<4; i++){
            if (!c) {
              if (fadeExpander && !fadeExpander->isBypassed()) {
                fade[i].rise = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[(isFadeType ? static_cast<int>(FADE_TIME_PARAM) : static_cast<int>(RISE_TIME_PARAM))+i].getValue());
                fade[i].fall = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[(isFadeType ? static_cast<int>(FADE_TIME_PARAM) : static_cast<int>(FALL_TIME_PARAM))+i].getValue());
                fade[i].process(args.sampleTime, !muteMod->params[MUTE_PARAM+i].getValue());
                shape = fadeExpander->params[(isFadeType ? static_cast<int>(FADE_SHAPE_PARAM) : static_cast<int>(FADE2_SHAPE_PARAM))+i].getValue();
                fadeLevel[i] = crossfade(fade[i].out, shape>0.f ? 11.f*fade[i].out/(10.f*fade[i].out+1.f) : pow(fade[i].out,4), shape>0.f ? shape : -shape);
                fadeExpander->outputs[FADE_OUTPUT+i].setVoltage(fadeLevel[i]*10.f); // fade & fade2 outputs match
              }  
              else if (softMute) {
                fade[i].rise = fade[i].fall = 40.f;
                fadeLevel[i] = fade[i].process(args.sampleTime, !muteMod->params[MUTE_PARAM+i].getValue());
              }
              else
                fadeLevel[i] = fade[i].out = !muteMod->params[MUTE_PARAM+i].getValue();
            }
            leftChannel[i]  *= fadeLevel[i];
            rightChannel[i] *= fadeLevel[i];
          }
        }
        if (!c && muteMod && !muteMod->isBypassed()){
          if (fadeExpander && !fadeExpander->isBypassed()) {
            fade[4].rise = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[isFadeType ? static_cast<int>(FADE_MIX_TIME_PARAM) : static_cast<int>(MIX_RISE_TIME_PARAM)].getValue());
            fade[4].fall = 1.f/std::max(softMute ? 0.025f : 0.f, fadeExpander->params[isFadeType ? static_cast<int>(FADE_MIX_TIME_PARAM) : static_cast<int>(MIX_FALL_TIME_PARAM)].getValue());
            fade[4].process(args.sampleTime, !muteMod->params[MUTE_MIX_PARAM].getValue());
            shape = fadeExpander->params[isFadeType ? static_cast<int>(FADE_MIX_SHAPE_PARAM) : static_cast<int>(FADE2_MIX_SHAPE_PARAM)].getValue();
            fadeLevel[4] = crossfade(fade[4].out, shape>0.f ? 11.f*fade[4].out/(10.f*fade[4].out+1.f) : pow(fade[4].out,4), shape>0.f ? shape : -shape);
            fadeExpander->outputs[FADE_MIX_OUTPUT].setVoltage(fadeLevel[4]); // fade & fade2 outputs match
          }  
          else if (softMute) {
            fade[4].rise = fade[4].fall = 40.f;
            fadeLevel[4] = fade[4].process(args.sampleTime, !muteMod->params[MUTE_MIX_PARAM].getValue());
          }
          else
            fadeLevel[4] = fade[4].out = !muteMod->params[MUTE_MIX_PARAM].getValue();
        }
      }
      float preMixOff = offsetExpander ? offsetExpander->params[PRE_MIX_OFFSET_PARAM].getValue() : 0.f;
      float postMixOff = offsetExpander ? offsetExpander->params[POST_MIX_OFFSET_PARAM].getValue() : 0.f;
      leftOut += leftChannel[0] + leftChannel[1] + leftChannel[2] + leftChannel[3] + preMixOff;
      rightOut += rightChannel[0] + rightChannel[1] + rightChannel[2] + rightChannel[3] + preMixOff;

      cv = inputs[MIX_CV_INPUT].isConnected() ? (mode == 1 ? inputs[MIX_CV_INPUT].getVoltage()/10.f : inputs[MIX_CV_INPUT].getPolyVoltageSimd<simd::float_4>(c)/10.f) : 1.0f;
      vcaOversample = vcaMode>=4 && inputs[MIX_CV_INPUT].isConnected() ? 4 : 1;

      if (dcBlock && dcBlock < 3) {
        leftOut = leftDcBlockBeforeFilter[c/4].process(leftOut);
        rightOut = rightDcBlockBeforeFilter[c/4].process(rightOut);
      }

      if (clip == 4) { // hard pre
        leftOut = clamp(leftOut, -10.f, 10.f);
        rightOut = clamp(rightOut, -10.f, 10.f);
      }
      if (clip == 5) { // soft pre
        leftOut = softClip(leftOut);
        rightOut = softClip(rightOut);
      }
      if (clip==6 && vcaOversample==1) { // soft pre
        for (int i=0; i<oversample; i++){
          leftOut = leftUpSample[c/4].process(i ? simd::float_4::zero() : leftOut*oversample);
          leftOut = softClip(leftOut);
          leftOut = leftDownSample[c/4].process(leftOut);
          rightOut = rightUpSample[c/4].process(i ? simd::float_4::zero() : rightOut*oversample);
          rightOut = softClip(rightOut);
          rightOut = rightDownSample[c/4].process(rightOut);
        }
      }
      for (int s=0; s<vcaOversample; s++) {
        if (vcaOversample > 1) {
          cv = cvVcaBandlimit[4][c/4].process(s ? 0.f : cv*vcaOversample);
          leftOut = inLeftVcaBandlimit[4][c/4].process( s ? 0.f : leftOut*vcaOversample);
          rightOut = inRightVcaBandlimit[4][c/4].process( s ? 0.f : rightOut*vcaOversample);
        }
        if (vcaMode <= 1)
          cv = simd::clamp(cv, 0.f, 1.f);
        if (vcaMode == 1 || vcaMode == 3 || vcaMode == 5)
          cv = simd::sgn(cv)*simd::pow(simd::abs(cv), 4);
        if (clip == 6 && vcaOversample>1) {
          leftOut = softClip(leftOut);
          rightOut = softClip(rightOut);
        }
        leftOut *= (params[MIX_LEVEL_PARAM].getValue()+offset)*scale*cv;
        leftOut += postMixOff;
        rightOut *= (params[MIX_LEVEL_PARAM].getValue()+offset)*scale*cv;
        rightOut += postMixOff;
        if (clip==3 && vcaOversample>1) {
          leftOut = softClip(leftOut);
          rightOut = softClip(rightOut);
        }
        if (clip==7 && vcaOversample>1) {
          leftOut = softClip(leftOut*1.6667f) / 1.6667f;
          rightOut = softClip(rightOut*1.6667f) / 1.6667f;
        }
        if (vcaOversample > 1) {
          leftOut = outLeftVcaBandlimit[4][c/4].process(leftOut);
          rightOut = outRightVcaBandlimit[4][c/4].process(rightOut);
        }
      }

      if (clip == 1) { // hard post
        leftOut = clamp(leftOut, -10.f, 10.f);
        rightOut = clamp(rightOut, -10.f, 10.f);
      }    
      if (clip == 2) { // { soft post
        leftOut = softClip(leftOut);
        rightOut = softClip(rightOut);
      }    
      if ((clip==3 || clip==7) && vcaOversample==1) { // soft post
        for (int i=0; i<oversample; i++){
          leftOut = leftUpSample[c/4].process(i ? simd::float_4::zero() : leftOut*oversample);
          rightOut = rightUpSample[c/4].process(i ? simd::float_4::zero() : rightOut*oversample);
          if (clip==7) {
            leftOut = softClip(leftOut*1.6667f) / 1.6667f;
            rightOut = softClip(rightOut*1.6667f) / 1.6667f;
          }
          else {
            leftOut = softClip(leftOut);
            rightOut = softClip(rightOut);
          }
          leftOut = leftDownSample[c/4].process(leftOut);
          rightOut = rightDownSample[c/4].process(rightOut);
        }
      }  

      if (dcBlock == 3 || (dcBlock == 2 && clip)) {
        leftOut = leftDcBlockAfterFilter[c/4].process(leftOut);
        rightOut = rightDcBlockAfterFilter[c/4].process(rightOut);
      }

      leftOut  *= fadeLevel[4]; // Mix fade factor
      rightOut *= fadeLevel[4]; // Mix fade factor
      outputs[LEFT_MIX_OUTPUT].setVoltageSimd(leftOut, c);
      outputs[RIGHT_MIX_OUTPUT].setVoltageSimd(rightOut, c);
    }
    for (int i=0; i<4; i++){
      outputs[LEFT_OUTPUTS+i].setChannels(inChannels[i]);
      outputs[RIGHT_OUTPUTS+i].setChannels(inChannels[i]);
    }
    outputs[LEFT_MIX_OUTPUT].setChannels(channels);
    outputs[RIGHT_MIX_OUTPUT].setChannels(channels);
  }


  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
  void setState(int id, float value) override {
    json_t* root = dataToJson();
    if (!json_is_object(root)) { json_decref(root); root = json_object(); }
    switch (id) {
      case 0: json_object_set_new(root, "softMute", json_boolean(value != 0.f)); break;
      case 1: json_object_set_new(root, "toggleMute", json_boolean(value != 0.f)); break;
      case 2: json_object_set_new(root, "monoPanLaw", json_integer(static_cast<long long>(value))); break;
      case 3: json_object_set_new(root, "stereoPanLaw", json_integer(static_cast<long long>(value))); break;
      default: break;
    }
    dataFromJson(root);
    json_decref(root);
  }
};
}

RACK_WEB_EXPORTS(Venom::VCAMix4Stereo)
