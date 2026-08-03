import assert from "node:assert/strict";
import test from "node:test";
import {
  rackParamAssetUrl,
  rackParamControlSize,
  rackParamInteraction,
  rackParamKnobAsset,
  rackParamKnobRotation,
  rackParamNormalizedValue,
  rackParamPlacementStyle,
  rackParamSwitchAsset,
  rackParamSwitchFrame,
  rackParamSwitchFrames,
  rackParamTextValue,
  rackParamWidgetKind,
} from "../lib/rack-param-visual-data.ts";
import type { ParamSpec } from "../lib/web-plugin-registry.ts";

function rackParam(overrides: Partial<ParamSpec> = {}): ParamSpec {
  return {
    id: 0,
    name: "Param",
    min: 0,
    max: 1,
    default: 0,
    position: { x: 10, y: 20 },
    ...overrides,
  };
}

function widgetParam(widget: string, overrides: Partial<ParamSpec> = {}) {
  return rackParam({
    ...overrides,
    position: { x: 10, y: 20, widget },
  });
}

test("Rack widget parsing recognizes namespaces, aliases, and name boundaries", () => {
  assert.equal(
    rackParamWidgetKind(widgetParam("rack::componentlibrary::Rogan2PWhite")),
    "Rogan2PWhite",
  );
  assert.equal(rackParamWidgetKind(widgetParam("componentlibrary::VioM2Switch")), "VioM2Switch");
  assert.equal(rackParamWidgetKind(widgetParam("VCVLightLatch")), "VCVButton");
  assert.equal(rackParamWidgetKind(widgetParam("NotRogan2PWhiteExtra")), "");
});

test("Rack parameter interaction and control geometry follow catalog metadata", () => {
  assert.equal(rackParamInteraction(rackParam({ button: true, position: undefined })), "button");
  assert.equal(rackParamInteraction(widgetParam("Rogan2PWhite")), "knob");
  assert.equal(rackParamInteraction(widgetParam("VCVLightSlider")), "slider");
  assert.equal(rackParamInteraction(widgetParam("VioM2Switch")), "switch");
  assert.equal(
    rackParamInteraction(
      rackParam({ position: { x: 10, y: 20, width: 52, height: 17, control: "selector" } }),
    ),
    "selector",
  );
  assert.deepEqual(rackParamControlSize(widgetParam("Rogan2PWhite")), {
    width: 34.29297,
    height: 34.29297,
  });
  assert.deepEqual(rackParamControlSize(widgetParam("VioM2Switch")), {
    width: 14,
    height: 20.641106,
  });
});

test("Rack switch frames preserve catalog and numeric fallback semantics", () => {
  assert.equal(rackParamSwitchFrames(widgetParam("VioM2Switch")), 2);
  assert.equal(rackParamSwitchFrames(widgetParam("FMSM")), 4);
  assert.equal(rackParamSwitchFrames(rackParam({ min: -2, max: 2 })), 5);
  assert.equal(rackParamSwitchFrame(0.51, 4), 2);
});

test("Rack text knobs format enumerations, scales, powers, and units", () => {
  assert.equal(rackParamTextValue(rackParam({ name: "Window" }), 0), "Boxcar");
  assert.equal(rackParamTextValue(rackParam({ name: "Smooth" }), 2), "1/24 oct");
  assert.equal(rackParamTextValue(rackParam({ name: "Length" }), 3), "8");
  assert.equal(rackParamTextValue(rackParam({ name: "Y Scale", max: 2 }), 2), "Log 120dB");
  assert.equal(rackParamTextValue(rackParam({ name: "Hop" }), 0.01234), "12.34ms");
  assert.equal(rackParamTextValue(rackParam({ name: "Slope" }), 12.345), "12.3dB/oct");
});

test("Rack value normalization and placement preserve bounded and centered geometry", () => {
  const bounded = rackParam({ min: 0, max: 10 });
  assert.equal(rackParamNormalizedValue(bounded, -2), 0);
  assert.equal(rackParamNormalizedValue(bounded, 12), 1);
  assert.equal(rackParamNormalizedValue(bounded, 5), 0.5);
  assert.equal(rackParamNormalizedValue(rackParam({ min: 0, max: 10, unbounded: true }), 15), 1.5);
  assert.equal(rackParamNormalizedValue(rackParam({ min: 4, max: 4 }), 9), 0);

  const placement = rackParamPlacementStyle(
    { x: 10, y: 20, centered: true, zIndex: 3 },
    100,
    20,
    40,
  );
  assert.equal(placement.left, "10%");
  assert.ok(Math.abs(Number.parseFloat(placement.top) - (20 / 380) * 100) < 1e-12);
  assert.equal(placement.zIndex, 3);
  assert.equal(placement.transform, "translate(-50%, -50%)");
});

test("Rack knob angles and asset URLs come directly from catalog data", () => {
  const lengthKnob = rackParamKnobAsset("LengthKnob");
  assert.ok(lengthKnob);
  assert.equal(rackParamKnobRotation(lengthKnob, 0, false), -135);
  assert.equal(rackParamKnobRotation(lengthKnob, 1, false), 90);
  assert.equal(rackParamKnobRotation(lengthKnob, 1.25, true), -78.75);

  const fmsm = rackParamSwitchAsset("FMSM");
  assert.equal(fmsm.frames, 4);
  assert.equal(fmsm.names?.at(-1), "msm/Switch/FMSM_3.svg");
  assert.equal(
    rackParamAssetUrl("msm/Knobs/RedLargeKnob.svg"),
    "/rack-components/msm/Knobs/RedLargeKnob.svg",
  );
  assert.equal(rackParamAssetUrl("Rogan 1P"), "/api/rack-component?name=Rogan%201P");
});
