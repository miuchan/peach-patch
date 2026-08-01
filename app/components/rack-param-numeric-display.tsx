import { useEffect, useRef } from "react";
import dseg7FontUrl from "../assets/fonts/dseg7-classic-mini/DSEG7ClassicMini-Bold.ttf?url";

const MM_TO_RACK_PX=75/25.4;

export function RackParamNumericDisplay({
  value,
  digits,
  x,
  y,
  width,
  height,
  scaleX=1,
}:{
  value:number;
  digits:number;
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX?:number;
}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas)return;
    const density=Math.max(1,Math.min(3,window.devicePixelRatio||1)),displayWidth=width*scaleX;
    canvas.width=Math.round(displayWidth*density);
    canvas.height=Math.round(height*density);
    const context=canvas.getContext("2d");
    if(!context)return;
    const draw=()=>{
      context.setTransform(density,0,0,density,0,0);
      context.clearRect(0,0,displayWidth,height);
      context.fillStyle="#1a1a1a";
      context.beginPath();
      context.roundRect(0,0,displayWidth,height,1.5*scaleX);
      context.fill();
      context.font=`${6*scaleX}px DSEG7ClassicMini, monospace`;
      context.textAlign="right";
      context.textBaseline="alphabetic";
      context.fillStyle="#90c73e";
      context.shadowColor="#90c73e";
      context.shadowBlur=.7*scaleX;
      if("letterSpacing" in context)context.letterSpacing=`${.5*scaleX}px`;
      const rounded=Math.round(Number.isFinite(value)?value:0),text=String(rounded).padStart(digits,"0").slice(-digits);
      context.fillText(text,6.05*MM_TO_RACK_PX*scaleX,3.1*MM_TO_RACK_PX);
    };
    const font=new FontFace("DSEG7ClassicMini",`url(${dseg7FontUrl})`,{weight:"700"});
    font.load().then(loaded=>{document.fonts.add(loaded);draw()}).catch(draw);
  },[digits,height,scaleX,value,width]);
  return <canvas ref={ref} className="pw-rack-segment" style={{left:x*scaleX,top:y,width:width*scaleX,height}} aria-label={`${digits}-digit parameter display`}/>;
}
