'use strict';
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const storageKey='festiva-korea-custom-v1';
let records=[],custom=[],region='',entered=false,entering=false,loadPromise,mapProjection,world=[],koreaGeometry;
let photoData='',photoBusy=false,toastTimer,lastDetailFocus,animation=0,renderRequest=0;
let picking=false,pendingLocation=null,detailAnimation=null;
const canvas=$('earth'),ctx=canvas.getContext('2d');
let width=0,height=0,radius=0,rotation=[-112,-23,0],projection,drag=null;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const imageFor=f=>f.custom?(f.image||''):(f.poster||`assets/${f.id}.jpg`);
const allFestivals=()=>[...custom,...records];
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function loadLocal(){try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');custom=Array.isArray(value)?value.filter(f=>f&&f.custom&&typeof f.name==='string'&&typeof f.region==='string'&&Number.isFinite(f.lat)&&Number.isFinite(f.lng)&&f.lat>=33&&f.lat<=39&&f.lng>=124&&f.lng<=132&&(!f.image||/^data:image\/jpeg;base64,/.test(f.image))):[];}catch{custom=[];}}
function persist(next){localStorage.setItem(storageKey,JSON.stringify(next));custom=next;}
async function getJSON(url){const r=await fetch(url);if(!r.ok)throw Error(`불러오지 못했습니다: ${url}`);return r.json();}
function paint(){
 if(!ctx||!projection||entered||document.hidden)return;
 const [cx,cy]=projection.translate();ctx.clearRect(0,0,width,height);
 const scale=projection.scale();
 ctx.save();ctx.beginPath();ctx.ellipse(cx,cy+scale+25,scale*.66,14,0,0,Math.PI*2);ctx.fillStyle='#1238b015';ctx.filter='blur(12px)';ctx.fill();ctx.restore();
 let ocean=ctx.createRadialGradient(cx-scale*.3,cy-scale*.4,scale*.05,cx,cy,scale);ocean.addColorStop(0,'#3869f4');ocean.addColorStop(.8,'#164bdf');ocean.addColorStop(1,'#0a2f9c');
 ctx.beginPath();ctx.arc(cx,cy,scale,0,2*Math.PI);ctx.fillStyle=ocean;ctx.fill();
 const path=d3.geoPath(projection,ctx);
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,scale,0,2*Math.PI);ctx.clip();
 ctx.beginPath();path(d3.geoGraticule10());ctx.strokeStyle='#ffffff12';ctx.lineWidth=.6;ctx.stroke();
 for(const f of world){ctx.beginPath();path(f.geometry);ctx.fillStyle=f.k?'#ffad75':'#f1f5ff';ctx.fill();ctx.strokeStyle=f.k?'#ff9060':'#9fb7ef';ctx.lineWidth=f.k?.9:.55;ctx.stroke();}
 const shade=ctx.createRadialGradient(cx-scale*.3,cy-scale*.35,scale*.25,cx,cy,scale*1.02);shade.addColorStop(0,'#ffffff00');shade.addColorStop(.78,'#ffffff00');shade.addColorStop(1,'#00164f66');ctx.fillStyle=shade;ctx.fillRect(cx-scale,cy-scale,scale*2,scale*2);ctx.restore();
 ctx.beginPath();ctx.arc(cx,cy,scale+.5,0,2*Math.PI);ctx.strokeStyle='#133db8';ctx.lineWidth=1;ctx.stroke();
 const distance=d3.geoDistance([127.8,36.2],[-rotation[0],-rotation[1]]);
 const point=projection([127.8,36.2]);const visible=distance<1.45;
 const entry=$('korea-entry');entry.style.left=`${visible?point[0]+48:cx}px`;entry.style.top=`${visible?point[1]-15:cy+scale+47}px`;entry.innerHTML=visible?'<span class="dot"></span> 대한민국 <span class="arrow">↗</span>':'대한민국으로 이동 ↗';
}
function schedulePaint(){if(!renderRequest)renderRequest=requestAnimationFrame(()=>{renderRequest=0;paint();});}
function resize(){const rect=$('globe-stage').getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);radius=Math.min(width*.32,height*.34,310);if(projection)projection.translate([width/2,height*.51]).scale(radius).rotate(rotation);schedulePaint();}
async function initGlobe(){
 resize();try{
 if(typeof d3==='undefined')throw Error('지도 모듈을 불러오지 못했습니다.');
 projection=d3.geoOrthographic().rotate(rotation).precision(.55).translate([width/2,height*.51]).scale(radius);
 // Paint the sphere before the geographic data arrives.
 paint();world=(await getJSON('assets/world.json')).map(f=>({k:f.k,geometry:{type:f.t,coordinates:f.c}}));paint();
 }catch(error){console.error(error);$('load-state').textContent='지구본을 불러오지 못했습니다. 한국 보기로 탐색할 수 있어요.';$('korea-entry').style.left='50%';$('korea-entry').style.top='50%';}
}
function animateGlobe(){return new Promise(resolve=>{
 if(!projection||reduced){resolve();return;}
 cancelAnimationFrame(animation);const start=performance.now(),from=rotation.slice();const to=[-127.8,-36.2,0];to[0]=from[0]+((((to[0]-from[0])+180)%360+360)%360-180);const fromScale=projection.scale();
 const frame=now=>{const t=Math.min(1,(now-start)/620),ease=1-Math.pow(1-t,3);rotation=from.map((v,i)=>v+(to[i]-v)*ease);projection.rotate(rotation).scale(fromScale*(1+.28*ease));paint();if(t<1)animation=requestAnimationFrame(frame);else{animation=0;resolve();}};animation=requestAnimationFrame(frame);
 });}
