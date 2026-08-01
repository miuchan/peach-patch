import { useId, useState, type PointerEvent } from "react";

const WAVEFORM_COLORS = [
  [255, 0, 0],
  [255, 180, 0],
  [0, 255, 0],
  [100, 200, 255],
  [255, 200, 150],
  [255, 100, 200],
  [255, 255, 255],
] as const;

function bounded(value:number,min:number,max:number){
  return Math.max(min,Math.min(max,value));
}

export function RackTapestryDisplay({
  values,
  bins,
  maxSplices,
  actionBase,
  deleteActionBase,
  actionSteps,
  x,
  y,
  width,
  height,
  scaleX,
  onMomentary,
}:{
  values?:number[];
  bins:number;
  maxSplices:number;
  actionBase:number;
  deleteActionBase:number;
  actionSteps:number;
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX:number;
  onMomentary:(id:number,active:boolean)=>void;
}){
  const gradientId=`tapestry-waveform-${useId().replace(/:/g,"")}`,
    [hoverX,setHoverX]=useState<number|null>(null),
    present=Boolean(values?.[0]),
    playhead=bounded(values?.[1]??0,0,1),
    currentSplice=Math.round(values?.[2]??0),
    colorIndex=bounded(Math.round(values?.[3]??3),0,WAVEFORM_COLORS.length-1),
    spliceCount=bounded(Math.round(values?.[4]??0),0,maxSplices),
    splices=Array.from({length:spliceCount},(_,index)=>bounded(values?.[5+index]??0,0,1)),
    waveOffset=5+maxSplices,
    [red,green,blue]=WAVEFORM_COLORS[colorIndex],
    hitTolerance=6/width,
    hoveredSplice=hoverX===null?-1:splices.findIndex(marker=>Math.abs(marker-hoverX/width)<=hitTolerance),
    barWidth=2.5,
    barGap=1,
    barSpacing=barWidth+barGap,
    centerY=height*.5,
    maxBarHeight=height*.45;

  const position=(event:PointerEvent<SVGSVGElement>)=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    return bounded((event.clientX-bounds.left)*width/Math.max(1,bounds.width),0,width);
  }, trigger=(event:PointerEvent<SVGSVGElement>,remove:boolean)=>{
    const normalized=position(event)/width,
      encoded=Math.round(normalized*(actionSteps-1)),
      id=(remove?deleteActionBase:actionBase)+encoded;
    onMomentary(id,true);
    onMomentary(id,false);
  };

  return <svg
    className="pw-tapestry-display"
    aria-label="Tapestry reel waveform and splice editor"
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    style={{position:"absolute",left:x*scaleX,top:y,width:width*scaleX,height,touchAction:"none"}}
    onPointerDown={(event)=>{
      if(!present||event.button>0)return;
      event.preventDefault();
      event.stopPropagation();
      trigger(event,event.button===1);
    }}
    onContextMenu={(event)=>{
      if(!present)return;
      event.preventDefault();
      event.stopPropagation();
      const bounds=event.currentTarget.getBoundingClientRect(),
        normalized=bounded((event.clientX-bounds.left)/Math.max(1,bounds.width),0,1),
        encoded=Math.round(normalized*(actionSteps-1)),
        id=deleteActionBase+encoded;
      onMomentary(id,true);
      onMomentary(id,false);
    }}
    onPointerMove={(event)=>setHoverX(position(event))}
    onPointerLeave={()=>setHoverX(null)}
  >
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={`rgb(${red},${green},${blue})`} stopOpacity=".86"/>
        <stop offset="1" stopColor={`rgb(${Math.round(red*.7)},${Math.round(green*.7)},${Math.round(blue*.7)})`} stopOpacity=".71"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width={width} height={height} fill="#141419"/>
    {present&&Array.from({length:bins},(_,bin)=>{
      const peak=Math.max(0,values?.[waveOffset+bin]??0),
        barHeight=Math.max(2,Math.pow(peak,.7)*maxBarHeight),
        barX=bin*barSpacing,
        hovered=hoverX!==null&&hoverX>=barX&&hoverX<barX+barSpacing;
      return <g key={bin}>
        <rect x={barX+.5} y={centerY-barHeight+.5} width={barWidth} height={barHeight*2} rx="1" fill="rgba(0,0,0,.078)"/>
        <rect x={barX} y={centerY-barHeight} width={barWidth} height={barHeight} rx="1" fill={`url(#${gradientId})`} opacity={hovered?1:.9}/>
        <rect x={barX} y={centerY} width={barWidth} height={barHeight} rx="1" fill={`url(#${gradientId})`} opacity={hovered?1:.9}/>
        {barHeight>3?<><circle cx={barX+barWidth*.5} cy={centerY-barHeight} r={barWidth*.5} fill={`rgba(${red},${green},${blue},${hovered?1:.86})`}/><circle cx={barX+barWidth*.5} cy={centerY+barHeight} r={barWidth*.5} fill={`rgba(${Math.round(red*.7)},${Math.round(green*.7)},${Math.round(blue*.7)},${hovered?1:.78})`}/></>:null}
        {hovered?<rect x={barX} y={centerY-barHeight} width={barWidth} height={barHeight*2} rx="1" fill="none" stroke="rgba(255,255,255,.31)" strokeWidth=".5"/>:null}
      </g>;
    })}
    {present?<line x1="0" y1={centerY} x2={width} y2={centerY} stroke="rgba(100,100,120,.235)" strokeWidth=".5"/>:null}
    {present&&splices.map((marker,index)=><line key={index} x1={marker*width} y1="0" x2={marker*width} y2={height} stroke={index===currentSplice?"#ffc832":"#c89632"} strokeWidth={index===currentSplice?2:1}/>)}
    {present?<line x1={playhead*width} y1="0" x2={playhead*width} y2={height} stroke="#ff5050" strokeWidth="2"/>:null}
    {present&&hoverX!==null?<><line x1={hoverX} y1="0" x2={hoverX} y2={height} stroke={hoveredSplice>=0?"rgba(255,100,100,.706)":"rgba(100,255,100,.588)"} strokeWidth={hoveredSplice>=0?3:2}/><path d={`M${hoverX},0 L${hoverX-5},-5 L${hoverX+5},-5 Z`} fill={hoveredSplice>=0?"rgba(255,100,100,.784)":"rgba(100,255,100,.784)"}/></>:null}
    <rect x=".5" y=".5" width={width-1} height={height-1} fill="none" stroke="#3c3c46" strokeWidth="1"/>
  </svg>;
}
