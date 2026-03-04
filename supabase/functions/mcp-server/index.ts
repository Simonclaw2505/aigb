/**
 * MCP Server Edge Function - AIGB
 * Implements Model Context Protocol (JSON-RPC 2.0)
 * Auth: X-API-Key hashed with SHA-256, looked up in agent_api_keys
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS: Record<string,string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:CORS});
  const j=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
  const je=(id:unknown,c:number,m:string)=>j({jsonrpc:"2.0",id,error:{code:c,message:m}});
  try {
    const rawKey=req.headers.get("x-api-key")??req.headers.get("X-API-Key");
    if(!rawKey) return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Missing X-API-Key"}},401);
    const enc=new TextEncoder();
    const hb=await crypto.subtle.digest("SHA-256",enc.encode(rawKey));
    const kh=Array.from(new Uint8Array(hb)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const su=Deno.env.get("SUPABASE_URL")!;
    const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb=createClient(su,sk);
    const{data:kr,error:ke}=await sb.from("agent_api_keys")
      .select("id,project_id,is_active,expires_at,usage_count")
      .eq("key_hash",kh).eq("is_active",true).maybeSingle();
    if(ke||!kr) return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid API key"}},401);
    if(kr.expires_at&&new Date(kr.expires_at)<new Date())
      return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Key expired"}},401);
    sb.from("agent_api_keys").update({last_used_at:new Date().toISOString(),usage_count:(kr.usage_count??0)+1}).eq("id",kr.id).then(()=>{});
    const pid:string=kr.project_id;
    let body:{jsonrpc?:string;method?:string;params?:unknown;id?:unknown};
    try{body=await req.json();}catch{return je(null,-32700,"Parse error");}
    const{method,params,id}=body;
    if(method==="initialize") return j({jsonrpc:"2.0",id,result:{protocolVersion:"2024-11-05",serverInfo:{name:"AIGB MCP Gateway",version:"1.0.0"},capabilities:{tools:{}}}});
    if(method==="notifications/initialized") return j({jsonrpc:"2.0",id,result:{}});
    if(method==="tools/list"){
      const{data:caps,error:ce}=await sb.from("agent_capabilities")
        .select("action_template_id,agent_policy,action_templates(id,name,description,input_schema)")
        .eq("project_id",pid).eq("is_active",true).neq("agent_policy","deny");
      if(ce) return je(id,-32603,"Failed to load tools: "+ce.message);
      // deno-lint-ignore no-explicit-any
      const tools=(caps??[]).filter((c:any)=>c.action_templates).map((c:any)=>{
        const at=c.action_templates;
        const ok=c.agent_policy==="require_confirmation"||c.agent_policy==="require_approval";
        return{name:at.id,description:(at.description??at.name)+(ok?" [requires approval]":""),inputSchema:at.input_schema??{type:"object",properties:{}}};
      });
      return j({jsonrpc:"2.0",id,result:{tools}});
    }
    if(method==="tools/call"){
      const p=(params??{}) as{name?:string;arguments?:Record<string,unknown>};
      const aid=p.name;const ins=p.arguments??{};
      if(!aid) return je(id,-32602,"Missing tool name");
      const{data:cap,error:ce2}=await sb.from("agent_capabilities")
        .select("agent_policy").eq("project_id",pid).eq("action_template_id",aid).eq("is_active",true).maybeSingle();
      if(ce2||!cap) return je(id,-32602,"Tool not found or not enabled");
      if(cap.agent_policy==="deny") return je(id,-32603,"Tool denied by policy");
      if(cap.agent_policy==="require_approval"){
        const{data:ar}=await sb.from("approval_requests")
          .insert({project_id:pid,action_template_id:aid,input_parameters:ins,requested_by:"agent",status:"pending"})
          .select("id").single();
        return j({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify({status:"pending_approval",message:"Requires human approval.",approval_request_id:ar?.id})}]}});
      }
      const rr=await fetch(su+"/functions/v1/action-runner",{
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:sk,Authorization:"Bearer "+sk,"X-API-Key":rawKey,"X-Internal-Call":"mcp-server"},
        body:JSON.stringify({action_template_id:aid,inputs:ins}),
      });
      // deno-lint-ignore no-explicit-any
      const rd:any=await rr.json();
      if(!rr.ok||!rd.success) return je(id,-32603,"Tool failed: "+(rd.error??"unknown"));
      return j({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify(rd.data??rd)}]}});
    }
    return je(id,-32601,"Method not found: "+method);
  }catch(err){
    console.error("mcp-server:",err);
    return new Response(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32603,message:"Internal error"}}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
  }
});/**
 * MCP Server Edge Function - AIGB
 * Implements Model Context Protocol (JSON-RPC 2.0)
 * Auth: X-API-Key header hashed with SHA-256, looked up in agent_api_keys
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS: Record<string,string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:CORS});
  const j=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json"}});
  const je=(id:unknown,c:number,m:string)=>j({jsonrpc:"2.0",id,error:{code:c,message:m}});
  try {
    const rawKey=req.headers.get("x-api-key")??req.headers.get("X-API-Key");
    if(!rawKey) return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Missing X-API-Key"}},401);
    const enc=new TextEncoder();
    const hb=await crypto.subtle.digest("SHA-256",enc.encode(rawKey));
    const kh=Array.from(new Uint8Array(hb)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const su=Deno.env.get("SUPABASE_URL")!;
    const sk=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb=createClient(su,sk);
    const{data:kr,error:ke}=await sb.from("agent_api_keys")
      .select("id,project_id,is_active,expires_at,usage_count")
      .eq("key_hash",kh).eq("is_active",true).maybeSingle();
    if(ke||!kr) return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Invalid API key"}},401);
    if(kr.expires_at&&new Date(kr.expires_at)<new Date())
      return j({jsonrpc:"2.0",id:null,error:{code:-32600,message:"Key expired"}},401);
    sb.from("agent_api_keys").update({last_used_at:new Date().toISOString(),usage_count:(kr.usage_count??0)+1}).eq("id",kr.id).then(()=>{});
    const pid:string=kr.project_id;
    let body:{jsonrpc?:string;method?:string;params?:unknown;id?:unknown};
    try{body=await req.json();}catch{return je(null,-32700,"Parse error");}
    const{method,params,id}=body;
    if(method==="initialize") return j({jsonrpc:"2.0",id,result:{protocolVersion:"2024-11-05",serverInfo:{name:"AIGB MCP Gateway",version:"1.0.0"},capabilities:{tools:{}}}});
    if(method==="notifications/initialized") return j({jsonrpc:"2.0",id,result:{}});
    if(method==="tools/list"){
      const{data:caps,error:ce}=await sb.from("agent_capabilities")
        .select("action_template_id,agent_policy,action_templates(id,name,description,input_schema)")
        .eq("project_id",pid).eq("is_active",true).neq("agent_policy","deny");
      if(ce) return je(id,-32603,"Failed to load tools: "+ce.message);
      // deno-lint-ignore no-explicit-any
      const tools=(caps??[]).filter((c:any)=>c.action_templates).map((c:any)=>{
        const at=c.action_templates;
        const needsApproval=c.agent_policy==="require_confirmation"||c.agent_policy==="require_approval";
        return{name:at.id,description:(at.description??at.name)+(needsApproval?" [requires approval]":""),inputSchema:at.input_schema??{type:"object",properties:{}}};
      });
      return j({jsonrpc:"2.0",id,result:{tools}});
    }
    if(method==="tools/call"){
      const p=(params??{}) as{name?:string;arguments?:Record<string,unknown>};
      const aid=p.name;const ins=p.arguments??{};
      if(!aid) return je(id,-32602,"Missing tool name");
      const{data:cap,error:capE}=await sb.from("agent_capabilities")
        .select("agent_policy").eq("project_id",pid).eq("action_template_id",aid).eq("is_active",true).maybeSingle();
      if(capE||!cap) return je(id,-32602,"Tool not found or not enabled");
      if(cap.agent_policy==="deny") return je(id,-32603,"Tool denied by policy");
      if(cap.agent_policy==="require_approval"){
        const{data:ar}=await sb.from("approval_requests")
          .insert({project_id:pid,action_template_id:aid,input_parameters:ins,requested_by:"agent",status:"pending"})
          .select("id").single();
        return j({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify({status:"pending_approval",message:"Requires human approval.",approval_request_id:ar?.id})}]}});
      }
      const rr=await fetch(su+"/functions/v1/action-runner",{
        method:"POST",
        headers:{"Content-Type":"application/json",apikey:sk,Authorization:"Bearer "+sk,"X-API-Key":rawKey,"X-Internal-Call":"mcp-server"},
        body:JSON.stringify({action_template_id:aid,inputs:ins}),
      });
      // deno-lint-ignore no-explicit-any
      const rd:any=await rr.json();
      if(!rr.ok||!rd.success) return je(id,-32603,"Tool failed: "+(rd.error??"unknown"));
      return j({jsonrpc:"2.0",id,result:{content:[{type:"text",text:JSON.stringify(rd.data??rd)}]}});
    }
    return je(id,-32601,"Method not found: "+method);
  }catch(err){
    console.error("mcp-server:",err);
    return new Response(JSON.stringify({jsonrpc:"2.0",id:null,error:{code:-32603,message:"Internal error"}}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
  }
});
