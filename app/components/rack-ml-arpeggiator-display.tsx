export function RackMlArpeggiatorDisplay({values,channels,rows,x,y,width,height,scaleX}:{values?:number[];channels:number;rows:number;x:number;y:number;width:number;height:number;scaleX:number}){
  const activeChannels=Math.max(1,Math.min(channels,Math.round(values?.[0]??1))),
    rowHeight=height/rows,columnWidth=width/activeChannels,
    horizontalRows=[1,2,4,5,6,7,8,10,11,12,13,14,15,16];
  return <svg
    className="pw-ml-arpeggiator-display"
    aria-label={`${activeChannels}-channel arpeggiator order, range, and mode display`}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    style={{left:x*scaleX,top:y,width:width*scaleX,height}}
  >
    <rect className="frame" x=".25" y=".25" width={width-.5} height={height-.5}/>
    {horizontalRows.map(row=><line key={`row-${row}`} x1="0" x2={width} y1={row*rowHeight} y2={row*rowHeight}/>)}
    {Array.from({length:activeChannels},(_,channel)=>{
      const offset=1+channel*3,order=Math.max(0,Math.min(1,Math.round(values?.[offset]??0))),
        range=Math.max(0,Math.min(3,Math.round(values?.[offset+1]??1))),
        mode=Math.max(0,Math.min(6,Math.round(values?.[offset+2]??0))),
        left=channel*columnWidth;
      return <g key={channel}>
        {channel>0&&<line x1={left} x2={left} y1="0" y2={height}/>}
        <rect className="active" x={left} y={(1-order)*rowHeight} width={columnWidth} height={rowHeight}/>
        <rect className="active" x={left} y={(7-range)*rowHeight} width={columnWidth} height={rowHeight}/>
        <rect className="active" x={left} y={(16-mode)*rowHeight} width={columnWidth} height={rowHeight}/>
      </g>;
    })}
  </svg>;
}
