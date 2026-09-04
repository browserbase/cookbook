/**
 * Deterministic same-origin API replays, ported verbatim from the demo repo's prompt `browserEval` blocks
 * and `tool.ts` bodies. These run via `page.evaluate(<string>)` on an authenticated Square page — NO LLM,
 * NO custom Stagehand tools (which would force experimental mode and bypass the model gateway). Each IIFE
 * returns a plain JSON array the function then maps to the clean schema CSV.
 */

/** services-list — Square catalog (ITEM + CATEGORY), one row per variation. Returns the schema array. */
export const EXTRACT_SERVICES = `(async () => {
  async function fetchAll(type) {
    let all = [], cursor = null;
    do {
      const url = "https://app.squareup.com/v2/catalog/frontend/list?types=" + type +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      const resp = await fetch(url, { credentials: "include" });
      const data = await resp.json();
      all = all.concat(data.objects || []);
      cursor = data.cursor || null;
    } while (cursor);
    return all;
  }
  const items = await fetchAll("ITEM");
  const cats = await fetchAll("CATEGORY");
  const catMap = {};
  for (const c of cats) catMap[c.id] = (c.category_data && c.category_data.name) || "";
  const toMin = (ms) => (typeof ms === "number" && ms > 0 ? String(Math.round(ms / 60000)) : "");
  const services = [];
  for (const obj of items) {
    const it = obj.item_data || {};
    const vars = it.variations || [];
    const isMulti = vars.length > 1;
    const categoryName =
      catMap[it.category_id] ||
      (it.categories && it.categories[0] && catMap[it.categories[0].id]) ||
      (it.reporting_category && it.reporting_category.name) || "";
    const description = it.description || it.description_plaintext || "";
    for (const v of vars) {
      const vd = v.item_variation_data || {};
      const processingMs = vd.transition_time != null ? vd.transition_time : (vd.processing_time != null ? vd.processing_time : vd.processing_duration);
      const bufferMs = vd.trailing_buffer_time != null ? vd.trailing_buffer_time : (vd.buffer_time != null ? vd.buffer_time : vd.trailing_buffer_duration);
      services.push({
        name: (isMulti ? (vd.name || it.name) : it.name) || "",
        description,
        category_name: categoryName,
        duration: toMin(vd.service_duration),
        price: vd.price_money ? (vd.price_money.amount / 100).toFixed(2) : "",
        price_varies: vd.pricing_type === "VARIABLE_PRICING" || !vd.price_money,
        processing_duration: toMin(processingMs),
        trailing_buffer_duration: toMin(bufferMs),
        parent_service_name: isMulti ? (it.name || "") : "",
      });
    }
  }
  return services;
})()`;

/** team-members — 3-way join of staff/services/business_locations. Returns one row per provider-per-location. */
export const EXTRACT_TEAM_MEMBERS = `(async () => {
  const findArr = (o) => { if (Array.isArray(o)) return o; for (const k in o){ if (Array.isArray(o[k])) return o[k]; if (o[k]&&typeof o[k]==='object'){ const f=findArr(o[k]); if (f) return f; } } return null; };
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const H = { accept: "application/json, text/javascript, */*; q=0.01", "x-requested-with": "XMLHttpRequest", ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}) };
  const get = async (path) => { const r = await fetch(path, { credentials: "same-origin", headers: H }); const t = await r.text(); let j=null; try{j=JSON.parse(t);}catch(e){} return { status: r.status, arr: findArr(j) || [] }; };
  const [staffR, svcR, locR] = await Promise.all([
    get("/appointments/api/staff"), get("/appointments/api/services"), get("/appointments/api/business_locations"),
  ]);
  const staff = staffR.arr, services = svcR.arr, locs = locR.arr;
  if (!staff.length) return { error: "no staff (status " + staffR.status + ")" };
  const locName = {};
  for (const l of locs) { if (l.id != null) locName[String(l.id)] = l.name; if (l.unit_token != null) locName[String(l.unit_token)] = l.name; }
  const varLocKey = (() => { for (const s of services) for (const v of (s.variations||[])) { for (const k of Object.keys(v)) if (/location/i.test(k)) return k; } return null; })();
  const offer = {};
  for (const s of services) {
    const sIds = s.staff_ids || [];
    let locIds = null;
    if (varLocKey) { const set=new Set(); for (const v of (s.variations||[])) { const lv=v[varLocKey]; if (lv!=null) set.add(String(lv)); } if (set.size) locIds = set; }
    for (const sid of sIds) { (offer[sid] = offer[sid] || []).push({ name: s.name, locIds }); }
  }
  const rows = [];
  for (const p of staff) {
    const blids = (p.business_location_ids||[]).map(String);
    const offers = offer[p.id] || [];
    const seenLocName = new Set();
    for (const lid of (blids.length ? blids : [null])) {
      const locationName = (lid != null && locName[lid]) || "";
      if (seenLocName.has(locationName)) continue;
      seenLocName.add(locationName);
      const svcNames = offers.filter(o => !o.locIds || (lid != null && o.locIds.has(lid))).map(o => o.name);
      rows.push({
        firstName: p.first_name || "",
        lastName: p.last_name || "",
        email: p.email || "",
        phone: p.phone || "",
        permissionLevel: p.em_role_name || (p.is_owner ? "Owner" : ""),
        location: locationName,
        services: [...new Set(svcNames)].join(", "),
      });
    }
  }
  return { rows };
})()`;

