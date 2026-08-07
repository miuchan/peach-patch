import { useEffect, useRef } from "react";

function hsl(hue: number, saturation: number, lightness: number) {
  const h = (((hue % 1) + 1) % 1) * 360;
  const s = Math.max(0, Math.min(1, saturation)) * 100;
  const l = Math.max(0, Math.min(1, lightness)) * 100;
  return `hsl(${h} ${s}% ${l}%)`;
}

function drawFace(context: CanvasRenderingContext2D, value: number[]) {
  const [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P] = value;
  const sf = 1 + 0.2 * Math.sin(B - C);
  const ox = 67.5 + sf * 20.33 * Math.sin(D - C / 2);
  const oy = 180 + sf * 30.33 * Math.sin(G - F);
  const hue = 0.4 + 0.3 * Math.sin(A / 2) + 0.3 * Math.sin(K / 3);
  const saturation = 0.5 + 0.32 * Math.sin(B / 3 - 33.21 - D / 2);
  const lightness = 0.5 + 0.35 * Math.sin(C / 2);
  const faceRadiusX = sf * (70 + 40 * Math.sin(A - B / 2));
  const faceRadiusY = sf * (150 + 80 * Math.sin(F / 2.2));
  const faceRotation =
    0.04 * Math.sin(H - M) + 0.02 * Math.sin(H / 3 + 2.2) + 0.02 * Math.sin(L + P + 8.222);
  const eyeY = oy - 10 * (2 + sf + Math.sin(I - J / 2));
  const eyeSpacing = (faceRadiusX / 2) * (1.8 + 0.5 * Math.sin(200 - J));
  const eyeRadiusX = (faceRadiusX / 4) * (1 + 0.4 * Math.sin(G));
  const eyeRadiusY = (faceRadiusX / 4) * (1 + 0.4 * Math.sin(H - N + 100));
  const irisRadius = eyeRadiusY * 0.4 * (1.3 + 0.4 * Math.sin(K - D + 1));
  const pupilRadius = irisRadius * 0.4 * (1 + 0.6 * Math.sin(E));
  const gazeDirection = Math.PI * (1 + Math.sin(B - K));
  const gazeStrength = 4 * (1.3 + 0.5 * Math.sin(D - 1) + 0.6 * Math.sin(1 - L / 2));
  context.save();
  context.rotate(faceRotation);
  context.fillStyle = hsl(hue, saturation, lightness);
  context.beginPath();
  context.ellipse(ox, oy, Math.abs(faceRadiusX), Math.abs(faceRadiusY), 0, 0, Math.PI * 2);
  context.fill();

  const leftEyeX = ox - eyeSpacing / 2;
  const rightEyeX = ox + eyeSpacing / 2;
  const pupilOffsetX = gazeStrength * Math.cos(gazeDirection);
  const pupilOffsetY = gazeStrength * Math.sin(gazeDirection);
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "rgb(250,250,250)";
  context.beginPath();
  context.ellipse(leftEyeX, eyeY, Math.abs(eyeRadiusX), Math.abs(eyeRadiusY), 0, 0, Math.PI * 2);
  context.ellipse(rightEyeX, eyeY, Math.abs(eyeRadiusX), Math.abs(eyeRadiusY), 0, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = hsl(lightness, saturation, hue);
  context.beginPath();
  context.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, Math.abs(irisRadius), 0, Math.PI * 2);
  context.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, Math.abs(irisRadius), 0, Math.PI * 2);
  context.fill();
  context.fillStyle = hsl(0.1, 0.1, 0.1);
  context.beginPath();
  context.arc(leftEyeX + pupilOffsetX, eyeY + pupilOffsetY, Math.abs(pupilRadius), 0, Math.PI * 2);
  context.arc(rightEyeX + pupilOffsetX, eyeY + pupilOffsetY, Math.abs(pupilRadius), 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";

  const leftBrowHeight = eyeRadiusY * (1.9 + 0.6 * Math.sin(G) + 0.3 * Math.sin(K - B / 2));
  const rightBrowHeight = eyeRadiusY * (1.9 + 0.6 * Math.sin(G - 2.2 + N) + 0.2 * Math.sin(L + 33));
  const leftBrowAngle = 0.5 * Math.sin(C) + 0.2 * Math.sin(H / 2 - 2);
  const rightBrowAngle = 0.7 * Math.sin(F) + 0.3 * Math.sin(2 - I);
  const browLength = faceRadiusX * 0.3 * (2.2 + Math.sin(G) + 0.4 * Math.sin(B - 2));
  const browRadius = browLength / 2;
  context.strokeStyle = hsl(0.1, 0.2, 0.2);
  context.lineWidth = Math.abs(5 * (1.3 + Math.sin(M - 2)));
  context.lineCap = "butt";
  context.beginPath();
  context.moveTo(
    leftEyeX - browRadius * Math.cos(leftBrowAngle),
    eyeY - leftBrowHeight - browRadius * Math.sin(leftBrowAngle),
  );
  context.lineTo(
    leftEyeX + browRadius * Math.cos(leftBrowAngle),
    eyeY - leftBrowHeight + browRadius * Math.sin(leftBrowAngle),
  );
  context.moveTo(
    rightEyeX - browRadius * Math.cos(rightBrowAngle),
    eyeY - rightBrowHeight - browRadius * Math.sin(rightBrowAngle),
  );
  context.lineTo(
    rightEyeX + browRadius * Math.cos(rightBrowAngle),
    eyeY - rightBrowHeight + browRadius * Math.sin(rightBrowAngle),
  );
  context.stroke();

  const mouthY = oy + 0.4 * faceRadiusY * (1 + 0.4 * Math.sin(C / 2));
  const mouthWidth = faceRadiusX * 0.6 * (1.2 + 0.6 * Math.sin(C));
  const mouthOpen = faceRadiusY * 0.06 * (1 + Math.sin(O) - Math.sin(A * 2 + 44));
  const mouthSmile = Math.sin(D) * 2;
  context.globalCompositeOperation = "source-atop";
  context.strokeStyle = hsl(
    0.1 * Math.sin(N) - 0.1,
    0.6 + 0.3 * Math.sin(M),
    0.5 + 0.4 * Math.sin(I),
  );
  context.fillStyle = "black";
  context.lineWidth = Math.abs(5.4 * (Math.sin(H) - Math.sin(M / 2)));
  context.beginPath();
  context.moveTo(ox - mouthWidth / 2, mouthY - 20 * mouthSmile);
  context.bezierCurveTo(
    ox - mouthWidth / 4,
    mouthY - mouthOpen * mouthSmile,
    ox + mouthWidth / 4,
    mouthY - mouthOpen * mouthSmile,
    ox + mouthWidth / 2,
    mouthY - 10 * mouthSmile,
  );
  context.bezierCurveTo(
    ox + mouthWidth / 4,
    mouthY + mouthSmile * mouthOpen,
    ox - mouthWidth / 4,
    mouthY + mouthSmile * mouthOpen,
    ox - mouthWidth / 2,
    mouthY - 20 * mouthSmile,
  );
  context.closePath();
  context.stroke();
  context.fill();
  context.restore();
}

