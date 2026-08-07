import { type MouseEvent } from "react";
import { useI18n } from "../i18n/provider";

function withAlpha(color: string, alpha: number) {
  const opacity = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color.slice(0, 7)}${opacity}`;
}

export function RackCrawlDisplay({
  values,
  actionBase,
  actionSteps,
  maxPoints,
  crawlerCount,
  colors,
  x,
  y,
  width,
  height,
  scaleX,
  onAction,
}: {
  values?: number[];
  actionBase: number;
  actionSteps: number;
  maxPoints: number;
  crawlerCount: number;
  colors: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  onAction: (id: number, active: boolean) => void;
}) {
  const { t } = useI18n();
  const count = Math.max(1, Math.min(maxPoints, Math.round(values?.[0] ?? 1)));
  const displayWidth = values?.[1] || width;
  const displayHeight = values?.[2] || height;
  const distance = values?.[3] ?? 80;
  const pointOffset = 4;
  const points = Array.from({ length: count }, (_, index) => ({
    x: values?.[pointOffset + index * 2] ?? 0,
    y: values?.[pointOffset + index * 2 + 1] ?? 0,
  }));
  const crawlerOffset = pointOffset + maxPoints * 2;
  const crawlerStride = 4 + maxPoints;
  const crawlers = Array.from({ length: crawlerCount }, (_, crawler) => {
    const offset = crawlerOffset + crawler * crawlerStride;
    return {
      x: values?.[offset] ?? 0,
      y: values?.[offset + 1] ?? 0,
      originX: values?.[offset + 2] ?? 0,
      originY: values?.[offset + 3] ?? 0,
      connected: Array.from(
        { length: count },
        (_, point) => (values?.[offset + 4 + point] ?? 0) > 0.5,
      ),
    };
  });

  const doubleClick = (event: MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = Math.max(
      0,
      Math.min(displayWidth, ((event.clientX - bounds.left) * displayWidth) / bounds.width),
    );
    const py = Math.max(
      0,
      Math.min(displayHeight, ((event.clientY - bounds.top) * displayHeight) / bounds.height),
    );
    const xStep = Math.round((px / displayWidth) * (actionSteps - 1));
    const yStep = Math.round((py / displayHeight) * (actionSteps - 1));
    onAction(actionBase + xStep + yStep * actionSteps, true);
  };

  return (
    <svg
      className="pw-rack-crawl-display"
      aria-label={t("display.crawl")}
      viewBox={`0 0 ${displayWidth} ${displayHeight}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x * scaleX,
        top: y,
        width: width * scaleX,
        height,
        touchAction: "none",
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        doubleClick(event);
      }}
    >
      <rect width={displayWidth} height={displayHeight} fill="#000" />
      {crawlers.flatMap((crawler, crawlerIndex) =>
        points.map((point, pointIndex) =>
          crawler.connected[pointIndex] ? (
            <line
              key={`connection-${crawlerIndex}-${pointIndex}`}
              x1={crawler.x}
              y1={crawler.y}
              x2={point.x}
              y2={point.y}
              stroke={withAlpha(colors[crawlerIndex % colors.length], 0.25)}
            />
          ) : null,
        ),
      )}
      {crawlers.map((crawler, index) => (
        <circle
          key={`ring-${index}`}
          cx={crawler.x}
          cy={crawler.y}
          r={distance}
          fill="none"
          stroke={withAlpha(colors[index % colors.length], 0.08)}
        />
      ))}
      {points.map((point, index) => (
        <circle
          key={`point-${index}`}
          cx={point.x}
          cy={point.y}
          r="3"
          fill={crawlers.some((crawler) => crawler.connected[index]) ? "#fff" : "#ffffff73"}
        />
      ))}
      {crawlers.map((crawler, index) => (
        <g key={`origin-${index}`} stroke={withAlpha(colors[index % colors.length], 0.35)}>
          <line
            x1={crawler.originX - 4}
            y1={crawler.originY}
            x2={crawler.originX + 4}
            y2={crawler.originY}
          />
          <line
            x1={crawler.originX}
            y1={crawler.originY - 4}
            x2={crawler.originX}
            y2={crawler.originY + 4}
          />
        </g>
      ))}
      {crawlers.map((crawler, index) => (
        <circle
          key={`crawler-${index}`}
          cx={crawler.x}
          cy={crawler.y}
          r="6"
          fill={colors[index % colors.length]}
          stroke="#fff"
        />
      ))}
    </svg>
  );
}