/** appointments — reservations across EVERY location × ALL staff, 6mo back→6mo forward, deduped. Returns {rows}.
 *  Resolves service names via the catalog (service_id→item name), staff via employee_attributions, location
 *  via business_locations, price via the cart's total_money. Client email/phone aren't on the reservation. */
export const EXTRACT_APPOINTMENTS = `(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const H = { accept:"application/json, text/javascript, */*; q=0.01", "x-requested-with":"XMLHttpRequest", ...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{}) };
  const findArr=(o)=>{ if(Array.isArray(o))return o; for(const k in o){ if(Array.isArray(o[k]))return o[k]; if(o[k]&&typeof o[k]==="object"){const f=findArr(o[k]); if(f)return f;} } return null; };
  const get=async(p)=>{ try{ const r=await fetch(p,{credentials:"same-origin",headers:H}); const t=await r.text(); try{return JSON.parse(t);}catch(e){return null;} }catch(e){ return null; } };
  const locs = findArr(await get("/appointments/api/business_locations")) || [];
  const staff = findArr(await get("/appointments/api/staff")) || [];
  if (!locs.length) return { error: "no business_locations (auth?)" };
  const locName = {}; for (const l of locs){ if(l.id!=null)locName[String(l.id)]=l.name; if(l.unit_token!=null)locName[String(l.unit_token)]=l.name; }
  const staffIds = staff.map(s=>s.id).filter(x=>x!=null);
  // catalog ITEM map: service_id -> service name (paginate)
  const svcName={};
  try { let cur=null; do { const u="https://app.squareup.com/v2/catalog/frontend/list?types=ITEM"+(cur?"&cursor="+encodeURIComponent(cur):""); const r=await fetch(u,{credentials:"include"}); const d=await r.json(); for(const o of (d.objects||[])){ if(o.id&&o.item_data){ svcName[o.id]=o.item_data.name; for(const v of (o.item_data.variations||[])){ if(v.id) svcName[v.id]=o.item_data.name; } } } cur=d.cursor||null; } while(cur); } catch(e){}
  const now=new Date(); const off=(()=>{const o=-now.getTimezoneOffset()/60;const s=o<0?"-":"+";const a=Math.abs(o);return s+String(Math.floor(a)).padStart(2,"0")+":"+String(Math.round((a%1)*60)).padStart(2,"0");})();
  const fmt=(d,end)=>{const y=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,"0"),da=String(d.getDate()).padStart(2,"0");return y+"-"+mo+"-"+da+(end?"T23:59:59":"T00:00:00")+off;};
  const ds=new Date(now);ds.setMonth(ds.getMonth()-6); const de=new Date(now);de.setMonth(de.getMonth()+6);
  const dateStart=fmt(ds,false), dateEnd=fmt(de,true);
  const findTotal=(cart)=>{ try{ if(cart&&cart.amounts&&cart.amounts.total_money&&cart.amounts.total_money.amount!=null) return cart.amounts.total_money.amount; }catch(e){} try{ const m=JSON.stringify(cart||{}).match(/"total_money":\\{"amount":(\\d+)/); if(m) return parseInt(m[1],10); }catch(e){} return null; };
  const byId={};
  for (const loc of locs) {
    const qs=new URLSearchParams(); qs.set("business_location_id",String(loc.id)); qs.set("date_start",dateStart); qs.set("date_end",dateEnd);
    for(const sid of staffIds) qs.append("staff_ids[]",String(sid));
    const arr = findArr(await get("/appointments/merchant/api/reservations?"+qs)) || [];
    for (const r of arr) {
      if (!r.id || byId[r.id]) continue;
      const its = (r.cart && r.cart.line_items && r.cart.line_items.itemization) || [];
      const services = [...new Set(its.map(it => { const sid = it.feature_details && it.feature_details.appointments_service_details && it.feature_details.appointments_service_details.service_id; return (sid && svcName[sid]) || null; }).filter(Boolean))];
      const staffNames = [...new Set(its.flatMap(it => (it.employee_attributions||[]).map(e => e.employee ? ((e.employee.first_name||"")+" "+(e.employee.last_name||"")).trim() : null)).filter(Boolean))];
      const amt = findTotal(r.cart);
      byId[r.id] = { id:String(r.id), status:r.status||"", clientName:r.client_name||"", clientEmail:"", clientPhone:"", dateStart:r.date_start||"", dateEnd:r.date_end||"", serviceNames:services, staffNames, locationName: locName[String(r.business_location_id)]||"", totalMoney: amt!=null?{amount:amt,currency:"USD"}:null, rrule: r.rrule||null };
    }
  }
  return { rows: Object.values(byId) };
})()`;

/** customer-list — ALL customers via SearchAndGetCustomers (protobuf). Returns {rows} with name/email/phone.
 *  Contact message fields: fn1=token, fn3=first, fn4=last, fn6=email, fn7=phone. Marketing consent isn't
 *  reliably identifiable in the protobuf flags → left blank. */
