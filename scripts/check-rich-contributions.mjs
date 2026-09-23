import assert from "node:assert/strict";
import QRCode from "qrcode";

const base="http://127.0.0.1:8787";
const qr=await QRCode.toBuffer("https://example.com/rich-counter",{width:400});
let adminCookie="",visitorCookie="";
async function call(path,{method="GET",data,body,admin=false,visitor=false,status=200}={}) {
  const headers={Origin:base};
  if(admin&&adminCookie)headers.Cookie=adminCookie;
  if(visitor&&visitorCookie)headers.Cookie=visitorCookie;
  if(data)headers["Content-Type"]="application/json";
  const response=await fetch(base+path,{method,headers,body:data?JSON.stringify(data):body});
  const text=await response.text();
  assert.equal(response.status,status,`${method} ${path}: ${response.status} ${text.slice(0,300)}`);
  const cookie=response.headers.get("set-cookie")?.split(";")[0];
  if(cookie&&admin)adminCookie=cookie;
  if(cookie&&visitor)visitorCookie=cookie;
  try{return JSON.parse(text);}catch{return text;}
}
await call("/api/admin/login",{method:"POST",data:{password:"000000"},admin:true});
await call("/api/contribute/quota",{visitor:true});
const before=await call("/api/catalog");
const name=`丰富投稿验证 ${Date.now()}`;
const details={mode:"restaurant",include_main:false,restaurant_id:"",restaurant_name:name,
  name_zh_hant:"豐富投稿驗證",name_en:"Rich submission",address:"一楼",address_zh_hant:"一樓",address_en:"Floor 1",
  category:"中餐",description:"新餐厅",description_zh_hant:"新餐廳",description_en:"New restaurant",
  opens_app:true,wechat_mini_program:true,other_note:"还有自助机",other_note_zh_hant:"還有自助機",other_note_en:"Kiosk available",
  url:"",windows:[{name:"窗口一",url:"https://example.com/rich-counter"},{name:"窗口二",url:""}]};
const form=new FormData();form.set("details",JSON.stringify(details));
form.set("window_image_0",new Blob([qr],{type:"image/png"}),"qr.png");
const created=await call("/api/contributions",{method:"POST",body:form,visitor:true,status:201});
assert.ok(!(await call("/api/catalog")).restaurants.some(r=>r.name===name),"pending content must stay private");
const review=await call("/api/admin/contributions",{admin:true});
const proposal=review.submissions.find(item=>item.id===created.id);
assert.equal(proposal.windows.length,2);
assert.equal(proposal.image_id,null);
assert.equal(proposal.other_note_en,"Kiosk available");
await call(`/media/${proposal.windows[0].image_id}`,{status:401});
await call(`/api/admin/contributions/${created.id}`,{method:"PUT",admin:true,data:{...details,
  other_note_en:"Kiosk and app",windows:proposal.windows.map((window,index)=>({id:window.id,name:index===0?"审核窗口":window.name,
    url:window.url,included:index===0}))}});
await call(`/api/admin/contributions/${created.id}/approve`,{method:"POST",admin:true});
const publicRestaurant=(await call("/api/catalog")).restaurants.find(r=>r.name===name);
assert.ok(publicRestaurant);
assert.equal(publicRestaurant.url,"");
assert.equal(publicRestaurant.image_id,null);
assert.equal(publicRestaurant.name_en,"Rich submission");
assert.equal(publicRestaurant.opens_app,1);
assert.equal(publicRestaurant.wechat_mini_program,1);
assert.equal(publicRestaurant.other_note_en,"Kiosk and app");
assert.deepEqual(publicRestaurant.windows.map(w=>w.name),["审核窗口"]);
await call(`/media/${proposal.windows[0].image_id}`);

const existing=before.restaurants.find(r=>r.url);
assert.ok(existing,"local database needs a published restaurant with a main link");
const update={mode:"update",include_main:false,restaurant_id:existing.id,restaurant_name:existing.name,
  name_zh_hant:existing.name_zh_hant,name_en:existing.name_en,address:existing.address,
  address_zh_hant:existing.address_zh_hant,address_en:existing.address_en,category:existing.category,
  description:existing.description,description_zh_hant:existing.description_zh_hant,description_en:existing.description_en,
  opens_app:true,wechat_mini_program:false,other_note:"可跳转应用",other_note_zh_hant:"可跳轉應用",other_note_en:"Opens the app",
  url:"",windows:[{name:"共创追加窗口",url:"https://example.com/extra"}]};
const updateForm=new FormData();updateForm.set("details",JSON.stringify(update));
const updated=await call("/api/contributions",{method:"POST",body:updateForm,visitor:true,status:201});
await call(`/api/admin/contributions/${updated.id}/approve`,{method:"POST",admin:true});
const after=(await call("/api/catalog")).restaurants.find(r=>r.id===existing.id);
assert.equal(after.url,existing.url,"metadata approval must preserve the current main link when not proposed");
assert.equal(after.other_note_en,"Opens the app");
assert.ok(after.windows.some(window=>window.name==="共创追加窗口"));
console.log("Rich contributions: pending privacy, optional main, multilingual metadata, notes, multiple windows, moderation edits, and existing restaurant updates passed.");
