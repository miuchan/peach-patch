const DISPLAY_STYLES=[
  {foreground:"#e40707",background:"#4e0c09",screen:"#3a1013"},
  {foreground:"#cdfffe",background:"#274699",screen:"#253b63"},
  {foreground:"#f0c000",background:"#303030",screen:"#303030"},
  {foreground:"#d2ff00",background:"#2a2f25",screen:"#2a2f25"},
  {foreground:"#ffffff",background:"#000000",screen:"#000000"},
] as const;

const clamp=(value:number,minimum:number,maximum:number)=>Math.max(minimum,Math.min(maximum,value));
const integer=(value:number|undefined,fallback=0)=>Number.isFinite(value)?Math.round(value as number):fallback;
const characters=(values:number[]|undefined,offset:number)=>Array.from({length:4},(_,index)=>String.fromCharCode(clamp(integer(values?.[offset+index],32),0,255))).join("");

export function RackWolframDisplay({
  values,
  cells,
  x,
  y,
  width,
  height,
  scaleX,
}:{
  values?:number[];
  cells:number;
  x:number;
  y:number;
  width:number;
  height:number;
  scaleX:number;
}){
  const menuActive=(values?.[0]??0)>.5,
    miniMenuActive=(values?.[1]??0)>.5,
    page=clamp(integer(values?.[2]),0,3),
    selected=clamp(integer(values?.[3]),0,1),
    style=DISPLAY_STYLES[clamp(integer(values?.[5]),0,DISPLAY_STYLES.length-1)],
    cellStyle=clamp(integer(values?.[6]),0,1),
    slew=clamp(integer(values?.[7]),0,100),
    seed=clamp(integer(values?.[8]),0,256),
    engineLabel=characters(values,9),
    ruleSelectLabel=characters(values,17),
    seedLabel=characters(values,21),
    modeLabel=characters(values,25),
    padding=1,
    cellPadding=(width-padding*2)/cells,
    circleRadius=5,
    roundedSize=10,
    fontSize=cellPadding*2,
    textBackgroundSize=fontSize-2,
    textBackgroundPadding=fontSize*.5-textBackgroundSize*.5+padding,
    wolfSeedSize=fontSize*.5-2,
    wolfSeedY=fontSize*.5*4+2,
    firstMatrixRow=miniMenuActive&&!menuActive?cells-4:0,
    matrix=Array.from({length:cells*cells},(_,index)=>(values?.[29+index]??0)>.5),
    menuLines=page===0
      ?[(page<2?engineLabel.toLowerCase():"menu"),"SEED",selected===0?(seed===256?"RAND":"    "):seedLabel,"<#@>"]
      :page===1
        ?[engineLabel.toLowerCase(),"MODE",modeLabel,"<#@>"]
        :page===2
          ?["menu","SLEW",`${String(slew).padStart(3," ")}%`,"<#@>"]
          :["menu","ALGO",engineLabel,"<#@>"],
    drawTextBackground=(row:number)=><g key={`text-bg-${row}`}>{Array.from({length:4},(_,column)=><rect key={column} x={column*fontSize+textBackgroundPadding} y={row*fontSize+textBackgroundPadding} width={textBackgroundSize} height={textBackgroundSize} rx="3" fill={style.background}/>)}</g>,
    drawWolfSeed=(foreground:boolean)=><g key={foreground?"wolf-seed-on":"wolf-seed-off"}>
      {Array.from({length:8},(_,column)=>{
        const on=Boolean((seed>>(7-column))&1);
        return on===foreground?<rect key={column} x={column*fontSize*.5+2} y={wolfSeedY} width={wolfSeedSize} height={wolfSeedSize*2+2} rx="3" fill={foreground?style.foreground:style.background}/>:null;
      })}
      {foreground&&Array.from({length:7},(_,index)=>{
        const column=index+1,xPosition=column*fontSize*.5+1;
        return <path key={column} d={`M ${xPosition} ${wolfSeedY-1} v 2 M ${xPosition} ${wolfSeedY+fontSize-textBackgroundPadding-1} v 2`} fill="none" stroke={style.foreground} strokeWidth=".5"/>;
      })}
    </g>;

  return <svg
    className="pw-wolfram-display"
    aria-label={menuActive?`Wolfram ${menuLines.join(" ").trim()} menu`:`Wolfram ${engineLabel.trim()} cellular automaton display`}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    style={{left:x*scaleX,top:y,width:width*scaleX,height}}
  >
    <rect x=".5" y=".5" width={width-1} height={height-1} rx="2" fill={style.screen} stroke="#101010" strokeWidth="1"/>
    {menuActive&&<>
      {Array.from({length:4},(_,row)=>page===0&&selected===0&&seed!==256&&row===2?drawWolfSeed(false):drawTextBackground(row))}
      {page===0&&selected===0&&seed!==256&&drawWolfSeed(true)}
      {menuLines.map((line,row)=><text key={row} x="1" y={1+fontSize*row} fill={style.foreground} fontFamily={'"Modular Mooch Wolfram", monospace'} fontSize={fontSize} dominantBaseline="hanging" xmlSpace="preserve">{line}</text>)}
    </>}
    {!menuActive&&miniMenuActive&&<>
      {drawTextBackground(0)}
      {drawTextBackground(1)}
      <text x="1" y="1" fill={style.foreground} fontFamily={'"Modular Mooch Wolfram", monospace'} fontSize={fontSize} dominantBaseline="hanging">RULE</text>
      <text x="1" y={1+fontSize} fill={style.foreground} fontFamily={'"Modular Mooch Wolfram", monospace'} fontSize={fontSize} dominantBaseline="hanging" xmlSpace="preserve">{ruleSelectLabel}</text>
    </>}
    {!menuActive&&matrix.map((on,index)=>{
      const row=Math.floor(index/cells),column=index%cells;
      if(row<firstMatrixRow)return null;
      if(cellStyle===1){
        const inset=(cellPadding-roundedSize)*.5+padding;
        return <rect key={index} x={column*cellPadding+inset} y={row*cellPadding+inset} width={roundedSize} height={roundedSize} rx="1" fill={on?style.foreground:style.background}/>;
      }
      const center=cellPadding*.5+padding;
      return <circle key={index} cx={column*cellPadding+center} cy={row*cellPadding+center} r={circleRadius} fill={on?style.foreground:style.background}/>;
    })}
  </svg>;
}
