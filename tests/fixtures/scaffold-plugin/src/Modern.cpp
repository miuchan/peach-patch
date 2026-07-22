#include "plugin.hpp"
#include "Compatibility.hpp"
#include <math.hpp>

struct NativeMeterDisplay;
extern Model* modelExpanderOnly;

struct FixtureExpanderMessage { float value = 0.f; };

struct FixtureMeterInterface { virtual float getFixtureMeter() const = 0; };

struct ModernModule : Module, FixtureMeterInterface {
  enum ParamId { RATE_PARAM, PARAMS_LEN };
  enum InputId { MULT_INPUT, INPUTS_LEN };
  enum OutputId { ENUMS(MULT_OUTPUTS, 2 * 4), OUTPUTS_LEN };
  enum LightId { TEST_LIGHT, LIGHTS_LEN };
  int multiplier = 1;
  bool enabled = true;
  float offsets[3]{};
  float matrix[2][2]{};
  dsp::TSchmittTrigger<simd::float_4> edgeDetector;
  dsp::SchmittTrigger scalarEdgeDetector;
  dsp::BooleanTrigger buttonEdgeDetector;
  dsp::TExponentialFilter<simd::float_4> smoother;
  dsp::TBiquadFilter<float> biquad;
  dsp::TBiquadFilter<simd::float_4> simdBiquad;
  dsp::Timer timer;
  string::Version savedVersion;
  FixtureSimdUnion unionState;
  FixtureExpanderMessage rightMessages[2];
  std::atomic<NativeMeterDisplay*> nativeMeter{nullptr};

  struct EditableQuantity : ParamQuantity {
    void setDisplayValueString(const std::string value) override { setValue(std::atof(value.c_str())); }
  };

  ModernModule() {
    leftExpander.producerMessage = &multiplier;
    rightExpander.consumerMessage = &enabled;
    getRightExpander().requestMessageFlip();
    (void) getExpander(0).moduleId;
    (void) model;
    (void) isBypassed();
    config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    configParam<EditableQuantity>(RATE_PARAM, std::log2(1e-3f), std::log2(8.f), std::log2(0.125f), "Rate");
    const int configSwitch = 1;
    (void) configSwitch;
    configInput(MULT_INPUT, "Mult");
    configBypass(MULT_INPUT, MULT_OUTPUTS);
    getInputInfo(MULT_INPUT)->description = "Normalled test input";
    getParamQuantity(RATE_PARAM)->unit = "V";
    getParamQuantity(0)->displayMultiplier = 10.f;
    smoother.setLambda(4.f);
    biquad.setParameters(dsp::TBiquadFilter<float>::LOWPASS, .1f, .707f, 1.f);
    simdBiquad.setParameters(dsp::TBiquadFilter<simd::float_4>::HIGHPASS, .1f, .707f, 1.f);
    for (int index = 0; index < 8; index++)
      configOutput(MULT_OUTPUTS + index, string::f("Mult %d", index + 1));
  }

  void onAdd(const AddEvent& event) override { Module::onAdd(event); }
  void onRandomize(const RandomizeEvent& event) override { Module::onRandomize(event); }
  void onPortChange(const PortChangeEvent& event) override {
    if (event.type == Port::INPUT && event.portId == MULT_INPUT)
      enabled = event.connecting;
  }
  float getFixtureMeter() const override { return offsets[0]; }

