(() => {
'use strict';
const $=id=>document.getElementById(id);
const num=id=>parseFloat($(id)?.value)||0;
const integer=id=>Math.max(1,Math.floor(num(id)||1));
const fmt=(v,d=0)=>new Intl.NumberFormat('ar-EG',{maximumFractionDigits:d}).format(Number.isFinite(+v)?+v:0);
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const STORE_Q='barrelShare.quotes.v4', STORE_S='barrelShare.settings.v4';
const SETTINGS=['shippingCost','barrelResale','safetyBuffer','sharesPerBarrel','sharePrice','sarToSdg','barrelWeight','barrelVolume','minSaving','ownerWeight','ownerVolume','reserveWeight','reserveVolume','pickupPoint'];
let products=[],editing=null;

const blank=()=>({id:uid('P'),name:'',url:'',qty:1,saudiPrice:0,sudanPrice:0,unitWeight:0,unitVolume:0});
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quotes=()=>{try{return JSON.parse(localStorage.getItem(STORE_Q)||'[]')}catch{return[]}};
function setQuotes(v){localStorage.setItem(STORE_Q,JSON.stringify(v));renderHistory();renderKpis()}

function selectOrOther(selectId,inputId,value){
  const s=$(selectId),i=$(inputId); if(!s||!i)return;
  const has=[...s.options].some(o=>o.value===String(value)&&o.value!=='other');
  s.value=has?String(value):'other'; i.value=value;
  i.classList.toggle('show',s.value==='other');
}
function bindSelectOther(selectId,inputId,onChange){
  const s=$(selectId),i=$(inputId); if(!s||!i)return;
  s.addEventListener('change',()=>{i.classList.toggle('show',s.value==='other');if(s.value!=='other')i.value=s.value;onChange?.()});
  i.addEventListener('input',()=>onChange?.());
}

function saveSettings(){const s={};SETTINGS.forEach(x=>s[x]=$(x).value);s.autoSharePrice=$('autoSharePrice').checked;localStorage.setItem(STORE_S,JSON.stringify(s))}
function loadSettings(){try{const s=JSON.parse(localStorage.getItem(STORE_S)||'{}');SETTINGS.forEach(x=>{if(s[x]!==undefined)$(x).value=s[x]});if(s.autoSharePrice!==undefined)$('autoSharePrice').checked=!!s.autoSharePrice}catch{}}
function suggested(){return Math.max(0,(num('shippingCost')-num('barrelResale')+num('safetyBuffer'))/integer('sharesPerBarrel'))}
function capacity(){const d=integer('sharesPerBarrel');return{kg:Math.max(0,num('barrelWeight')-num('ownerWeight')-num('reserveWeight'))/d,l:Math.max(0,num('barrelVolume')-num('ownerVolume')-num('reserveVolume'))/d}}
function calc(){
  const shares=integer('customerShares'),c=capacity();
  const productsSar=products.reduce((s,p)=>s+p.qty*p.saudiPrice,0),sudan=products.reduce((s,p)=>s+p.qty*p.sudanPrice,0),weight=products.reduce((s,p)=>s+p.qty*p.unitWeight,0),volume=products.reduce((s,p)=>s+p.qty*p.unitVolume,0);
  const shipping=shares*num('sharePrice'),total=productsSar+shipping,landed=total*num('sarToSdg'),saving=sudan-landed,pct=sudan?saving/sudan*100:0,kgCap=c.kg*shares,lCap=c.l*shares;
  const weightKnown=products.some(p=>p.unitWeight>0),volumeKnown=products.some(p=>p.unitVolume>0),ok=(!weightKnown||weight<=kgCap)&&(!volumeKnown||volume<=lCap);
  return{shares,c,productsSar,sudan,weight,volume,shipping,total,landed,saving,pct,kgCap,lCap,ok,good:sudan>0&&saving>0&&pct>=num('minSaving')&&ok,barrels:Math.ceil(shares/integer('sharesPerBarrel'))};
}

function quantityControl(p){
  const common=[1,2,3,4,5,6,10,12,24]; const current=String(p.qty||1),known=common.map(String).includes(current);
  return `<select data-qsel>${common.map(v=>`<option value="${v}" ${String(v)===current?'selected':''}>${v}</option>`).join('')}<option value="other" ${known?'':'selected'}>أخرى…</option></select><input data-f="qty" class="conditional ${known?'':'show'}" type="number" min="1" step="1" value="${p.qty||1}" inputmode="numeric">`;
}
function renderProducts(){
  const w=$('productsContainer');w.innerHTML='';
  products.forEach((p,i)=>{
    const d=document.createElement('details'); d.className='product-card'; d.open=products.length===1||i===products.length-1;
    d.innerHTML=`<summary><div class="product-title"><strong>${i+1}) ${esc(p.name||'منتج جديد')}</strong><small>${p.saudiPrice?fmt(p.saudiPrice,2)+' ر.س للوحدة':'أدخل السعر للمقارنة'}</small></div><span class="product-chip">× ${fmt(p.qty)}</span></summary>
    <div class="product-body">
      <div class="product-basic"><label>اسم المنتج<input data-f="name" value="${esc(p.name)}" placeholder="مثال: حليب Anchor 1.8 كجم"></label><label>الكمية${quantityControl(p)}</label></div>
      <div class="price-row"><label>سعر الوحدة في السعودية (ر.س)<input data-f="saudiPrice" type="number" min="0" step=".01" value="${p.saudiPrice||''}" inputmode="decimal"></label><label>سعر الوحدة في السودان (ج.س)<input data-f="sudanPrice" type="number" min="0" step="1" value="${p.sudanPrice||''}" inputmode="numeric"></label></div>
      <details class="product-more"><summary>تفاصيل إضافية: الرابط والوزن والحجم</summary><div class="form-grid two"><label class="span-two">رابط الشراء<input data-f="url" value="${esc(p.url)}" placeholder="https://..."></label><label>وزن الوحدة (كجم)<input data-f="unitWeight" type="number" min="0" step=".01" value="${p.unitWeight||''}" inputmode="decimal"></label><label>حجم الوحدة (لتر)<input data-f="unitVolume" type="number" min="0" step=".1" value="${p.unitVolume||''}" inputmode="decimal"></label></div></details>
      <div class="remove-row"><button class="btn danger compact" data-del>حذف المنتج</button></div>
    </div>`;
    d.querySelectorAll('[data-f]').forEach(x=>x.addEventListener('input',e=>{const k=e.target.dataset.f;p[k]=['name','url'].includes(k)?e.target.value:(parseFloat(e.target.value)||0);update();updateProductHeader(d,p,i)}));
    const qsel=d.querySelector('[data-qsel]'),qinput=d.querySelector('[data-f="qty"]');
    qsel.addEventListener('change',()=>{qinput.classList.toggle('show',qsel.value==='other');if(qsel.value!=='other'){qinput.value=qsel.value;p.qty=+qsel.value;update();updateProductHeader(d,p,i)}});
    d.querySelector('[data-del]').onclick=e=>{e.preventDefault();if(products.length===1){products=[blank()]}else products=products.filter(x=>x.id!==p.id);renderProducts();update()};
    w.appendChild(d);
  });
  $('productsCount').textContent=`${fmt(products.length)} ${products.length===1?'منتج':'منتجات'}`;
}
function updateProductHeader(d,p,i){const title=d.querySelector('.product-title strong'),small=d.querySelector('.product-title small'),chip=d.querySelector('.product-chip');title.textContent=`${i+1}) ${p.name||'منتج جديد'}`;small.textContent=p.saudiPrice?`${fmt(p.saudiPrice,2)} ر.س للوحدة`:'أدخل السعر للمقارنة';chip.textContent=`× ${fmt(p.qty)}`}

function whatsapp(){
  const c=calc(),name=$('customerName').value.trim(),a=[`السلام عليكم${name?' '+name:''} 🌹`,'','حسبت ليك الطلب من السعودية إلى ود مدني:',''];
  products.filter(p=>p.name||p.saudiPrice||p.sudanPrice).forEach((p,i)=>{a.push(`${i+1}) ${p.name||'المنتج'}`,`الكمية: ${fmt(p.qty)}`,`سعر الوحدة في السعودية: ${fmt(p.saudiPrice,2)} ر.س`);if(p.url)a.push(`الرابط: ${p.url}`);a.push('')});
  a.push(`عدد الحصص: ${fmt(c.shares)}`,`قيمة المنتجات: ${fmt(c.productsSar,2)} ر.س`,`رسوم الحصص: ${fmt(c.shipping,2)} ر.س`,`الإجمالي: ${fmt(c.total,2)} ر.س ≈ ${fmt(c.landed)} ج.س`);
  if(c.sudan){a.push(`سعر نفس الكمية في السودان: ${fmt(c.sudan)} ج.س`,`التوفير: ${fmt(c.saving)} ج.س (${fmt(c.pct,1)}%)`,'',c.good?'✅ النتيجة: يستاهل الشحن حسب الأرقام الحالية.':c.saving>0?`⚠️ يوجد توفير، لكنه أقل من ${fmt(num('minSaving'))}%؛ لذلك لا أنصح بالشحن حاليًا.`:'❌ الشراء في السودان أوفر حسب الأرقام الحالية.')}
  a.push('',`الحساب على صرف: 1 ريال = ${fmt(num('sarToSdg'))} ج.س.`,`سعة الحصة الحالية: ${fmt(c.c.kg,1)} كجم / ${fmt(c.c.l,1)} لتر.`,`الاستلام: ${$('pickupPoint').value}.`,'السعر النهائي يتأكد وقت الشراء وبعد تثبيت شروط شركة الشحن.');return a.join('\n');
}

function update(save=true){
  if($('autoSharePrice').checked)$('sharePrice').value=suggested().toFixed(2);
  if(save)saveSettings();const c=calc();
  $('productsTotalSar').textContent=`${fmt(c.productsSar,2)} ر.س`;$('shippingTotalSar').textContent=`${fmt(c.shipping,2)} ر.س`;$('landedTotalSdg').textContent=`${fmt(c.landed)} ج.س`;$('sudanTotalSdg').textContent=`${fmt(c.sudan)} ج.س`;
  $('weightLabel').textContent=`${fmt(c.weight,1)} / ${fmt(c.kgCap,1)} كجم`;$('volumeLabel').textContent=`${fmt(c.volume,1)} / ${fmt(c.lCap,1)} لتر`;
  const wp=Math.min(100,c.kgCap?c.weight/c.kgCap*100:0),vp=Math.min(100,c.lCap?c.volume/c.lCap*100:0);$('weightBar').style.width=`${wp}%`;$('volumeBar').style.width=`${vp}%`;$('weightBar').classList.toggle('over',c.weight>c.kgCap);$('volumeBar').classList.toggle('over',c.volume>c.lCap);
  const box=$('decisionBox');if(!c.ok){box.className='decision bad';box.textContent='⚠️ الطلب أكبر من سعة الحصص المختارة.'}else if(!c.sudan){box.className='decision neutral';box.textContent='أدخل سعر السعودية وسعر السودان للمقارنة.'}else if(c.good){box.className='decision good';box.textContent=`✅ مناسب للشحن — توفير ${fmt(c.pct,1)}%`}else if(c.saving>0){box.className='decision warn';box.textContent=`⚠️ يوجد توفير ${fmt(c.pct,1)}% لكنه أقل من الحد`}else{box.className='decision bad';box.textContent='❌ غير مناسب — الشراء في السودان أوفر'};
  $('decisionDetails').textContent=c.sudan?`التوفير ${fmt(c.saving)} ج.س · ${fmt(c.shares)} حصة · يحتاج ${fmt(c.barrels)} ${c.barrels===1?'برميل':'براميل'}`:'';
  $('customerSharesHint').textContent=`الحصة الآن ≈ ${fmt(c.c.kg,1)} كجم / ${fmt(c.c.l,1)} لتر · الطلب يحتاج ${fmt(c.barrels)} ${c.barrels===1?'برميل':'براميل'}.`;
  $('settingsSummary').innerHTML=`سعة الحصة الآن <strong>${fmt(c.c.kg,1)} كجم / ${fmt(c.c.l,1)} لتر</strong> · السعر المقترح <strong>${fmt(suggested(),2)} ر.س</strong>.`;
  $('whatsappMessage').value=whatsapp();renderKpis();
}

function snapshot(){const c=calc(),old=editing?quotes().find(x=>x.quoteId===editing):null;return{quoteId:editing||uid('Q'),customerId:old?.customerId||uid('C'),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),customerName:$('customerName').value,customerPhone:$('customerPhone').value,recipientName:$('recipientName').value,recipientPhone:$('recipientPhone').value,pickupPoint:$('pickupPoint').value,notes:$('customerNote').value,status:$('quoteStatus').value,shares:c.shares,sharesPerBarrel:integer('sharesPerBarrel'),perShareWeightKg:c.c.kg,perShareVolumeL:c.c.l,barrelsForQuote:c.barrels,sharePriceSar:num('sharePrice'),shippingSar:c.shipping,productsTotalSar:c.productsSar,totalSar:c.total,sarToSdg:num('sarToSdg'),landedTotalSdg:c.landed,sudanMarketTotalSdg:c.sudan,savingSdg:c.saving,savingPercent:c.pct,decision:c.good?'مناسب':c.saving>0?'توفير ضعيف':'غير مناسب',totalWeightKg:c.weight,totalVolumeL:c.volume,products:JSON.parse(JSON.stringify(products))}}
function saveQuote(){const s=snapshot(),q=quotes(),i=q.findIndex(x=>x.quoteId===s.quoteId);if(i>=0)q[i]=s;else q.unshift(s);editing=s.quoteId;setQuotes(q);const b=$('saveQuoteBtn'),t=b.textContent;b.textContent='تم الحفظ ✓';b.classList.add('flash');setTimeout(()=>{b.textContent=t;b.classList.remove('flash')},1000)}
function reset(){editing=null;['customerName','customerPhone','recipientName','recipientPhone','customerNote'].forEach(x=>$(x).value='');$('quoteStatus').value='جديد';selectOrOther('customerSharesSelect','customerShares',1);products=[blank()];renderProducts();update(false);showTab('order')}
function openQuote(id){const q=quotes().find(x=>x.quoteId===id);if(!q)return;editing=id;$('customerName').value=q.customerName||'';$('customerPhone').value=q.customerPhone||'';$('recipientName').value=q.recipientName||'';$('recipientPhone').value=q.recipientPhone||'';$('customerNote').value=q.notes||'';$('quoteStatus').value=q.status||'جديد';selectOrOther('customerSharesSelect','customerShares',q.shares||1);if(q.pickupPoint){$('pickupPoint').value=q.pickupPoint;selectOrOther('pickupPointSelect','pickupPoint',q.pickupPoint)}products=q.products?.length?q.products.map(p=>({...p,id:p.id||uid('P')})):[blank()];renderProducts();update(false);showTab('order');window.scrollTo({top:0,behavior:'smooth'})}

function renderHistory(){const t=$('historySearch').value.toLowerCase(),rows=quotes().filter(x=>!t||`${x.customerName} ${x.customerPhone} ${(x.products||[]).map(p=>p.name).join(' ')}`.toLowerCase().includes(t)),w=$('historyContainer');if(!rows.length){w.innerHTML='<div class="empty">لا توجد عروض محفوظة بعد.</div>';return}w.innerHTML=rows.map(x=>`<div class="history-row"><div><strong>${esc(x.customerName||'بدون اسم')}</strong><small>${esc(x.customerPhone||'')}</small></div><div><strong>${fmt(x.shares)} حصة</strong><small>${fmt(x.landedTotalSdg)} ج.س</small></div><div><span class="status ${x.status==='مدفوع'?'paid':x.status==='ملغي'?'cancelled':''}">${esc(x.status||'جديد')}</span></div><div><strong>${esc(x.decision||'')}</strong><small>${fmt(x.savingPercent,1)}%</small></div><div class="history-actions"><button class="btn secondary compact" data-open="${x.quoteId}">فتح</button><button class="btn danger compact" data-del="${x.quoteId}">حذف</button></div></div>`).join('');w.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openQuote(b.dataset.open));w.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>setQuotes(quotes().filter(x=>x.quoteId!==b.dataset.del)))}
function renderKpis(){const q=quotes(),active=q.filter(x=>x.status!=='ملغي').reduce((s,x)=>s+(+x.shares||0),0);$('activeSharesKpi').textContent=fmt(active);$('barrelsNeededKpi').textContent=fmt(Math.ceil(active/integer('sharesPerBarrel')));$('quotesKpi').textContent=fmt(q.length);$('sharePriceKpi').textContent=`${fmt(num('sharePrice'),2)} ر.س`}

