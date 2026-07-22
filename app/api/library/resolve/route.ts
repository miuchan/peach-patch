import { WEB_PLUGIN_BY_KEY } from "../../../../lib/web-plugin-registry";
import { parseLibraryModuleHtml, parseLibraryModuleUrl } from "../../../../lib/vcv-library";

export async function GET(request:Request){
  try{
    const requested=new URL(request.url).searchParams.get("url");
    if(!requested)return Response.json({error:"Missing module detail URL"},{status:400});
    const {plugin,model,key,url}=parseLibraryModuleUrl(requested),compiled=WEB_PLUGIN_BY_KEY[key];
    const response=await fetch(url,{headers:{accept:"text/html"}});
    if(!response.ok)throw new Error(`VCV Library returned ${response.status}`);
    const html=await response.text();
    const metadata=parseLibraryModuleHtml(html,plugin,model,compiled?.version);
    return Response.json({key,plugin,model,...metadata,compiled:Boolean(compiled),runtime:compiled??null});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not resolve module"},{status:400})}
}
