type StateKey={key:string;type:"integer"|"real"|"boolean"|"string-enum";values?:string[];index?:number;path?:Array<number|string>;default?:number};

function itemPath(item:StateKey){return item.path??(item.index===undefined?[]:[item.index]);}
function nestedValue(value:unknown,path:Array<number|string>):unknown{return path.reduce<unknown>((current,segment)=>typeof segment==="number"&&Array.isArray(current)?current[segment]:typeof segment==="string"&&current!==null&&typeof current==="object"?(current as Record<string,unknown>)[segment]:undefined,value);}
function setNestedValue(value:unknown,path:Array<number|string>,next:unknown):unknown{const [segment,...rest]=path;if(typeof segment==="number"){const result=Array.isArray(value)?[...value]:[];result[segment]=rest.length?setNestedValue(result[segment],rest,next):next;return result;}const result=value!==null&&typeof value==="object"&&!Array.isArray(value)?{...(value as Record<string,unknown>)}:{};result[segment]=rest.length?setNestedValue(result[segment],rest,next):next;return result;}

function stateValue(data:Record<string,unknown>,item:StateKey){
  const path=itemPath(item),source=path.length?nestedValue(data[item.key],path):data[item.key];
  if(source===undefined)return item.default??0;
  if(item.type==="boolean")return source?1:0;
  if(item.type==="string-enum")return Math.max(0,item.values?.indexOf(String(source??""))??0);
  return Number(source);
}

export function stateFromData(key:string,data:Record<string,unknown>|undefined,stateKeys?:StateKey[]):number[]{
  if(!data)return stateKeys?.some(item=>item.default!==undefined)?stateKeys.map(item=>item.default??0):[];
  if(stateKeys?.length)return stateKeys.map(item=>stateValue(data,item));
  if(key==="Fundamental/SEQ3")return [data.running?1:0,data.clockPassthrough?1:0,...(Array.isArray(data.gates)?data.gates.map(value=>value?1:0):[])];
  if(key==="AudibleInstruments/Branches")return Array.isArray(data.modes)?data.modes.map(value=>value?1:0):[];
  if(key==="AudibleInstruments/Tides")return [Number(data.mode??1),Number(data.range??1),data.sheep?1:0];
  if(key==="AudibleInstruments/Rings")return [Number(data.polyphony??0),Number(data.model??0),data.easterEgg?1:0];
  return[];
}

export function dataFromState(key:string,source:Record<string,unknown>|undefined,state:number[]|undefined,stateKeys?:StateKey[]):Record<string,unknown>|undefined{
  if(!source&&!state?.length)return source;
  const data={...(source??{})};
  if(stateKeys?.length&&state?.length)stateKeys.forEach((item,index)=>{if(index>=state.length)return;const value=item.type==="boolean"?Boolean(state[index]):item.type==="integer"?Math.trunc(state[index]):item.type==="string-enum"?(item.values?.[Math.max(0,Math.min((item.values?.length??1)-1,Math.round(state[index])))]??""):state[index],path=itemPath(item);data[item.key]=path.length?setNestedValue(data[item.key],path,value):value;});
  else if(key==="Fundamental/SEQ3"&&state?.length){data.running=Boolean(state[0]);data.clockPassthrough=Boolean(state[1]);data.gates=state.slice(2,10).map(Boolean);}
  else if(key==="AudibleInstruments/Branches"&&state?.length)data.modes=state.slice(0,2).map(Boolean);
  else if(key==="AudibleInstruments/Tides"&&state?.length){data.mode=state[0];data.range=state[1];data.sheep=Boolean(state[2]);}
  else if(key==="AudibleInstruments/Rings"&&state?.length){data.polyphony=state[0];data.model=state[1];data.easterEgg=Boolean(state[2]);}
  return data;
}