  void process(const ProcessArgs&) override {
    if (rightExpander.module && rightExpander.module->model == modelExpanderOnly) {
      multiplier = static_cast<FixtureExpanderMessage*>(rightExpander.module->leftExpander.consumerMessage)->value;
    }
    if (nativeMeter.load()) {
      nativeMeter.load()->push(1.f);
    }
    const float elapsed = timer.process(1.f / 48000.f);
    (void) elapsed;
    lights[TEST_LIGHT].setBrightness(-0.5f);
    enum FixtureLimit { FIXTURE_LIMIT = 3 };
    const int mixedClamp = clamp(4, 0, FIXTURE_LIMIT);
    const int namespacedClamp = rack::math::clamp(5, 0, 4);
    simd::float_4 packed(1.f, 2.f, 3.f, 4.f);
    packed = _mm_shuffle_ps(packed.v, packed.v, _MM_SHUFFLE(2, 1, 0, 3));
    packed = _mm_move_ss(packed.v, simd::float_4(5.f).v);
    unionState.lanes[0] = smoother.process(1.f / 48000.f, packed);
    (void) biquad.process(1.f);
    (void) simdBiquad.process(packed);
    dsp::VuMeter meter;
    meter.setValue(unionState.lanes[0][0]);
    const NVGcolor color = nvgHSL(0.5f, 1.f, 0.5f);
    (void) mixedClamp;
    (void) namespacedClamp;
    (void) meter.getBrightness(1);
    (void) color;
    (void) fixtureAnyConnected(&inputs);
    const auto buttonEvent = buttonEdgeDetector.processEvent(false);
    const auto scalarEvent = scalarEdgeDetector.processEvent(0.f);
    const json_int_t eventSum = static_cast<int>(buttonEvent) + static_cast<int>(scalarEvent);
    (void) eventSum;
    const int channels = std::max(1, inputs[MULT_INPUT].getChannels());
    for (int index = 0; index < 8; index++) {
      outputs[MULT_OUTPUTS + index].setChannels(channels);
      for (int channel = 0; channel < channels; channel += 4) {
        simd::float_4 value = enabled ? simd::fmax(inputs[MULT_INPUT].getNormalPolyVoltageSimd<simd::float_4>(10.f, channel) * multiplier + offsets[0] + matrix[1][1], 0.f) : simd::float_4(0.f);
        value = crossfade(value, value, 0.5f);
        (void) simd::movemask(edgeDetector.process(value));
        outputs[MULT_OUTPUTS + index].setVoltageSimd(value, channel);
      }
    }
  }

  json_t* dataToJson() override {
    json_t* root = json_object();
    json_object_set_new(root, "multiplier", json_integer(multiplier));
    json_object_set_new(root, "enabled", json_boolean(enabled));
    json_t* offsetsJson = json_array();
    for (int index = 0; index < 3; index++)
      json_array_insert_new(offsetsJson, index, json_real(offsets[index]));
    json_object_set_new(root, "offsets", offsetsJson);
    json_t* matrixJson = json_array();
    for (int row = 0; row < 2; row++) {
      json_t* rowJson = json_array();
      for (int column = 0; column < 2; column++)
        json_array_insert_new(rowJson, column, json_real(matrix[row][column]));
      json_array_insert_new(matrixJson, row, rowJson);
    }
    json_object_set_new(root, "matrix", matrixJson);
    return root;
  }

  void dataFromJson(json_t* root) override {
    json_t* value = json_object_get(root, "multiplier");
    if (value) multiplier = json_integer_value(value);
    json_t* enabledValue = json_object_get(root, "enabled");
    if (enabledValue) enabled = json_boolean_value(enabledValue);
    json_t* offsetsJson = json_object_get(root, "offsets");
    if (offsetsJson) for (int index = 0; index < 3; index++) {
      json_t* offset = json_array_get(offsetsJson, index);
      if (offset) offsets[index] = json_number_value(offset);
    }
    json_t* matrixJson = json_object_get(root, "matrix");
    if (matrixJson) for (int row = 0; row < 2; row++) {
      json_t* rowJson = json_array_get(matrixJson, row);
      if (rowJson) for (int column = 0; column < 2; column++) {
        json_t* cell = json_array_get(rowJson, column);
        if (cell) matrix[row][column] = json_number_value(cell);
      }
    }
  }
};

struct ModernWidget : ModuleWidget {};
Model* modelModern = createModel<ModernModule, ModernWidget>("Modern");
