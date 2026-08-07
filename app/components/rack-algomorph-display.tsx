import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { RuntimeVisual } from "../../lib/web-plugin-registry";

type AlgomorphVisual = Extract<RuntimeVisual, { kind: "algomorph-display" }>;
type Point = { x: number; y: number };
type Edge = { move: Point; curves: Array<[Point, Point, Point]> };
type Arrow = { move: Point; lines: Point[] };
type Graph = {
  nodes: Array<{ id: number; point: Point }>;
  edges: Edge[];
  arrows: Arrow[];
  mystery: boolean;
};
type GraphBank = {
  count: number;
  strides: number[];
  arrays: Float32Array[];
  byAlgorithm: Map<number, number>;
};

const ORIGIN = { x: 56.5375, y: 46.638 },
  NODE_FILL = "rgb(64,54,74)",
  NODE_STROKE = "rgb(26,26,26)",
  TEXT = [178, 169, 185] as const,
  EDGE = [154, 154, 111] as const,
  AUX_LABELS = [
    "CV",
    "CV%",
    "CLICK",
    "CVx2",
    "CVx3",
    "SUM%",
    "MOD%",
    "CLOCK",
    "BTTF",
    "RESET",
    "RUN",
    "ADDR",
    "WILD",
    "CARR",
    "OP 1",
    "OP 2",
    "OP 3",
    "OP 4",
    "CV%x2",
    "CV%x3",
  ];
const graphBanks = new Map<string, Promise<GraphBank>>();

