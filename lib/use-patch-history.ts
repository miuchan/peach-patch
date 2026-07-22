"use client";

import { useCallback, useState } from "react";

type History<T> = { past:T[]; present:T; future:T[] };

export function usePatchHistory<T>(initial:T){
  const [history,setHistory]=useState<History<T>>({past:[],present:initial,future:[]});
  const commit=useCallback((update:T|((value:T)=>T))=>setHistory(current=>{
    const next=typeof update==="function"?(update as (value:T)=>T)(current.present):update;
    if(Object.is(next,current.present))return current;
    return {past:[...current.past.slice(-99),current.present],present:next,future:[]};
  }),[]);
  const mutate=useCallback((update:(value:T)=>T)=>setHistory(current=>({...current,present:update(current.present)})),[]);
  const checkpoint=useCallback((previous:T)=>setHistory(current=>({past:[...current.past.slice(-99),previous],present:current.present,future:[]})),[]);
  const undo=useCallback(()=>setHistory(current=>current.past.length?{past:current.past.slice(0,-1),present:current.past[current.past.length-1],future:[current.present,...current.future]}:current),[]);
  const redo=useCallback(()=>setHistory(current=>current.future.length?{past:[...current.past,current.present],present:current.future[0],future:current.future.slice(1)}:current),[]);
  return {value:history.present,commit,mutate,checkpoint,undo,redo,canUndo:history.past.length>0,canRedo:history.future.length>0};
}

