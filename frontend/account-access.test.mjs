import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const root=new URL("./",import.meta.url);
const read=(name)=>readFile(new URL(name,root),"utf8");

test("viewer navigation includes read-only sections while account management remains admin-only",async()=>{
 const ui=await read("main.js");
 assert.match(ui,/function visibleSections\(\)/);
 assert.match(ui,/visibleSections\(\)\.map/);
 assert.match(ui,/visibleSections\(\)\.map\(\(\[name\]\)=>name\)/);
 assert.match(ui,/if\(!allowedSection\(active\)\)active="總覽"/);
 assert.match(ui,/"訓練控制":\["admin","viewer"\]/);
 assert.match(ui,/"專家與模型":\["admin","viewer"\]/);
 assert.match(ui,/"系統設定":\["admin"\]/);
});
test("admin account API validates server-side role",async()=>{
 const server=await read("server.mjs");
 assert.match(server,/pathname==="\/api\/auth\/admin\/users"/);
 assert.match(server,/actor\.role!=="admin"/);
 assert.match(server,/await verifiedSession\(req\)/);
 assert.match(server,/p1_admin_create_viewer/);
 assert.match(server,/p1_admin_set_viewer_enabled/);
 assert.match(server,/p1_admin_list_viewers/);
});
test("authenticated requests check database account status",async()=>{
 const server=await read("server.mjs");
 assert.match(server,/p1_session_account_status/);
 assert.match(server,/account\.enabled!==true/);
 assert.match(server,/account\.role!==identity\.role/);
 assert.match(server,/await verifiedSession\(fake,"refresh"\)/);
});