export const EXTRACT_CUSTOMERS = `(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const Hpb = { accept:"application/x-protobuf", "content-type":"application/x-protobuf", ...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{}) };
  const td=new TextDecoder(); const te=new TextEncoder();
  const rv=(b,i)=>{let v=0,s=0;while(true){const x=b[i++];v+=(x&0x7f)*Math.pow(2,s);s+=7;if(!(x&0x80))break;}return [v,i];};
  const fieldsOf=(b)=>{ let i=0; const out=[]; while(i<b.length){ let t;[t,i]=rv(b,i); const fn=t>>3,wt=t&7; if(wt===2){let ln;[ln,i]=rv(b,i);out.push({fn,bytes:b.slice(i,i+ln)});i+=ln;} else if(wt===0){let v;[v,i]=rv(b,i);out.push({fn,num:v});} else if(wt===5){i+=4;} else if(wt===1){i+=8;} else break; } return out; };
  const vEnc=(n)=>{const o=[];while(n>127){o.push((n&0x7f)|0x80);n=Math.floor(n/128);}o.push(n);return o;};
  const ld=(field,bytes)=>[(field<<3)|2,...vEnc(bytes.length),...bytes];
  const SGC="/services/squareup.customerswebfeproto.service.CustomersWebFeService/SearchAndGetCustomers";
  const PAGE=5000;
  const sgcReq=(merchant,size,cursor)=>{ const m=[...te.encode(merchant)]; let pag=[8,...vEnc(size)]; if(cursor){ const cb=[...te.encode(cursor)]; pag=pag.concat([(2<<3)|2,...vEnc(cb.length),...cb]); } let b=[]; b=b.concat(ld(1,m)); b=b.concat(ld(4,pag)); b=b.concat([(5<<3)|2,4,8,9,16,0]); for(const fl of [2,3,6,5,20,22]) b=b.concat([(8<<3)|0,fl]); return new Uint8Array(b); };
  const sgcCall=async(merchant,size,cursor)=>{ try{ const r=await fetch(SGC,{method:"POST",credentials:"same-origin",headers:Hpb,body:sgcReq(merchant,size,cursor)}); if(r.status!==200) return {status:r.status,buf:null}; return {status:200,buf:new Uint8Array(await r.arrayBuffer())}; }catch(e){ return {status:0,buf:null}; } };
  const parsePage=(buf)=>{ let total=null,cursor=null; const conts=[]; for(const f of fieldsOf(buf)){ if(f.fn===2&&f.bytes){ const tf=fieldsOf(f.bytes).find(x=>x.fn===3); if(tf&&tf.num!=null) total=tf.num; continue; } if(f.fn===5&&f.bytes){ cursor=td.decode(f.bytes); continue; } if(!f.bytes) continue; const sub=fieldsOf(f.bytes); const get=(n)=>{const x=sub.find(y=>y.fn===n&&y.bytes); return x?td.decode(x.bytes):null;}; const tok=get(1); if(!tok||!/^[A-Z0-9]{26}$/.test(tok)) continue; conts.push({ tok, firstName:get(3)||"", lastName:get(4)||"", email:get(6)||"", phone:get(7)||"" }); } return {total,cursor,conts}; };
  let html=""; try{ html=document.documentElement.innerHTML; }catch(e){}
  const mGrab=()=>{ const s=new Set(); try{(html.match(/\\bM[A-Z0-9]{12}\\b/g)||[]).forEach(x=>s.add(x));}catch(e){} try{for(const k of Object.keys(window)){const v=window[k]; if(typeof v==="string"&&/^M[A-Z0-9]{12}$/.test(v))s.add(v);}}catch(e){} try{for(let i=0;i<localStorage.length;i++){const v=localStorage.getItem(localStorage.key(i))||""; (v.match(/\\bM[A-Z0-9]{12}\\b/g)||[]).forEach(x=>s.add(x));}}catch(e){} return [...s]; };
  let merchant=null, bestTotal=-1;
  for (const m of mGrab()) { const r=await sgcCall(m,5,null); if(r.status===200&&r.buf){ const pg=parsePage(r.buf); const t=(pg.total!=null)?pg.total:pg.conts.length; if(t>bestTotal){bestTotal=t;merchant=m;} } }
  if (!merchant || bestTotal<=0) return { error:"no working merchant for SearchAndGetCustomers" };
  const byTok={}; let total=null,cursor=null,pages=0;
  do { const r=await sgcCall(merchant,PAGE,cursor); if(r.status!==200||!r.buf) break; const pg=parsePage(r.buf); if(pg.total!=null) total=pg.total; const before=Object.keys(byTok).length; for(const c of pg.conts){ if(!byTok[c.tok]) byTok[c.tok]=c; } cursor=pg.cursor; pages++; if(Object.keys(byTok).length===before) break; } while (cursor && (total==null || Object.keys(byTok).length<total) && pages<400);
  return { rows: Object.values(byTok) };
})()`;

/** products — retail items from the catalog (product_type REGULAR), one row per variation. Returns {rows}.
 *  Stock count / low-quantity need Square's inventory API (not in the catalog) → left blank for now. */
