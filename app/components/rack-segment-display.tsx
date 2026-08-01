import { useEffect, useRef } from "react";
import segmentFontUrl from "../assets/fonts/braids-segment14/Segment14.ttf?url";

export function RackSegmentDisplay({value,values,x,y,width,height,scaleX=1}:{value:number;values:string[];x:number;y:number;width:number;height:number;scaleX?:number}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const density=Math.max(1,Math.min(3,window.devicePixelRatio||1)),displayWidth=width*scaleX;
    canvas.width=Math.round(displayWidth*density);canvas.height=Math.round(height*density);
    const context=canvas.getContext("2d");if(!context)return;
    const draw=()=>{
      context.setTransform(density,0,0,density,0,0);context.clearRect(0,0,displayWidth,height);
      context.fillStyle="#383838";context.strokeStyle="#101010";context.lineWidth=1;
      context.beginPath();context.roundRect(0,0,displayWidth,height,5);context.fill();context.stroke();
      context.font=`${38*scaleX}px BraidsSegment14, monospace`;context.textBaseline="alphabetic";
      context.fillStyle="rgba(175,210,44,.063)";context.fillText("~~~~",9*scaleX,48);
      const index=Math.max(0,Math.min(values.length-1,Math.round(value*(values.length-1))));
      context.fillStyle="#afd22c";context.shadowColor="#afd22c";context.shadowBlur=2;context.fillText(values[index]??values[0]??"",9*scaleX,48);
    };
    const font=new FontFace("BraidsSegment14",`url(${segmentFontUrl})`);font.load().then(loaded=>{document.fonts.add(loaded);draw()}).catch(draw);
  },[height,scaleX,value,values,width]);
  return <canvas ref={ref} className="pw-rack-segment" style={{left:x*scaleX,top:y,width:width*scaleX,height}} aria-label="Live Rack segment display"/>;
}
