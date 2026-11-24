// «خصم السلة المتروكة»: العميل يفتح رابط سلته من رسالة الواتساب (?cart=<رمز>).
// ترجع سلته، يظهر احتفال ونافذة «تم تطبيق الخصم» مع عداد، ويُطبَّق الكوبون الشخصي تلقائياً عند الدفع.
const CART_OFFER_KEY = "figsCartOffer";
let cartOfferLinkHandled = false;
let cartOfferAutoSignature = "";
let cartOfferTicker = 0;

const cartOfferText = (ar, en) => state.lang === "en" ? en : ar;
const cartOfferDigits = value => state.lang === "en" ? String(value) : String(value).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[digit]);

function readCartOffer() {
  try {
    const offer = JSON.parse(localStorage.getItem(CART_OFFER_KEY) || "null");
    if (!offer?.code || !offer.expiresAt) return null;
    if (Date.now() >= offer.expiresAt) { localStorage.removeItem(CART_OFFER_KEY); return null; }
    return offer;
  } catch { return null; }
}

function clearCartOffer() {
  try { localStorage.removeItem(CART_OFFER_KEY); } catch {}
}

// الخصم لصاحب الرقم فقط، ويظهر بعد تسجيل دخوله بنفس الرقم.
function cartOfferForUser() {
  const offer = readCartOffer();
  if (!offer) return null;
  const phone = normalizePhone(state.user?.phone || "");
  return phone && phone === offer.phone ? offer : null;
}

function cartOfferRemaining(offer) {
  const left = Math.max(0, offer.expiresAt - Date.now());
  const hours = Math.floor(left / 3600000), minutes = Math.floor(left % 3600000 / 60000), seconds = Math.floor(left % 60000 / 1000);
  return [hours, minutes, seconds].map(part => String(part).padStart(2, "0")).join(":");
}

function tickCartOfferCountdowns() {
  const offer = readCartOffer();
  const nodes = document.querySelectorAll("[data-cart-offer-countdown]");
  nodes.forEach(node => { node.textContent = offer ? cartOfferRemaining(offer) : "00:00:00"; });
  if (!offer) {
    document.getElementById("cartOfferBanner")?.remove();
    document.querySelectorAll(".cart-offer-timer, .cart-offer-inline").forEach(node => node.classList.add("expired"));
    clearInterval(cartOfferTicker); cartOfferTicker = 0;
  } else if (!nodes.length) {
    clearInterval(cartOfferTicker); cartOfferTicker = 0;
  }
}

function startCartOfferCountdown() {
  tickCartOfferCountdowns();
  if (!cartOfferTicker) cartOfferTicker = setInterval(tickCartOfferCountdowns, 1000);
}

function closeCartOfferSheet() {
  const overlay = document.getElementById("cartOfferSheet");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => overlay.remove(), 320);
}

function showCartOfferSheet(offer) {
  document.getElementById("cartOfferSheet")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "cart-offer-overlay";
  overlay.id = "cartOfferSheet";
  overlay.innerHTML = `<section class="cart-offer-sheet" role="dialog" aria-modal="true" aria-labelledby="cartOfferTitle">
      <span class="cart-offer-handle" aria-hidden="true"></span>
      <div class="cart-offer-badge" aria-hidden="true">🎉</div>
      <h2 id="cartOfferTitle">${cartOfferText("تهانينا", "Congratulations")}</h2>
      <p>${cartOfferText(`تم تطبيق خصم ${cartOfferLabel(offer)} على سلتك..`, `A ${cartOfferLabel(offer)} discount has been applied to your cart..`)}</p>
      <div class="cart-offer-actions">
        <button type="button" class="secondary" id="cartOfferMore">${cartOfferText("إضافة المزيد من المنتجات", "Add more products")}</button>
        <button type="button" class="primary" id="cartOfferPay">${cartOfferText("إتمام الدفع", "Checkout")}</button>
      </div>
      <div class="cart-offer-timer" role="timer"><span>${cartOfferText("ينتهي الخصم خلال", "Discount ends in")}</span><strong data-cart-offer-countdown dir="ltr">${cartOfferRemaining(offer)}</strong></div>
    </section>`;
  document.body.append(overlay);
  overlay.onclick = event => { if (event.target === overlay) closeCartOfferSheet(); };
  overlay.querySelector("#cartOfferMore").onclick = closeCartOfferSheet;
  overlay.querySelector("#cartOfferPay").onclick = () => {
    closeCartOfferSheet();
    if (!cartCount()) return toast(cartOfferText("سلتك فارغة، أضف منتجاتك أولاً", "Your cart is empty"));
    openCheckout();
  };
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("open")));
  startCartOfferCountdown();
}