export const EXTRACT_PRODUCTS = `(async () => {
  async function fetchAll(type) {
    let all = [], cursor = null, pages = 0;
    const seen = new Set();
    do {
      if (++pages > 1000) throw new Error("Catalog page limit reached before completion");
      const url = "https://app.squareup.com/v2/catalog/frontend/list?types=" + type + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
      let resp;
      try { resp = await fetch(url, { credentials: "include" }); }
      catch { throw new Error("Catalog request failed"); }
      if (!resp.ok) throw new Error("Catalog request failed (HTTP " + resp.status + ")");
      let data;
      try { data = await resp.json(); } catch { throw new Error("Invalid catalog JSON"); }
      if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.objects) || (data.errors != null && (!Array.isArray(data.errors) || data.errors.length))) throw new Error("Invalid catalog response");
      for (const object of data.objects) {
        if (!object || typeof object !== "object" || Array.isArray(object) || typeof object.id !== "string" || !object.id) throw new Error("Invalid catalog object");
        const detail = type === "ITEM" ? object.item_data : object.category_data;
        if (!detail || typeof detail !== "object" || Array.isArray(detail)) throw new Error("Missing catalog object data");
      }
      all = all.concat(data.objects);
      if (data.cursor != null && typeof data.cursor !== "string") throw new Error("Invalid catalog cursor");
      cursor = data.cursor || null;
      if (cursor && seen.has(cursor)) throw new Error("Repeated catalog cursor before completion");
      if (cursor) seen.add(cursor);
    } while (cursor);
    return all;
  }
  const items = await fetchAll("ITEM");
  const cats = await fetchAll("CATEGORY");
  const catMap = {}; for (const c of cats) catMap[c.id] = (c.category_data && c.category_data.name) || "";
  const toAmt = (m) => (m && typeof m.amount === "number" ? (m.amount / 100).toFixed(2) : "");
  const out = [];
  for (const o of items) {
    const it = o.item_data || {};
    if (it.product_type !== "REGULAR") continue; // products only (skip services + credit packages)
    const categoryName = catMap[it.category_id] || (it.categories && it.categories[0] && catMap[it.categories[0].id]) || (it.reporting_category && it.reporting_category.name) || "";
    if (typeof it.name !== "string" || !it.name.trim() || !Array.isArray(it.variations)) throw new Error("Invalid retail item data");
    const vars = it.variations;
    const isMulti = vars.length > 1;
    for (const v of vars) {
      if (!v || !v.item_variation_data || typeof v.item_variation_data !== "object" || Array.isArray(v.item_variation_data)) throw new Error("Invalid product variation");
      const vd = v.item_variation_data;
      out.push({
        name: it.name || "",
        brand: "",
        price: toAmt(vd.price_money),
        count: "",
        intended_uses: "",
        business_cost: toAmt(vd.default_unit_cost),
        barcode: vd.sku || vd.upc || vd.gtin || "",
        optional_info: it.description || it.description_plaintext || "",
        location_name: "",
        category: categoryName,
        size: isMulti ? (vd.name || "") : "",
        color: "",
        low_quantity_level: "",
      });
    }
  }
  return { rows: out, complete: true, sources: { items: items.length, categories: cats.length } };
})()`;

/** unavailabilities — calendar events (lunch/time-off/busy blocks) for a 12-month window. Returns {rows}. */
export const EXTRACT_UNAVAILABILITIES = `(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const now = new Date();
  const off = (() => { const o=-now.getTimezoneOffset()/60; const s=o<0?"-":"+"; const a=Math.abs(o); return s+String(Math.floor(a)).padStart(2,"0")+":"+String(Math.round((a%1)*60)).padStart(2,"0"); })();
  const fmt = (d,end)=>{ const y=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,"0"),da=String(d.getDate()).padStart(2,"0"); return y+"-"+mo+"-"+da+(end?"T23:59:59":"T00:00:00")+off; };
  const start = new Date(now); start.setHours(0,0,0,0);
  const endd  = new Date(now); endd.setMonth(endd.getMonth()+12);
  const dateStart = fmt(start,false), dateEnd = fmt(endd,true);
  let res, body=null;
  try { res = await fetch("/appointments/api/events?date_start="+encodeURIComponent(dateStart)+"&date_end="+encodeURIComponent(dateEnd), { method:"GET", credentials:"same-origin", headers:{ accept:"application/json, text/javascript, */*; q=0.01", "x-requested-with":"XMLHttpRequest", ...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{}) } }); body = await res.json(); } catch(e){ return { error: "events fetch failed: " + (e&&e.message) }; }
  const findArr=(o)=>{ if(Array.isArray(o))return o; for(const k in o){ if(Array.isArray(o[k]))return o[k]; if(o[k]&&typeof o[k]==="object"){const f=findArr(o[k]); if(f)return f;} } return null; };
  const events = findArr(body) || [];
  const seen=new Set(); const out=[];
  for (const e of events) { const id=String(e.id != null ? e.id : ""); if(id&&seen.has(id))continue; seen.add(id);
    out.push({ id, name: e.name != null ? e.name : (e.title != null ? e.title : null), staffId: e.staff_id != null ? e.staff_id : (e.staffId != null ? e.staffId : null), dateStart: e.date_start != null ? e.date_start : (e.dateStart != null ? e.dateStart : ""), dateEnd: e.date_end != null ? e.date_end : (e.dateEnd != null ? e.dateEnd : ""), tzid: e.tzid != null ? e.tzid : (e.timezone != null ? e.timezone : null), rrule: e.rrule != null ? e.rrule : null });
  }
  return { rows: out };
})()`;

