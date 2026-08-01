import { memo, useEffect, useRef } from "react";

const FFT_SIZE=2048,SAMPLE_RATE=48_000,BANDS=[25,40,63,100,160,250,500,1000,2000,4000,8000,16000],
  THEMES=[
    ["#ff3038","#ff8a66","#260a0c","#ffc247"],
    ["#ff6b18","#ffc15a","#2a1408","#ffe6a6"],
    ["#ffd24a","#ff9f2f","#2a1a0a","#ff5a36"],
    ["#47ff87","#8fb8ff","#102a1a","#ff8747"],
    ["#93eaff","#5b8cff","#202020","#ff3030"],
    ["#6f9fd8","#b4c4de","#101824","#ffe0a3"],
    ["#ffe0a3","#b9d6c2","#241f18","#ff7043"],
  ];

function fftMagnitudes(samples:number[]){
  const real=new Float64Array(FFT_SIZE),imaginary=new Float64Array(FFT_SIZE),offset=Math.max(0,samples.length-FFT_SIZE);
  for(let index=0;index<FFT_SIZE;index++)real[index]=(samples[offset+index]??0)*.1*(.5-.5*Math.cos(2*Math.PI*index/(FFT_SIZE-1)));
  for(let index=1,j=0;index<FFT_SIZE;index++){
    let bit=FFT_SIZE>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
    if(index<j)[real[index],real[j]]=[real[j],real[index]];
  }
  for(let length=2;length<=FFT_SIZE;length<<=1){
    const angle=-2*Math.PI/length,stepReal=Math.cos(angle),stepImaginary=Math.sin(angle);
    for(let offset=0;offset<FFT_SIZE;offset+=length){
      let twiddleReal=1,twiddleImaginary=0;
      for(let index=0;index<length/2;index++){
        const even=offset+index,odd=even+length/2,
          oddReal=real[odd]*twiddleReal-imaginary[odd]*twiddleImaginary,
          oddImaginary=real[odd]*twiddleImaginary+imaginary[odd]*twiddleReal;
        real[odd]=real[even]-oddReal;imaginary[odd]=imaginary[even]-oddImaginary;
        real[even]+=oddReal;imaginary[even]+=oddImaginary;
        const nextReal=twiddleReal*stepReal-twiddleImaginary*stepImaginary;
        twiddleImaginary=twiddleReal*stepImaginary+twiddleImaginary*stepReal;twiddleReal=nextReal;
      }
    }
  }
  return Array.from({length:FFT_SIZE/2+1},(_,bin)=>Math.hypot(real[bin],imaginary[bin])/FFT_SIZE);
}

function bandLevels(samples:number[]){
  if(samples.length<FFT_SIZE)return BANDS.map(()=>-120);
  const magnitudes=fftMagnitudes(samples),
    edges=[Math.sqrt(BANDS[0]*(BANDS[0]/2)),...BANDS.slice(1).map((center,index)=>Math.sqrt(BANDS[index]*center)),SAMPLE_RATE/2];
  return BANDS.map((_,band)=>{
    const low=Math.max(0,Math.floor(edges[band]*FFT_SIZE/SAMPLE_RATE)),
      high=Math.max(low+1,Math.min(magnitudes.length,Math.ceil(edges[band+1]*FFT_SIZE/SAMPLE_RATE)));
    let sum=0;for(let bin=low;bin<high;bin++)sum+=magnitudes[bin];
    return Math.max(-120,20*Math.log10(sum/(high-low)+1e-6));
  });
}

type Props={samples?:number[][];params:number[];state?:number[];x:number;y:number;width:number;height:number};

