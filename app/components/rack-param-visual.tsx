"use client";
/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from "react";
import type { ParamSpec } from "../../lib/web-plugin-registry";

type KnobAsset={name:string;size:number;angle:number;bg?:string;fg?:string};
const KNOBS:Record<string,KnobAsset>={
  RoundBlackKnob:{name:"RoundBlackKnob",bg:"RoundBlackKnobBg",size:28.3476,angle:.83},
  RoundBlackSnapKnob:{name:"RoundBlackKnob",bg:"RoundBlackKnobBg",size:28.3476,angle:.83},
  RoundSmallBlackKnob:{name:"RoundSmallBlackKnob",bg:"RoundSmallBlackKnobBg",size:22.6758,angle:.83},
  RoundLargeBlackKnob:{name:"RoundLargeBlackKnob",bg:"RoundLargeBlackKnobBg",size:36,angle:.83},
  RoundBigBlackKnob:{name:"RoundBigBlackKnob",bg:"RoundBigBlackKnobBg",size:45,angle:.83},
  RoundHugeBlackKnob:{name:"RoundHugeBlackKnob",bg:"RoundHugeBlackKnobBg",size:53.8593,angle:.83},
  Trimpot:{name:"Trimpot",bg:"TrimpotBg",size:17.8594,angle:.75},
  BefacoBigKnob:{name:"BefacoBigKnob",bg:"BefacoBigKnobBg",size:73.704,angle:.75},
  Davies1900hWhiteKnob:{name:"Davies1900hWhite",bg:"Davies1900hWhiteBg",size:36.002,angle:.83},
  Rogan1PSRed:{name:"Rogan1PSRed",bg:"Rogan1PSBg",fg:"Rogan1PSRedFg",size:39.6836,angle:.83},
  Rogan1PSGreen:{name:"Rogan1PSGreen",bg:"Rogan1PSBg",fg:"Rogan1PSGreenFg",size:39.6836,angle:.83},
  Rogan1PSWhite:{name:"Rogan1PSWhite",bg:"Rogan1PSBg",fg:"Rogan1PSWhiteFg",size:39.6836,angle:.83},
  Rogan2PSRed:{name:"Rogan2PSRed",bg:"Rogan2PSBg",fg:"Rogan2PSRedFg",size:43.3476,angle:.83},
  Rogan2PSGreen:{name:"Rogan2PSGreen",bg:"Rogan2PSBg",fg:"Rogan2PSGreenFg",size:43.3476,angle:.83},
  Rogan2PSWhite:{name:"Rogan2PSWhite",bg:"Rogan2PSBg",fg:"Rogan2PSWhiteFg",size:43.3476,angle:.83},
  Rogan2SGray:{name:"Rogan2SGray",bg:"Rogan2SBg",fg:"Rogan2SGrayFg",size:43.3476,angle:.83},
  Rogan3PSRed:{name:"Rogan3PSRed",bg:"Rogan3PSBg",fg:"Rogan3PSRedFg",size:51.84375,angle:.83},
  Rogan3PSGreen:{name:"Rogan3PSGreen",bg:"Rogan3PSBg",fg:"Rogan3PSGreenFg",size:51.84375,angle:.83},
  Rogan3PSWhite:{name:"Rogan3PSWhite",bg:"Rogan3PSBg",fg:"Rogan3PSWhiteFg",size:51.84375,angle:.83},
};
const SWITCHES:Record<string,{name:string;size:[number,number];frames:number}>={
  VCVButton:{name:"VCVButton",size:[18,18],frames:2},
  CKD6:{name:"CKD6",size:[28,27.9959],frames:2},
  TL1105:{name:"TL1105",size:[15.36,15.3577],frames:2},
  CKSS:{name:"CKSS",size:[14,20.6411],frames:2},
  CKSSThree:{name:"CKSSThree",size:[13.457,28.3477],frames:3},
  NKK:{name:"NKK",size:[31.9999,43.8825],frames:3},
};
export function rackParamWidgetKind(param:ParamSpec){
  const widget=param.position?.widget??"";
  const simple=widget.replace(/\b(?:rack::)?componentlibrary::/g,"").trim();
  if(/VCVLightButton|VCVLightLatch|VCVLatch|VCVButton|LEDButton/.test(simple))return"VCVButton";
  if(/VCVLightBezel/.test(simple))return"VCVBezel";
  if(/VCVLightSlider|LEDLightSlider/.test(simple))return"VCVSlider";
  if(/BefacoSlidePot/.test(simple))return"BefacoSlidePot";
  return Object.keys({...KNOBS,...SWITCHES}).find(name=>new RegExp(`(?:^|[^A-Za-z0-9_])${name}(?:$|[^A-Za-z0-9_])`).test(simple))??"";
}
export type RackParamInteraction="knob"|"slider"|"switch"|"button"|"selector"|"unknown";
export function rackParamInteraction(param:ParamSpec):RackParamInteraction{
  if(param.button)return"button";
  if(param.position?.control==="selector")return"selector";
  const kind=rackParamWidgetKind(param);
  if(kind in KNOBS)return"knob";
  if(kind==="VCVSlider"||kind==="BefacoSlidePot")return"slider";
  if(kind==="VCVBezel"||kind in SWITCHES)return"switch";
  return"unknown";
}
export function rackParamControlSize(param:ParamSpec){
  const position=param.position,kind=rackParamWidgetKind(param),knob=KNOBS[kind];
  if(position?.control==="selector")return{width:position.width??38,height:position.height??18};
  if(knob)return{width:knob.size,height:knob.size};
  if(kind==="VCVSlider")return{width:19.8426,height:76.5352};
  if(kind==="BefacoSlidePot")return{width:15.5913,height:111};
  if(kind==="VCVBezel")return{width:21.2603,height:21.2599};
  const control=SWITCHES[kind];
  return control?{width:control.size[0],height:control.size[1]}:{width:position?.width??38,height:position?.height??40};
}
export function rackParamSwitchFrames(param:ParamSpec){
  const kind=rackParamWidgetKind(param);
  return kind==="VCVBezel"?2:SWITCHES[kind]?.frames??Math.max(2,Math.round(param.max-param.min)+1);
}
function asset(name:string){return`/api/rack-component?name=${encodeURIComponent(name)}`}

