import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseLibraryModuleHtml, parseLibraryModuleUrl } from "../lib/vcv-library.ts";
import { checkoutLockedRepository, officialLibrarySubmodule } from "../scripts/scaffold-library-module.mjs";

test("official Library module URLs are canonicalized narrowly",()=>{
  assert.deepEqual(parseLibraryModuleUrl("https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"),{plugin:"Bogaudio",model:"Bogaudio-ADSR",key:"Bogaudio/Bogaudio-ADSR",url:"https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"});
  for(const value of ["http://library.vcvrack.com/A/B","https://evil.example/A/B","https://user@library.vcvrack.com/A/B","https://library.vcvrack.com:444/A/B","https://library.vcvrack.com/A/B/C","https://library.vcvrack.com/A/%2f","https://library.vcvrack.com/A/B?x=1","https://library.vcvrack.com/A/B#x"])assert.throws(()=>parseLibraryModuleUrl(value));
});

test("Library HTML metadata exposes only safe HTTPS assets and source links",()=>{
  const html='<meta property="og:title" content="Bogaudio &amp; ADSR"><meta name="description" content="Envelope"><meta property="og:image" content="https://library.vcvrack.com/a.webp"><span title="Current version distributed">2.6.47</span><a href="https://github.com/bogaudio/BogaudioModules">Source code</a>License: <a>GPL-3.0-or-later</a>';
  assert.deepEqual(parseLibraryModuleHtml(html,"Bogaudio","Bogaudio-ADSR"),{title:"Bogaudio & ADSR",description:"Envelope",screenshotUrl:"https://library.vcvrack.com/a.webp",sourceUrl:"https://github.com/bogaudio/BogaudioModules",license:"GPL-3.0-or-later",version:"2.6.47"});
  const unsafe='<meta property="og:image" content="http://example.com/x"><a href="https://user:secret@github.com/repo">Source code</a>';
  const parsed=parseLibraryModuleHtml(unsafe,"A","B","2.0.0");assert.equal(parsed.screenshotUrl,"");assert.equal(parsed.sourceUrl,undefined);assert.equal(parsed.version,"2.0.0");
});

test("official source locking follows the Library path when its submodule label differs from the plugin slug",()=>{
  const modules='[submodule "repos/Other"]\n\tpath = repos/Other\n\turl = https://github.com/example/Other.git\n[submodule "repos/ValleyFree"]\n\tpath = repos/Valley\n\turl = https://github.com/ValleyAudio/ValleyRackFree.git\n';
  assert.deepEqual(officialLibrarySubmodule(modules,"Valley","https://github.com/ValleyAudio/ValleyRackFree"),{name:"repos/ValleyFree",path:"repos/Valley",url:"https://github.com/ValleyAudio/ValleyRackFree.git"});
  assert.throws(()=>officialLibrarySubmodule(modules,"Valley","https://github.com/attacker/Different"),/differs/);
});

test("an exact revision at the remote default HEAD still receives a populated worktree",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-head-checkout-")),repository=path.join(temporary,"repository"),target=path.join(temporary,"cache","source"),environment={...process.env,GIT_AUTHOR_NAME:"Rack Web",GIT_AUTHOR_EMAIL:"rack-web@example.invalid",GIT_COMMITTER_NAME:"Rack Web",GIT_COMMITTER_EMAIL:"rack-web@example.invalid"};
  try{execFileSync("git",["init",repository],{env:environment,stdio:"ignore"});fs.writeFileSync(path.join(repository,"plugin.json"),'{"slug":"Fixture"}\n');execFileSync("git",["-C",repository,"add","plugin.json"],{env:environment});execFileSync("git",["-C",repository,"commit","-m","fixture"],{env:environment,stdio:"ignore"});const commit=execFileSync("git",["-C",repository,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),staging=checkoutLockedRepository(repository,commit,target);assert.equal(fs.readFileSync(path.join(staging,"plugin.json"),"utf8"),'{"slug":"Fixture"}\n');assert.equal(execFileSync("git",["-C",staging,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),commit)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