function exportExcel(){if(typeof XLSX==='undefined'){alert('تعذر تحميل مكتبة Excel');return}const q=quotes();const settings=[['الإعداد','القيمة'],['ShippingCostSAR',num('shippingCost')],['BarrelVolumeL',num('barrelVolume')],['BarrelMaxWeightKg',num('barrelWeight')],['OwnerReservedWeightKg',num('ownerWeight')],['OwnerReservedVolumeL',num('ownerVolume')],['PackingReserveWeightKg',num('reserveWeight')],['PackingReserveVolumeL',num('reserveVolume')],['SharesPerBarrel',integer('sharesPerBarrel')],['ExpectedBarrelResaleSAR',num('barrelResale')],['SafetyBufferSAR',num('safetyBuffer')],['SharePriceSAR',num('sharePrice')],['AutoSharePrice',$('autoSharePrice').checked?'TRUE':'FALSE'],['SARToSDG',num('sarToSdg')],['MinimumSavingPercent',num('minSaving')],['PickupPoint',$('pickupPoint').value]];
const customers=[['CustomerID','CustomerName','WhatsApp','RecipientName','RecipientPhone','PickupPoint','Notes'],...q.map(x=>[x.customerId,x.customerName,x.customerPhone,x.recipientName,x.recipientPhone,x.pickupPoint,x.notes])];
const qq=[['QuoteID','CustomerID','CreatedAt','Shares','SharesPerBarrel','PerShareWeightKg','PerShareVolumeL','BarrelsForQuote','SharePriceSAR','ShippingSAR','ProductsTotalSAR','TotalSAR','SARToSDG','LandedTotalSDG','SudanMarketTotalSDG','SavingSDG','SavingPercent','Decision','Status','TotalWeightKg','TotalVolumeL'],...q.map(x=>[x.quoteId,x.customerId,x.createdAt,x.shares,x.sharesPerBarrel,x.perShareWeightKg,x.perShareVolumeL,x.barrelsForQuote,x.sharePriceSar,x.shippingSar,x.productsTotalSar,x.totalSar,x.sarToSdg,x.landedTotalSdg,x.sudanMarketTotalSdg,x.savingSdg,x.savingPercent,x.decision,x.status,x.totalWeightKg,x.totalVolumeL])];
const pp=[['QuoteID','ProductName','ProductURL','Quantity','SaudiUnitPriceSAR','SudanUnitPriceSDG','UnitWeightKg','UnitVolumeL'],...q.flatMap(x=>(x.products||[]).map(p=>[x.quoteId,p.name,p.url,p.qty,p.saudiPrice,p.sudanPrice,p.unitWeight,p.unitVolume]))];
const wb=XLSX.utils.book_new();[['Settings',settings],['Customers',customers],['Quotes',qq],['Products',pp]].forEach(([name,data])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),name));XLSX.writeFile(wb,'barrel-share-data.xlsx')}

function showTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`));if(name==='history')renderHistory();window.scrollTo({top:0,behavior:'smooth'})}
function init(){
  loadSettings();products=[blank()];
  selectOrOther('customerSharesSelect','customerShares',num('customerShares')||1);selectOrOther('sharesPerBarrelSelect','sharesPerBarrel',num('sharesPerBarrel'));selectOrOther('minSavingSelect','minSaving',num('minSaving'));selectOrOther('pickupPointSelect','pickupPoint',$('pickupPoint').value);
  bindSelectOther('customerSharesSelect','customerShares',()=>update());bindSelectOther('sharesPerBarrelSelect','sharesPerBarrel',()=>update());bindSelectOther('minSavingSelect','minSaving',()=>update());bindSelectOther('pickupPointSelect','pickupPoint',()=>update());
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  $('goResultBtn').onclick=()=>{update();showTab('result')};$('editOrderBtn').onclick=()=>showTab('order');$('newQuoteBtn').onclick=reset;$('addProductBtn').onclick=()=>{products.push(blank());renderProducts();update();requestAnimationFrame(()=>document.querySelector('.product-card:last-child')?.scrollIntoView({behavior:'smooth',block:'center'}))};
  $('copyMessageBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('whatsappMessage').value);$('copyMessageBtn').textContent='تم النسخ ✓';setTimeout(()=>$('copyMessageBtn').textContent='نسخ الرسالة',1000)}catch{$('whatsappMessage').select();document.execCommand('copy')}};
  $('openWhatsappBtn').onclick=()=>{const phone=$('customerPhone').value.replace(/\D/g,''),text=encodeURIComponent($('whatsappMessage').value);window.open(phone?`https://wa.me/${phone}?text=${text}`:`https://wa.me/?text=${text}`,'_blank')};
  $('saveQuoteBtn').onclick=saveQuote;$('historySearch').oninput=renderHistory;$('exportBtn').onclick=exportExcel;$('importBtn').onclick=()=>$('excelFile').click();
  SETTINGS.forEach(id=>$(id)?.addEventListener('input',()=>update()));$('autoSharePrice').onchange=()=>update();['customerName','customerPhone','recipientName','recipientPhone','customerNote','quoteStatus'].forEach(id=>$(id)?.addEventListener('input',()=>update()));
  renderProducts();update(false);renderHistory();
}
window.addEventListener('DOMContentLoaded',init);
})();
