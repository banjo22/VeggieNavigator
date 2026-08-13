import { readFile } from "node:fs/promises";
const names=["EXPO_PUBLIC_SUPABASE_URL","EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY","EXPO_PUBLIC_SUPABASE_ANON_KEY","EXPO_PUBLIC_API_BASE_URL"];
let text="";try{text=await readFile(new URL("../.env",import.meta.url),"utf8");}catch{}
const configured=Object.fromEntries(names.map(name=>[name,new RegExp(`^${name}=.+$`,`m`).test(text)]));
console.log("Mobile-Konfiguration (keine Werte):");for(const [name,present] of Object.entries(configured))console.log(`${name}: ${present?"vorhanden":"fehlt"}`);
const baseLine=text.match(/^EXPO_PUBLIC_API_BASE_URL=(.+)$/m);if(baseLine?.[1]){try{const response=await fetch(`${baseLine[1].replace(/\/$/,"")}/api/mobile-health`,{signal:AbortSignal.timeout(5000)});console.log(`Backend erreichbar: ${response.ok?"ja":"nein"} (HTTP ${response.status})`);}catch{console.log("Backend erreichbar: nein");}}else console.log("Backend erreichbar: nicht prüfbar");
