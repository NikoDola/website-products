import { cp, mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i++) {
  const key=args[i];
  if(["--dry-run","--register"].includes(key)) options[key]=true;
  else if(["--id","--name","--port","--client"].includes(key)) { if(!args[i+1]||args[i+1].startsWith("--")) throw new Error(`Missing value for ${key}`); options[key]=args[++i]; }
  else throw new Error(`Unknown argument: ${key}`);
}
const id=options["--id"],name=options["--name"]||id;
if(!id||!/^[a-z][a-z0-9-]{1,49}$/.test(id)) throw new Error('Usage: npm run site:new -- --id client-name --name "Client Name" [--port 3002] [--register]');
const target=resolve(root,`${id}-web`);
if(dirname(target)!==root) throw new Error("Project must be inside this workspace.");
try { await access(target); throw new Error("This project folder already exists. Nothing was overwritten."); } catch(error) { if(error.code!=="ENOENT") throw error; }
const ports=new Set([3000,3001]);
for(const folder of await readdir(root,{withFileTypes:true})) if(folder.isDirectory()) {
  try { const config=JSON.parse(await readFile(join(root,folder.name,"site.config.json"),"utf8")); if(config.localPort) ports.add(config.localPort); } catch {}
}
let port=options["--port"]?Number(options["--port"]):3002;
if(options["--port"]&&ports.has(port)) throw new Error("This local port is already assigned in the workspace.");
while(ports.has(port)) port++;
if(!Number.isInteger(port)||port<3002||port>65535) throw new Error("Use a free local port between 3002 and 65535.");
if(options["--dry-run"]) { console.log(JSON.stringify({id,name,folder:target,port,register:Boolean(options["--register"])},null,2)); process.exit(0); }
await cp(join(root,"templates/website-starter"),target,{recursive:true,errorOnExist:true,force:false});
await mkdir(join(target,"public"),{recursive:true});
const pkg=JSON.parse(await readFile(join(target,"package.json"),"utf8"));pkg.name=`${id}-web`;pkg.scripts.dev=`next dev --hostname 127.0.0.1 --port ${port}`;
await writeFile(join(target,"package.json"),JSON.stringify(pkg,null,2)+"\n");
const content=JSON.parse(await readFile(join(target,"src/content/site.json"),"utf8"));content.id=id;content.name=name;
await writeFile(join(target,"src/content/site.json"),JSON.stringify(content,null,2)+"\n");
const client=options["--client"]||`${id}-client`;
await writeFile(join(target,"site.config.json"),JSON.stringify({schemaVersion:1,siteId:id,name,clientId:client,projectPath:`${id}-web`,localPort:port,publicUrl:"",cmsUrl:"",capabilities:{publicHealth:true,cms:false},commands:{dev:"npm run dev",build:"npm run build"}},null,2)+"\n");
if(options["--register"]) {
  const post=async(entity,body)=>{
    const response=await fetch(`http://127.0.0.1:3001/api/entities/${entity}`,{method:"POST",headers:{Origin:"http://127.0.0.1:3001","Content-Type":"application/json","x-platform-request":"admin"},body:JSON.stringify(body)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);return result;
  };
  try {
    if(!options["--client"]) await post("clients",{id:client,name});
    await post("sites",{id,name,client_id:client,public_url:"https://example.com",project_path:`${id}-web`,state:"development"});
    console.log("Registered locally. Replace the placeholder public URL after deployment; monitoring is disabled.");
  } catch(error) { console.error(`Files were created; registration did not finish: ${error.message}. Add the client/site in the admin manually.`); process.exitCode=1; }
}
console.log(`Created ${target}\nNext: npm --prefix ${id}-web install\nThen: npm --prefix ${id}-web run dev\nLocal URL: http://127.0.0.1:${port}`);
