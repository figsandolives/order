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

// الخصم لصاحب الرقم فقط؛ زائر غير مسجل يراه حتى يسجل دخوله.
function cartOfferForUser() {
  const offer = readCartOffer();
  if (!offer) return null;
  const phone = normalizePhone(state.user?.phone || "");
  return !phone || phone === offer.phone ? offer : null;
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
      <p>${cartOfferText(`تم تطبيق خصم ${cartOfferDigits(offer.percent)}٪ على سلتك..`, `A ${offer.percent}% discount has been applied to your cart..`)}</p>
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

async function openCartOfferFromLink() {
  if (cartOfferLinkHandled) return;
  const token = new URLSearchParams(location.search).get("cart");
  if (!token) return;
  cartOfferLinkHandled = true;
  const clean = new URL(location.href);
  clean.searchParams.delete("cart");
  history.replaceState(history.state, "", `${clean.pathname}${clean.search}${clean.hash}`);
  if (!/^[A-Z0-9]{16}$/.test(token)) return;
  let data;
  try { data = await orderingApi(`/cart-offer/${encodeURIComponent(token)}`); }
  catch (error) { return toast(error.message || cartOfferText("تعذر فتح رابط السلة", "Could not open the cart link")); }
  const phone = normalizePhone(state.user?.phone || "");
  const sameCustomer = !phone || phone === data.phone;
  // نرجع السلة إن كانت فارغة على هذا الجهاز؛ السلة الحالية أحدث إن وُجدت.
  if (sameCustomer && data.cart && typeof data.cart === "object" && !cartCount()) {
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
  if (!sameCustomer) return toast(cartOfferText("هذا الخصم خاص بحساب آخر", "This discount belongs to another account"));
  // نضبط وقت الانتهاء على ساعة الجهاز حتى لو كانت ساعته غير دقيقة.
  const expiresAt = Date.now() + (data.expiresAt - data.serverNow);
  localStorage.setItem(CART_OFFER_KEY, JSON.stringify({ token, code: data.code, phone: data.phone, percent: data.percent, expiresAt }));
  cartOfferAutoSignature = "";
  if (typeof couponCelebrate === "function") couponCelebrate();
  showCartOfferSheet({ percent: data.percent, expiresAt });
}

// صفحة التأكيد: عداد أحمر تحت الكوبون، ويُطبَّق كوبون السلة تلقائياً مرة لكل سلة.
function cartOfferAfterConfirmation() {
  const offer = cartOfferForUser();
  if (!offer || !state.user?.phone) return;
  const box = document.querySelector(".checkout-coupon");
  if (box && !box.querySelector(".cart-offer-inline")) {
    box.insertAdjacentHTML("beforeend", `<p class="cart-offer-inline">${cartOfferText(`خصم سلتك ${cartOfferDigits(offer.percent)}٪ ينتهي خلال`, `Your ${offer.percent}% cart discount ends in`)} <strong data-cart-offer-countdown dir="ltr">${cartOfferRemaining(offer)}</strong></p>`);
    startCartOfferCountdown();
  }
  if (typeof currentCheckoutCoupon !== "function" || currentCheckoutCoupon()) return;
  const signature = couponCartSignature();
  if (cartOfferAutoSignature === signature) return;
  cartOfferAutoSignature = signature;
  applyTypedCoupon(offer.code).then(result => {
    if (result?.error && /استخدام|انتهت|غير صحيح|خاص بحساب/.test(result.error)) clearCartOffer();
  });
}

// إن وصل الرابط والكتالوج محمّل مسبقاً.
if (typeof state !== "undefined" && Array.isArray(state.products) && state.products.length) openCartOfferFromLink();
