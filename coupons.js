// Coupon values are quotes from the server; payment creation revalidates every condition.
let checkoutCoupon = null;
let couponRequestRevision = 0;
const couponText = (ar,en) => state.lang === 'en' ? en : ar;
function clearCheckoutCoupon() {
  couponRequestRevision++;
  if (checkoutCoupon) state.paymentRequestId = "";
  checkoutCoupon = null;
}
function couponCartSignature() {
  return JSON.stringify({cart:state.cart,mode:state.mode,area:state.area?.name,fee:deliveryFee(),subtotal:subtotal(),phone:state.user?.phone,catalog:catalogSignature});
}
function currentCheckoutCoupon() {
  if (checkoutCoupon && checkoutCoupon.signature !== couponCartSignature()) clearCheckoutCoupon();
  // خصم السلة يُحسب فوراً على الجهاز من شروطه؛ السيرفر يعيد التحقق عند الدفع.
  if (!checkoutCoupon && typeof cartOfferLocalQuote === "function") return cartOfferLocalQuote();
  return checkoutCoupon;
}
function couponAmount() { return Number(currentCheckoutCoupon()?.discount || 0); }
function couponPayloadFields() {
  const quote=currentCheckoutCoupon();
  if (quote?.cartOffer) return {cartOffer:quote.cartOffer,cartOfferExpectedTotal:quote.total};
  return quote ? {couponCode:quote.coupon.code,couponRevision:quote.coupon.revision,couponExpectedTotal:quote.total} : {};
}
function couponDialog(title,lines,actions) {
  let dialog=document.getElementById('couponMessage');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='couponMessage';dialog.className='coupon-message';document.body.append(dialog);}
  dialog.innerHTML=`<header><h2>${escapeHtml(title)}</h2><button type="button" aria-label="${couponText('إغلاق','Close')}">×</button></header><div class="coupon-message-body">${lines.map(line=>`<p>${escapeHtml(line).replace(/\n/g,'<br>')}</p>`).join('')}</div>${actions?.length?`<div class="coupon-message-actions">${actions.map((action,index)=>`<button type="button" class="${action.primary?'primary':'secondary'}" data-coupon-action="${index}">${escapeHtml(action.label)}</button>`).join('')}</div>`:`<button type="button" class="primary coupon-message-close">${couponText('حسناً','OK')}</button>`}`;
  dialog.querySelectorAll('button').forEach(button=>button.onclick=()=>{dialog.close();const action=actions?.[Number(button.dataset.couponAction)];if(action)action.onClick();});
  if(!dialog.open)dialog.showModal();
}
function couponMarkup() {
  const quote=currentCheckoutCoupon();
  return `<section class="checkout-coupon"><div class="coupon-label"><label for="checkoutCouponCode">${couponText('كوبون الخصم','Discount coupon')}</label><button type="button" id="couponTerms">${couponText('الشروط والأحكام','Terms & conditions')}</button></div>
    <form class="coupon-field" id="couponForm"><input id="checkoutCouponCode" type="text" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${couponText('أدخل رمز الكوبون','Enter coupon code')}" value="${escapeHtml(quote?.coupon.code||'')}" ${quote?'readonly':''}><button type="submit" id="applyCoupon" ${quote?'':'disabled'}>${quote?couponText('إزالة','Remove'):couponText('تطبيق','Apply')}</button></form>
    <p class="coupon-hint hidden" id="couponHint" role="alert"></p>
    ${quote?`<p class="coupon-applied" role="status">${couponText('تم تطبيق','Applied')} <bdi>${escapeHtml(quote.coupon.code)}</bdi> · ${couponText('وفّرت','You saved')} ${money(quote.discount)}</p>`:''}</section>`;
}
// رمز الكوبون بالأحرف والأرقام الإنجليزية فقط؛ أي حرف أو رقم عربي يُرفض مع رسالة توضيح
const COUPON_ALLOWED=/[^A-Za-z0-9_-]/g;
function couponInputGuard() {
  const input=document.getElementById('checkoutCouponCode'),button=document.getElementById('applyCoupon'),hint=document.getElementById('couponHint');
  if(!input||!button||input.readOnly)return;
  const raw=input.value;
  const clean=raw.replace(COUPON_ALLOWED,'').toUpperCase();
  if(clean!==raw){
    const rejectedArabic=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(raw);
    input.value=clean;
    if(clean!==raw.toUpperCase()&&hint){
      hint.textContent=rejectedArabic?couponText('لا يقبل حروفاً أو أرقاماً عربية — اكتب الرمز بالإنجليزي','Coupon codes use English letters and numbers only'):couponText('اكتب رمز الكوبون بأحرف وأرقام إنجليزية فقط','Coupon codes use English letters and numbers only');
      hint.classList.remove('hidden');
    }
  } else if(hint&&clean)hint.classList.add('hidden');
  button.disabled=!clean;
}
// يتحقق من الكوبون المكتوب ويطبقه. يرجع {applied:true} أو {error} أو {stale:true}
async function applyTypedCoupon(code) {
  const revision=++couponRequestRevision;
  const signature=couponCartSignature();
  const button=document.getElementById('applyCoupon');
  if(button){button.disabled=true;button.classList.add('checking');button.textContent=couponText('جارٍ التحقق…','Checking…');}
  try {
    const body={...paymentPayload(state.paymentMethod||'knet'),idempotencyKey:requestId(),couponCode:code};
    const quote=await orderingApi('/coupons/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},true);
    if(revision!==couponRequestRevision||signature!==couponCartSignature())return {stale:true};
    if(!quote.ok||!quote.coupon||!Number.isFinite(quote.discount)||quote.discount<=0)throw Error(couponText('تعذر التحقق من الكوبون','Could not validate coupon'));
    checkoutCoupon={...quote,signature};state.paymentRequestId='';renderConfirmation();couponCelebrate();
    return {applied:true};
  }catch(error){return revision===couponRequestRevision?{error:error.message||couponText('تعذر التحقق من الكوبون','Could not validate coupon')}:{stale:true};}
  finally {if(button?.isConnected){button.classList.remove('checking');button.textContent=couponText('تطبيق','Apply');couponInputGuard();}}
}
// عند الضغط على «ادفع الآن» وفي الخانة كوبون مكتوب لم يُطبّق: نطبقه أولاً ونوقف ليرى الزبون المبلغ الجديد
async function couponGateBeforePay(proceed) {
  const input=document.getElementById('checkoutCouponCode');
  const code=input&&!input.readOnly?input.value.trim():'';
  if(!code||currentCheckoutCoupon())return proceed();
  const pay=document.getElementById('finish');if(pay)pay.disabled=true;
  const result=await applyTypedCoupon(code);
  if(pay?.isConnected)pay.disabled=false;
  if(result.applied||result.stale)return;
  couponDialog(couponText('لم يتم تطبيق الكوبون','Coupon not applied'),[result.error],[
    {label:couponText('تعديل الكوبون','Edit coupon'),onClick:()=>{const field=document.getElementById('checkoutCouponCode');field?.focus();field?.select();}},
    {label:couponText('الدفع بدون كوبون','Pay without coupon'),primary:true,onClick:()=>{const field=document.getElementById('checkoutCouponCode');if(field){field.value='';couponInputGuard();}proceed();}}
  ]);
}
function bindCheckoutCoupon() {
  if(!document.getElementById('couponForm'))return;
  const couponInput=document.getElementById('checkoutCouponCode');
  if(couponInput){couponInput.setAttribute('inputmode','latin');couponInput.setAttribute('lang','en');couponInput.oninput=couponInputGuard;couponInputGuard();}
  document.getElementById('couponForm').onsubmit=async event=>{
    event.preventDefault();
    if(currentCheckoutCoupon()){clearCheckoutCoupon();state.paymentRequestId='';renderConfirmation();return;}
    const code=document.getElementById('checkoutCouponCode').value.trim();
    if(!code||/[^A-Za-z0-9_-]/.test(code)){document.getElementById('checkoutCouponCode').focus();return;}
    const result=await applyTypedCoupon(code);
    if(result.error)couponDialog(couponText('كوبون الخصم','Discount coupon'),[result.error]);
  };
  document.getElementById('couponTerms').onclick=async()=>{
    const quote=currentCheckoutCoupon();
    if(quote)return couponDialog(couponText('شروط وأحكام الكوبون','Coupon terms & conditions'),state.lang==='en'?quote.coupon.termsEn:quote.coupon.termsAr);
    const code=document.getElementById('checkoutCouponCode').value.trim();
    if(!code)return couponDialog(couponText('شروط وأحكام الكوبون','Coupon terms & conditions'),[couponText('أدخل رمز الكوبون لعرض شروطه الخاصة. المنتجات المخفّضة ورسوم التوصيل لا يشملها خصم الكوبون.','Enter a coupon code to read its terms. Sale items and delivery fees are excluded from coupon discounts.')]);
    try {const data=await orderingApi(`/coupons/${encodeURIComponent(code)}/terms`,{},true);couponDialog(couponText('شروط وأحكام الكوبون','Coupon terms & conditions'),state.lang==='en'?data.termsEn:data.termsAr);}
    catch(error){couponDialog(couponText('كوبون الخصم','Discount coupon'),[error.message]);}
  };
}

// احتفال خفيف عند نجاح تطبيق الكوبون: قصاصات ملونة تنطلق من خانة الكوبون، ثم تنزل ببطء من أعلى الشاشة وتتمايل، وتختفي بهدوء — بدون أي كتابة
function couponCelebrate() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.coupon-confetti')?.remove();
  const layer=document.createElement('div');layer.className='coupon-confetti';layer.setAttribute('aria-hidden','true');
  const colors=['#dca83e','#2d6a4f','#e9c46a','#8fbf9f','#f4a261','#ffffff','#e76f51'];
  const field=document.getElementById('couponForm')?.getBoundingClientRect();
  const originX=field?field.left+field.width/2:innerWidth/2, originY=field?field.top:innerHeight*.7;
  const piece=(i)=>{const el=document.createElement('i');el.style.cssText=`background:${colors[i%colors.length]};width:${6+Math.random()*5}px;height:${8+Math.random()*8}px;border-radius:${Math.random()<.35?'50%':'2px'}`;layer.append(el);return el;};
  let longest=0;
  // 1) انطلاقة من خانة الكوبون
  for(let i=0;i<40;i++){
    const el=piece(i);el.style.left=originX+'px';el.style.top=originY+'px';
    const angle=(-90+(Math.random()*110-55))*Math.PI/180, power=220+Math.random()*300;
    const dx=Math.cos(angle)*power, dy=Math.sin(angle)*power, duration=3200+Math.random()*1200;
    longest=Math.max(longest,duration);
    el.animate([
      {transform:'translate(0,0) rotate(0deg)',opacity:1},
      {transform:`translate(${dx}px,${dy}px) rotate(${180+Math.random()*180}deg)`,opacity:1,offset:.3},
      {transform:`translate(${dx*1.15+(Math.random()*60-30)}px,${dy+240}px) rotate(${420+Math.random()*300}deg)`,opacity:1,offset:.7},
      {transform:`translate(${dx*1.3}px,${dy+380+Math.random()*160}px) rotate(${700+Math.random()*400}deg)`,opacity:0}
    ],{duration,easing:'cubic-bezier(.15,.65,.35,1)',fill:'forwards'});
  }
  // 2) مطر قصاصات ينزل ببطء من أعلى الشاشة
  for(let i=0;i<55;i++){
    const el=piece(i+3);el.style.left=(Math.random()*innerWidth)+'px';el.style.top='-20px';
    const delay=Math.random()*1400, duration=3600+Math.random()*1600, sway=40+Math.random()*50, fall=innerHeight*(.75+Math.random()*.3);
    longest=Math.max(longest,delay+duration);
    el.animate([
      {transform:'translate(0,0) rotate(0deg)',opacity:0},
      {transform:`translate(${sway}px,${fall*.25}px) rotate(120deg)`,opacity:1,offset:.15},
      {transform:`translate(${-sway}px,${fall*.55}px) rotate(300deg)`,opacity:1,offset:.5},
      {transform:`translate(${sway*.6}px,${fall*.8}px) rotate(480deg)`,opacity:.9,offset:.8},
      {transform:`translate(0,${fall}px) rotate(620deg)`,opacity:0}
    ],{duration,delay,easing:'linear',fill:'both'});
  }
  document.body.append(layer);
  setTimeout(()=>layer.remove(),longest+200);
}
