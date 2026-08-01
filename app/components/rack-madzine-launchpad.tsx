import { useRef, useState, type PointerEvent } from "react";

const cellColors = ["#323437", "#8c6446", "#3c8264", "#a0463c", "#b49650", "#785a3c", "#b46450"];
const speedPresets = [-8, -4, -2, -1, -.5, .5, 1, 2, 4, 8];

function speedToKnob(speed:number) {
  if (speed < 0) return (speed + 8) / 32;
  if (speed < 1) return .25 + speed / 4;
  return .5 + (speed - 1) / 14;
}

export function RackMadzineLaunchpad({
  actionBase,
  rows,
  columns,
  wavePoints,
  cellWidth,
  cellHeight,
  spacingX,
  spacingY,
  x,
  y,
  width,
  height,
  scaleX,
  values,
  onMomentary,
}: {
  actionBase:number;
  rows:number;
  columns:number;
  wavePoints:number;
  cellWidth:number;
  cellHeight:number;
  spacingX:number;
  spacingY:number;
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX:number;
  values?:number[];
  onMomentary:(id:number,active:boolean)=>void;
}) {
  const gridRef=useRef<HTMLDivElement>(null);
  const holdTimerRef=useRef<number|null>(null);
  const dragRef=useRef<{pointerId:number;source:number;target:number;held:boolean;copy:boolean}|null>(null);
  const [pressed,setPressed]=useState<number|null>(null);
  const [dropTarget,setDropTarget]=useState<number|null>(null);
  const [speedCell,setSpeedCell]=useState<number|null>(null);
  const cellCount=rows*columns,waveOffset=cellCount*4,visual=values??[];
  const action=(id:number)=>{onMomentary(id,true);onMomentary(id,false)};
  const clearHold=()=>{if(holdTimerRef.current!==null){window.clearTimeout(holdTimerRef.current);holdTimerRef.current=null}};
  const targetAt=(event:PointerEvent<HTMLButtonElement>)=>{
    const rect=gridRef.current?.getBoundingClientRect();
    if(!rect)return dragRef.current?.source??0;
    const localX=(event.clientX-rect.left)/rect.width*width,
      localY=(event.clientY-rect.top)/rect.height*height,
      column=Math.max(0,Math.min(columns-1,Math.round((localX-cellWidth/2)/spacingX))),
      row=Math.max(0,Math.min(rows-1,Math.round((localY-cellHeight/2)/spacingY)));
    return row*columns+column;
  };
  const release=(event:PointerEvent<HTMLButtonElement>)=>{
    const drag=dragRef.current;
    if(!drag||drag.pointerId!==event.pointerId)return;
    clearHold();
    if(!drag.held){
      if(drag.target!==drag.source)action((drag.copy?5300:1200)+drag.source*cellCount+drag.target);
      else action(actionBase+drag.source);
    }
    dragRef.current=null;
    setPressed(null);
    setDropTarget(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const setSpeed=(cell:number,knob:number)=>{
    const value=Math.max(0,Math.min(1000,Math.round(knob*1000)));
    action(10000+cell*1001+value);
  };
  return (
    <div ref={gridRef} className="pw-madzine-launchpad" style={{left:x*scaleX,top:y,width:width*scaleX,height}}>
      {Array.from({length:cellCount},(_,cell)=>{
        const row=Math.floor(cell/columns),column=cell%columns,state=Math.max(0,Math.min(6,Math.round(visual[cell*4]??0))),
          loopClocks=Math.max(0,Math.round(visual[cell*4+1]??0)),progress=Math.max(0,Math.min(1,visual[cell*4+2]??0)),
          wave=visual.slice(waveOffset+cell*wavePoints,waveOffset+(cell+1)*wavePoints),
          maximum=Math.max(.001,...wave.map(value=>Math.abs(value))),
          points=wave.map((value,index)=>`${4+index/(wavePoints-1)*(cellWidth-8)},${cellHeight/2-value/maximum*(cellHeight/2-4)}`).join(" ");
        return (
          <button
            key={cell}
            type="button"
            aria-label={`Launchpad cell ${row+1}-${column+1}`}
            className={`${pressed===cell?"pressed ":""}${dropTarget===cell&&pressed!==cell?"drop-target ":""}state-${state}`}
            style={{left:column*spacingX*scaleX,top:row*spacingY,width:cellWidth*scaleX,height:cellHeight,backgroundColor:cellColors[state]}}
            onPointerDown={(event)=>{
              if(event.button!==0)return;
              event.preventDefault();event.stopPropagation();setSpeedCell(null);
              dragRef.current={pointerId:event.pointerId,source:cell,target:cell,held:false,copy:event.shiftKey};
              setPressed(cell);setDropTarget(cell);event.currentTarget.setPointerCapture(event.pointerId);
              holdTimerRef.current=window.setTimeout(()=>{
                const drag=dragRef.current;if(!drag||drag.source!==cell||drag.target!==cell)return;
                drag.held=true;action(1100+cell);
              },1000);
            }}
            onPointerMove={(event)=>{
              const drag=dragRef.current;if(!drag||drag.pointerId!==event.pointerId)return;
              const target=targetAt(event);drag.copy=event.shiftKey;
              if(target!==drag.target){drag.target=target;setDropTarget(target)}
              if(target!==drag.source)clearHold();
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();setSpeedCell(cell)}}
          >
            {(state===2||state===5)&&wave.some(value=>Math.abs(value)>.001)&&<svg viewBox={`0 0 ${cellWidth} ${cellHeight}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points}/><line x1={4+progress*(cellWidth-8)} x2={4+progress*(cellWidth-8)} y1="2" y2={cellHeight-2}/></svg>}
            {loopClocks>0&&<span>{loopClocks}</span>}
            {state===3&&<i style={{width:`${progress*100}%`}}/>}
          </button>
        );
      })}
      {speedCell!==null&&(()=>{
        const speed=visual[speedCell*4+3]??1,knob=Math.max(0,Math.min(1,speedToKnob(speed))),
          column=speedCell%columns,row=Math.floor(speedCell/columns);
        return <div className="pw-launchpad-speed" style={{left:Math.min(width*scaleX-156,column*spacingX*scaleX),top:Math.min(height-74,row*spacingY+cellHeight)}}>
          <b>Cell {row+1}-{column+1} · {speed.toFixed(2)}×</b>
          <input aria-label={`Cell ${row+1}-${column+1} playback speed`} type="range" min="0" max="1000" defaultValue={Math.round(knob*1000)} onPointerDown={(event)=>event.stopPropagation()} onDoubleClick={(event)=>{event.preventDefault();event.stopPropagation();event.currentTarget.value="500";setSpeed(speedCell,.5)}} onChange={(event)=>setSpeed(speedCell,Number(event.target.value)/1000)}/>
          <select aria-label={`Cell ${row+1}-${column+1} speed preset`} defaultValue={speedPresets.includes(speed)?String(speed):""} onPointerDown={(event)=>event.stopPropagation()} onChange={(event)=>setSpeed(speedCell,speedToKnob(Number(event.target.value)))}>
            <option value="">Custom</option>
            {speedPresets.map(value=><option key={value} value={value}>{value}×</option>)}
          </select>
          <button type="button" aria-label="Close speed menu" onPointerDown={(event)=>event.stopPropagation()} onClick={()=>setSpeedCell(null)}>×</button>
        </div>;
      })()}
    </div>
  );
}