/** packages — credit packages via catalog search, with bundle (service + credits) resolved. Returns {rows}. */
export const EXTRACT_PACKAGES = `(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const H = { accept:"application/json", "content-type":"application/json", "x-requested-with":"XMLHttpRequest", ...(csrf?{"x-csrf-token":csrf}:{}) };
  const body = JSON.stringify({ product_types:["CREDIT_PACKAGE"], include_related_objects:true, limit:200 });
  let res, txt, data=null;
  for (let a=0;a<3;a++){ try { res = await fetch("/v2/catalog/frontend/search",{ method:"POST", credentials:"same-origin", headers:H, body }); txt = await res.text(); try{data=JSON.parse(txt);}catch(e){} if (res.ok) break; await new Promise(s=>setTimeout(s,600*(a+1))); } catch(e){ await new Promise(s=>setTimeout(s,600*(a+1))); } }
  if (!data) return { error: "search failed: HTTP " + (res&&res.status) + " " + (txt||"").slice(0,120) };
  const all = data.objects || [];
  const related = data.related_objects || [];
  const items = all.filter(o => o.type === "ITEM" && o.item_data && o.item_data.product_type === "CREDIT_PACKAGE");
  const byId = {}; for (const r of [...all, ...related]) { if (r && r.id) byId[r.id] = r; }
  const itemName = (id) => { const o = byId[id]; return (o && o.item_data && o.item_data.name) || null; };
  const servicesFromPricingRule = (prId) => { const pr = prId && byId[prId]; if (!pr || !pr.pricing_rule_data) return []; const ps = byId[pr.pricing_rule_data.match_products_id]; const ids = (ps && ps.product_set_data && (ps.product_set_data.product_ids_any || ps.product_set_data.product_ids_all)) || []; return [...new Set(ids.map(itemName).filter(Boolean))]; };
  const seen = new Set(); const out = [];
  for (const o of items) {
    if (seen.has(o.id)) continue; seen.add(o.id);
    const d = o.item_data || {};
    const bundle = [];
    for (const v of (d.variations || [])) {
      const cpi = (v.item_variation_data && v.item_variation_data.credit_package_info) || null;
      if (!cpi) continue;
      for (const p of (cpi.redemption_policies || [])) { const rd = p.credit_redemption_policy_data || {}; const svcs = servicesFromPricingRule(rd.pricing_rule_id); bundle.push({ catalog_item_name: svcs.join(", ") || null, credit_amount: (rd.quantity != null ? rd.quantity : null) }); }
    }
    out.push({ package_title: d.name != null ? d.name : null, bundle });
  }
  return { rows: out };
})()`;

/** reviews — all feedback (all time, with + without comments), enriched with service names + location. Returns {rows}. */
export const EXTRACT_REVIEWS = `(async () => {
  const csrf = document.querySelector('meta[name="csrf-token"]') ? document.querySelector('meta[name="csrf-token"]').content : null;
  const H = { accept:"application/json", "content-type":"application/json", "x-requested-with":"XMLHttpRequest", ...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{}) };
  const usecToIso = (t) => { const u = t && (typeof t==="object" ? t.instant_usec : t); return (u!=null) ? new Date(Math.round(u/1000)).toISOString() : null; };
  const chunk = (arr,n) => { const o=[]; for (let i=0;i<arr.length;i+=n) o.push(arr.slice(i,i+n)); return o; };
  const cands = new Set();
  try { (document.documentElement.innerHTML.match(/\\bM[A-Z0-9]{11,}\\b/g)||[]).forEach(x=>cands.add(x)); } catch(e){}
  try { for (const k of Object.keys(window)) { const v=window[k]; if (typeof v==="string" && /^M[A-Z0-9]{11,}$/.test(v)) cands.add(v); } } catch(e){}
  try { for (let i=0;i<localStorage.length;i++){ const v=localStorage.getItem(localStorage.key(i))||""; (v.match(/M[A-Z0-9]{11,}/g)||[]).forEach(x=>cands.add(x)); } } catch(e){}
  const merchantCandidates = [...cands];
  const END = Date.now()*1000 + 86400000000*2;
  const postFeedback = async (cursor) => { const body = JSON.stringify({ begin_time:{instant_usec:0}, end_time:{instant_usec:END}, with_comments_only:false, location_specificity_type:"ALL", cursor: cursor||null, limit:200 }); let res, txt, data=null; for (let a=0;a<3;a++){ try { res = await fetch("/api/v1/dialogue/conversations-list",{ method:"POST", credentials:"same-origin", headers:H, body }); txt = await res.text(); try{data=JSON.parse(txt);}catch(e){} if (res.ok) break; await new Promise(s=>setTimeout(s,600*(a+1))); } catch(e){ await new Promise(s=>setTimeout(s,600*(a+1))); } } return { ok: res&&res.ok, status: res&&res.status, data, head:(txt||"").slice(0,160) }; };
  let convs=[], cursor=null, total=null, pages=0;
  do { const r = await postFeedback(cursor); if (!r.ok || !r.data) return { error: "conversations-list failed: HTTP " + r.status + " " + r.head }; if (total==null) total = r.data.total_response_count != null ? r.data.total_response_count : null; const arr = r.data.conversations || []; convs = convs.concat(arr); cursor = r.data.cursor || r.data.next_cursor || (r.data.paging && r.data.paging.cursor) || null; pages++; if (arr.length === 0) break; } while (cursor && pages < 200 && (total==null || convs.length < total));
  const payment_tokens = [...new Set(convs.map(c=>c.payment_token).filter(Boolean))];
  const unit_tokens = [...new Set(convs.map(c=>c.merchant_token).filter(Boolean))];
  const callTF = async (m, pts) => { let res, txt, j=null; try { res = await fetch("/api/v3/reports/transaction-families",{ method:"POST", credentials:"same-origin", headers:H, body: JSON.stringify({ user_token:{ merchant_token:m, unit_token: unit_tokens }, token_params:{ payment_token: pts, bill_token: pts } }) }); txt = await res.text(); try{j=JSON.parse(txt);}catch(e){} } catch(e){} return { status: res&&res.status, fams: (j && (j.transaction_family || j.transaction_families)) || null }; };
  let merchant=null; const probe = payment_tokens.slice(0,50);
  if (probe.length) { for (const m of merchantCandidates) { const a = await callTF(m, probe); if (a.status===200 && a.fams && a.fams.length) { merchant=m; break; } } }
  const txMap = {};
  if (merchant) { for (const pts of chunk(payment_tokens, 100)) { const a = await callTF(merchant, pts); for (const f of (a.fams||[])) { const ot = f.original_transaction || f; const pt = ot.payment_token || (ot.tokens && ot.tokens.payment_token) || (f.tokens && f.tokens.payment_token) || null; if (!pt) continue; const items = ot.itemization || []; const services = [...new Set(items.map(it => (it.name_or_translation_type && it.name_or_translation_type.name) || it.name).filter(Boolean))]; const location = (ot.subunit_merchant && (ot.subunit_merchant.location_name || ot.subunit_merchant.name)) || null; txMap[pt] = { services, location }; } } }
  const seen = new Set(); const out = [];
  for (const c of convs) { if (!c || seen.has(c.token)) continue; seen.add(c.token); const tx = txMap[c.payment_token] || {}; const comments = (c.comments||[]).map(m => ({ content:m.content==null?null:m.content })); out.push({ id: c.token != null ? c.token : null, created: usecToIso(c.created_at), sentiment: c.sentiment != null ? c.sentiment : null, services_names: (tx.services && tx.services.join(", ")) || null, customer_id: c.contact_token != null ? c.contact_token : null, comment: (comments[0] && comments[0].content) || null }); }
  return { rows: out };
})()`;