export const CellaFrequencyAnalyzerDisplay=memo(function CellaFrequencyAnalyzerDisplay({samples,params,state,x,y,width,height}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null),historyRef=useRef<number[][]>([[],[]]),
    displayedRef=useRef<number[][]>(Array.from({length:3},()=>BANDS.map(()=>0))),
    targetsRef=useRef<number[][]>(Array.from({length:3},()=>BANDS.map(()=>0))),
    bandDbRef=useRef<number[][]>(Array.from({length:3},()=>BANDS.map(()=>-120))),
    peaksRef=useRef<number[][]>(Array.from({length:3},()=>BANDS.map(()=>0))),
    ghostsRef=useRef<number[][]>(Array.from({length:3},()=>BANDS.map(()=>0))),
    lastTimeRef=useRef(0);
  useEffect(()=>{
    for(let channel=0;channel<2;channel++){
      const history=historyRef.current[channel],incoming=samples?.[channel]??[];
      history.push(...incoming.map(value=>Number.isFinite(value)?value:0));
      if(history.length>FFT_SIZE*2)history.splice(0,history.length-FFT_SIZE*2);
    }
    const left=bandLevels(historyRef.current[0]),right=bandLevels(historyRef.current[1]),
      active=[historyRef.current[0],historyRef.current[1]].map(history=>history.some(value=>Math.abs(value)>1e-8)),
      activeCount=Math.max(1,Number(active[0])+Number(active[1])),
      mono=BANDS.map((_,band)=>10*Math.log10(((active[0]?10**(left[band]/10):0)+(active[1]?10**(right[band]/10):0))/activeCount+1e-12)),
      now=performance.now(),dt=Math.min(.1,Math.max(1/120,(now-(lastTimeRef.current||now-16))/1000)),
      fallDecay=Math.exp(-(FFT_SIZE/SAMPLE_RATE)/Math.max(.001,params[2]??.01)),
      nextDb=[mono,left,right].map((row,rowIndex)=>row.map((db,band)=>{
        const previous=bandDbRef.current[rowIndex][band],next=db>=previous?db:previous*fallDecay+db*(1-fallDecay);
        return bandDbRef.current[rowIndex][band]=Math.max(-120,next);
      })),
      top=params[0]??-12,bottom=params[1]??-100,range=Math.max(1,top-bottom),
      nextTargets=nextDb.map(row=>row.map(db=>Math.max(0,Math.min(1,(db-bottom)/range))));
    lastTimeRef.current=now;
    const blend=1-Math.exp(-dt/.012),peakDecay=Math.exp(-dt/Math.max(.001,params[3]??1)),ghostDecay=Math.exp(-dt/.9);
    for(let row=0;row<3;row++)for(let band=0;band<BANDS.length;band++){
      targetsRef.current[row][band]=nextTargets[row][band];
      displayedRef.current[row][band]+=(nextTargets[row][band]-displayedRef.current[row][band])*blend;
      peaksRef.current[row][band]=Math.max(displayedRef.current[row][band],peaksRef.current[row][band]*peakDecay);
      ghostsRef.current[row][band]=Math.max(displayedRef.current[row][band],ghostsRef.current[row][band]*ghostDecay);
    }
    const canvas=canvasRef.current;if(!canvas)return;
    const pixelRatio=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);
    const context=canvas.getContext("2d");if(!context)return;
    context.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    const displayMode=Math.max(0,Math.min(2,Math.round(state?.[0]??1))),stereoMode=(state?.[1]??0)>.5,
      intensityMode=Math.max(0,Math.min(2,Math.round(state?.[2]??0))),effectsMode=Math.max(0,Math.min(2,Math.round(state?.[3]??2))),
      signatureEffects=Math.max(0,Math.round(state?.[4]??2)),showLabels=(state?.[5]??1)>.5,showUnlit=(state?.[6]??1)>.5,
      theme=THEMES[Math.max(0,Math.min(THEMES.length-1,Math.round(state?.[7]??5)))],
      primary=theme[0],secondary=theme[1],inactive=theme[2],peakColor=theme[3],margin=3,bandWidth=(width-margin*2)/BANDS.length,
      contentBottom=showLabels?16:10,contentTop=6,contentHeight=height-contentBottom-contentTop,rows=displayMode===0?(showLabels?50:51):30;
    const gradient=context.createLinearGradient(0,height,0,0);gradient.addColorStop(0,"#010304");gradient.addColorStop(1,"#050d0f");
    context.fillStyle=gradient;context.fillRect(0,0,width,height);
    const drawMeter=(band:number,channel:number,level:number,peak:number,ghost:number)=>{
      const channelCount=stereoMode?2:1,gap=stereoMode?1.5:0,
        meterWidth=(bandWidth-6-gap*(channelCount-1))/channelCount,
        left=margin+band*bandWidth+3+channel*(meterWidth+gap),color=channel===0?primary:secondary;
      context.save();
      if(effectsMode&&signatureEffects&1){context.shadowColor=color;context.shadowBlur=effectsMode===2?10:5;}
      if(displayMode===2){
        const activeHeight=level*contentHeight;
        if(showUnlit){context.globalAlpha=intensityMode===2?.18:.42;context.fillStyle=inactive;context.fillRect(left,contentTop,meterWidth,contentHeight);}
        context.globalAlpha=intensityMode===1?Math.max(.35,Math.sqrt(level)):1;context.fillStyle=color;
        context.beginPath();context.roundRect(left,height-contentBottom-activeHeight,meterWidth,activeHeight,2);context.fill();
        context.globalAlpha=1;context.fillStyle=peakColor;context.fillRect(left,height-contentBottom-peak*contentHeight-1,meterWidth,2);
      }else{
        const columns=displayMode===0?(stereoMode?3:6):1,pitch=contentHeight/rows,
          cellWidth=displayMode===0?Math.min(4,(meterWidth-(columns-1)*2)/columns):meterWidth,
          activeCount=Math.ceil(level*rows),ghostCount=Math.ceil(ghost*rows),peakIndex=Math.max(0,Math.min(rows-1,Math.ceil(peak*rows)-1));
        for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
          const px=left+(columns===1?0:column*(cellWidth+2)),py=height-contentBottom-(row+1)*pitch+(pitch-(displayMode===0?4:pitch*.64))/2,
            cellHeight=displayMode===0?4:pitch*.64;
          if(row===peakIndex){context.globalAlpha=1;context.fillStyle=peakColor;}
          else if(row<activeCount){context.globalAlpha=intensityMode===1?Math.max(.35,Math.sqrt(level)):1;context.fillStyle=color;}
          else if(intensityMode===2&&row<ghostCount){context.globalAlpha=.28;context.fillStyle=color;}
          else if(showUnlit){context.globalAlpha=intensityMode===2?.18:.42;context.fillStyle=inactive;}
          else continue;
          context.beginPath();context.roundRect(px,py,cellWidth,cellHeight,displayMode===0?2:1.5);context.fill();
        }
      }
      context.restore();
    };
    for(let band=0;band<BANDS.length;band++){
      if(stereoMode)for(let channel=0;channel<2;channel++)drawMeter(band,channel,displayedRef.current[channel+1][band],peaksRef.current[channel+1][band],ghostsRef.current[channel+1][band]);
      else drawMeter(band,0,displayedRef.current[0][band],peaksRef.current[0][band],ghostsRef.current[0][band]);
    }
    if(showLabels){
      context.globalAlpha=.9;context.fillStyle="#b4bec0";context.font=`${Math.max(7,width/62)}px Arial,sans-serif`;context.textAlign="center";context.textBaseline="top";
      BANDS.forEach((frequency,band)=>context.fillText(frequency>=1000?`${frequency/1000}k`:`${frequency}`,margin+(band+.5)*bandWidth,height-13));
    }
    if(effectsMode&&signatureEffects&2){
      const glass=context.createLinearGradient(0,0,width,height);glass.addColorStop(0,"#ffffff12");glass.addColorStop(.45,"#ffffff00");glass.addColorStop(1,"#8bdcff0b");
      context.fillStyle=glass;context.fillRect(0,0,width,height);
    }
  },[height,params,samples,state,width]);
  return <canvas ref={canvasRef} className="pw-rack-spectrum pw-cella-frequency-analyzer" style={{left:x,top:y,width,height}} aria-label="Live Cella frequency analyzer"/>;
});
