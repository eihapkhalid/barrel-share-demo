(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = (n,d=0) => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:d}).format(Number.isFinite(+n)?+n:0);
  const n = id => parseFloat($(id).value) || 0;
  const int = id => Math.max(1, Math.floor(n(id) || 1));
  const uid = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const STORAGE = { settings:'barrelShare.settings.v3', quotes:'barrelShare.quotes.v3' };
  const settingsIds = ['shippingCost','barrelResale','safetyBuffer','sharesPerBarrel','sharePrice','sarToSdg','barrelWeight','barrelVolume','minSaving','ownerWeight','ownerVolume','reserveWeight','reserveVolume','pickupPoint'];
  const priceDrivers = ['shippingCost','barrelResale','safetyBuffer','sharesPerBarrel'];
  let products = [];
  let editingId = null;

  const blankProduct = () => ({id:uid('P'),name:'',qty:1,saudiPrice:0,sudanPrice:0,unitWeight:0,unitVolume:0,url:''});
  const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function quotes(){ try{return JSON.parse(localStorage.getItem(STORAGE.quotes)||'[]')}catch{return[]} }
  function setQuotes(v){ localStorage.setItem(STORAGE.quotes,JSON.stringify(v)); renderHistory(); renderKpis(); }
  function saveSettings(){
    const v={}; settingsIds.forEach(id=>v[id]=$(id).value); v.autoSharePrice=$('autoSharePrice').checked;
    localStorage.setItem(STORAGE.settings,JSON.stringify(v));
  }
  function loadSettings(){
    try{
      const v=JSON.parse(localStorage.getItem(STORAGE.settings)||'{}');
      settingsIds.forEach(id=>{if(v[id]!==undefined) $(id).value=v[id]});
      if(v.autoSharePrice!==undefined) $('autoSharePrice').checked=!!v.autoSharePrice;
    }catch{}
  }

  function suggestedPrice(){ return Math.max(0,(n('shippingCost')-n('barrelResale')+n('safetyBuffer'))/int('sharesPerBarrel')); }
  function perShare(){
    const d=int('sharesPerBarrel');
    return {
      kg:Math.max(0,n('barrelWeight')-n('ownerWeight')-n('reserveWeight'))/d,
      l:Math.max(0,n('barrelVolume')-n('ownerVolume')-n('reserveVolume'))/d
    };
  }
  function calc(){
    const shares=int('customerShares'), cap=perShare();
    const productsSar=products.reduce((s,p)=>s+p.qty*p.saudiPrice,0);
    const sudanSdg=products.reduce((s,p)=>s+p.qty*p.sudanPrice,0);
    const weight=products.reduce((s,p)=>s+p.qty*p.unitWeight,0);
    const volume=products.reduce((s,p)=>s+p.qty*p.unitVolume,0);
    const shippingSar=shares*n('sharePrice');
    const totalSar=productsSar+shippingSar;
    const landedSdg=totalSar*n('sarToSdg');
    const saving=sudanSdg-landedSdg;
    const savingPct=sudanSdg>0?saving/sudanSdg*100:0;
    const kgCap=cap.kg*shares, lCap=cap.l*shares;
    const weightKnown=products.some(p=>p.unitWeight>0), volumeKnown=products.some(p=>p.unitVolume>0);
    const capacityOk=(!weightKnown||weight<=kgCap)&&(!volumeKnown||volume<=lCap);
    const viable=sudanSdg>0&&saving>0&&savingPct>=n('minSaving')&&capacityOk;
    return {shares,cap,productsSar,sudanSdg,weight,volume,shippingSar,totalSar,landedSdg,saving,savingPct,kgCap,lCap,capacityOk,viable,barrels:Math.ceil(shares/int('sharesPerBarrel'))};
  }

  function renderProducts(){
    const wrap=$('productsContainer'); wrap.innerHTML='';
    products.forEach((p,i)=>{
      const d=document.createElement('details'); d.className='product-card'; d.open=products.length===1||i===products.length-1;
      d.innerHTML=`<summary><span>${i+1}) ${esc(p.name||'منتج جديد')}</span><span class="product-summary">${fmt(p.qty)} × ${fmt(p.saudiPrice,2)} ر.س</span></summary>
      <div class="product-body"><div class="form-grid two">
      <label>اسم المنتج<input data-f="name" value="${esc(p.name)}" placeholder="مثال: Anchor Daily Plus 1.8kg"></label>
      <label>رابط الشراء<input data-f="url" value="${esc(p.url)}" placeholder="https://..."></label>
      <label>الكمية<input data-f="qty" type="number" min="1" step="1" value="${p.qty||1}"></label>
      <label>سعر الوحدة في السعودية (ر.س)<input data-f="saudiPrice" type="number" min="0" step="0.01" value="${p.saudiPrice||''}"></label>
      <label>سعر الوحدة في السودان (ج.س)<input data-f="sudanPrice" type="number" min="0" step="1" value="${p.sudanPrice||''}"></label>
      <label>وزن الوحدة (كجم) — اختياري<input data-f="unitWeight" type="number" min="0" step="0.01" value="${p.unitWeight||''}"></label>
      <label>حجم الوحدة التقريبي (لتر) — اختياري<input data-f="unitVolume" type="number" min="0" step="0.1" value="${p.unitVolume||''}"></label>
      <div style="display:flex;align-items:end"><button class="btn danger" data-remove style="width:100%">حذف المنتج</button></div>
      </div></div>`;
      d.querySelectorAll('[data-f]').forEach(input=>input.addEventListener('input',e=>{
        const k=e.target.dataset.f; p[k]=['name','url'].includes(k)?e.target.value:(parseFloat(e.target.value)||0); update(false);
        d.querySelector('summary span:first-child').textContent=`${i+1}) ${p.name||'منتج جديد'}`;
        d.querySelector('.product-summary').textContent=`${fmt(p.qty)} × ${fmt(p.saudiPrice,2)} ر.س`;
      }));
      d.querySelector('[data-remove]').onclick=e=>{e.preventDefault();products=products.filter(x=>x.id!==p.id);if(!products.length)products=[blankProduct()];renderProducts();update();};
      wrap.appendChild(d);
    });
    $('addProductBtn').disabled=products.length>=3;
  }

  function renderCalc(){
    const c=calc();
    $('productsTotalSar').textContent=`${fmt(c.productsSar,2)} ر.س`;
    $('shippingTotalSar').textContent=`${fmt(c.shippingSar,2)} ر.س`;
    $('landedTotalSdg').textContent=`${fmt(c.landedSdg)} ج.س`;
    $('sudanTotalSdg').textContent=`${fmt(c.sudanSdg)} ج.س`;
    $('weightLabel').textContent=`${fmt(c.weight,1)} / ${fmt(c.kgCap,1)} كجم`;
    $('volumeLabel').textContent=`${fmt(c.volume,1)} / ${fmt(c.lCap,1)} لتر`;
    const wp=c.kgCap?Math.min(100,c.weight/c.kgCap*100):0, vp=c.lCap?Math.min(100,c.volume/c.lCap*100):0;
    $('weightBar').style.width=`${wp}%`; $('volumeBar').style.width=`${vp}%`;
    $('weightBar').classList.toggle('over',c.weight>c.kgCap); $('volumeBar').classList.toggle('over',c.volume>c.lCap);
    const box=$('decisionBox');
    if(!c.capacityOk){ box.className='decision bad'; box.textContent='⚠️ الطلب يتجاوز سعة الحصص المختارة.'; }
    else if(c.sudanSdg<=0){ box.className='decision neutral'; box.textContent='أدخل سعر السعودية وسعر السودان للمنتجات.'; }
    else if(c.viable){ box.className='decision good'; box.textContent=`✅ مناسب — توفير تقريبي ${fmt(c.savingPct,1)}%`; }
    else if(c.saving>0){ box.className='decision warn'; box.textContent=`⚠️ التوفير ${fmt(c.savingPct,1)}% فقط — أقل من الحد ${fmt(n('minSaving'))}%`; }
    else { box.className='decision bad'; box.textContent='❌ غير مناسب — الشراء في السودان أوفر حسب الأرقام الحالية.'; }
    $('decisionDetails').textContent=c.sudanSdg>0?`التوفير: ${fmt(c.saving)} ج.س · طلب العميل يحتاج ${fmt(c.barrels)} ${c.barrels===1?'برميل':'براميل'} وفق التقسيم الحالي.`:'';
    $('customerSharesHint').textContent=`تقسيم البرميل الحالي: ${fmt(int('sharesPerBarrel'))} حصص · الحصة ≈ ${fmt(c.cap.kg,1)} كجم / ${fmt(c.cap.l,1)} لتر · طلب العميل يحتاج ${fmt(c.barrels)} ${c.barrels===1?'برميل':'براميل'}.`;
  }

  function message(){
    const c=calc(), name=$('customerName').value.trim(); const a=[];
    a.push(`السلام عليكم${name?' '+name:''} 🌹`,'','حسبت ليك الطلب من السعودية إلى ود مدني:','');
    products.filter(p=>p.name||p.saudiPrice||p.sudanPrice).forEach((p,i)=>{
      a.push(`${i+1}) ${p.name||'المنتج'}`,`الكمية: ${fmt(p.qty)}`,`سعر الوحدة في السعودية: ${fmt(p.saudiPrice,2)} ر.س`);
      if(p.url) a.push(`الرابط: ${p.url}`); a.push('');
    });
    a.push(`عدد الحصص: ${fmt(c.shares)}`,`قيمة المنتجات: ${fmt(c.productsSar,2)} ر.س`,`رسوم الحصص: ${fmt(c.shares)} × ${fmt(n('sharePrice'),2)} = ${fmt(c.shippingSar,2)} ر.س`,`الإجمالي: ${fmt(c.totalSar,2)} ر.س ≈ ${fmt(c.landedSdg)} ج.س`);
    if(c.sudanSdg>0){ a.push(`سعر نفس الكمية في السودان: ${fmt(c.sudanSdg)} ج.س`,`التوفير التقريبي: ${fmt(c.saving)} ج.س (${fmt(c.savingPct,1)}%)`,'',c.viable?'✅ النتيجة: يستاهل الشحن حسب الأرقام الحالية.':c.saving>0?`⚠️ النتيجة: يوجد توفير لكن أقل من ${fmt(n('minSaving'))}%، لذلك لا أنصح بالشحن حاليًا.`:'❌ النتيجة: ما أنصح بالشحن؛ الشراء في السودان أوفر حسب الأرقام الحالية.'); }
    a.push('',`الحساب على صرف: 1 ريال = ${fmt(n('sarToSdg'))} ج.س.`,`سعة الحصة الحالية تقريبًا: ${fmt(c.cap.kg,1)} كجم / ${fmt(c.cap.l,1)} لتر.`,`الاستلام: ${$('pickupPoint').value}.`,'السعر النهائي يتأكد وقت الشراء وبعد تثبيت شروط شركة الشحن.');
    return a.join('\n');
  }

  function renderSettings(){
    const cap=perShare(), suggested=suggestedPrice(), split=int('sharesPerBarrel');
    const margin=split*n('sharePrice')+n('barrelResale')-n('shippingCost');
    $('settingsSummary').innerHTML=`تقسيم البرميل: <strong>${fmt(split)} حصص</strong> · سعة الحصة: <strong>${fmt(cap.kg,1)} كجم / ${fmt(cap.l,1)} لتر</strong>.<br>سعر الحصة المقترح: <strong>${fmt(suggested,2)} ر.س</strong> · الفارق بعد اكتمال الحصص وبيع البرميل: <strong>${fmt(margin,2)} ر.س</strong>.`;
  }
  function renderKpis(){
    const q=quotes(), active=q.filter(x=>x.status!=='ملغي').reduce((s,x)=>s+(+x.shares||0),0);
    $('activeSharesKpi').textContent=fmt(active); $('barrelsNeededKpi').textContent=fmt(Math.ceil(active/int('sharesPerBarrel'))); $('quotesKpi').textContent=fmt(q.length); $('sharePriceKpi').textContent=`${fmt(n('sharePrice'),2)} ر.س`;
  }
  function update(save=true){ if(save)saveSettings(); renderCalc(); renderSettings(); renderKpis(); $('whatsappMessage').value=message(); }

  function snapshot(){
    const c=calc(), old=editingId?quotes().find(x=>x.quoteId===editingId):null;
    return {quoteId:editingId||uid('Q'),customerId:old?.customerId||uid('C'),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),customerName:$('customerName').value.trim(),customerPhone:$('customerPhone').value.trim(),recipientName:$('recipientName').value.trim(),recipientPhone:$('recipientPhone').value.trim(),pickupPoint:$('pickupPoint').value.trim(),notes:$('customerNote').value.trim(),status:$('quoteStatus').value,shares:c.shares,sharesPerBarrel:int('sharesPerBarrel'),perShareWeightKg:c.cap.kg,perShareVolumeL:c.cap.l,barrelsForQuote:c.barrels,sharePriceSar:n('sharePrice'),shippingSar:c.shippingSar,productsTotalSar:c.productsSar,totalSar:c.totalSar,sarToSdg:n('sarToSdg'),landedTotalSdg:c.landedSdg,sudanMarketTotalSdg:c.sudanSdg,savingSdg:c.saving,savingPercent:c.savingPct,decision:c.viable?'مناسب':c.saving>0?'توفير ضعيف':'غير مناسب',totalWeightKg:c.weight,totalVolumeL:c.volume,products:JSON.parse(JSON.stringify(products))};
  }
  function saveQuote(){ const s=snapshot(); let q=quotes(); const i=q.findIndex(x=>x.quoteId===s.quoteId); if(i>=0)q[i]=s;else q.unshift(s); editingId=s.quoteId;setQuotes(q);const b=$('saveQuoteBtn'),t=b.textContent;b.textContent='تم الحفظ ✓';setTimeout(()=>b.textContent=t,1000); }
  function newQuote(){ editingId=null; ['customerName','customerPhone','recipientName','recipientPhone','customerNote'].forEach(id=>$(id).value='');$('customerShares').value=1;$('quoteStatus').value='جديد';products=[blankProduct()];renderProducts();update(false); }
  function openQuote(id){ const q=quotes().find(x=>x.quoteId===id);if(!q)return;editingId=id;$('customerName').value=q.customerName||'';$('customerPhone').value=q.customerPhone||'';$('recipientName').value=q.recipientName||'';$('recipientPhone').value=q.recipientPhone||'';$('pickupPoint').value=q.pickupPoint||$('pickupPoint').value;$('customerNote').value=q.notes||'';$('customerShares').value=q.shares||1;$('quoteStatus').value=q.status||'جديد';products=(q.products||[]).map(p=>({...p,id:p.id||uid('P')}));if(!products.length)products=[blankProduct()];renderProducts();update(false);window.scrollTo({top:0,behavior:'smooth'}); }
  function removeQuote(id){ setQuotes(quotes().filter(x=>x.quoteId!==id));if(editingId===id)newQuote(); }
  function renderHistory(){
    const term=$('historySearch').value.trim().toLowerCase(); const rows=quotes().filter(q=>!term||`${q.customerName} ${q.customerPhone} ${(q.products||[]).map(p=>p.name).join(' ')}`.toLowerCase().includes(term));
    const w=$('historyContainer'); if(!rows.length){w.innerHTML='<div class="empty">لا توجد عروض محفوظة.</div>';return;}
    w.innerHTML=rows.map(q=>`<div class="history-row"><div><strong>${esc(q.customerName||'بدون اسم')}</strong><small>${esc(q.customerPhone||'')}</small></div><div><strong>${fmt(q.shares)} حصة</strong><small>${fmt(q.land edTotalSdg||0)} ج.س</small></div><div><span class="status ${q.status==='مدفوع'?'paid':q.status==='ملغي'?'cancelled':''}">${esc(q.status||'جديد')}</span></div><div><strong>${esc(q.decision||'')}</strong><small>${fmt(q.savingPercent||0,1)}%</small></div><div class="history-actions"><button class="btn secondary" data-open="${q.quoteId}">فتح</button><button class="btn danger" data-del="${q.quoteId}">حذف</button></div></div>`.replace('land edTotalSdg','landedTotalSdg')).join('');
    w.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openQuote(b.dataset.open)); w.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeQuote(b.dataset.del));
  }

  function exportExcel(){
    if(typeof XLSX==='undefined'){alert('تعذر تحميل مكتبة Excel.');return;}
    const q=quotes();
    const settings=[['الإعداد','القيمة','الوصف'],['ShippingCostSAR',n('shippingCost'),'تكلفة شحن البرميل'],['BarrelVolumeL',n('barrelVolume'),'حجم البرميل'],['BarrelMaxWeightKg',n('barrelWeight'),'أقصى وزن'],['OwnerReservedWeightKg',n('ownerWeight'),'وزنك الخاص'],['OwnerReservedVolumeL',n('ownerVolume'),'حجمك الخاص'],['PackingReserveWeightKg',n('reserveWeight'),'احتياط الوزن'],['PackingReserveVolumeL',n('reserveVolume'),'احتياط الحجم'],['SharesPerBarrel',int('sharesPerBarrel'),'عدد الحصص الديناميكي'],['ExpectedBarrelResaleSAR',n('barrelResale'),'بيع البرميل المتوقع'],['SafetyBufferSAR',n('safetyBuffer'),'هامش أمان'],['SharePriceSAR',n('sharePrice'),'سعر الحصة'],['AutoSharePrice',$('autoSharePrice').checked?'TRUE':'FALSE','تحديث السعر تلقائيًا'],['SARToSDG',n('sarToSdg'),'سعر الصرف'],['MinimumSavingPercent',n('minSaving'),'أقل توفير'],['PickupPoint',$('pickupPoint').value,'الاستلام']];
    const customers=[['CustomerID','CustomerName','WhatsApp','RecipientName','RecipientPhone','PickupPoint','Notes','LastUpdated'],...q.map(x=>[x.customerId,x.customerName,x.customerPhone,x.recipientName,x.recipientPhone,x.pickupPoint,x.notes,x.updatedAt])];
    const qr=[['QuoteID','CustomerID','CreatedAt','Shares','SharesPerBarrel','PerShareWeightKg','PerShareVolumeL','BarrelsForQuote','SharePriceSAR','ShippingSAR','ProductsTotalSAR','TotalSAR','SARToSDG','LandedTotalSDG','SudanMarketTotalSDG','SavingSDG','SavingPercent','Decision','TotalWeightKg','TotalVolumeL','Status'],...q.map(x=>[x.quoteId,x.customerId,x.createdAt,x.shares,x.sharesPerBarrel,x.perShareWeightKg,x.perShareVolumeL,x.barrelsForQuote,x.sharePriceSar,x.shippingSar,x.productsTotalSar,x.totalSar,x.sarToSdg,x.landedTotalSdg,x.sudanMarketTotalSdg,x.savingSdg,x.savingPercent,x.decision,x.totalWeightKg,x.totalVolumeL,x.status])];
    const pr=[['QuoteID','ProductName','Quantity','SaudiUnitPriceSAR','SudanUnitPriceSDG','UnitWeightKg','UnitVolumeL','ProductURL','SaudiLineTotalSAR','SudanLineTotalSDG'],...q.flatMap(x=>(x.products||[]).map(p=>[x.quoteId,p.name,p.qty,p.saudiPrice,p.sudanPrice,p.unitWeight,p.unitVolume,p.url,p.qty*p.saudiPrice,p.qty*p.sudanPrice]))];
    const active=q.filter(x=>x.status!=='ملغي').reduce((s,x)=>s+(+x.shares||0),0), cap=perShare();
    const dash=[['لوحة متابعة — حصة البرميل',''],['المؤشر','القيمة'],['عدد الحصص في البرميل',int('sharesPerBarrel')],['سعة الحصة — كجم',cap.kg],['سعة الحصة — لتر',cap.l],['سعر الحصة الحالي — ر.س',n('sharePrice')],['عدد العروض',q.length],['الحصص النشطة',active],['البراميل المطلوبة',Math.ceil(active/int('sharesPerBarrel'))]];
    const wb=XLSX.utils.book_new(); [['Settings',settings],['Customers',customers],['Quotes',qr],['Products',pr],['Dashboard',dash]].forEach(([name,rows])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name));
    XLSX.writeFile(wb,`barrel-share-${new Date().toISOString().slice(0,10)}.xlsx`);
  }
  function importExcel(file){
    if(typeof XLSX==='undefined'){alert('تعذر تحميل مكتبة Excel.');return;}
    const r=new FileReader(); r.onload=e=>{try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      if(wb.Sheets.Settings){ const rows=XLSX.utils.sheet_to_json(wb.Sheets.Settings,{header:1,defval:''}); const map=Object.fromEntries(rows.slice(1).filter(x=>x[0]).map(x=>[String(x[0]),x[1]])); const m={ShippingCostSAR:'shippingCost',BarrelVolumeL:'barrelVolume',BarrelMaxWeightKg:'barrelWeight',OwnerReservedWeightKg:'ownerWeight',OwnerReservedVolumeL:'ownerVolume',PackingReserveWeightKg:'reserveWeight',PackingReserveVolumeL:'reserveVolume',SharesPerBarrel:'sharesPerBarrel',ExpectedBarrelResaleSAR:'barrelResale',SafetyBufferSAR:'safetyBuffer',SharePriceSAR:'sharePrice',SARToSDG:'sarToSdg',MinimumSavingPercent:'minSaving',PickupPoint:'pickupPoint'};Object.entries(m).forEach(([k,id])=>{if(map[k]!==undefined)$(id).value=map[k]});if(map.AutoSharePrice!==undefined)$('autoSharePrice').checked=String(map.AutoSharePrice).toUpperCase()!=='FALSE'; }
      const qrows=wb.Sheets.Quotes?XLSX.utils.sheet_to_json(wb.Sheets.Quotes,{defval:''}):[], prows=wb.Sheets.Products?XLSX.utils.sheet_to_json(wb.Sheets.Products,{defval:''}):[], crows=wb.Sheets.Customers?XLSX.utils.sheet_to_json(wb.Sheets.Customers,{defval:''}):[];
      const cm=Object.fromEntries(crows.map(x=>[x.CustomerID,x])), pm={};prows.forEach(x=>(pm[x.QuoteID]||=[]).push({id:uid('P'),name:x.ProductName||'',qty:+x.Quantity||1,saudiPrice:+x.SaudiUnitPriceSAR||0,sudanPrice:+x.SudanUnitPriceSDG||0,unitWeight:+x.UnitWeightKg||0,unitVolume:+x.UnitVolumeL||0,url:x.ProductURL||''}));
      const data=qrows.map(x=>{const c=cm[x.CustomerID]||{};return{quoteId:x.QuoteID||uid('Q'),customerId:x.CustomerID||uid('C'),createdAt:x.CreatedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),customerName:c.CustomerName||'',customerPhone:c.WhatsApp||'',recipientName:c.RecipientName||'',recipientPhone:c.RecipientPhone||'',pickupPoint:c.PickupPoint||$('pickupPoint').value,notes:c.Notes||'',shares:+x.Shares||1,sharesPerBarrel:+x.SharesPerBarrel||int('sharesPerBarrel'),perShareWeightKg:+x.PerShareWeightKg||0,perShareVolumeL:+x.PerShareVolumeL||0,barrelsForQuote:+x.BarrelsForQuote||0,sharePriceSar:+x.SharePriceSAR||0,shippingSar:+x.ShippingSAR||0,productsTotalSar:+x.ProductsTotalSAR||0,totalSar:+x.TotalSAR||0,sarToSdg:+x.SARToSDG||0,landedTotalSdg:+x.LandedTotalSDG||0,sudanMarketTotalSdg:+x.SudanMarketTotalSDG||0,savingSdg:+x.SavingSDG||0,savingPercent:+x.SavingPercent||0,decision:x.Decision||'',totalWeightKg:+x.TotalWeightKg||0,totalVolumeL:+x.TotalVolumeL||0,status:x.Status||'جديد',products:pm[x.QuoteID]||[]}});
      saveSettings();setQuotes(data);newQuote();update();alert(`تم استيراد ${data.length} عرض بنجاح.`);
    }catch(err){console.error(err);alert('تعذر قراءة ملف Excel. استخدم ملفًا صادرًا من هذا التطبيق.');}};r.readAsArrayBuffer(file);
  }

  $('addProductBtn').onclick=()=>{if(products.length<3){products.push(blankProduct());renderProducts();update(false)}};
  $('copyMessageBtn').onclick=async()=>{try{await navigator.clipboard.writeText($('whatsappMessage').value)}catch{$('whatsappMessage').select();document.execCommand('copy')}};
  $('openWhatsappBtn').onclick=()=>{const phone=$('customerPhone').value.replace(/\D/g,''),text=encodeURIComponent($('whatsappMessage').value);window.open(phone?`https://wa.me/${phone}?text=${text}`:`https://wa.me/?text=${text}`,'_blank')};
  $('saveQuoteBtn').onclick=saveQuote; $('newQuoteBtn').onclick=newQuote; $('historySearch').oninput=renderHistory; $('exportBtn').onclick=exportExcel; $('importBtn').onclick=()=>$('excelFile').click(); $('excelFile').onchange=e=>{if(e.target.files[0])importExcel(e.target.files[0]);e.target.value=''};
  $('applySuggestedPriceBtn').onclick=()=>{$('autoSharePrice').checked=true;$('sharePrice').value=suggestedPrice().toFixed(2);update()};
  settingsIds.filter(id=>id!=='sharePrice').forEach(id=>{const h=()=>{if(priceDrivers.includes(id)&&$('autoSharePrice').checked)$('sharePrice').value=suggestedPrice().toFixed(2);if(id==='sharesPerBarrel')$(id).value=int(id);update()};$(id).addEventListener('input',h);$(id).addEventListener('change',h)});
  $('sharePrice').oninput=()=>{$('autoSharePrice').checked=false;update()}; $('autoSharePrice').onchange=()=>{if($('autoSharePrice').checked)$('sharePrice').value=suggestedPrice().toFixed(2);update()}; $('customerShares').onchange=()=>{$('customerShares').value=int('customerShares');update(false)};
  ['customerName','customerPhone','recipientName','recipientPhone','customerNote','customerShares','quoteStatus'].forEach(id=>{$(id).addEventListener('input',()=>update(false));$(id).addEventListener('change',()=>update(false))});

  loadSettings(); if($('autoSharePrice').checked)$('sharePrice').value=suggestedPrice().toFixed(2); products=[blankProduct()]; renderProducts(); renderHistory(); update(false);
})();