// رابط الخصم: لا نعرض السلة ولا الخصم إلا لصاحب الرقم بعد تسجيل دخوله.
// زائر غير مسجل: نطلب منه تسجيل الدخول أولاً، ثم نكمل تلقائياً بعد الدخول.
const CART_OFFER_PENDING_KEY = "figsCartOfferPending";

function cartOfferPendingToken() {
  try { return sessionStorage.getItem(CART_OFFER_PENDING_KEY) || ""; } catch { return ""; }
}
function setCartOfferPendingToken(token) {
  try { token ? sessionStorage.setItem(CART_OFFER_PENDING_KEY, token) : sessionStorage.removeItem(CART_OFFER_PENDING_KEY); } catch {}
}

async function openCartOfferFromLink() {
  if (cartOfferLinkHandled) return;
  const token = (new URLSearchParams(location.search).get("cart") || "").toUpperCase();
  if (!token) return;
  cartOfferLinkHandled = true;
  const clean = new URL(location.href);
  clean.searchParams.delete("cart");
  history.replaceState(history.state, "", `${clean.pathname}${clean.search}${clean.hash}`);
  if (!/^[A-Z0-9]{16}$/.test(token)) return;
  if (!state.user?.phone) {
    setCartOfferPendingToken(token);
    return typeof couponDialog === "function"
      ? couponDialog(cartOfferText("خصم السلة", "Cart discount"), [cartOfferText("سجّل دخولك برقمك اللي وصلته الرسالة عشان تفتح سلتك والخصم.", "Log in with the number that received the message to open your cart and discount.")], [
          { label: cartOfferText("تسجيل الدخول", "Log in"), primary: true, onClick: () => openAuth("login") }
        ])
      : openAuth("login");
  }
  return claimCartOffer(token);
}

// بعد تسجيل الدخول: نكمل رابط الخصم المعلّق إن وُجد.
function cartOfferAfterLogin() {
  const token = cartOfferPendingToken();
  if (token) return claimCartOffer(token);
  syncCartOffer(true);
  renderCartOfferBanner();
}

async function claimCartOffer(token) {
  setCartOfferPendingToken("");
  let data;
  try { data = await orderingApi(`/cart-offer/${encodeURIComponent(token)}/claim`, { method: "POST" }, true); }
  catch (error) {
    if (/خاص بحساب/.test(error.message || "")) return toast(cartOfferText("هذا الخصم خاص بحساب آخر", "This discount belongs to another account"));
    return toast(error.message || cartOfferText("تعذر فتح رابط السلة", "Could not open the cart link"));
  }
  // نرجع السلة إن كانت فارغة على هذا الجهاز؛ السلة الحالية أحدث إن وُجدت.
  if (data.cart && typeof data.cart === "object" && !cartCount()) {
    state.cart = { ...data.cart };
    persistCart();
    renderCartBar();
    if (typeof syncAllProductQuantityControls === "function") syncAllProductQuantityControls();
  }
  if (data.status !== "active") {
    clearCartOffer();
    return typeof couponDialog === "function"
      ? couponDialog(cartOfferText("خصم السلة", "Cart discount"), [data.status === "used" ? cartOfferText("تم استخدام هذا الخصم مسبقاً.", "This discount was already used.") : cartOfferText("انتهت مدة خصم السلة، وسلتك ما زالت بانتظارك.", "The cart discount has ended, but your cart is still waiting.")])
      : null;
  }
  // نضبط وقت الانتهاء على ساعة الجهاز حتى لو كانت ساعته غير دقيقة.
  const expiresAt = Date.now() + (data.expiresAt - data.serverNow);
  localStorage.setItem(CART_OFFER_KEY, JSON.stringify({ token, code: data.code, phone: data.phone, percent: data.percent, labelAr: data.labelAr, labelEn: data.labelEn, expiresAt, ...cartOfferTermsFields(data) }));
  cartOfferError = "";
  cartOfferAutoSignature = "";
  cartOfferSyncedAt = Date.now();
  if (typeof couponCelebrate === "function") couponCelebrate();
  showCartOfferSheet({ percent: data.percent, labelAr: data.labelAr, labelEn: data.labelEn, expiresAt });
  renderCartOfferBanner();
}

// صفحة التأكيد أثناء مدة الخصم: لا خانة كوبون؛ فقط «خصم السلة» + الشروط والأحكام + العداد.
// الخصم خاص (ليس كوبوناً): يُسعّر من السيرفر ويُرسل مع الدفع كـ cartOffer.
let cartOfferError = "";
let cartOfferQuoteRevision = 0;
let cartOfferQuoting = false;

