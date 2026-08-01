import type { CSSProperties } from "react";

const NOTE_NAMES_SHARP=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const NOTE_NAMES_FLAT=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
const COLORS=["#ff3333","#ffd456","#72ea65","#13ecc4","#ebebeb"];

function noteText(voltage:number,flats:boolean){
  const microPitch=Math.max(-10,Math.min(10,voltage))*12+60,
    sourceNote=Math.round(microPitch),
    finalNote=Math.round(sourceNote+(microPitch-sourceNote)),
    deviation=microPitch-sourceNote-(finalNote-sourceNote),
    nameIndex=(1200+finalNote)%12,
    octave=Math.trunc(finalNote/12)-1,
    name=(flats?NOTE_NAMES_FLAT:NOTE_NAMES_SHARP)[nameIndex]??"C";
  if(Math.abs(deviation)<.01)return`${name}${octave}`;
  return`${name}${octave} ${deviation>0?"+":"-"}${Math.trunc(Math.abs(deviation)*100)}c`;
}

function numericText(value:number,decimals:number){
  const rendered=value.toFixed(Math.max(0,Math.min(8,Math.round(decimals))));
  return value>=0?` ${rendered}`:rendered;
}

export function RackNoteMeterDisplay({samples,params,x,y,width,height,rowHeight,scaleX=1}:{samples?:number[][];params:number[];x:number;y:number;width:number;height:number;rowHeight:number;scaleX?:number}){
  const mode=Math.max(0,Math.min(2,Math.round(params[1]??0))),
    decimals=Math.round(params[2]??5),
    flats=(params[0]??0)>=.5,
    color=COLORS[Math.max(0,Math.min(COLORS.length-1,Math.round(params[3]??0)))]??COLORS[0],
    readings=Array.from({length:16},(_,index)=>{
      const voltage=samples?.[index]?.at(-1);
      if(voltage===undefined||!Number.isFinite(voltage))return"";
      if(mode===1)return numericText(voltage,decimals);
      if(mode===2)return numericText(Math.pow(2,voltage)*261.625565,decimals);
      return noteText(voltage,flats);
    });
  return <div className="pw-rack-note-meter" style={{left:x*scaleX,top:y,width:width*scaleX,height,color,"--note-row-height":`${rowHeight}px`} as CSSProperties} aria-label={`Note meter ${mode===0?"note names":mode===1?"volts":"frequency"}`}>
    <b>{mode===0?"":mode===1?"V":"Hz"}</b>
    {readings.map((reading,index)=><span key={index}>{reading}</span>)}
  </div>;
}