// Embedded browser programs share validation without importing runtime dependencies into the page.
const PACKAGE_WIRE_HELPERS = String.raw`
  const csrf=document.querySelector('meta[name="csrf-token"]')?.content;
  const Hjson={accept:"application/json","content-type":"application/json","x-requested-with":"XMLHttpRequest",...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{})};
  const Hpb={accept:"application/x-protobuf","content-type":"application/x-protobuf",...(csrf?{"x-csrf-token":decodeURIComponent(csrf)}:{})};
  const td=new TextDecoder("utf-8",{fatal:true}), te=new TextEncoder();
  const text=(v)=>typeof v==="string" && v.trim().length>0;
  const rv=(b,i)=>{
    let v=0;
    for(let n=0;n<10;n++){
      if(i>=b.length) throw new Error("truncated protobuf varint");
      const x=b[i++]; v+=(x&127)*Math.pow(2,7*n);
      if(!Number.isSafeInteger(v)) throw new Error("protobuf integer out of range");
      if(!(x&128)) return [v,i];
    }
    throw new Error("invalid protobuf varint");
  };
  const fieldsOf=(b)=>{
    let i=0; const out=[];
    while(i<b.length){
      let t; [t,i]=rv(b,i); const fn=Math.floor(t/8), wt=t%8;
      if(fn<1 || fn>536870911) throw new Error("invalid protobuf field");
      if(wt===2){ let len; [len,i]=rv(b,i); if(len>b.length-i) throw new Error("truncated protobuf field"); out.push({fn,bytes:b.slice(i,i+len)}); i+=len; }
      else if(wt===0){ let num; [num,i]=rv(b,i); out.push({fn,num}); }
      else if(wt===1 || wt===5){const len=wt===1?8:4; if(len>b.length-i) throw new Error("truncated protobuf number"); out.push({fn,fixed:b.slice(i,i+len)}); i+=len;}
      else throw new Error("unsupported protobuf wire type");
    }
    return out;
  };
  const vEnc=(n)=>{const out=[]; while(n>127){out.push((n%128)|128);n=Math.floor(n/128);}out.push(n);return out;};
  const ld=(field,bytes)=>[...vEnc(field*8+2),...vEnc(bytes.length),...bytes];
`;

