(() => {
  'use strict';
  const fileInput = document.getElementById('excelFile');
  if (!fileInput) return;
  fileInput.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { alert('تعذر تحميل مكتبة Excel.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type:'array' });
        const settingsRows = wb.Sheets.Settings ? XLSX.utils.sheet_to_json(wb.Sheets.Settings,{header:1,defval:''}) : [];
        const rawSettings = Object.fromEntries(settingsRows.slice(1).filter(r=>r[0]).map(r=>[String(r[0]),r[1]]));
        const map = {
          ShippingCostSAR:'shippingCost', BarrelVolumeL:'barrelVolume', BarrelMaxWeightKg:'barrelWeight',
          OwnerReservedWeightKg:'ownerWeight', OwnerReservedVolumeL:'ownerVolume', PackingReserveWeightKg:'reserveWeight',
          PackingReserveVolumeL:'reserveVolume', SharesPerBarrel:'sharesPerBarrel', ExpectedBarrelResaleSAR:'barrelResale',
          SafetyBufferSAR:'safetyBuffer', SharePriceSAR:'sharePrice', SARToSDG:'sarToSdg',
          MinimumSavingPercent:'minSaving', PickupPoint:'pickupPoint'
        };
        const settings = {};
        Object.entries(map).forEach(([key,id]) => { if (rawSettings[key] !== undefined) settings[id] = String(rawSettings[key]); });
        settings.autoSharePrice = String(rawSettings.AutoSharePrice ?? 'TRUE').toUpperCase() !== 'FALSE';

        const customers = wb.Sheets.Customers ? XLSX.utils.sheet_to_json(wb.Sheets.Customers,{defval:''}) : [];
        const quoteRows = wb.Sheets.Quotes ? XLSX.utils.sheet_to_json(wb.Sheets.Quotes,{defval:''}) : [];
        const productRows = wb.Sheets.Products ? XLSX.utils.sheet_to_json(wb.Sheets.Products,{defval:''}) : [];
        const customerMap = Object.fromEntries(customers.map(r=>[r.CustomerID,r]));
        const productMap = {};
        productRows.forEach(r => {
          (productMap[r.QuoteID] ||= []).push({
            id:`P-${Math.random().toString(36).slice(2)}`, name:r.ProductName||'', url:r.ProductURL||'',
            qty:+r.Quantity||1, saudiPrice:+r.SaudiUnitPriceSAR||0, sudanPrice:+r.SudanUnitPriceSDG||0,
            unitWeight:+r.UnitWeightKg||0, unitVolume:+r.UnitVolumeL||0
          });
        });
        const quotes = quoteRows.map(r => {
          const c = customerMap[r.CustomerID] || {};
          return {
            quoteId:r.QuoteID||`Q-${Math.random().toString(36).slice(2)}`, customerId:r.CustomerID||`C-${Math.random().toString(36).slice(2)}`,
            createdAt:r.CreatedAt||new Date().toISOString(), updatedAt:new Date().toISOString(),
            customerName:c.CustomerName||'', customerPhone:c.WhatsApp||'', recipientName:c.RecipientName||'', recipientPhone:c.RecipientPhone||'',
            pickupPoint:c.PickupPoint||settings.pickupPoint||'', notes:c.Notes||'', status:r.Status||'جديد',
            shares:+r.Shares||1, sharesPerBarrel:+r.SharesPerBarrel||+settings.sharesPerBarrel||2,
            perShareWeightKg:+r.PerShareWeightKg||0, perShareVolumeL:+r.PerShareVolumeL||0, barrelsForQuote:+r.BarrelsForQuote||1,
            sharePriceSar:+r.SharePriceSAR||0, shippingSar:+r.ShippingSAR||0, productsTotalSar:+r.ProductsTotalSAR||0, totalSar:+r.TotalSAR||0,
            sarToSdg:+r.SARToSDG||0, landedTotalSdg:+r.LandedTotalSDG||0, sudanMarketTotalSdg:+r.SudanMarketTotalSDG||0,
            savingSdg:+r.SavingSDG||0, savingPercent:+r.SavingPercent||0, decision:r.Decision||'', totalWeightKg:+r.TotalWeightKg||0,
            totalVolumeL:+r.TotalVolumeL||0, products:productMap[r.QuoteID]||[]
          };
        });
        localStorage.setItem('barrelShare.settings.v4', JSON.stringify(settings));
        localStorage.setItem('barrelShare.quotes.v4', JSON.stringify(quotes));
        alert(`تم استيراد ${quotes.length} عرض بنجاح.`);
        location.reload();
      } catch (err) {
        console.error(err);
        alert('تعذر قراءة الملف. استخدم ملف Excel صادرًا من هذا التطبيق.');
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  });
})();