export function RackParamVisual({param,value,moduleWidth,sourceWidth}:{param:ParamSpec;value:number;moduleWidth:number;sourceWidth:number}){
  const position=param.position,kind=rackParamWidgetKind(param);
  if(!position||!kind)return null;
  const scale=moduleWidth/sourceWidth,normalized=param.max===param.min?0:Math.max(0,Math.min(1,(value-param.min)/(param.max-param.min))),placementStyle=(width:number,height:number)=>({left:`${(position.x+(position.centered?0:width/2))/sourceWidth*100}%`,top:`${(position.y+(position.centered?0:height/2))/380*100}%`,transform:"translate(-50%, -50%)"}) as CSSProperties,knob=KNOBS[kind];
  if(knob){
    const size=knob.size*scale,rotation=(-knob.angle+normalized*knob.angle*2)*180;
    return <span className="pw-rack-param-visual knob" style={{...placementStyle(knob.size,knob.size),width:size,height:size}} aria-hidden="true">
      {knob.bg&&<img className="background" src={asset(knob.bg)} alt="" />}
      <img className="moving" src={asset(knob.name)} alt="" style={{transform:`rotate(${rotation}deg)`}} />
      {knob.fg&&<img className="foreground" src={asset(knob.fg)} alt="" />}
    </span>;
  }
  if(kind==="VCVSlider")return <span className="pw-rack-param-visual slider" style={{...placementStyle(19.8426,76.5352),width:19.8426*scale,height:76.5352*scale}} aria-hidden="true">
    <img src={asset("VCVSlider")} alt="" />
    <img className="handle" src={asset("VCVSliderHandle")} alt="" style={{top:`${(1-normalized)*64.793*scale}px`}} />
  </span>;
  if(kind==="BefacoSlidePot")return <span className="pw-rack-param-visual befaco-slider" style={{...placementStyle(15.5913,111),width:15.5913*scale,height:111*scale}} aria-hidden="true">
    <img className="background" src={asset("BefacoSlidePot")} alt="" style={{left:3.5*scale,top:3.5*scale,width:8.5913*scale,height:104*scale}} />
    <img className="handle" src={asset("BefacoSlidePotHandle")} alt="" style={{left:2.5*scale,top:(1.5+(1-normalized)*89)*scale,width:11.7*scale,height:19.27*scale}} />
  </span>;
  if(kind==="VCVBezel")return <span className={`pw-rack-param-visual bezel ${normalized>.01?"active":""}`} style={{...placementStyle(21.2603,21.2599),width:21.2603*scale,height:21.2599*scale}} aria-hidden="true">
    <img src={asset("VCVBezel")} alt="" />
  </span>;
  const control=SWITCHES[kind],frame=Math.round(normalized*(control.frames-1));
  return <span className={`pw-rack-param-visual switch ${normalized>.01?"active":""}`} style={{...placementStyle(control.size[0],control.size[1]),width:control.size[0]*scale,height:control.size[1]*scale}} aria-hidden="true">
    <img src={asset(`${control.name}${frame}`)} alt="" />
  </span>;
}
