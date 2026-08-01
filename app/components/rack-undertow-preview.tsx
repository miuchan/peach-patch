import { memo, useEffect, useRef } from "react";

const HEADER = 8;
const POINTS = 256;
const TRAIL_FADE_MS = 333;
const MAX_TRAILS = 6;

type Point = { x:number; y:number };
type Trail = { born:number; points:Point[] };

function frequencyText(value:number){
  const hz=Number.isFinite(value)&&value>0?value:0;
  if(hz<1)return`${(hz*1000).toFixed(1)} mHz`;
  if(hz>=1000)return`${(hz/1000).toFixed(2)} kHz`;
  if(hz<10)return`${hz.toFixed(2)} Hz`;
  if(hz<100)return`${hz.toFixed(1)} Hz`;
  return`${hz.toFixed(0)} Hz`;
}

function stroke(context:CanvasRenderingContext2D,points:Point[]){
  context.beginPath();
  points.forEach((point,index)=>index?context.lineTo(point.x,point.y):context.moveTo(point.x,point.y));
  context.stroke();
}

export const RackUndertowPreview=memo(function RackUndertowPreview({
  values,
  x,
  y,
  width,
  height,
  scaleX,
}:{
  values?:number[];
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX:number;
}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const previousRef=useRef<Point[]|null>(null);
  const trailsRef=useRef<Trail[]>([]);
  const displayWidth=width*scaleX;
  const canvasHeight=height+15;

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    canvas.width=Math.max(1,Math.round(displayWidth*dpr));
    canvas.height=Math.max(1,Math.round(canvasHeight*dpr));
    const context=canvas.getContext("2d");
    if(!context)return;
    context.setTransform(dpr,0,0,dpr,0,0);
    context.clearRect(0,0,displayWidth,canvasHeight);
    const pad=1.625,left=pad,right=Math.max(left+1,displayWidth-pad),top=pad,bottom=Math.max(top+1,height-pad),
      drawWidth=right-left,drawHeight=bottom-top,
      points=Array.from({length:POINTS},(_,index)=>{
        const voltage=Math.max(-5,Math.min(5,values?.[HEADER+index]??0));
        return{x:left+index/(POINTS-1)*drawWidth,y:top+(.5-.1*voltage)*drawHeight};
      }),
      now=performance.now(),
      tracerEnabled=(values?.[5]??1)>.5,
      previous=previousRef.current,
      changed=Boolean(previous?.some((point,index)=>Math.abs(point.y-points[index].y)>.02));
    if(tracerEnabled&&previous&&changed)trailsRef.current.push({born:now,points:previous});
    previousRef.current=points;
    trailsRef.current=tracerEnabled
      ?trailsRef.current.filter(trail=>now-trail.born<TRAIL_FADE_MS).slice(-MAX_TRAILS)
      :[];

    context.save();
    context.beginPath();
    context.rect(0,0,displayWidth,height);
    context.clip();
    context.strokeStyle="rgba(255,255,255,.14)";
    context.lineWidth=.65;
    context.beginPath();
    context.moveTo(left,top+.5*drawHeight);
    context.lineTo(right,top+.5*drawHeight);
    context.stroke();
    context.lineCap="butt";
    context.lineJoin="round";
    context.lineWidth=1.05;
    for(const trail of trailsRef.current){
      context.strokeStyle=`rgba(255,190,80,${Math.max(0,1-(now-trail.born)/TRAIL_FADE_MS)*.41})`;
      stroke(context,trail.points.filter((_,index)=>index%2===0||index===POINTS-1));
    }
    context.strokeStyle="#e6e6dc";
    context.lineWidth=1.25;
    stroke(context,points);
    context.restore();

    context.fillStyle="#fff";
    context.textAlign="center";
    context.textBaseline="top";
    context.font="11.5px ui-sans-serif, system-ui, sans-serif";
    context.fillText(frequencyText(values?.[0]??261.63),displayWidth*.5,height+1.5);
  },[canvasHeight,displayWidth,height,values]);

  return <canvas
    ref={canvasRef}
    aria-label={`Undertow waveform preview, ${frequencyText(values?.[0]??261.63)}`}
    style={{position:"absolute",left:x*scaleX,top:y,width:displayWidth,height:canvasHeight,pointerEvents:"none",zIndex:4}}
  />;
});