function drawStickFigure(context: CanvasRenderingContext2D, value: number[]) {
  const [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P] = value;
  const faceColor = hsl(
    0.5 + 0.25 * Math.sin(C / 2) + 0.25 * Math.sin(K / 3),
    0.5 + 0.32 * Math.sin(B / 3 - 33.21 - D / 2),
    0.5 + 0.35 * Math.sin(E / 2),
  );
  const cx = 62 * (1 + (Math.sin(E + F) - Math.sin(P + O / 2 + 50)) / 40000);
  const cy = 210 * (1 + (Math.sin(A + G - 12) - Math.sin(P + H / 2)) / 11000);
  const thighSpread = (2 + Math.sin(J + I + K) - Math.sin(A - N / 2)) / 4;
  const thighLength = 50 * (1 + (Math.sin(C - 100 + F + K * 2) + Math.sin(C + L - 10)) / 6);
  const thighDirection = (Math.sin(J + O - 211) - Math.sin(P * 2 + I) - Math.sin(B + K)) / 2;
  const ankleSpread =
    (2 + Math.sin(O - B) / 2 + Math.sin(F + 2) / 2 + Math.sin(P - E - D + 19.2)) / 13;
  const ankleLength = thighLength * (1 + Math.sin(F + A + J - K / 2 + 9) / 9);
  const ankleDirection =
    (3 * Math.PI) / 2 + (3 + Math.sin(J + M - L - 101) - Math.sin(P - B + 22) - Math.sin(H)) / 8;
  const point = (length: number, angle: number, x: number, y: number) => [
    x + length * Math.cos(angle),
    y - length * Math.sin(angle),
  ];
  const leftKnee = point(thighLength, (3 * Math.PI) / 2 + thighDirection + thighSpread, cx, cy);
  const rightKnee = point(thighLength, (3 * Math.PI) / 2 + thighDirection - thighSpread, cx, cy);
  const leftAnkle = point(ankleLength, ankleDirection + ankleSpread, leftKnee[0], leftKnee[1]);
  const rightAnkle = point(ankleLength, ankleDirection - ankleSpread, rightKnee[0], rightKnee[1]);
  context.strokeStyle = "rgb(36,201,166)";
  context.fillStyle = faceColor;
  context.lineJoin = "round";
  context.lineWidth = 3.2;
  context.beginPath();
  context.moveTo(leftAnkle[0], leftAnkle[1]);
  context.lineTo(leftKnee[0], leftKnee[1]);
  context.lineTo(cx, cy);
  context.lineTo(rightKnee[0], rightKnee[1]);
  context.lineTo(rightAnkle[0], rightAnkle[1]);
  context.stroke();
  const torsoLength = thighLength * (1.4 + Math.sin(A - 12) / 4);
  const neck = point(torsoLength, Math.PI / 2 + Math.sin(D) / 2, cx, cy);
  context.beginPath();
  context.moveTo(cx, cy);
  context.lineTo(neck[0], neck[1]);
  context.stroke();
  const armLength = (torsoLength * (2 + (Math.sin(N + 14) - Math.sin(P - L - 3)) / 2)) / 4;
  const forearmLength = armLength * (1 + (2 + Math.sin(F + B + 2) - Math.sin(E)) / 300);
  const armDirection = (3 * Math.PI) / 2 + 0.2 * Math.sin(C - M);
  const armSpread = Math.sin(B + P - A) + Math.sin(N - J);
  const leftElbow = point(armLength, armDirection + armSpread, neck[0], neck[1]);
  const rightElbow = point(armLength, armDirection - armSpread, neck[0], neck[1]);
  const leftHand = point(forearmLength, Math.sin(E + 22 + A - 4), leftElbow[0], leftElbow[1]);
  const rightHand = point(forearmLength, Math.sin(F + 22 - B), rightElbow[0], rightElbow[1]);
  for (const [elbow, hand] of [
    [leftElbow, leftHand],
    [rightElbow, rightHand],
  ]) {
    context.beginPath();
    context.moveTo(neck[0], neck[1]);
    context.lineTo(elbow[0], elbow[1]);
    context.lineTo(hand[0], hand[1]);
    context.stroke();
  }
  const headHeight =
    torsoLength * (0.5 + Math.sin(H - E - I - D) / 9 - Math.sin(F + B - C + E) / 7);
  const headWidth = headHeight * (0.6 + Math.sin(I + D - M / 2) / 7 + Math.sin(G / 2 + J - 10) / 6);
  context.save();
  context.translate(neck[0], neck[1]);
  context.rotate(Math.sin(C + A) / 2 + Math.sin(M / 2) / 3);
  context.beginPath();
  context.ellipse(0, -headHeight, Math.abs(headWidth), Math.abs(headHeight), 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

export function RackComputerscareFigure({
  values,
  figure,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  figure: "face" | "stick";
  width: number;
  height: number;
  scaleX: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, width, height);
    const source = Array.from({ length: 16 }, (_, index) => values?.[index] ?? 0);
    if (figure === "face") drawFace(context, source);
    else drawStickFigure(context, source);
  }, [figure, height, values, width]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: width * scaleX,
        height,
        pointerEvents: "none",
      }}
    />
  );
}
