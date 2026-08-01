const ALGORITHMS=["DECIMATE","DROPOUT","DESTROY","DJ FILTER","VINYL SIM"];

export function RackCorrupterDisplay({
  values,
  bins,
  x,
  y,
  width,
  height,
  scaleX,
}:{
  values?:number[];
  bins:number;
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX:number;
}){
  const writePosition=Math.max(0,Math.min(bins-1,Math.round(values?.[0]??0))),
    algorithm=Math.max(0,Math.min(ALGORITHMS.length-1,Math.round(values?.[1]??0))),
    waveHeight=height-14,
    middle=waveHeight/2,
    columnWidth=width/bins,
    status=[
      {label:"BND",active:(values?.[2]??0)>.5,x:(17-7)/77.44*width,color:"#00ff80"},
      {label:"BRK",active:(values?.[3]??0)>.5,x:(35.48-7)/77.44*width,color:"#ff8000"},
      {label:"FRZ",active:(values?.[4]??0)>.5,x:(53.96-7)/77.44*width,color:"#4080ff"},
    ];
  return <svg
    className="pw-corrupter-display"
    aria-label={`Corrupter waveform, ${ALGORITHMS[algorithm]} algorithm`}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    style={{position:"absolute",left:x*scaleX,top:y,width:width*scaleX,height,pointerEvents:"none"}}
  >
    <rect width={width} height={height} fill="#051018"/>
    {Array.from({length:bins},(_,bin)=>{
      const source=(writePosition+bin)%bins,
        amplitude=Math.max(0,Math.min(1,values?.[5+source]??0));
      if(amplitude<=0)return null;
      const barHeight=amplitude*middle,
        red=Math.round(0x10+amplitude*0x60),
        green=Math.round(0x60+amplitude*0x9f),
        blue=Math.round(0x80+amplitude*0x7f);
      return <rect
        key={bin}
        x={bin*columnWidth}
        y={middle-barHeight}
        width={Math.max(columnWidth,.35)}
        height={barHeight*2}
        fill={`rgba(${red},${green},${blue},.784)`}
      />;
    })}
    <rect x={writePosition/bins*width} y="0" width="1.5" height={waveHeight} fill="rgba(255,255,255,.706)"/>
    {status.map(item=>item.active&&<text key={item.label} x={item.x} y={height-3} fill={item.color} fontSize="9" textAnchor="middle">{item.label}</text>)}
    <text x={(72.44-7)/77.44*width} y={height-3} fill="#80e0e0" fontSize="9" textAnchor="middle">{ALGORITHMS[algorithm]}</text>
    <rect x=".5" y=".5" width={width-1} height={height-1} fill="none" stroke="rgba(80,145,170,.45)" strokeWidth="1"/>
  </svg>;
}
