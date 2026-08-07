import { useMemo, useState, type CSSProperties } from "react";
import type { ModuleInstance } from "../../lib/patch-types";
import type { RuntimeVisual, WebPluginModule } from "../../lib/web-plugin-registry";

type LintBuddyVisual = Extract<RuntimeVisual, { kind: "lint-buddy" }>;
export type LintBuddyTarget = { module: ModuleInstance; definition?: WebPluginModule };
type LintTest =
  "Labels Check" | "Probe Bypass" | "JSON Extract" | "WidgetPositions" | "WhiteList" | "MyPatch";

const TESTS: LintTest[] = [
  "Labels Check",
  "Probe Bypass",
  "JSON Extract",
  "WidgetPositions",
  "WhiteList",
  "MyPatch",
];

function targetName(target?: LintBuddyTarget) {
  if (!target) return "Disconnected";
  return `${target.definition?.brand ?? target.module.plugin} ${target.definition?.name ?? target.module.model}`;
}

function reportFor(test: LintTest, target?: LintBuddyTarget) {
  const warnings: string[] = [];
  const info: string[] = [];
  if (!target?.definition) {
    warnings.push(
      "LintBuddy is a Developer Tool.",
      "",
      "It checks module features but has no",
      "musical purpose. Please don't use",
      "it in performance patches. Want to add",
      "a test or feature? Happy to take a PR!",
    );
    return { warnings, info };
  }
  const { definition, module } = target;
  if (test === "Labels Check") {
    for (const param of definition.params) {
      const line = `PQ[${param.id}] name='${param.name}' label='${param.name}'`;
      (param.name && !param.name.startsWith("#") ? info : warnings).push(line);
    }
    for (const input of definition.inputs) {
      const line = `IN[${input.id}] name='${input.name}' label='${input.name}'`;
      (input.name && !input.name.startsWith("#") ? info : warnings).push(line);
    }
    for (const output of definition.outputs) {
      const line = `OUT[${output.id}] name='${output.name}' label='${output.name}'`;
      (output.name && !output.name.startsWith("#") ? info : warnings).push(line);
    }
  } else if (test === "Probe Bypass") {
    if (!definition.bypassRoutes?.length) info.push("No Bypass Routes in Module");
    for (const [inputId, outputId] of definition.bypassRoutes ?? []) {
      const input = definition.inputs.find((port) => port.id === inputId)?.name ?? "unnamed_input";
      const output =
        definition.outputs.find((port) => port.id === outputId)?.name ?? "unnamed_output";
      info.push(`Bypass from ${inputId} (${input}) to ${outputId} (${output})`);
    }
  } else if (test === "JSON Extract") {
    const json = JSON.stringify(module.rack ?? {}, null, 2);
    info.push(...json.split("\n"));
  } else if (test === "WidgetPositions") {
    info.push(`| box: w=${definition.width}, h=380 x=0 y=0 class=[ModuleWidget]`);
    for (const param of definition.params)
      info.push(
        `|-- box: x=${param.position?.x ?? 0} y=${param.position?.y ?? 0} class=[${param.position?.widget ?? "ParamWidget"}]`,
      );
    for (const port of definition.inputs)
      info.push(`|-- box: x=${port.position?.x ?? 0} y=${port.position?.y ?? 0} class=[InputPort]`);
    for (const port of definition.outputs)
      info.push(
        `|-- box: x=${port.position?.x ?? 0} y=${port.position?.y ?? 0} class=[OutputPort]`,
      );
  } else if (test === "WhiteList") {
    info.push(`Subscribed: ${definition.plugin}`, `Module: ${definition.model}`);
  } else {
    info.push("Patch Path", "[browser-local://peach-patch/autosave]");
  }
  return { warnings, info };
}

function plainText(test: LintTest, target: LintBuddyTarget | undefined, runs: number) {
  const report = reportFor(test, target);
  return [
    `LintBuddy: module=${targetName(target)}`,
    `         : test  =${test}`,
    runs ? `         : runs  =${runs}` : "",
    "",
    `WARNINGS (${report.warnings.length})`,
    ...report.warnings,
    "",
    `INFO (${report.info.length})`,
    ...report.info,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

const buttonStyle: CSSProperties = {
  position: "absolute",
  height: 22,
  border: "1px solid #777783",
  borderRadius: 3,
  background: "linear-gradient(#3b3b43,#202026)",
  color: "#f2f2f4",
  font: "12px system-ui, sans-serif",
  textAlign: "center",
  padding: "0 4px",
  pointerEvents: "auto",
};

function ReportList({ lines, top }: { lines: string[]; top: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 5,
        top,
        width: 260,
        height: 119.5,
        overflow: "auto",
        boxSizing: "border-box",
        border: "0.7px solid rgb(200,200,220)",
        background: "#000",
        color: "#fff",
        padding: "3px",
        font: "10px/13px ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "pre",
        pointerEvents: "auto",
      }}
    >
      {lines.map((line, index) => (
        <div key={`${index}-${line}`}>{line || "\u00a0"}</div>
      ))}
    </div>
  );
}

export function RackLintBuddy({
  visual,
  scaleX,
  target,
}: {
  visual: LintBuddyVisual;
  scaleX: number;
  target?: LintBuddyTarget;
}) {
  const [test, setTest] = useState<LintTest>("Labels Check");
  const [runs, setRuns] = useState(0);
  const report = useMemo(() => reportFor(test, target), [target, test]);
  const output = (kind: "stdout" | "html" | "log") => {
    const text = plainText(test, target, runs);
    if (kind === "stdout") console.log(text);
    else if (kind === "log") console.info(`LintBuddy Log Output\n${text}`);
    else {
      const url = URL.createObjectURL(
        new Blob(
          [
            `<html><body><pre>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></body></html>`,
          ],
          {
            type: "text/html",
          },
        ),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };

  return (
    <div
      className="pw-rack-lint-buddy"
      style={{
        position: "absolute",
        left: visual.x,
        top: visual.y,
        width: visual.width,
        height: visual.height,
        transform: `scaleX(${scaleX})`,
        transformOrigin: "left top",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 28,
          width: 270,
          color: "#f2f2f4",
          font: "12px system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        {targetName(target)}
      </div>
      <ReportList lines={report.warnings} top={45} />
      <ReportList lines={report.info} top={173.5} />
      <select
        aria-label="Select LintBuddy test"
        value={test}
        onChange={(event) => {
          setTest(event.target.value as LintTest);
          setRuns(0);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ ...buttonStyle, left: 10, top: 300.5, width: 140, appearance: "none" }}
      >
        {TESTS.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <select
        aria-label="Output LintBuddy report"
        value=""
        onChange={(event) => {
          const kind = event.target.value as "stdout" | "html" | "log" | "";
          if (kind) output(kind);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ ...buttonStyle, left: 10, top: 326.5, width: 69, appearance: "none" }}
      >
        <option value="">Output To...</option>
        <option value="stdout">STDOUT (if attached)</option>
        <option value="html">HTML</option>
        <option value="log">RACK Log</option>
      </select>
      <button
        type="button"
        style={{ ...buttonStyle, left: 80, top: 326.5, width: 69 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          for (let index = 0; index < 100; index += 1) reportFor(test, target);
          setRuns((value) => value + 100);
        }}
      >
        Run 100 times
      </button>
    </div>
  );
}