function cartOfferLabel(offer) {
  return state.lang === "en" ? (offer.labelEn || `${offer.percent}%`) : (offer.labelAr || `${cartOfferDigits(offer.percent)}٪`);
}

function cartOfferCheckoutMarkup() {
  const offer = cartOfferForUser();
  if (!offer || !state.user?.phone) return "";
  return `<section class="checkout-coupon cart-offer-terms">
      <div class="coupon-label"><span class="cart-offer-name">${cartOfferText("خصم السلة", "Cart discount")} ${escapeHtml(cartOfferLabel(offer))}</span><button type="button" id="cartOfferTerms">${cartOfferText("الشروط والأحكام", "Terms & conditions")}</button></div>
      ${cartOfferError ? `<p class="coupon-hint" role="alert">${escapeHtml(cartOfferError)}</p>` : ""}
      <p class="cart-offer-inline">${cartOfferText("ينتهي الخصم خلال", "Discount ends in")} <strong data-cart-offer-countdown dir="ltr">${cartOfferRemaining(offer)}</strong></p>
    </section>`;
}

function cartOfferAfterConfirmation() {
  const offer = cartOfferForUser();
  if (!offer || !state.user?.phone) return;
  startCartOfferCountdown();
  syncCartOffer(true);
  if (cartOfferQuoting && !currentCheckoutCoupon()?.local) setCartOfferPayBusy(true);
  const termsButton = document.getElementById("cartOfferTerms");
  if (termsButton) termsButton.onclick = () => {
    const quote = currentCheckoutCoupon();
    const lines = quote?.coupon?.cartOffer && quote.coupon.termsAr?.length ? (state.lang === "en" ? quote.coupon.termsEn : quote.coupon.termsAr)
      : [cartOfferText("خصم خاص بحسابك على منتجات سلتك، يُستخدم في طلب واحد خلال مدة العرض. رسوم التوصيل غير مشمولة.", "A personal discount on your cart, for one order within the offer time. Delivery fees are excluded.")];
    couponDialog(cartOfferText("شروط وأحكام خصم السلة", "Cart discount terms"), lines);
  };
  const current = currentCheckoutCoupon();
  if (current?.coupon?.cartOffer && !current.local) return;
  if (current && !current.local) clearCheckoutCoupon();
  // نعيد التسعير كلما رجع لصفحة الدفع بدون خصم مطبّق؛ نتوقف فقط إن فشلت نفس السلة قبل قليل.
  const signature = couponCartSignature();
  if (cartOfferAutoSignature === signature && (cartOfferError || cartOfferQuoting)) return;
  // إن كان الخصم محسوباً على الجهاز نتحقق منه بالخلفية بدون تعطيل زر الدفع.
  quoteCartOffer(offer, !current?.local).catch(() => {});
}

const cartOfferFils = value => Math.round(Number(value || 0) * 1000);

function cartOfferTermsFields(data) {
  return data?.terms ? { terms: data.terms, revision: data.revision, termsAr: data.termsAr, termsEn: data.termsEn } : {};
}

// نفس حساب السيرفر (cart-offer-pricing.js › applyCartOffer) حتى يظهر الخصم فوراً
// في السلة وكل خطوات الدفع. لا يرجع شيئاً إن لم تنطبق الشروط؛ السيرفر يحسم عند الدفع.
function cartOfferLocalQuote() {
  const offer = cartOfferForUser();
  const terms = offer?.terms;
  if (!terms || !state.user?.phone || !(Number(terms.amount) > 0)) return null;
  const signature = couponCartSignature();
  if (cartOfferError && cartOfferAutoSignature === signature) return null;
  const items = cartItems();
  if (!items.length) return null;
  const catalogType = items.some(({ product }) => catalogTypeOf(product) === "restaurant") ? "restaurant" : "bakery";
  if (terms.catalogType && terms.catalogType !== "all" && terms.catalogType !== catalogType) return null;
  if (terms.fulfillment && terms.fulfillment !== "all" && terms.fulfillment !== state.mode) return null;
  const excluded = new Set((terms.excludedProductIds || []).map(String));
  const eligible = items.reduce((sum, { product: item, quantity, options }) => {
    const sale = Number(item.originalPrice || 0) > Number(item.price || 0);
    return sum + (excluded.has(String(item.id)) || (terms.excludeSaleItems !== false && sale) ? 0 : cartOfferFils(selectionFlowTotal(item, options, quantity)));
  }, 0);
  if (eligible <= 0 || eligible < cartOfferFils(terms.minSubtotal)) return null;
  let discount = terms.type === "fixed" ? cartOfferFils(terms.amount) : Math.round(eligible * Number(terms.amount) / 100);
  discount = Math.min(eligible, discount, Number(terms.maxDiscount) ? cartOfferFils(terms.maxDiscount) : Infinity);
  if (discount <= 0) return null;
  const sub = cartOfferFils(subtotal()), fee = cartOfferFils(deliveryFee());
  return {
    ok: true, local: true, signature, cartOffer: offer.token,
    subtotal: sub / 1000, deliveryFee: fee / 1000, discount: discount / 1000, total: (sub + fee - discount) / 1000,
    coupon: { cartOffer: true, code: offer.code, revision: offer.revision, labelAr: `خصم السلة ${offer.labelAr}`, labelEn: `Cart discount ${offer.labelEn}`, termsAr: offer.termsAr, termsEn: offer.termsEn, discount: discount / 1000 }
  };
}

