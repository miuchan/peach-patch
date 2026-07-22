import type { SampleAssetRef } from "./patch-types";

export type StoredSample={ref:SampleAssetRef;samples:Float32Array};
const DATABASE="patchwork-web-assets",STORE="samples";

function openDatabase(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error("Could not open sample storage"))})}

export async function putSample(sample:StoredSample){const database=await openDatabase();await new Promise<void>((resolve,reject)=>{const transaction=database.transaction(STORE,"readwrite");transaction.objectStore(STORE).put({ref:sample.ref,samples:sample.samples},sample.ref.storageKey);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error??new Error("Could not save sample"))});database.close()}

export async function getSample(storageKey:string){const database=await openDatabase(),value=await new Promise<StoredSample|undefined>((resolve,reject)=>{const request=database.transaction(STORE).objectStore(STORE).get(storageKey);request.onsuccess=()=>resolve(request.result as StoredSample|undefined);request.onerror=()=>reject(request.error??new Error("Could not read sample"))});database.close();return value}