function loadGraphBank(url: string): Promise<GraphBank> {
  let cached = graphBanks.get(url);
  if (cached) return cached;
  cached = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Unable to load Algomorph graph data (${response.status})`);
    const buffer = await response.arrayBuffer(),
      header = new DataView(buffer, 0, 36),
      magic = header.getUint32(0, true),
      count = header.getUint32(4, true),
      strides = Array.from({ length: 7 }, (_, index) => header.getUint32(8 + index * 4, true));
    if (magic !== 0x31474c41 || count !== 1980 || strides.join(",") !== "9,9,18,47,47,90,90")
      throw new Error("Algomorph graph data has an unsupported layout");
    let offset = 36;
    const arrays = strides.map((stride) => {
      const values = new Float32Array(buffer, offset, count * stride);
      offset += values.byteLength;
      return values;
    });
    if (offset !== buffer.byteLength) throw new Error("Algomorph graph data is truncated");
    const byAlgorithm = new Map<number, number>();
    for (let graph = 0; graph < count; graph += 1)
      byAlgorithm.set(Math.round(arrays[0][graph * strides[0]]), graph);
    return { count, strides, arrays, byAlgorithm };
  });
  graphBanks.set(url, cached);
  return cached;
}

function graphFrom(bank: GraphBank, algorithm: number): Graph {
  const graphIndex = bank.byAlgorithm.get(Math.round(algorithm)),
    mystery = graphIndex === undefined,
    graph = graphIndex ?? 1979,
    [xNodes, yNodes, moves, xCurves, yCurves, xPolygons, yPolygons] = bank.arrays,
    [nodeStride, , moveStride, curveStride, , polygonStride] = bank.strides,
    nodes = Array.from({ length: 4 }, () => ({ id: 404, point: { x: 0, y: 0 } })),
    edges: Edge[] = [],
    arrows: Arrow[] = [];
  for (let index = 0; index < 4; index += 1) {
    const id = -Math.round(xNodes[graph * nodeStride + index * 2 + 1]);
    if (id !== 404)
      nodes[id - 1] = {
        id,
        point: {
          x: xNodes[graph * nodeStride + index * 2 + 2],
          // This intentionally matches GraphStructure.cpp's asymmetric source index.
          y: yNodes[graph * nodeStride + index + 1],
        },
      };
  }
  let curveIndex = 1;
  for (let index = 0; index < 9; index += 1) {
    const moveOffset = graph * moveStride + index * 2,
      moveX = moves[moveOffset];
    if (moveX === -404) break;
    const curves: Array<[Point, Point, Point]> = [];
    for (let segment = 0; segment < 15; segment += 1) {
      const first = xCurves[graph * curveStride + curveIndex];
      if (first === -1) {
        curveIndex += 1;
        break;
      }
      if (first === -404) break;
      curves.push(
        [0, 1, 2].map((point) => ({
          x: xCurves[graph * curveStride + curveIndex + point],
          y: yCurves[graph * curveStride + curveIndex + point],
        })) as [Point, Point, Point],
      );
      curveIndex += 3;
    }
    edges.push({ move: { x: moveX, y: moves[moveOffset + 1] }, curves });
    const polygonOffset = graph * polygonStride + index * 10,
      lines = Array.from({ length: 9 }, () => ({ x: 0, y: 0 }));
    for (let point = 1; point < 10; point += 1) {
      const x = xPolygons[polygonOffset + point];
      if (x === -404) break;
      lines[point - 1] = { x, y: yPolygons[polygonOffset + point] };
    }
    arrows.push({
      move: { x: xPolygons[polygonOffset], y: yPolygons[polygonOffset] },
      lines,
    });
  }
  return { nodes, edges, arrows, mystery };
}

const mix = (first: number, second: number, amount: number) => first + (second - first) * amount;
const mixPoint = (first: Point, second: Point, amount: number) => ({
  x: mix(first.x, second.x, amount),
  y: mix(first.y, second.y, amount),
});
const color = (rgb: readonly number[], alpha = 1) =>
  `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, alpha))})`;

function drawText(context: CanvasRenderingContext2D, text: string, point: Point, divisor: number) {
  const metrics = context.measureText(text),
    height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  context.fillText(text, point.x - metrics.width / 2, point.y + height / divisor);
}

function drawNodes(
  context: CanvasRenderingContext2D,
  source: Graph,
  destination: Graph,
  morph: number,
) {
  const flipped =
      source.nodes.filter((node) => node.id !== 404).length <
      destination.nodes.filter((node) => node.id !== 404).length,
    most = flipped ? destination : source,
    least = flipped ? source : destination;
  for (let index = 0; index < 4; index += 1) {
    const mostNode = most.nodes[index],
      leastNode = least.nodes[index];
    let first = mostNode.point,
      second = leastNode.point,
      firstAlpha = 1,
      secondAlpha = 1;
    if (mostNode.id === 404 && leastNode.id === 404) continue;
    if (mostNode.id === 404) {
      first = flipped ? leastNode.point : ORIGIN;
      second = flipped ? ORIGIN : leastNode.point;
      firstAlpha = flipped ? 1 : 0;
      secondAlpha = flipped ? 0 : 1;
    } else if (leastNode.id === 404) {
      first = flipped ? ORIGIN : mostNode.point;
      second = flipped ? mostNode.point : ORIGIN;
      firstAlpha = flipped ? 0 : 1;
      secondAlpha = flipped ? 1 : 0;
    } else if (flipped) {
      first = leastNode.point;
      second = mostNode.point;
    }
    const point = mixPoint(first, second, morph),
      alpha = mix(firstAlpha, secondAlpha, morph);
    context.beginPath();
    context.arc(point.x, point.y, 8.35425, 0, Math.PI * 2);
    context.fillStyle = color([64, 54, 74], alpha);
    context.fill();
    context.strokeStyle = color([26, 26, 26], alpha);
    context.lineWidth = 0.75;
    context.stroke();
    context.font = "11px DelexanderMiriamLibre";
    context.fillStyle = color(TEXT, alpha);
    drawText(context, String(index + 1), point, 3.25);
  }
}

function reticulateEdge(
  context: CanvasRenderingContext2D,
  most: Edge,
  least: Edge,
  morph: number,
  flipped: boolean,
) {
  for (let index = 0; index < most.curves.length; index += 1) {
    const mostCurve = most.curves[index];
    let leastCurve = least.curves[index] ?? least.curves.at(-1);
    if (!leastCurve) leastCurve = [ORIGIN, ORIGIN, ORIGIN];
    const points = mostCurve.map((point, pointIndex) =>
      flipped
        ? mixPoint(leastCurve![pointIndex], point, morph)
        : mixPoint(point, leastCurve![pointIndex], morph),
    );
    context.bezierCurveTo(
      points[0].x,
      points[0].y,
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
    );
  }
}

function reticulateArrow(
  context: CanvasRenderingContext2D,
  most: Arrow,
  least: Arrow,
  morph: number,
  flipped: boolean,
) {
  const absent = least.move.x === 0,
    point = (mostPoint: Point, leastPoint: Point) =>
      absent
        ? flipped
          ? mixPoint(ORIGIN, mostPoint, morph)
          : mixPoint(mostPoint, ORIGIN, morph)
        : flipped
          ? mixPoint(leastPoint, mostPoint, morph)
          : mixPoint(mostPoint, leastPoint, morph);
  const move = point(most.move, least.move);
  context.moveTo(move.x, move.y);
  for (let index = 0; index < 9; index += 1) {
    const line = point(most.lines[index], least.lines[index]);
    context.lineTo(line.x, line.y);
  }
}

function drawEdges(
  context: CanvasRenderingContext2D,
  source: Graph,
  destination: Graph,
  morph: number,
) {
  const flipped = source.edges.length < destination.edges.length,
    most = flipped ? destination : source,
    least = flipped ? source : destination;
  for (let index = 0; index < most.edges.length; index += 1) {
    let first: Edge,
      second: Edge,
      firstArrow: Arrow,
      secondArrow: Arrow,
      alpha = 1;
    if (!least.edges.length) {
      first = flipped ? ({ move: ORIGIN, curves: [] } as Edge) : most.edges[index];
      second = flipped ? most.edges[index] : ({ move: ORIGIN, curves: [] } as Edge);
      firstArrow = most.arrows[index];
      secondArrow = least.arrows[index] ?? {
        move: { x: 0, y: 0 },
        lines: Array(9).fill({ x: 0, y: 0 }),
      };
      alpha = flipped ? morph : 1 - morph;
    } else if (index < least.edges.length) {
      first = flipped ? least.edges[index] : most.edges[index];
      second = flipped ? most.edges[index] : least.edges[index];
      firstArrow = most.arrows[index];
      secondArrow = least.arrows[index];
    } else {
      first = flipped ? least.edges.at(-1)! : most.edges[index];
      second = flipped ? most.edges[index] : least.edges.at(-1)!;
      firstArrow = most.arrows[index];
      secondArrow = least.arrows.at(-1)!;
    }
    context.beginPath();
    const move = mixPoint(first.move, second.move, morph);
    context.moveTo(move.x, move.y);
    const curvedFlipped = first.curves.length < second.curves.length,
      mostCurved = curvedFlipped ? second : first,
      leastCurved = curvedFlipped ? first : second;
    reticulateEdge(context, mostCurved, leastCurved, morph, curvedFlipped);
    context.strokeStyle = color(EDGE, alpha);
    context.lineWidth = 0.925;
    context.stroke();
    context.beginPath();
    reticulateArrow(context, firstArrow, secondArrow, morph, flipped);
    context.fillStyle = color(EDGE, alpha);
    context.fill();
    context.strokeStyle = color(EDGE, alpha);
    context.lineWidth = 2.65 / 4 + 1 / 3;
    context.stroke();
  }
}

function drawGraph(
  context: CanvasRenderingContext2D,
  source: Graph,
  destination: Graph,
  configMode: boolean,
  morph: number,
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height);
  context.beginPath();
  context.roundRect(0, 0, width, height, 3.675);
  context.strokeStyle = "#000";
  context.lineWidth = 0.45;
  context.stroke();
  if (configMode) {
    for (let index = 0; index < 4; index += 1) {
      const node = source.nodes[index];
      if (node.id === 404) continue;
      context.beginPath();
      context.arc(node.point.x, node.point.y, 8.35425, 0, Math.PI * 2);
      context.fillStyle = NODE_FILL;
      context.fill();
      context.strokeStyle = NODE_STROKE;
      context.lineWidth = 0.75;
      context.stroke();
      context.font = "11px DelexanderMiriamLibre";
      context.fillStyle = color(TEXT);
      drawText(context, String(index + 1), node.point, 3.25);
    }
  } else drawNodes(context, source, destination, morph);
  const mysteryAlpha = configMode
    ? source.mystery
      ? 1
      : 0
    : source.mystery && destination.mystery
      ? 1
      : source.mystery
        ? 1 - morph
        : destination.mystery
          ? morph
          : 0;
  if (mysteryAlpha) {
    context.font = "92px DelexanderMiriamLibre";
    context.fillStyle = color(TEXT, mysteryAlpha);
    drawText(context, "?", { x: width / 2, y: height / 2 }, 3.925);
  }
  if (configMode) {
    context.beginPath();
    for (const edge of source.edges) {
      context.moveTo(edge.move.x, edge.move.y);
      for (const curve of edge.curves)
        context.bezierCurveTo(
          curve[0].x,
          curve[0].y,
          curve[1].x,
          curve[1].y,
          curve[2].x,
          curve[2].y,
        );
    }
    context.strokeStyle = color(EDGE);
    context.lineWidth = 0.925;
    context.stroke();
    for (const arrow of source.arrows) {
      context.beginPath();
      context.moveTo(arrow.move.x, arrow.move.y);
      for (const line of arrow.lines) context.lineTo(line.x, line.y);
      context.fillStyle = color(EDGE);
      context.fill();
      context.strokeStyle = color(EDGE);
      context.lineWidth = 2.65 / 4 + 1 / 3;
      context.stroke();
    }
  } else drawEdges(context, source, destination, morph);
}

export function RackAlgomorphDisplay({
  visual,
  values = [],
  scaleX,
  onAction,
}: {
  visual: AlgomorphVisual;
  values?: number[];
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [bank, setBank] = useState<GraphBank>(),
    [fontReady, setFontReady] = useState(false),
    [menu, setMenu] = useState<{ x: number; y: number }>();
  useEffect(() => {
    let active = true;
    void loadGraphBank(`${visual.assetBase}${visual.graphFile}`).then((loaded) => {
      if (active) setBank(loaded);
    });
    return () => {
      active = false;
    };
  }, [visual.assetBase, visual.graphFile]);
  useEffect(() => {
    if (typeof FontFace === "undefined") {
      setFontReady(true);
      return;
    }
    const face = new FontFace(
      visual.font.family,
      `url(${JSON.stringify(`${visual.assetBase}${visual.font.file}`)})`,
    );
    void face.load().then((loaded) => {
      document.fonts.add(loaded);
      setFontReady(true);
    });
  }, [visual.assetBase, visual.font]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || !bank || !fontReady) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1),
      { width, height } = visual.display;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGraph(
      context,
      graphFrom(bank, values[4] ?? 0),
      graphFrom(bank, values[5] ?? values[4] ?? 0),
      (values[0] ?? 0) >= 0.5,
      Math.max(0, Math.min(1, values[3] ?? 0)),
      width,
      height,
    );
  }, [bank, fontReady, values, visual.display]);
  const action = (id: number) => {
    onAction(id, true);
    onAction(id, false);
    setMenu(undefined);
  };
  const contextMenu = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  };
  const scene = Math.max(0, Math.min(2, Math.round(values[1] ?? 1)));
  return (
    <div
      className="pw-rack-algomorph"
      style={{
        position: "absolute",
        left: visual.x * scaleX,
        top: visual.y,
        width: visual.width * scaleX,
        height: visual.height,
        pointerEvents: "none",
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${visual.width} ${visual.height}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {visual.operators.flatMap(([fromX, fromY]) =>
          visual.modulators.map(([toX, toY], index) => (
            <g key={`${fromX}-${fromY}-${index}`}>
              <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="#5a5a5a" strokeWidth="1.1" />
              <line
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke="rgba(0,0,0,.376)"
                strokeWidth=".6"
              />
            </g>
          )),
        )}
      </svg>
      <canvas
        ref={canvas}
        aria-label="Algomorph algorithm graph"
        style={{
          position: "absolute",
          left: visual.display.x * scaleX,
          top: visual.display.y,
          width: visual.display.width * scaleX,
          height: visual.display.height,
        }}
      />
      {visual.auxPanel ? (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${visual.auxPanel.width} ${visual.auxPanel.height}`}
          style={{
            position: "absolute",
            left: visual.auxPanel.x * scaleX,
            top: visual.auxPanel.y,
            width: visual.auxPanel.width * scaleX,
            height: visual.auxPanel.height,
            overflow: "visible",
          }}
        >
          {visual.auxPanel.labelY.map((y, index) => {
            const mode = Math.round(values[6 + index] ?? -3),
              label =
                mode >= 0
                  ? (AUX_LABELS[mode] ?? "ERROR")
                  : mode === -2
                    ? "MULTI"
                    : mode === -1
                      ? "NONE"
                      : "ERROR";
            return (
              <text
                key={index}
                x={visual.auxPanel!.labelX}
                y={y}
                fill="#ccc"
                fontFamily={visual.font.family}
                fontSize="10"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>
      ) : null}
      <button
        type="button"
        aria-label="Algomorph connection matrix"
        style={{
          position: "absolute",
          left: visual.connectionRegion.x * scaleX,
          top: visual.connectionRegion.y,
          width: visual.connectionRegion.width * scaleX,
          height: visual.connectionRegion.height,
          border: 0,
          padding: 0,
          background: "transparent",
          pointerEvents: "auto",
        }}
        onContextMenu={contextMenu}
      />
      {menu ? (
        <div
          className="pw-native-interaction-menu"
          role="menu"
          aria-label="Algomorph algorithm randomization"
          style={{ position: "fixed", left: menu.x, top: menu.y, pointerEvents: "auto" }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => action(visual.currentAction)}>
            <span>{`Randomize Algorithm ${scene + 1}`}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => action(visual.allAction)}>
            <span>Randomize All Algorithms</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
