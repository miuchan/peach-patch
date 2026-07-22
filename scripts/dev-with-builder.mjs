#!/usr/bin/env node
import {spawn} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const projectDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),environment={...process.env,WRANGLER_LOG_PATH:".wrangler/wrangler.log"},children=[spawn(process.execPath,[path.join(projectDir,"scripts","plugin-builder-server.mjs")],{cwd:projectDir,env:environment,stdio:"inherit"}),spawn(path.join(projectDir,"node_modules",".bin","vinext"),["dev"],{cwd:projectDir,env:environment,stdio:"inherit"})];
let stopping=false;
function stop(signal="SIGTERM"){if(stopping)return;stopping=true;for(const child of children)if(!child.killed)child.kill(signal)}
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>stop(signal));
for(const child of children)child.on("exit",code=>{if(!stopping){stop();process.exitCode=code??1}});
