import { memo, useEffect, useMemo, useRef } from "react";

type Point={x:number;y:number};

function hexGeometry(radius:number){
  const size=.5*86/radius,dx=size*1.5,dy=size*Math.sqrt(3),width=radius*2*dx,height=radius*2*dy,yAxis=3*radius-2,
    length=radius**3-(radius-1)**3,toCoords=(raw:number)=>{
      const resolve=(input:number)=>{
        let x=input,y=0,z=0;
        while(x<0){x+=yAxis+1;z+=1}
        while(x>=radius){x-=yAxis;y+=1}
        return[x,y,z];
      };
      const first=resolve(raw);
      return Math.max(...first)<radius?first:resolve(raw-length);
    };
  return{size,points:Array.from({length},(_,index)=>{const[x,y,z]=toCoords(index);return{x:width/2+(x-y)*dx,y:height/2+(z-(x+y)/2)*dy}})};
}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,Number.isFinite(value)?value:min))}

function drawHexagon(context:CanvasRenderingContext2D,point:Point,size:number,color:string){
  context.beginPath();
  context.moveTo(point.x+size,point.y);
  for(let index=1;index<6;index++){const angle=index*Math.PI/3;context.lineTo(point.x+Math.cos(angle)*size,point.y+Math.sin(angle)*size)}
  context.closePath();context.fillStyle=color;context.fill();
}

function tileColor(voltage:number,written:number,read:number){
  const normalized=Math.abs(voltage)/5,decibels=clamp(normalized>0?1+Math.log10(normalized)*.5:0,0,1),value=255*decibels;
  return`rgb(${Math.min(255,Math.round(value+255*clamp(written,0,1)))},${Math.round(value)},${Math.min(255,Math.round(value+255*clamp(read,0,1)))})`;
}

export const RackHexLooperDisplay=memo(function RackHexLooperDisplay({values,radius,x,y,width,height,scaleX}:{
  values?:number[];radius:number;x:number;y:number;width:number;height:number;scaleX:number;
}){
  const canvasRef=useRef<HTMLCanvasElement>(null),geometry=useMemo(()=>hexGeometry(radius),[radius]);
  useEffect(()=>{
    const canvas=canvasRef.current,displayWidth=width*scaleX;
    if(!canvas)return;
    const ratio=Math.min(2,window.devicePixelRatio||1),pixelWidth=Math.max(1,Math.round(displayWidth*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;
    if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    const context=canvas.getContext("2d");
    if(!context)return;
    context.setTransform(ratio*displayWidth/150,0,0,ratio,0,0);context.clearRect(0,0,150,height);
    if(!values||values.length<2+geometry.points.length*3)return;
    context.save();context.translate(150,4);context.rotate(Math.PI/2);
    for(let index=0;index<geometry.points.length;index++)drawHexagon(context,geometry.points[index],geometry.size,tileColor(values[2+index*3]??0,values[3+index*3]??0,values[4+index*3]??0));
    const write=Math.trunc(values[0]??-1),read=Math.trunc(values[1]??-1);
    if(geometry.points[write]){drawHexagon(context,geometry.points[write],geometry.size*2,"rgb(255,0,0)");drawHexagon(context,geometry.points[write],geometry.size,tileColor(values[2+write*3]??0,values[3+write*3]??0,values[4+write*3]??0))}
    if(geometry.points[read]){drawHexagon(context,geometry.points[read],geometry.size*2,"rgb(0,0,255)");drawHexagon(context,geometry.points[read],geometry.size,tileColor(values[2+read*3]??0,values[3+read*3]??0,values[4+read*3]??0))}
    context.restore();
  },[values,geometry,width,height,scaleX]);
  return <canvas ref={canvasRef} aria-label="Live three-dimensional looper memory" style={{position:"absolute",left:x*scaleX,top:y,width:width*scaleX,height,pointerEvents:"none",zIndex:4}}/>;
});
