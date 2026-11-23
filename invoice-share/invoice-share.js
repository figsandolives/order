"use strict";
// «رابط دفع لطلب»: الشخص المستلم للرابط يرى فاتورة ثابتة ويختار طريقة الدفع فقط.
(() => {
  const $ = selector => document.querySelector(selector);
  const apiBase = String(window.ORDERING_CONFIG?.apiBaseUrl || "").replace(/\/+$/, "");
  const params = new URLSearchParams(location.search);
  const shareId = (location.hash.replace(/^#/, "") || params.get("s") || "").trim();
  const returned = params.get("payment");
  const siteUrl = `${location.origin}/`;
  let method = "";
  let pollTimer = 0;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const money = value => `${Number(value || 0).toFixed(3)} د.ك`;
  const thumb = url => String(url || "").replace(/^(https:\/\/162-35-27-249\.sslip\.io)\/platform-assets\/(orderingPlatform\/catalog\/[^?#]+\.(?:webp|jpe?g|png))$/i, "$1/platform-thumbs/$2");
  const isAppleMobile = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isIphoneSafari = () => isAppleMobile() && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(navigator.userAgent);
  const icons = {
    info: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"/></svg>`
  };

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "تعذر الاتصال بالخدمة"), { status: response.status });
    return data;
  }

  function setBody(html, title = "تأكيد ودفع") {
    $("#checkoutTitle").textContent = title;
    $("#checkoutBody").innerHTML = html;
  }

  const visitButton = `<a class="primary share-visit" href="${siteUrl}" style="display:grid;place-items:center;text-decoration:none">زيارة موقعنا</a>`;

  function showMessage(kind, title, text) {
    clearTimeout(pollTimer);
    const mark = kind === "success" ? `<div class="check">✓</div>` : `<div class="error-mark">${kind === "cancelled" ? "×" : "!"}</div>`;
    setBody(`<div class="share-state ${kind}">${mark}<h3>${escapeHtml(title)}</h3>${text}${visitButton}</div>`, kind === "success" ? "تم الدفع" : "رابط الدفع");
  }

  function showPaid(orderId) {
    showMessage("success", "شكراً لك، تم الدفع", `<p>رقم الفاتورة</p><strong class="order-no">${escapeHtml(orderId || "—")}</strong>`);
  }

  function showStatus(data) {
    if (data.status === "paid") return showPaid(data.orderId);
    if (data.status === "cancelled") return showMessage("cancelled", "تم إلغاء مشاركة هذه الفاتورة", `<p>لم يعد بالإمكان الدفع من هذا الرابط.</p>`);
    if (data.status === "expired") return showMessage("cancelled", "انتهت صلاحية رابط الدفع", `<p>اطلب من صاحب الطلب إرسال رابط جديد.</p>`);
    if (data.status === "unavailable") return showMessage("cancelled", "تعذر تجهيز الفاتورة", `<p>${escapeHtml(data.message || "")}</p>`);
    return renderInvoice(data);
  }

  function renderInvoice(data, notice = "") {
    const apple = isIphoneSafari();
    if (!method || (method === "applepay" && !apple)) method = apple ? "applepay" : "knet";
    const mark = value => value === "applepay"
      ? `<span class="apple-pay-mark" aria-label="Apple Pay"> Pay</span>`
      : `<span class="knet-mark"><img src="/knet-logo.png" alt="KNET"></span>`;
    const choice = value => `<button type="button" class="payment-choice ${method === value ? "selected" : ""}" data-method="${value}" role="radio" aria-checked="${method === value}"><span class="payment-radio"></span>${mark(value)}<strong>${value === "applepay" ? "Apple Pay" : "كي نت"}</strong></button>`;
    const display = data.display || {};
    const timeLines = (display.deliveryTimeLines || []).map(line => `<span>${escapeHtml(line)}</span>`).join("");
    $("#shareKicker").textContent = `رابط دفع لطلب ${data.customerName || ""}`.trim();
    setBody(`
      <section class="checkout-review checkout-confirmation">
        <section class="checkout-confirm-customer" aria-label="تفاصيل الطلب">
          <div class="checkout-confirm-customer-head"><span class="detail-title-icon">${icons.info}</span><div><small>العميل</small><b>تفاصيل العنوان</b></div></div>
          <div class="checkout-confirm-customer-grid">
            <div class="checkout-confirm-customer-row"><small>الاسم</small><strong>${escapeHtml(data.customerName)}</strong></div>
            <div class="checkout-confirm-customer-row"><small>رقم الهاتف</small><strong class="phone">${escapeHtml(data.phone)}</strong></div>
            ${display.deliverySummary || timeLines ? `<div class="checkout-confirm-customer-row"><small>${escapeHtml(display.deliveryLabel || (data.mode === "pickup" ? "فرع الاستلام" : "عنوان التوصيل"))}</small><strong>${escapeHtml(display.deliverySummary || "—")}</strong></div>
            <div class="checkout-confirm-customer-row"><small>${escapeHtml(display.timeLabel || (data.mode === "pickup" ? "وقت الاستلام" : "وقت التوصيل"))}</small><strong class="delivery-time-lines">${timeLines || "<span>—</span>"}</strong></div>` : ""}
          </div>
        </section>
        <section class="checkout-confirm-totals" aria-label="ملخص الطلب">
          <button class="checkout-confirm-total-row products-toggle" id="productsToggle" type="button" aria-expanded="false" aria-controls="confirmationProducts"><span><b class="arrow">‹</b> تفاصيل الأصناف (${(data.items || []).length})</span></button>
          <div class="confirmation-products hidden" id="confirmationProducts">${(data.items || []).map(item => `<div class="confirmation-product"><img src="${escapeHtml(thumb(item.image) || "/logo.png")}" alt="" onerror="this.src='/logo.png'"><span>${escapeHtml(item.name)} × ${Number(item.quantity)}</span><b>${money(item.total)}</b></div>`).join("")}</div>
          <div class="checkout-confirm-total-row"><span>الإجمالي</span><strong>${money(data.subtotal)}</strong></div>
          ${data.couponCode ? `<div class="checkout-confirm-total-row coupon-saving"><span>خصم الكوبون <bdi>${escapeHtml(data.couponCode)}</bdi></span><strong>−${money(data.discount)}</strong></div>` : ""}
          ${data.mode === "delivery" ? `<div class="checkout-confirm-total-row"><span>رسوم التوصيل</span><strong>${money(data.deliveryFee)}</strong></div>` : ""}
          <div class="checkout-confirm-total-row checkout-confirm-final-total"><span>الإجمالي النهائي</span><strong>${money(data.total)}</strong></div>
        </section>
        ${notice ? `<div class="share-notice" role="alert">${escapeHtml(notice)}</div>` : ""}
        <div class="confirmation-sticky-actions">
          ${apple ? `<div class="payment-method-choices" role="radiogroup" aria-label="اختر طريقة الدفع">${choice("applepay")}${choice("knet")}</div>` : ""}
          <div class="actions"><button class="primary pay-now" id="finish">${mark(method)}<span>ادفع الآن</span></button></div>
        </div>
      </section>`);
    $("#productsToggle").onclick = () => {
      const open = $("#confirmationProducts").classList.toggle("hidden") === false;
      $("#productsToggle").classList.toggle("open", open);
      $("#productsToggle").setAttribute("aria-expanded", String(open));
    };
    document.querySelectorAll("[data-method]").forEach(button => button.onclick = () => { method = button.dataset.method; renderInvoice(data, notice); });
    $("#finish").onclick = () => pay(data);
    schedulePoll();
  }

  async function pay(data) {
    if (method === "knet" && Number(data.total) < 0.1) return renderInvoice(data, "الحد الأدنى للدفع عبر KNET هو 0.100 د.ك");
    clearTimeout(pollTimer);
    setBody(`<div class="loading-state"><div class="spinner"></div><h3>جاري التحويل لصفحة الدفع…</h3><p>نجهّز رابط دفع آمن</p></div>`, "جاري التحويل");
    try {
      const result = await api(`/pay-share/${encodeURIComponent(shareId)}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethod: method }) });
      const target = new URL(result.paymentUrl);
      const host = target.hostname.toLowerCase();
      const allowed = target.protocol === "https:" && ["bookeey.com", "kpay.com.kw", "kpaytest.com.kw", "bede.kw"].some(base => host === base || host.endsWith(`.${base}`));
      if (!allowed) throw new Error("رابط الدفع غير صالح");
      location.assign(target.href);
    } catch (error) {
      if (error.status === 410 || error.status === 404) return load();
      renderInvoice(data, error.message || "تعذر بدء الدفع، حاول مرة أخرى");
    }
  }

  // تحديث هادئ: إن أُلغيت المشاركة أو دُفعت تظهر النتيجة بدون إعادة تحميل.
  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      try {
        const data = await api(`/pay-share/${encodeURIComponent(shareId)}`);
        if (data.status !== "active") return showStatus(data);
      } catch {}
      schedulePoll();
    }, 10000);
  }

  // بعد الرجوع من صفحة الدفع الناجحة: ننتظر تأكيد البوابة.
  async function waitForPaid() {
    setBody(`<div class="loading-state"><div class="spinner"></div><h3>جاري التحقق من الدفع…</h3><p>لحظات ويتم تأكيد العملية</p></div>`, "التحقق من الدفع");
    const started = Date.now();
    while (Date.now() - started < 3 * 60 * 1000) {
      try {
        const data = await api(`/pay-share/${encodeURIComponent(shareId)}`);
        if (data.status === "paid") return showPaid(data.orderId);
        if (data.status !== "active") return showStatus(data);
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    return load("لم يتأكد الدفع بعد. إن خُصم المبلغ سيتأكد الطلب تلقائياً خلال دقائق.");
  }

  async function load(notice = "") {
    try {
      const data = await api(`/pay-share/${encodeURIComponent(shareId)}`);
      if (data.status === "active") return renderInvoice(data, notice);
      return showStatus(data);
    } catch (error) {
      showMessage("cancelled", error.status === 404 ? "الرابط غير صحيح" : "تعذر فتح الفاتورة", `<p>${escapeHtml(error.status === 404 ? "تأكد من الرابط المرسل لك." : error.message)}</p>`);
    }
  }

  if (!/^[A-Za-z0-9]{12}$/.test(shareId)) {
    showMessage("cancelled", "الرابط غير صحيح", `<p>تأكد من الرابط المرسل لك.</p>`);
    return;
  }
  if (returned) history.replaceState({}, "", `${location.pathname}#${shareId}`);
  if (returned === "success") waitForPaid();
  else load(returned === "failed" ? "لم تتم عملية الدفع. يمكنك المحاولة مرة أخرى." : "");
})();