// يعيد رسم الأسعار المعروضة (شريط السلة وصفحة الدفع) بعد تغيّر الخصم.
function cartOfferRefreshTotals() {
  if (typeof renderCartBar === "function") renderCartBar();
  if (!$("#checkoutModal").classList.contains("hidden") && document.querySelector(".cart-offer-terms")) renderConfirmation();
}

// يسعّر خصم السلة من السيرفر. زر الدفع يبقى معطلاً حتى يرجع السعر،
// حتى لا تُفتح صفحة الدفع بالمبلغ قبل الخصم.
let cartOfferQuotePromise = null;
function setCartOfferPayBusy(busy) {
  const pay = document.getElementById("finish");
  if (!pay) return;
  pay.disabled = busy;
  pay.classList.toggle("cart-offer-waiting", busy);
  pay.setAttribute("aria-busy", busy ? "true" : "false");
}

function quoteCartOffer(offer, blockPay = true) {
  const signature = couponCartSignature();
  if (cartOfferQuoting && cartOfferAutoSignature === signature && cartOfferQuotePromise) return cartOfferQuotePromise;
  cartOfferAutoSignature = signature;
  cartOfferQuoting = true;
  cartOfferError = "";
  if (blockPay) setCartOfferPayBusy(true);
  const revision = ++cartOfferQuoteRevision;
  const body = { ...paymentPayload(state.paymentMethod || "knet"), idempotencyKey: requestId(), cartOffer: offer.token };
  cartOfferQuotePromise = orderingApi("/cart-offer-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, true).finally(() => {
    if (revision !== cartOfferQuoteRevision) return;
    cartOfferQuoting = false;
    setCartOfferPayBusy(false);
  }).then(quote => {
    if (revision !== cartOfferQuoteRevision || signature !== couponCartSignature()) return false;
    if (!quote?.ok || !(quote.discount > 0)) throw Error(cartOfferText("تعذر تطبيق خصم السلة", "Could not apply the cart discount"));
    cartOfferError = "";
    checkoutCoupon = { ...quote, signature, cartOffer: offer.token };
    state.paymentRequestId = "";
    if (!$("#checkoutModal").classList.contains("hidden") && document.querySelector(".cart-offer-terms")) renderConfirmation();
    return true;
  }).catch(error => {
    if (revision !== cartOfferQuoteRevision) return false;
    cartOfferError = error.message || cartOfferText("تعذر تطبيق خصم السلة", "Could not apply the cart discount");
    // خصم مستخدم أو منتهٍ أو لحساب آخر: نرجع للوضع العادي (خانة الكوبون).
    if (/استخدام|انتهت|خاص بحساب|غير صحيح|إيقاف/.test(cartOfferError)) { cartOfferEnded(); return false; }
    cartOfferRefreshTotals();
    throw error;
  });
  return cartOfferQuotePromise;
}

// سطر «جارٍ تطبيق خصم السلة…» في الملخص حتى يصل السعر من السيرفر.
function cartOfferPendingRow() {
  const offer = cartOfferForUser();
  if (!offer || !state.user?.phone || cartOfferError) return "";
  return `<div class="checkout-confirm-total-row coupon-saving cart-offer-saving cart-offer-pending" role="status"><span>${escapeHtml(cartOfferLabel(offer))}</span><strong>${cartOfferText("جارٍ تطبيق الخصم…", "Applying discount…")}</strong></div>`;
}