async function loadKorea(){if(!loadPromise)loadPromise=Promise.all([getJSON('assets/korea.json'),getJSON('assets/festivals.json')]).then(([geometry,data])=>{koreaGeometry=geometry;records=data;drawKorea();}).catch(error=>{loadPromise=null;throw error;});return loadPromise;}
async function enterKorea(){
 if(entered){renderList();return;}if(entering)return;entering=true;$('korea-entry').disabled=true;
 try{const dataPromise=loadKorea();await Promise.all([animateGlobe(),dataPromise]);$('app').classList.add('entering');entered=true;$('korea-stage').hidden=false;$('festival-panel').hidden=false;$('app').classList.add('entered');renderList();setTimeout(()=>{if(entered)$('globe-stage').hidden=true;},reduced?0:500);$('load-state').textContent='';}
 catch(error){console.error(error);$('load-state').replaceChildren();$('load-state').append('한국 정보를 불러오지 못했습니다. ');const retry=document.createElement('button');retry.textContent='다시 시도';retry.onclick=enterKorea;$('load-state').append(retry);}
 finally{entering=false;$('korea-entry').disabled=false;}
}
function showHome(){cancelPick();entered=false;region='';$('search').value='';$('globe-stage').hidden=false;$('korea-stage').hidden=true;$('festival-panel').hidden=true;$('app').classList.remove('entering','entered');rotation=[-112,-23,0];if(projection)projection.rotate(rotation).scale(radius);resize();window.scrollTo({top:0,behavior:'instant'});}
function svgElement(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);return el;}
function drawKorea(){
 // Planar Mercator avoids spherical winding assumptions in the source geometry.
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 const minX=124.3,maxX=131.9,minY=merc(33),maxY=merc(38.8);
 const scale=Math.min(390/((maxX-minX)*Math.PI/180),470/(maxY-minY));
 mapProjection=([lng,lat])=>[230+(lng-128.1)*Math.PI/180*scale,325-((merc(lat)-(minY+maxY)/2)*scale)];
 const polys=koreaGeometry.type==='Polygon'?[koreaGeometry.coordinates]:koreaGeometry.coordinates;
 $('korea-land').replaceChildren();for(const poly of polys){const path=svgElement('path',{d:poly.map(ring=>ring.map((c,i)=>{const [x,y]=mapProjection(c);return`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;}).join(' ')+'Z').join(' '),'fill-rule':'evenodd'});$('korea-land').append(path);}
}
function queryRecords(){const q=$('search').value.trim().toLocaleLowerCase('ko');return allFestivals().filter(f=>(!region||f.region===region)&&(!q||`${f.name} ${f.region} ${f.venue||''}`.toLocaleLowerCase('ko').includes(q)));}
function renderMarkers(list){if(!mapProjection)return;$('map-markers').replaceChildren();
 const groups=[...new Map(list.map(f=>[f.region,f])).values()];
 for(const f of groups){const [x,y]=mapProjection([f.lng,f.lat]);const group=svgElement('g',{class:`map-pin ${region===f.region?'active':''}`,transform:`translate(${x},${y})`,tabindex:'0',role:'button','aria-label':`${f.region} 축제 보기`});group.append(svgElement('rect',{x:f.region==='진주'?-45:f.region==='창원'?-15:-10,y:f.region==='창원'?-28:-10,width:f.region==='창원'?30:58,height:36,fill:'transparent','pointer-events':'all'}),svgElement('circle',{r:10,class:'pin-ring'}),svgElement('circle',{r:4.5,class:'pin-dot'}));const text=svgElement('text',{x:f.region==='진주'?-12:f.region==='창원'?0:13,y:f.region==='진주'?16:f.region==='창원'?-15:4,'text-anchor':f.region==='진주'?'end':f.region==='창원'?'middle':'start'});text.textContent=f.region;group.append(text);const choose=()=>{if(picking){setLocation([f.lng,f.lat],f.region);return;}region=region===f.region?'':f.region;renderList();};group.onclick=choose;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};$('map-markers').append(group);}
}
function renderList(){
 const list=queryRecords();$('list-title').textContent=region?`${region}의 축제`:$('search').value.trim()?'검색 결과':'한국의 축제';$('list-count').textContent=`${list.length}개의 축제`;$('location-label').textContent=region||'전국의 축제';$('all-regions').hidden=!region;
 const grid=$('festival-grid');grid.replaceChildren();
 for(const f of list){const card=document.createElement('article');card.className='festival-card';const b=document.createElement('button');b.className='poster-button';b.setAttribute('aria-label',`${f.name} 상세 보기`);b.title=f.name;const thumb=document.createElement('div');thumb.className='thumb';const src=imageFor(f);if(src){const img=new Image();img.src=src;img.alt=f.name;img.loading='lazy';img.decoding='async';img.width=480;img.height=680;img.onerror=()=>{img.hidden=true;thumb.classList.add('missing');};thumb.append(img);}else thumb.classList.add('missing');const title=document.createElement('span');title.className='poster-title';title.textContent=f.name;const fallback=document.createElement('span');fallback.className='poster-fallback';fallback.textContent=f.name;thumb.append(fallback);b.append(thumb,title);b.onclick=()=>openDetail(f,b);card.append(b);grid.append(card);}
 if(!list.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='찾는 축제가 아직 없어요.';const clear=document.createElement('button');clear.textContent='전체 축제 보기';clear.onclick=()=>{region='';$('search').value='';renderList();};empty.append(clear);grid.append(empty);}
 $('sample-note').hidden=!list.some(f=>!f.custom);
 // Keep all search matches on the map when a single region is selected.
 const selected=region;region='';renderMarkers(queryRecords());region=selected;
 for(const el of $('map-markers').children)el.classList.toggle('active',el.getAttribute('aria-label')===`${region} 축제 보기`);
}
async function openDetail(f,source){
 if($('detail').open)return;lastDetailFocus=source||document.activeElement;
 const start=source?.getBoundingClientRect();const dialog=$('detail');
 $('detail-content').innerHTML=`<div class="detail-sheet"><h2 id="detail-title">${escapeHTML(f.name)}</h2><p>${escapeHTML(f.desc||'아직 등록된 설명이 없습니다.')}</p></div>`;
 dialog.setAttribute('aria-labelledby','detail-title');dialog.showModal();
 if(reduced||!start||!start.width||!start.height)return;
 dialog.classList.add('is-opening');
 const target=dialog.getBoundingClientRect(),flight=document.createElement('div');flight.className='flip-flight';flight.setAttribute('aria-hidden','true');
 const front=document.createElement('div');front.className='flip-front';const src=imageFor(f);if(src){const img=new Image();img.src=src;img.alt='';front.append(img);}const back=document.createElement('div');back.className='flip-back';flight.append(front,back);dialog.append(flight);
 Object.assign(flight.style,{left:`${target.left}px`,top:`${target.top}px`,width:`${target.width}px`,height:`${target.height}px`});
 const dx=start.left+start.width/2-target.left-target.width/2,dy=start.top+start.height/2-target.top-target.height/2;
 const sx=start.width/target.width,sy=start.height/target.height;
 detailAnimation=flight.animate([{transform:`perspective(1400px) translate(${dx}px,${dy}px) scale(${sx},${sy}) rotateY(0deg)`},{transform:'perspective(1400px) translate(0,0) scale(1,1) rotateY(180deg)'}],{duration:680,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});
 try{await detailAnimation.finished;}catch{}finally{flight.remove();dialog.classList.remove('is-opening');detailAnimation=null;}
}
function cancelPick(){picking=false;$('pick-hint').hidden=true;$('korea-stage').classList.remove('picking');}
async function startRegistration(){
 await enterKorea();if(!entered)return;region='';$('search').value='';renderList();picking=true;pendingLocation=null;$('pick-hint').hidden=false;$('korea-stage').classList.add('picking');$('korea-stage').scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
}
function setLocation(coords,label='한국'){
 pendingLocation={lng:coords[0],lat:coords[1],region:label};cancelPick();$('register').showModal();
}
$('cancel-pick').onclick=cancelPick;
$('korea-map').addEventListener('click',e=>{
 if(!picking||!e.target.closest('#korea-land'))return;
 const point=$('korea-map').createSVGPoint();point.x=e.clientX;point.y=e.clientY;const matrix=$('korea-map').getScreenCTM();if(!matrix)return;const p=point.matrixTransform(matrix.inverse());
 const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));const minY=merc(33),maxY=merc(38.8),scale=Math.min(390/(7.6*Math.PI/180),470/(maxY-minY));
 const lng=128.1+(p.x-230)/scale*180/Math.PI,lat=(2*Math.atan(Math.exp((325-p.y)/scale+(minY+maxY)/2))-Math.PI/2)*180/Math.PI;
 const nearest=allFestivals().map(f=>({f,d:Math.hypot((f.lng-lng)*.8,f.lat-lat)})).sort((a,b)=>a.d-b.d)[0];
 if(lat>=33&&lat<=39&&lng>=124&&lng<=132)setLocation([lng,lat],nearest&&nearest.d<.6?nearest.f.region:'한국');
});
function resetForm(){photoData='';photoBusy=false;$('register-form').reset();$('image-preview').hidden=true;$('image-preview').removeAttribute('src');$('upload-hint').hidden=false;$('form-error').textContent='';$('register-submit').disabled=false;}
async function readPhoto(file){
 if(!file)return;const valid=['image/jpeg','image/png','image/webp'];if(!valid.includes(file.type)||file.size>12*1024*1024)throw Error('JPG·PNG·WebP 사진을 12MB 이하로 올려주세요.');
 const bitmap=await createImageBitmap(file);try{const c=document.createElement('canvas');const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));const context=c.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,c.width,c.height);context.drawImage(bitmap,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78);}finally{bitmap.close();}
}
$('image-file').onchange=async()=>{photoBusy=true;$('register-submit').disabled=true;$('form-error').textContent='';try{photoData=await readPhoto($('image-file').files[0])||'';$('image-preview').src=photoData;$('image-preview').hidden=!photoData;$('upload-hint').hidden=!!photoData;}catch(error){photoData='';$('image-preview').hidden=true;$('upload-hint').hidden=false;$('form-error').textContent=error.message;}finally{photoBusy=false;$('register-submit').disabled=false;}};
$('register-form').onsubmit=async e=>{
 e.preventDefault();if(photoBusy)return;const data=new FormData(e.target);
 if(!pendingLocation){$('form-error').textContent='지도에서 축제 위치를 먼저 선택해주세요.';return;}
 const f={id:crypto.randomUUID(),custom:true,country:'KR',name:String(data.get('name')).trim(),desc:String(data.get('desc')).trim(),...pendingLocation,image:photoData};
 if(!f.name||!f.desc){$('form-error').textContent='축제명과 설명을 입력해주세요.';return;}
 if(!photoData){$('form-error').textContent='축제 포스터를 한 장 올려주세요.';return;}
 try{persist([f,...custom]);}catch{$('form-error').textContent='브라우저에 저장하지 못했습니다. 저장 공간을 확인해주세요.';return;}
 $('register').close();resetForm();pendingLocation=null;region='';$('search').value='';renderList();notify('이 브라우저에 축제를 등록했습니다.');
};
$('register-open').onclick=startRegistration;$('register-close').onclick=()=>$('register').close();$('detail-close').onclick=()=>$('detail').close();$('detail').addEventListener('close',()=>{detailAnimation?.cancel();if(lastDetailFocus?.isConnected)lastDetailFocus.focus();});
for(const id of['register','detail'])$(id).addEventListener('click',e=>{if(e.target!==$(id))return;const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();});
$('home').onclick=e=>{e.preventDefault();if(!entering)showHome();};$('back').onclick=showHome;$('korea-entry').onclick=enterKorea;$('all-regions').onclick=()=>{region='';renderList();};
$('search-form').onsubmit=e=>{e.preventDefault();region='';enterKorea();};let searchTimer;$('search').oninput=()=>{region='';clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(entered)renderList();else if($('search').value.trim())enterKorea();},180);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picking)cancelPick();if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('register').open&&!$('detail').open){e.preventDefault();$('search').focus();}});
canvas.onpointerdown=e=>{if(entering||entered||!projection)return;canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,rotation:rotation.slice(),moved:false};};
canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;rotation=[drag.rotation[0]+dx*.3,Math.max(-80,Math.min(80,drag.rotation[1]-dy*.3)),0];projection.rotate(rotation);schedulePaint();};
canvas.onpointerup=e=>{if(!drag)return;const wasMoved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(wasMoved||!projection)return;const rect=canvas.getBoundingClientRect();const p=[e.clientX-rect.left,e.clientY-rect.top];const center=projection.translate();if(Math.hypot(p[0]-center[0],p[1]-center[1])>projection.scale())return;const coords=projection.invert(p);const korea=world.find(f=>f.k);if(coords&&korea&&d3.geoContains(korea.geometry,coords))enterKorea();};
canvas.onpointercancel=()=>drag=null;
canvas.onkeydown=e=>{if(entered||entering||!projection)return;if(e.key==='Enter'){e.preventDefault();enterKorea();return;}const changes={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,8],ArrowDown:[0,-8]};if(changes[e.key]){e.preventDefault();rotation[0]+=changes[e.key][0];rotation[1]=Math.max(-80,Math.min(80,rotation[1]+changes[e.key][1]));projection.rotate(rotation);schedulePaint();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedulePaint();});new ResizeObserver(resize).observe($('globe-stage'));loadLocal();initGlobe();