const READ_CUSTOMER_PACKAGES = String.raw`
  if(!Array.isArray(customers) || customers.some(t=>!text(t)) || new Set(customers).size!==customers.length) throw new Error("invalid or duplicate customer tokens");
  const all=[], byId=new Map(), cursors=new Set(); let catalogCursor=null, catalogPages=0;
  do {
    if(++catalogPages>400) throw new Error("catalog pagination limit reached");
    const cr=await fetch("/v2/catalog/frontend/search",{method:"POST",credentials:"same-origin",headers:Hjson,body:JSON.stringify({product_types:["CREDIT_PACKAGE"],include_related_objects:true,limit:200,...(catalogCursor?{cursor:catalogCursor}:{})})});
    if(cr.status!==200) throw new Error("catalog request failed");
    const cd=await cr.json();
    if(!cd || typeof cd!=="object" || Array.isArray(cd) || cd.error || (cd.errors && (!Array.isArray(cd.errors) || cd.errors.length)) || !Array.isArray(cd.objects) || (cd.related_objects!==undefined && !Array.isArray(cd.related_objects))) throw new Error("invalid catalog response");
    for(const o of [...cd.objects,...(cd.related_objects||[])]){
      if(!o || typeof o!=="object" || Array.isArray(o) || !text(o.id)) throw new Error("invalid catalog object");
      if(byId.has(o.id) && JSON.stringify(byId.get(o.id))!==JSON.stringify(o)) throw new Error("conflicting catalog objects");
      byId.set(o.id,o);
    }
    all.push(...cd.objects);
    if(cd.cursor!=null && cd.next_cursor!=null && cd.cursor!==cd.next_cursor) throw new Error("ambiguous catalog cursor");
    catalogCursor=cd.cursor??cd.next_cursor??null;
    if(catalogCursor!==null && typeof catalogCursor!=="string") throw new Error("invalid catalog cursor");
    if(catalogCursor && (cursors.has(catalogCursor) || !cd.objects.length)) throw new Error("catalog pagination did not progress");
    if(catalogCursor) cursors.add(catalogCursor);
  } while(catalogCursor);
  const ruleMap=new Map();
  for(const o of all){
    if(o.type!=="ITEM" || o.item_data?.product_type!=="CREDIT_PACKAGE") continue;
    const d=o.item_data;
    if(!text(d.name) || !Array.isArray(d.variations)) throw new Error("invalid package catalog item");
    for(const v of d.variations){
      const cpi=v?.item_variation_data?.credit_package_info;
      if(!cpi) continue;
      if(!Array.isArray(cpi.redemption_policies)) throw new Error("invalid package redemption policies");
      for(const p of cpi.redemption_policies){
        const rid=p?.credit_redemption_policy_data?.pricing_rule_id;
        if(!text(rid)) throw new Error("missing package pricing rule");
        const rule=byId.get(rid)?.pricing_rule_data;
        const set=byId.get(rule?.match_products_id)?.product_set_data;
        const ids=set?.product_ids_any??set?.product_ids_all;
        if(!Array.isArray(ids) || !ids.length) throw new Error("unresolved package pricing rule");
        const names=ids.map(id=>{const name=byId.get(id)?.item_data?.name; if(!text(name)) throw new Error("unresolved package service"); return name;});
        const mapped={package_title:d.name,catalog_item_name:[...new Set(names)].join(", ")};
        if(ruleMap.has(rid) && JSON.stringify(ruleMap.get(rid))!==JSON.stringify(mapped)) throw new Error("ambiguous package pricing rule");
        ruleMap.set(rid,mapped);
      }
    }
  }
  const packsFrom=(buf,tok)=>fieldsOf(buf).map(f=>{
    // No schema is available for other envelope fields; never mistake an error or cursor for completion.
    if(f.fn!==2 || !f.bytes) throw new Error("unsupported credit packs response envelope");
    const sub=fieldsOf(f.bytes);
    const one=(n)=>{const fields=sub.filter(x=>x.fn===n);if(fields.length>1) throw new Error("duplicate credit pack field");return fields[0];};
    const str=(n,required=false)=>{const x=one(n);if(!x){if(required) throw new Error("missing credit pack identity");return null;}if(!x.bytes) throw new Error("invalid credit pack string");const value=td.decode(x.bytes);if(required && !text(value)) throw new Error("empty credit pack identity");return value||null;};
    const pack_id=str(1,true),client_token=str(4,true),pricing_rule_id=str(8,true),expires_at=str(10);
    const credit=one(11);
    if(credit && (!Number.isSafeInteger(credit.num) || credit.num<0)) throw new Error("invalid remaining credits");
    if(client_token!==tok) throw new Error("credit pack customer mismatch");
    return {pack_id,client_token,pricing_rule_id,expires_at,credits_remaining:credit?.num??null};
  });
  const out=[], seen=new Set(); let customersProbed=0;
  for(let i=0;i<customers.length;i+=20){
    const group=await Promise.all(customers.slice(i,i+20).map(async tok=>{
      const r=await fetch("/services/squareup.credittracking.service.CreditTrackingService/SearchCreditPacks",{method:"POST",credentials:"same-origin",headers:Hpb,body:new Uint8Array(ld(1,ld(1,ld(1,te.encode(tok))))) });
      if(r.status!==200) throw new Error("credit packs request failed");
      return packsFrom(new Uint8Array(await r.arrayBuffer()),tok);
    }));
    for(const packs of group) for(const p of packs){
      if(seen.has(p.pack_id)) throw new Error("duplicate credit pack");
      seen.add(p.pack_id);
      const mapped=ruleMap.get(p.pricing_rule_id);
      if(!mapped) throw new Error("unresolved credit pack catalog reference");
      out.push({...mapped,client_token:p.client_token,client_name:nameByToken[p.client_token]||null,expires_at:p.expires_at,credits_remaining:p.credits_remaining});
    }
    customersProbed+=group.length;
  }
  return {rows:out,complete:true,customersProbed};
`;