// قبل فتح الدفع: إن كان للعميل خصم سلة فعّال ولم يُطبّق بعد، ننتظر تطبيقه أولاً.
async function cartOfferGateBeforePay(proceed) {
  const offer = cartOfferForUser();
  if (!offer || !state.user?.phone || currentCheckoutCoupon()?.coupon?.cartOffer) return proceed();
  let applied = false;
  try { applied = await quoteCartOffer(offer); } catch {}
  if (applied && currentCheckoutCoupon()?.coupon?.cartOffer) return proceed();
  // انتهى الخصم أو أُوقف: الصفحة رجعت لوضعها العادي، فيراجع العميل المبلغ ويضغط الدفع من جديد.
  if (!readCartOffer()) return;
  couponDialog(cartOfferText("لم يتم تطبيق خصم السلة", "Cart discount not applied"), [cartOfferError || cartOfferText("تعذر تطبيق خصم السلة", "Could not apply the cart discount")], [
    { label: cartOfferText("إعادة المحاولة", "Try again"), onClick: () => cartOfferGateBeforePay(proceed) },
    { label: cartOfferText("الدفع بدون خصم", "Pay without discount"), primary: true, onClick: proceed }
  ]);
}

// بعد الدفع بخصم السلة: ينتهي العرض على هذا الجهاز.
function cartOfferPaid(order) {
  if (!order?.coupon?.cartOffer) return;
  clearCartOffer();
  renderCartOfferBanner();
}

// لافتة عائمة أعلى اليمين (بنفس شكل زر الواتساب): «قم بإتمام الدفع قبل» + عداد أحمر.
function renderCartOfferBanner() {
  const offer = cartOfferForUser();
  let banner = document.getElementById("cartOfferBanner");
  if (!offer || !cartCount()) { banner?.remove(); return; }
  if (!banner) {
    banner = document.createElement("button");
    banner.type = "button";
    banner.id = "cartOfferBanner";
    banner.className = "cart-offer-banner";
    banner.onclick = () => { if (cartCount()) openCheckout(); };
    document.body.append(banner);
  }
  banner.setAttribute("aria-label", cartOfferText("أكمل الدفع قبل انتهاء خصم السلة", "Checkout before the cart discount ends"));
  banner.innerHTML = `<span>${cartOfferText("قم بإتمام الدفع قبل:", "Checkout within:")}</span><strong data-cart-offer-countdown dir="ltr">${cartOfferRemaining(offer)}</strong><small>${cartOfferText("للاستفادة من الخصم", "to keep your discount")}</small>`;
  startCartOfferCountdown();
}

// عند فتح الموقع: نتأكد من السيرفر أن الخصم ما زال فعّالاً (قد تكون الإدارة أوقفته أو عدّلته).
let cartOfferSynced = false;
let cartOfferSyncedAt = 0;
async function syncCartOffer(force = false) {
  if ((cartOfferSynced && !force) || new URLSearchParams(location.search).get("cart")) return;
  if (force && Date.now() - cartOfferSyncedAt < 20000) return;
  cartOfferSynced = true;
  cartOfferSyncedAt = Date.now();
  const offer = cartOfferForUser();
  if (!offer?.token) return;
  try {
    const data = await orderingApi(`/cart-offer/${encodeURIComponent(offer.token)}/claim`, { method: "POST" }, true);
    if (data.status !== "active") return cartOfferEnded();
    const expiresAt = Date.now() + (data.expiresAt - data.serverNow);
    const before = JSON.stringify(offer.terms || null);
    localStorage.setItem(CART_OFFER_KEY, JSON.stringify({ ...offer, percent: data.percent, labelAr: data.labelAr, labelEn: data.labelEn, expiresAt, ...cartOfferTermsFields(data) }));
    renderCartOfferBanner();
    // وصلت الشروط أو تغيّرت: نحدّث الأسعار المعروضة.
    if (before !== JSON.stringify(data.terms || null)) cartOfferRefreshTotals();
  } catch (error) {
    if (/غير صحيح|خاص بحساب/.test(error.message || "")) cartOfferEnded();
  }
}

// أوقفته/حذفته الإدارة أو انتهى: نخفي اللافتة، ونرجع صفحة الدفع لوضعها العادي فوراً.
function cartOfferEnded() {
  clearCartOffer();
  cartOfferError = "";
  if (currentCheckoutCoupon()?.coupon?.cartOffer) clearCheckoutCoupon();
  renderCartOfferBanner();
  if (!$("#checkoutModal").classList.contains("hidden") && document.querySelector(".cart-offer-terms")) renderConfirmation();
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && readCartOffer()) syncCartOffer(true); });
setInterval(() => { if (document.visibilityState === "visible" && readCartOffer()) syncCartOffer(true); }, 60000);

// إن وصل الرابط والكتالوج محمّل مسبقاً.
if (typeof state !== "undefined" && Array.isArray(state.products) && state.products.length) { openCartOfferFromLink(); renderCartOfferBanner(); }
syncCartOffer();
