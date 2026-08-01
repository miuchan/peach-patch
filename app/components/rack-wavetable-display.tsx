import { memo, useEffect, useRef } from "react";

export const RackWavetableDisplay=memo(function RackWavetableDisplay({values,x,y,width,height,scaleX}:{
  values?:number[];x:number;y:number;width:number;height:number;scaleX:number;
}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=canvasRef.current,displayWidth=width*scaleX;
    if(!canvas)return;
    const ratio=Math.min(2,window.devicePixelRatio||1),pixelWidth=Math.max(1,Math.round(displayWidth*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
    if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    const context=canvas.getContext("2d");
    if(!context)return;
    context.setTransform(ratio*scaleX,0,0,ratio,0,0);
    context.clearRect(0,0,width,height);
    context.fillStyle="#080b08";context.fillRect(0,0,width,height);
    context.fillStyle="#f0cf35";context.font="11px 'SFMono-Regular',Consolas,monospace";context.textBaseline="top";
    context.fillText((values?.[0]??0)>.5?"Browser wavetable":"Basic.wav",4,3);
    if(!values||values.length<132)return;
    const top=18,bottom=height-5,plotHeight=Math.max(1,bottom-top),samples=values.slice(3,132);
    context.beginPath();
    for(let index=0;index<samples.length;index++){
      const px=4+(width-8)*index/(samples.length-1),sample=Number.isFinite(samples[index])?Math.max(-1,Math.min(1,samples[index])):0,py=top+plotHeight*(.5-.5*sample);
      if(index===0)context.moveTo(px,py);else context.lineTo(px,py);
    }
    context.lineCap="round";context.lineJoin="round";context.strokeStyle="#f0cf35";context.lineWidth=1.5;context.stroke();
  },[values,width,height,scaleX]);
  return <canvas ref={canvasRef} aria-label="Live wavetable waveform" style={{position:"absolute",left:x*scaleX,top:y,width:width*scaleX,height,pointerEvents:"none",zIndex:4}}/>;
});
