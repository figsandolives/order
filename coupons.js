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
  return checkoutCoupon;
}
function couponAmount() { return Number(currentCheckoutCoupon()?.discount || 0); }
function couponPayloadFields() {
  const quote=currentCheckoutCoupon();
  return quote ? {couponCode:quote.coupon.code,couponRevision:quote.coupon.revision,couponExpectedTotal:quote.total} : {};
}
function couponDialog(title,lines) {
  let dialog=document.getElementById('couponMessage');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='couponMessage';dialog.className='coupon-message';document.body.append(dialog);}
  dialog.innerHTML=`<header><h2>${escapeHtml(title)}</h2><button type="button" aria-label="${couponText('إغلاق','Close')}">×</button></header><div class="coupon-message-body">${lines.map(line=>`<p>${escapeHtml(line).replace(/\n/g,'<br>')}</p>`).join('')}</div><button type="button" class="primary coupon-message-close">${couponText('حسناً','OK')}</button>`;
  dialog.querySelectorAll('button').forEach(button=>button.onclick=()=>dialog.close());
  if(!dialog.open)dialog.showModal();
}
function couponMarkup() {
  const quote=currentCheckoutCoupon();
  return `<section class="checkout-coupon"><div class="coupon-label"><label for="checkoutCouponCode">${couponText('كوبون الخصم','Discount coupon')}</label><button type="button" id="couponTerms">${couponText('الشروط والأحكام','Terms & conditions')}</button></div>
    <form class="coupon-field" id="couponForm"><input id="checkoutCouponCode" type="text" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${couponText('أدخل رمز الكوبون','Enter coupon code')}" value="${escapeHtml(quote?.coupon.code||'')}" ${quote?'readonly':''}><button type="submit" id="applyCoupon">${quote?couponText('إزالة','Remove'):couponText('تطبيق','Apply')}</button></form>
    ${quote?`<p class="coupon-applied" role="status">${couponText('تم تطبيق','Applied')} <bdi>${escapeHtml(quote.coupon.code)}</bdi> · ${couponText('وفّرت','You saved')} ${money(quote.discount)}</p>`:''}</section>`;
}
function bindCheckoutCoupon() {
  document.getElementById('couponForm').onsubmit=async event=>{
    event.preventDefault();
    if(currentCheckoutCoupon()){clearCheckoutCoupon();state.paymentRequestId='';renderConfirmation();return;}
    const code=document.getElementById('checkoutCouponCode').value.trim();
    if(!code){document.getElementById('checkoutCouponCode').focus();return;}
    const revision=++couponRequestRevision;
    const signature=couponCartSignature();
    const button=document.getElementById('applyCoupon');button.disabled=true;button.textContent=couponText('جارٍ التحقق…','Checking…');
    try {
      const body={...paymentPayload(state.paymentMethod||'knet'),idempotencyKey:requestId(),couponCode:code};
      const quote=await orderingApi('/coupons/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},true);
      if(revision!==couponRequestRevision||signature!==couponCartSignature())return;
      if(!quote.ok||!quote.coupon||!Number.isFinite(quote.discount)||quote.discount<=0)throw Error(couponText('تعذر التحقق من الكوبون','Could not validate coupon'));
      checkoutCoupon={...quote,signature};state.paymentRequestId='';renderConfirmation();
    }catch(error){if(revision===couponRequestRevision)couponDialog(couponText('كوبون الخصم','Discount coupon'),[error.message]);}
    finally {if(button.isConnected){button.disabled=false;button.textContent=couponText('تطبيق','Apply');}}
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
