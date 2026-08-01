import { memo, useId } from "react";

const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

export const RackLomasSamplerDisplay = memo(function RackLomasSamplerDisplay({
  values,
  offset,
  x,
  y,
  width,
  height,
  scaleX,
}: {
  values?: number[];
  offset: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
}) {
  const clipId=useId().replaceAll(":","-");
  const displayWidth=width*scaleX,frames=Math.max(0,Math.round(values?.[offset]??0));
  const sampleRate=Math.max(1,values?.[offset+1]??48000),phase=clamp01(values?.[offset+2]??0);
  const playing=(values?.[offset+3]??0)>.5,recording=(values?.[offset+4]??0)>.5;
  const start=clamp01(values?.[offset+6]??0),end=clamp01(values?.[offset+7]??1);
  const slice=(values?.[offset+8]??0)>.5,waveform=Array.from({length:64},(_,index)=>clamp01(Math.abs(values?.[offset+9+index]??0)));
  const margin=4,textHeight=10,waveTop=margin+textHeight+3,waveHeight=Math.max(1,height-waveTop-margin);
  const centerY=waveTop+waveHeight/2,halfHeight=waveHeight/2;
  const upper=waveform.map((value,index)=>`${margin+index*(displayWidth-2*margin)/63},${centerY-value*halfHeight}`).join(" ");
  const lower=[...waveform].reverse().map((value,reverseIndex)=>{
    const index=63-reverseIndex;
    return `${margin+index*(displayWidth-2*margin)/63},${centerY+value*halfHeight}`;
  }).join(" ");
  const minimum=Math.min(start,end),maximum=Math.max(start,end),waveWidth=displayWidth-2*margin;
  const duration=frames/sampleRate,label=recording?"Recording…":frames>0?"Browser sample":"Load audio";

  return (
    <div
      aria-label={`Advanced Sampler display, ${label}${frames>0?`, ${duration.toFixed(2)} seconds`:""}`}
      style={{position:"absolute",left:x*scaleX,top:y,width:displayWidth,height,pointerEvents:"none",zIndex:4}}
    >
      <svg width={displayWidth} height={height} viewBox={`0 0 ${displayWidth} ${height}`} role="img">
        <defs><clipPath id={clipId}><rect x=".5" y=".5" width={Math.max(0,displayWidth-1)} height={Math.max(0,height-1)} rx="3"/></clipPath></defs>
        <rect x=".5" y=".5" width={Math.max(0,displayWidth-1)} height={Math.max(0,height-1)} rx="3" fill="#181818" stroke="#080808"/>
        <g clipPath={`url(#${clipId})`}>
          <text x={margin} y={margin+7} fill="#2cafd2" fontSize="8" fontWeight="700" letterSpacing=".7" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{label}</text>
          <text x={displayWidth-margin} y={margin+7} textAnchor="end" fill="#2cafd2" fontSize="8" fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{frames>0?"0/1":"0/0"}</text>
          {frames>0&&<polygon points={`${margin},${centerY} ${upper} ${displayWidth-margin},${centerY} ${lower}`} fill="#0b2c34" stroke="#2cafd2" strokeWidth=".8"/>}
          {slice&&Array.from({length:17},(_,index)=>{
            const lineX=margin+waveWidth*index/16;
            return <path key={index} d={`M${lineX} ${waveTop}v${waveHeight*.17}M${lineX} ${waveTop+waveHeight}v${-waveHeight*.17}`} stroke="#164b69" strokeWidth=".7"/>;
          })}
          <rect x={margin} y={waveTop} width={waveWidth*minimum} height={waveHeight} fill="rgba(24,24,24,.55)"/>
          <rect x={margin+waveWidth*maximum} y={waveTop} width={waveWidth*(1-maximum)} height={waveHeight} fill="rgba(24,24,24,.55)"/>
          <path d={`M${margin+waveWidth*start} ${waveTop}v${waveHeight}M${margin+waveWidth*end} ${waveTop}v${waveHeight}`} stroke="#2cafd2" strokeWidth=".8"/>
          {playing&&<path d={`M${margin+waveWidth*phase} ${waveTop}v${waveHeight}`} stroke="#2cafd2" strokeWidth="1.2"/>}
        </g>
      </svg>
    </div>
  );
});
