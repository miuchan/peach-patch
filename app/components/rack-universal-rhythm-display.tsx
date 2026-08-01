const STYLE_NAMES=["W.African","Afro-Cuban","Brazilian","Balkan","Indian","Gamelan","Jazz","Electronic","Breakbeat","Techno"],
  STYLE_COLORS=["#ff7864","#64c8ff","#ffc850","#c86496","#ff96c8","#96dcb4","#b496ff","#64dcdc","#ffb464","#dcdcdc"],
  DISPLAY_TO_ROLE=[3,2,0,1],
  UI_TO_ROLE=[1,0,2,3],
  ROLE_NAMES=["FOUNDATION","TIMELINE","GROOVE","LEAD"];

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}

export function RackUniversalRhythmDisplay({values,steps,displayX,displayY,displayWidth,displayHeight,roleStartX,roleSpacing,x,y,width,height,scaleX}:{values?:number[];steps:number;displayX:number;displayY:number;displayWidth:number;displayHeight:number;roleStartX:number;roleSpacing:number;x:number;y:number;width:number;height:number;scaleX:number}){
  const rowHeight=displayHeight/8;
  return <svg className="pw-rack-universal-rhythm" aria-label="Universal Rhythm eight-voice pattern display" viewBox={`0 0 ${width} ${height}`} style={{position:"absolute",left:x*scaleX,top:y,width:width*scaleX,height,pointerEvents:"none"}}>
    <rect x={displayX} y={displayY} width={displayWidth} height={displayHeight} rx="2" fill="#191919"/>
    {DISPLAY_TO_ROLE.map((role,displayRow)=>{
      const length=clamp(Math.round(values?.[role]??16),1,steps),current=clamp(Math.round(values?.[4+role]??0),0,length-1),
        style=clamp(Math.round(values?.[8+role]??0),0,9),stepWidth=displayWidth/length;
      return <g key={role}>
        <rect x={displayX+current*stepWidth} y={displayY+displayRow*rowHeight*2} width={stepWidth} height={rowHeight*2} fill={STYLE_COLORS[style]} fillOpacity={60/255}/>
        {[0,1].flatMap(voiceIndex=>{
          const voice=role*2+voiceIndex,yPosition=displayY+(displayRow*2+voiceIndex)*rowHeight+rowHeight/2;
          return Array.from({length},(_,step)=>{
            const velocity=clamp(values?.[12+voice*steps+step]??0,0,1);
            if(velocity<=0)return null;
            return <circle key={`${voice}-${step}`} cx={displayX+step*stepWidth+stepWidth/2} cy={yPosition} r={1.5+velocity*1.5} fill={STYLE_COLORS[style]} fillOpacity={voiceIndex===0?1:200/255}/>;
          });
        })}
      </g>;
    })}
    {UI_TO_ROLE.map((role,index)=>{
      const center=roleStartX+index*roleSpacing,style=clamp(Math.round(values?.[8+role]??0),0,9),color=STYLE_COLORS[style];
      return <g key={`label-${role}`} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial, sans-serif">
        <text x={center} y="165" fontSize="17.5" fontWeight="700" stroke="#fff" strokeWidth="2" paintOrder="stroke" fill={color}>{ROLE_NAMES[index]}</text>
        <text x={center} y="178" fontSize="16" stroke="rgba(0,0,0,.392)" strokeWidth="1" paintOrder="stroke" fill={color}>{STYLE_NAMES[style]}</text>
      </g>;
    })}
  </svg>;
}