/** Purchased package credits; success requires complete customer and catalog enumeration. */
export const EXTRACT_CLIENT_PACKAGES = `(async () => {
${PACKAGE_WIRE_HELPERS}
  const SGC="/services/squareup.customerswebfeproto.service.CustomersWebFeService/SearchAndGetCustomers";
  const PAGE=5000;
  const sgcReq=(merchant,size,cursor)=>{ const m=[...te.encode(merchant)]; let pag=[8,...vEnc(size)]; if(cursor){ const cb=[...te.encode(cursor)]; pag=pag.concat([(2<<3)|2,...vEnc(cb.length),...cb]); } let b=[]; b=b.concat(ld(1,m)); b=b.concat(ld(4,pag)); b=b.concat([(5<<3)|2,4,8,9,16,0]); for(const fl of [2,3,6,5,20,22]) b=b.concat([(8<<3)|0,fl]); return new Uint8Array(b); };
  const sgcCall=async(merchant,size,cursor)=>{ try{ const r=await fetch(SGC,{method:"POST",credentials:"same-origin",headers:Hpb,body:sgcReq(merchant,size,cursor)}); if(r.status!==200) return {status:r.status,buf:null}; return {status:200,buf:new Uint8Array(await r.arrayBuffer())}; }catch(e){ return {status:0,buf:null}; } };
  const parsePage=(buf)=>{ let total=null,cursor=null; const conts=[]; for(const f of fieldsOf(buf)){ if(f.fn===2&&f.bytes){ const tf=fieldsOf(f.bytes).find(x=>x.fn===3); if(tf&&tf.num!=null) total=tf.num; continue; } if(f.fn===5&&f.bytes){ cursor=td.decode(f.bytes); continue; } if(!f.bytes) continue; const sub=fieldsOf(f.bytes); let tok=null; const alpha=[]; for(const sf of sub){ if(!sf.bytes)continue; const s=td.decode(sf.bytes); if(!tok&&/^[A-Z0-9]{26}$/.test(s)){tok=s;continue;} if(/^[A-Za-z][A-Za-z .'\\-]{0,38}$/.test(s)&&!/@/.test(s))alpha.push(s); } if(tok) conts.push({tok,name:alpha.slice(0,2).join(" ").trim()||null}); } return {total,cursor,conts}; };
  let html=""; try{ html=document.documentElement.innerHTML; }catch(e){}
  const mGrab=()=>{ const s=new Set(); try{(html.match(/\\bM[A-Z0-9]{12}\\b/g)||[]).forEach(x=>s.add(x));}catch(e){} try{for(const k of Object.keys(window)){const v=window[k]; if(typeof v==="string"&&/^M[A-Z0-9]{12}$/.test(v))s.add(v);}}catch(e){} try{for(let i=0;i<localStorage.length;i++){const v=localStorage.getItem(localStorage.key(i))||""; (v.match(/\\bM[A-Z0-9]{12}\\b/g)||[]).forEach(x=>s.add(x));}}catch(e){} return [...s]; };
  const merchantCands=mGrab();
  let merchant=null, bestTotal=-1;
  for (const m of merchantCands) { const r=await sgcCall(m,5,null); if(r.status===200&&r.buf){ const pg=parsePage(r.buf); if (!Number.isSafeInteger(pg.total) || pg.total<0) throw new Error("customer total missing"); const t=pg.total; if(t>bestTotal){bestTotal=t;merchant=m;} } }
  if (!merchant || bestTotal<0) return { error:"no working merchant for SearchAndGetCustomers (candidates="+merchantCands.length+")" };
  const contactTokens=new Set(); const nameByToken=Object.create(null); const customerCursors=new Set(); let total=null,cursor=null,pages=0;
  do {
    if (++pages>400) throw new Error("customer pagination limit reached");
    const r=await sgcCall(merchant,PAGE,cursor);
    if(r.status!==200||!r.buf) throw new Error("customer enumeration request failed");
    const pg=parsePage(r.buf);
    if (!Number.isSafeInteger(pg.total) || pg.total<0 || (total!==null && total!==pg.total)) throw new Error("customer total missing or changed");
    total=pg.total;
    const before=contactTokens.size;
    for(const c of pg.conts){ contactTokens.add(c.tok); if(c.name) nameByToken[c.tok]=c.name; }
    cursor=pg.cursor;
    if(cursor && (customerCursors.has(cursor) || contactTokens.size===before)) throw new Error("customer pagination did not progress");
    if(cursor) customerCursors.add(cursor);
  } while(cursor);
  const customers=[...contactTokens];
  if(total===null || customers.length!==total) throw new Error("customer enumeration incomplete");
${READ_CUSTOMER_PACKAGES}
})()`;

/** Token-sourced package credits; rejects failed or unsupported responses before delivery. */
export function buildExtractPacksForTokens(tokens: string[], nameByToken: Record<string, string>): string {
  return `(async () => {
    const customers=${JSON.stringify(tokens)};
    const nameByToken=JSON.parse(${JSON.stringify(JSON.stringify(nameByToken))});
    ${PACKAGE_WIRE_HELPERS}
    ${READ_CUSTOMER_PACKAGES}
  })()`;
}
