// «مساعدك الذكي» — واجهة المحادثة. يعمل فوق script.js بدون تعديله:
// • الزر يظهر فقط بعد أن يؤكد السيرفر أهلية الحساب (الحماية الفعلية بالسيرفر، هنا إخفاء فقط).
// • كل ما يُعرض من السيرفر يمر بفحص شكل البيانات، والنصوص تُكتب textContent (لا HTML).
// • إضافة السلة تتم بمسار السلة الأصلي (addSelectedOptionsToCart / changeQuantity) بعد حجز الإجراء من السيرفر،
//   ولا يظهر «أضيفت» إلا بعد أن تتغير السلة فعلاً.
(() => {
  "use strict";
  if (typeof PICKER_MODE !== "undefined" && PICKER_MODE) return;
  const tools = document.getElementById("homeTools");
  if (!tools || typeof orderingApiUrl !== "function") return;

  const TEXT = {
    ar: {
      button: "مساعدك الذكي", title: "مساعدك الذكي", pilot: "تجربة أولية", close: "إغلاق", fresh: "محادثة جديدة", clear: "مسح السجل",
      placeholder: "اكتب طلبك… مثل: ضيف لي فطاير زعتر", send: "إرسال", greeting: name => `هلا${name ? ` ${name}` : ""} 👋 قول لي شنو تبي من المنيو وأضيفه لسلتك.`,
      starters: ["شنو عندكم زعتر؟", "ضيف لي بالسلة فطاير زعتر", "أبي أقدم شكوى"], retention: days => `المحادثة تنحفظ ${days} يوم، وتقدر تمسحها بأي وقت.`,
      thinking: "أفكر…", searching: "أدور بالمنيو…", cart: "أجهّز السلة…", loading: "جاري التحميل…", retry: "إعادة المحاولة",
      cut: "انقطع الاتصال قبل اكتمال الرد.", failed: "تعذر الاتصال بالمساعد.", busy: "المساعد يرد على رسالتك السابقة، لحظة وجرّب.",
      add: "أضف للسلة", choose: "اختر وأضف", soldOut: "غير متوفر", onSelection: "السعر حسب الاختيار", quantity: "الكمية", qty: n => `× ${n}`,
      adding: "جاري الإضافة للسلة…", added: "أضيفت للسلة ✓", notAdded: "ما تمت الإضافة", inCart: (count, total) => `في سلتك الآن ${count} · الإجمالي ${total}`,
      viewCart: "عرض السلة", otherTab: "تمت معالجتها من نافذة ثانية.", stale: "ما اكتملت الإضافة، اطلبها من جديد.", priceChanged: "تغيّر السعر، اطلب الإضافة من جديد.", unavailable: "المنتج مو متوفر حالياً.",
      whatsapp: "فتح واتساب", supportNote: "ترسل رسالتك بنفسك للفرع مباشرة.", clearAsk: "تمسح المحادثة وكل ما حفظه المساعد عنك؟", yes: "نعم، امسح", no: "إلغاء", cleared: "تم مسح المحادثة",
      interrupted: "الرد ما اكتمل.", limit: max => `الحد ${max} حرف`, linked: "تم تفعيل مساعدك الذكي على هذا الجهاز"
    },
    en: {
      button: "Smart assistant", title: "Your smart assistant", pilot: "Pilot", close: "Close", fresh: "New chat", clear: "Clear history",
      placeholder: "Ask for anything on the menu…", send: "Send", greeting: name => `Hi${name ? ` ${name}` : ""} 👋 Tell me what you want from the menu and I will add it to your cart.`,
      starters: ["What zaatar items do you have?", "Add zaatar fatayer to my cart", "I want to file a complaint"], retention: days => `Chats are kept for ${days} days. You can clear them any time.`,
      thinking: "Thinking…", searching: "Searching the menu…", cart: "Preparing your cart…", loading: "Loading…", retry: "Try again",
      cut: "The connection dropped before the reply finished.", failed: "Could not reach the assistant.", busy: "Still replying to your previous message. Try again in a moment.",
      add: "Add to cart", choose: "Choose & add", soldOut: "Unavailable", onSelection: "Price on selection", quantity: "Quantity", qty: n => `× ${n}`,
      adding: "Adding to your cart…", added: "Added to cart ✓", notAdded: "Not added", inCart: (count, total) => `Cart now has ${count} · Total ${total}`,
      viewCart: "View cart", otherTab: "Handled in another window.", stale: "The add did not finish. Please ask again.", priceChanged: "The price changed. Please ask again.", unavailable: "This item is not available right now.",
      whatsapp: "Open WhatsApp", supportNote: "You send the message to the branch yourself.", clearAsk: "Clear this chat and everything the assistant saved about you?", yes: "Yes, clear", no: "Cancel", cleared: "Chat cleared",
      interrupted: "The reply did not finish.", limit: max => `Limit ${max} characters`, linked: "Your smart assistant is now active on this device"
    }
  };
  const lang = () => (state.lang === "en" ? "en" : "ar");
  const t = key => TEXT[lang()][key];
  const pick = (ar, en) => (lang() === "en" ? (en || ar) : (ar || en)) || "";
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const MAX_CHARS = 500;
  const SPARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.7 4.6a2 2 0 0 0 1.2 1.2l4.6 1.7-4.6 1.7a2 2 0 0 0-1.2 1.2L12 18.5l-1.7-4.6a2 2 0 0 0-1.2-1.2L4.5 11l4.6-1.7a2 2 0 0 0 1.2-1.2L12 3.5Z"/><path class="fa-spark-dot" d="M18.5 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z"/></svg>`;
  const tabId = (() => {
    try { const saved = sessionStorage.getItem("figsOlivesAssistantTab"); if (saved) return saved; } catch { /* خاص */ }
    const fresh = `tab-${(crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 24)}`;
    try { sessionStorage.setItem("figsOlivesAssistantTab", fresh); } catch { /* خاص */ }
    return fresh;
  })();
  const newId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);

  // ---------- الهيكل ----------
  const button = el("button", "home-assistant");
  button.type = "button"; button.id = "assistantButton"; button.hidden = true;
  button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", "assistantPanel");
  button.innerHTML = `${SPARK}<span></span>`;
  tools.insertBefore(button, document.getElementById("homeLanguageToggle"));

  const layer = el("div", "fa-layer"); layer.id = "assistantLayer"; layer.hidden = true;
  const backdrop = el("button", "fa-backdrop"); backdrop.type = "button"; backdrop.tabIndex = -1;
  const panel = el("section", "fa-panel"); panel.id = "assistantPanel";
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-labelledby", "assistantTitle");
  const head = el("header", "fa-head");
  const titleWrap = el("div", "fa-title");
  titleWrap.innerHTML = SPARK;
  const title = el("h2"); title.id = "assistantTitle";
  const badge = el("small", "fa-badge");
  titleWrap.append(title, badge);
  const headButton = (className, path) => { const node = el("button", `fa-icon ${className}`); node.type = "button"; node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`; return node; };
  const freshButton = headButton("fa-fresh", "M12 5v14M5 12h14");
  const clearButton = headButton("fa-clear", "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5");
  const closeButton = headButton("fa-close", "M6 6l12 12M18 6L6 18");
  head.append(titleWrap, freshButton, clearButton, closeButton);
  const confirmBar = el("div", "fa-confirm"); confirmBar.hidden = true;
  const log = el("div", "fa-log"); log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite"); log.tabIndex = 0;
  const form = el("form", "fa-form");
  const input = el("textarea", "fa-input"); input.rows = 1; input.maxLength = MAX_CHARS; input.setAttribute("enterkeyhint", "send"); input.autocomplete = "off";
  const sendButton = el("button", "fa-send"); sendButton.type = "submit";
  sendButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6"/></svg>`;
  form.append(input, sendButton);
  panel.append(head, confirmBar, log, form);
  layer.append(backdrop, panel);
  document.body.append(layer);

  // ---------- الحالة ----------
  let eligible = false, isOpen = false, busy = false, epoch = 0, controller = null, loadedKey = "", firstName = "", retentionDays = 0;
  let pendingEnroll = (location.hash.match(/assistant-enroll=([a-f0-9]{32,64})/) || [])[1] || "";
  const sessionKey = () => `${state.user?.phone || ""}|${String(customerSessionToken || "").slice(-16)}`;
  const mobile = () => matchMedia("(max-width: 760px)").matches;
  const appliedKey = phone => `figsOlivesAssistantApplied:${phone}`;
  const appliedIds = phone => { try { return JSON.parse(localStorage.getItem(appliedKey(phone))) || []; } catch { return []; } };
  const markApplied = (phone, id) => { try { localStorage.setItem(appliedKey(phone), JSON.stringify([...appliedIds(phone).filter(item => item !== id), id].slice(-60))); } catch { /* ممتلئ */ } };

  async function api(path, body) {
    const token = customerSessionToken;
    if (!token) throw Object.assign(new Error("no session"), { status: 401 });
    const response = await fetch(orderingApiUrl(path), {
      method: body === undefined ? "GET" : "POST", cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(typeof data.error === "string" ? data.error : t("failed")), { status: response.status });
    return data;
  }

  function applyLabels() {
    const direction = lang() === "ar" ? "rtl" : "ltr";
    button.querySelector("span").textContent = t("button");
    button.setAttribute("aria-label", t("button"));
    panel.dir = direction; panel.lang = lang();
    title.textContent = t("title"); badge.textContent = t("pilot");
    freshButton.title = t("fresh"); freshButton.setAttribute("aria-label", t("fresh"));
    clearButton.title = t("clear"); clearButton.setAttribute("aria-label", t("clear"));
    closeButton.setAttribute("aria-label", t("close")); backdrop.setAttribute("aria-label", t("close"));
    input.placeholder = t("placeholder"); input.setAttribute("aria-label", t("placeholder")); sendButton.setAttribute("aria-label", t("send"));
  }

  function setEligible(value) {
    eligible = Boolean(value);
    button.hidden = !eligible;
    if (!eligible) { stopStream(); close(false); log.replaceChildren(); loadedKey = ""; }
  }
  function stopStream() { epoch += 1; controller?.abort(); controller = null; busy = false; syncComposer(); }

  // الأهلية تُسأل من السيرفر عند كل تغيّر في الجلسة (دخول، خروج، تبديل حساب).
  let checkedKey = null;
  async function checkEligibility() {
    const key = sessionKey();
    checkedKey = key;
    stopStream();
    if (!state.user?.phone || !customerSessionToken) return setEligible(false);
    try {
      if (pendingEnroll) {
        const code = pendingEnroll; pendingEnroll = "";
        history.replaceState(null, "", location.pathname + location.search);
        try {
          const result = await api("/assistant/enroll", { code });
          if (sessionKey() === key && result.sessionToken) { saveCustomerSession(result, state.user.phone); checkedKey = sessionKey(); toast(t("linked")); }
        } catch { /* رابط منتهي أو حساب غير مشمول: يبقى الزر مخفياً */ }
      }
      const data = await api("/assistant/eligibility");
      if (sessionKey() !== checkedKey) return;
      if (isOpen && data.eligible === true && loadedKey && loadedKey !== checkedKey) { log.replaceChildren(); loadedKey = ""; }
      setEligible(data.eligible === true);
      if (eligible && isOpen) loadConversation();
    } catch { if (sessionKey() === checkedKey) setEligible(false); }
  }
  let watchedLang = state.lang;
  setInterval(() => {
    if (sessionKey() !== checkedKey) checkEligibility();
    if (state.lang !== watchedLang) { watchedLang = state.lang; applyLabels(); if (isOpen && !busy) { loadedKey = ""; loadConversation(); } }
  }, 1200);

  // ---------- فتح وإغلاق ----------
  function fitViewport() {
    const viewport = window.visualViewport;
    if (!viewport || !mobile()) { layer.style.removeProperty("--fa-height"); layer.style.removeProperty("--fa-bottom"); return; }
    layer.style.setProperty("--fa-height", `${Math.round(viewport.height)}px`);
    layer.style.setProperty("--fa-bottom", `${Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))}px`);
  }
  window.visualViewport?.addEventListener("resize", () => { if (isOpen) { fitViewport(); scrollDown(); } });
  window.visualViewport?.addEventListener("scroll", () => { if (isOpen) fitViewport(); });
  function open() {
    if (!eligible || isOpen) return;
    isOpen = true;
    layer.hidden = false;
    panel.setAttribute("aria-modal", String(mobile()));
    button.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("fa-open");
    fitViewport();
    requestAnimationFrame(() => { layer.classList.add("fa-in"); input.focus({ preventScroll: true }); });
    loadConversation();
  }
  function close(restoreFocus = true) {
    if (!isOpen) return;
    isOpen = false;
    layer.classList.remove("fa-in");
    layer.hidden = true;
    confirmBar.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("fa-open");
    if (restoreFocus && !button.hidden) button.focus({ preventScroll: true });
  }
  button.addEventListener("click", () => (isOpen ? close() : open()));
  closeButton.addEventListener("click", () => close());
  backdrop.addEventListener("click", () => close());
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.stopPropagation(); return close(); }
    if (event.key !== "Tab" || !mobile()) return;
    const focusable = [...panel.querySelectorAll("button:not([disabled]):not([hidden]), textarea, a[href], [tabindex='0']")].filter(node => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  // ---------- العرض ----------
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const fils = value => money(Number(value) / 1000);
  function syncComposer() { sendButton.disabled = busy || !input.value.trim(); input.disabled = false; log.classList.toggle("fa-busy", busy); }
  function disableOldControls() { log.querySelectorAll(".fa-live").forEach(node => { node.classList.remove("fa-live"); node.querySelectorAll("button[data-fa-input]").forEach(control => { control.disabled = true; }); }); }
  function userBubble(text) { const node = el("div", "fa-msg fa-user"); node.append(el("p", "", text)); log.append(node); scrollDown(); return node; }
  function showGreeting() {
    const node = el("div", "fa-msg fa-bot fa-greeting");
    node.append(el("p", "", t("greeting")(firstName)));
    const chips = el("div", "fa-chips");
    for (const starter of t("starters")) { const chip = el("button", "fa-chip", starter); chip.type = "button"; chip.addEventListener("click", () => send({ text: starter })); chips.append(chip); }
    node.append(chips);
    if (retentionDays) node.append(el("small", "fa-note", t("retention")(retentionDays)));
    log.append(node);
  }

  // فحص شكل كل حدث قبل عرضه؛ أي شيء غير متوقع يُهمل.
  const isText = (value, max = 400) => typeof value === "string" && value.length <= max;
  const isFils = value => Number.isInteger(value) && value >= 0 && value <= 100000000;
  const isId = value => typeof value === "string" && value.length > 0 && value.length <= 100;
  function validAction(action) {
    return action && /^a[a-f0-9]{30}$/.test(action.id) && isId(action.productId) && Array.isArray(action.selections) && action.selections.length <= 60
      && action.selections.every(entry => entry && isId(entry.stepId) && isId(entry.id) && Number.isInteger(entry.quantity) && entry.quantity >= 1 && entry.quantity <= 999)
      && Number.isInteger(action.quantity) && action.quantity >= 1 && action.quantity <= 99 && isFils(action.expectedFils)
      && ["proposed", "claimed", "confirmed", "failed", "rejected", "expired"].includes(action.status);
  }
  function validPart(part) {
    if (!part || typeof part !== "object") return false;
    if (part.type === "text") return isText(part.text ?? part.delta, 8000);
    if (part.type === "products") return Array.isArray(part.items) && part.items.length <= 8 && part.items.every(item => item && isId(item.id) && isText(item.nameAr) && (item.priceFils === null || isFils(item.priceFils)));
    if (part.type === "choices") {
      if (!isId(part.productId) || !["option", "quantity", "confirm"].includes(part.kind)) return false;
      if (part.kind === "option") return isId(part.stepId) && Array.isArray(part.options) && part.options.length <= 40 && part.options.every(option => option && isId(option.id) && isText(option.ar));
      if (part.kind === "quantity") return Array.isArray(part.options) && part.options.every(value => Number.isInteger(value) && value >= 1 && value <= 99);
      return isFils(part.priceFils) && Number.isInteger(part.quantity);
    }
    if (part.type === "support") return part.url === null || /^https:\/\/wa\.me\/\d{10,15}$/.test(part.url);
    if (part.type === "cart_link") return true;
    if (part.type === "cart_action") return typeof part.actionId === "string" || validAction(part.action);
    return false;
  }

  function inputButton(label, className, payload) {
    const control = el("button", className, label);
    control.type = "button"; control.dataset.faInput = "1";
    control.addEventListener("click", () => { if (!control.disabled) send({ input: payload, label }); });
    return control;
  }
  function productsNode(part) {
    const list = el("div", "fa-cards fa-live");
    for (const card of part.items) {
      const local = product(card.id);
      const node = el("article", "fa-card");
      const image = el("img"); image.alt = ""; image.loading = "lazy";
      const source = local ? productImages(local)[0] : "";
      image.src = source ? thumbnailUrl(source) : "logo.png";
      image.addEventListener("error", () => { if (!image.dataset.fallback) { image.dataset.fallback = "1"; image.src = source || "logo.png"; } });
      const body = el("div", "fa-card-body");
      body.append(el("strong", "", pick(card.nameAr, card.nameEn)));
      const available = card.available === true && Boolean(local);
      body.append(el("span", "fa-price", card.priceFils === null ? t("onSelection") : fils(card.priceFils)));
      const action = available ? inputButton(card.needsOptions ? t("choose") : t("add"), "fa-add", { type: "add", productId: card.id }) : Object.assign(el("button", "fa-add", t("soldOut")), { type: "button", disabled: true });
      node.append(image, body, action);
      list.append(node);
    }
    return list;
  }
  function choicesNode(part) {
    const box = el("div", "fa-choice fa-live");
    const name = pick(part.productAr, part.productEn);
    if (part.kind === "confirm") {
      box.append(el("strong", "", name));
      const summary = pick(part.summaryAr, part.summaryEn);
      if (summary) box.append(el("span", "fa-summary", summary));
      box.append(el("span", "fa-price", `${t("qty")(part.quantity)} · ${fils(part.priceFils)}`));
      box.append(inputButton(t("add"), "fa-add", { type: "add", productId: part.productId }));
      return box;
    }
    box.append(el("strong", "", part.kind === "quantity" ? pick(part.titleAr, part.titleEn) || t("quantity") : pick(part.titleAr, part.titleEn)));
    if (name) box.append(el("span", "fa-summary", name));
    const chips = el("div", "fa-chips");
    if (part.kind === "quantity") for (const value of part.options) chips.append(inputButton(String(value), "fa-chip fa-chip-qty", { type: "quantity", productId: part.productId, value }));
    else for (const option of part.options) {
      const label = pick(option.ar, option.en);
      const chip = inputButton(label, "fa-chip", { type: "choose", productId: part.productId, stepId: part.stepId, optionId: option.id });
      if (isFils(option.priceFils) && option.priceFils > 0) chip.append(el("small", "", fils(option.priceFils)));
      chips.append(chip);
    }
    box.append(chips);
    return box;
  }
  function supportNode(part) {
    // إذا ما انضبط رقم الفرع في السيرفر نستخدم رابط الدعم الرسمي الموجود أصلاً في المتجر.
    const official = document.querySelector("#whatsappMenu a[href^='https://wa.me/']")?.href || "";
    const url = part.url || (/^https:\/\/wa\.me\/\d{10,15}$/.test(official) ? official : "");
    const box = el("div", "fa-support");
    box.append(el("strong", "", pick(part.titleAr, part.titleEn) || pick("واتساب فرع التوصيل", "Delivery branch WhatsApp")));
    box.append(el("small", "", t("supportNote")));
    if (url) { const link = el("a", "fa-whatsapp", t("whatsapp")); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; box.append(link); }
    return box;
  }
  function cartLinkNode() {
    const control = el("button", "fa-view-cart", t("viewCart")); control.type = "button";
    control.addEventListener("click", () => { if (mobile()) close(false); document.getElementById("headerCart")?.click(); });
    return control;
  }
  function paintAction(card, action, note = "") {
    card.replaceChildren();
    card.dataset.status = action.status;
    const label = `${pick(action.nameAr, action.nameEn)}${pick(action.summaryAr, action.summaryEn) ? ` — ${pick(action.summaryAr, action.summaryEn)}` : ""}`;
    if (action.status === "confirmed") {
      card.append(el("strong", "fa-ok", t("added")), el("span", "fa-summary", `${label} ${t("qty")(action.quantity)} · ${fils(action.expectedFils)}`));
      if (action.result && Number.isInteger(action.result.count) && isFils(action.result.subtotalFils)) card.append(el("span", "fa-total", t("inCart")(action.result.count, fils(action.result.subtotalFils))));
      card.append(cartLinkNode());
    } else if (["proposed", "claimed"].includes(action.status) && !note) {
      card.append(el("strong", "fa-wait", t("adding")), el("span", "fa-summary", `${label} ${t("qty")(action.quantity)}`));
    } else {
      card.append(el("strong", "fa-bad", t("notAdded")), el("span", "fa-summary", `${label} ${t("qty")(action.quantity)}`), el("small", "", note || (isText(action.reason, 200) ? action.reason : t("stale"))));
    }
    scrollDown();
  }
  function actionNode(action, live) {
    const card = el("div", "fa-cart");
    paintAction(card, action);
    if (action.status === "proposed" || (action.status === "claimed" && live) || (action.status === "claimed" && appliedIds(state.user?.phone).includes(action.id))) runAction(action, card);
    else if (action.status === "claimed") paintAction(card, action, t("stale"));
    return card;
  }
  function partNode(part, actions, live) {
    if (!validPart(part)) return null;
    if (part.type === "text") return el("p", "", part.text);
    if (part.type === "products") return productsNode(part);
    if (part.type === "choices") return choicesNode(part);
    if (part.type === "support") return supportNode(part);
    if (part.type === "cart_link") return cartLinkNode();
    const action = part.action || actions?.[part.actionId];
    return validAction(action) ? actionNode(action, live) : null;
  }

  // ---------- السلة ----------
  // تبويب ثانٍ قد يكون غيّر السلة: نأخذ آخر نسخة محفوظة قبل أي كتابة.
  function syncCartFromStorage() {
    const phone = state.user?.phone;
    if (!phone) return;
    try {
      const stored = localStorage.getItem(cartStorageKey(phone));
      if (stored && stored !== JSON.stringify(state.cart)) { const parsed = JSON.parse(stored); if (parsed && typeof parsed === "object") { state.cart = parsed; renderCartBar(); syncAllProductQuantityControls(); } }
    } catch { /* نبقي السلة الحالية */ }
  }
  window.addEventListener("storage", event => { if (eligible && state.user?.phone && event.key === cartStorageKey(state.user.phone)) syncCartFromStorage(); });

  // يبني اختيارات السلة من كتالوج المتصفح نفسه بمعرّفات الإجراء المعتمد، بنفس شكل مسار الخيارات الأصلي.
  function buildSelection(item, action) {
    const picked = stepId => action.selections.filter(entry => entry.stepId === stepId);
    const flow = productSelectionFlow(item);
    if (flow) {
      const selected = [], byStep = {};
      for (const step of flow.steps) {
        byStep[step.id] = picked(step.id).map(entry => {
          const option = step.items.find(candidate => candidate.id === entry.id);
          return option ? { ...option, quantity: entry.quantity, flowStepId: step.id, isFilling: step.distributeQuantity === true, nameSuffix: step.required !== false && step.multiple !== true } : null;
        });
        if (!byStep[step.id].length || byStep[step.id].includes(null)) return null;
        selected.push(...byStep[step.id]);
      }
      if (selected.length !== action.selections.length) return null;
      return { selected, quantity: selectedFlowQuantity(flow, byStep) };
    }
    const config = productOptions(item);
    if (!config) return action.selections.length ? null : { selected: [], quantity: action.quantity };
    if (config.nestedEnabled) {
      const chain = [];
      let pool = config.items;
      for (const stepId of ["l1", "l2", "l3"]) {
        const entry = picked(stepId)[0];
        if (!entry) break;
        const option = pool.find(candidate => candidate.id === entry.id);
        if (!option) return null;
        chain.push(chain.length ? { ...option, quantity: 1, nameSuffix: true, showQuantity: false } : { ...option, nameSuffix: true });
        pool = option.subOptions || [];
      }
      if (chain.length !== action.selections.length || chain.length < 2) return null;
      return { selected: chain, quantity: action.quantity };
    }
    const selected = picked("option").map(entry => {
      const option = config.items.find(candidate => candidate.id === entry.id);
      return option ? { ...option, quantity: entry.quantity, showQuantity: item.options?.optionQuantityEnabled === true, nameSuffix: config.required === true && config.multiple !== true } : null;
    });
    if (selected.includes(null) || selected.length !== action.selections.length || (config.required && !selected.length)) return null;
    return { selected, quantity: action.quantity };
  }
  function priceCheck(action) {
    const item = product(action.productId);
    if (!item || productIsSoldOut(item) || (item.availability?.status && item.availability.status !== "available")) return { reason: "unavailable" };
    const built = buildSelection(item, action);
    if (!built || built.quantity !== action.quantity) return { reason: "mismatch" };
    const total = Math.round(selectionFlowTotal(item, built.selected, built.quantity) * 1000);
    return total === action.expectedFils ? { item, built } : { reason: "price" };
  }
  async function runAction(action, card) {
    // Serialize browser cart writes across tabs using the native Web Locks API.
    if (navigator.locks?.request) return navigator.locks.request(`figs-assistant-cart-${state.user?.phone}`, () => applyAction(action, card));
    return applyAction(action, card);
  }
  async function applyAction(action, card) {
    const phone = state.user?.phone, mine = epoch;
    const current = () => mine === epoch && state.user?.phone === phone;
    const report = body => api(`/assistant/actions/${action.id}/result`, { tabId, ...body });
    const cartNow = () => ({ count: cartCount(), subtotalFils: Math.round(subtotal() * 1000) });
    try {
      if (appliedIds(phone).includes(action.id)) {
        // السلة تغيّرت فعلاً في زيارة سابقة وانقطع التبليغ: لا نضيف مرة ثانية.
        const result = await report({ status: "applied", cart: cartNow() }).catch(() => null);
        if (current()) paintAction(card, result && validAction(result.action) && result.action.status === "confirmed" ? result.action : { ...action, status: "confirmed" });
        return;
      }
      const claim = await api(`/assistant/actions/${action.id}/claim`, { tabId });
      if (!current() || !validAction(claim.action)) return;
      if (!claim.execute) {
        let latest = claim.action;
        if (latest.status === "claimed") {
          paintAction(card, latest, t("otherTab"));
          for (let tries = 0; tries < 12 && current(); tries += 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const status = await api(`/assistant/actions/${action.id}`).catch(() => null);
            if (status && validAction(status.action)) latest = status.action;
            if (latest.status !== "claimed") break;
          }
        }
        if (current()) { syncCartFromStorage(); paintAction(card, latest, latest.status === "claimed" ? t("otherTab") : ""); }
        return;
      }
      syncCartFromStorage();
      let check = priceCheck(claim.action);
      if (check.reason === "price" || check.reason === "mismatch") { await refreshCatalogFromServer().catch(() => false); if (!current()) return; check = priceCheck(claim.action); }
      if (check.reason) {
        const message = check.reason === "unavailable" ? t("unavailable") : check.reason === "price" ? t("priceChanged") : t("stale");
        await report({ status: "failed", reason: check.reason }).catch(() => null);
        return paintAction(card, { ...claim.action, status: "failed" }, message);
      }
      if (appliedIds(phone).includes(action.id)) return paintAction(card, { ...claim.action, status: "confirmed" });
      // Confirm that the original cart path really changed quantity and price before reporting success.
      const before = cartNow();
      // مسار السلة الأصلي في المتجر، ثم نسجّل فوراً أن هذا الإجراء نُفّذ حتى لا يتكرر.
      if (check.built.selected.length || productSelectionFlow(check.item) || productOptions(check.item)) addSelectedOptionsToCart(String(check.item.id), check.built.selected, check.built.quantity);
      else { changeQuantity(String(check.item.id), check.built.quantity); toast(tr("added")); }
      const totals = cartNow();
      if (totals.count - before.count !== claim.action.quantity || totals.subtotalFils - before.subtotalFils !== claim.action.expectedFils) {
        await report({ status: "failed", reason: "cart_write_not_confirmed" }).catch(() => null);
        return paintAction(card, { ...claim.action, status: "failed" }, t("notAdded"));
      }
      markApplied(phone, action.id);
      const result = await report({ status: "applied", cart: totals }).catch(() => null);
      if (current()) paintAction(card, result && validAction(result.action) && result.action.status === "confirmed" ? result.action : { ...claim.action, status: "confirmed", result: totals });
    } catch (error) {
      if (!current()) return;
      if (error?.status === 404) return checkEligibility();
      paintAction(card, { ...action, status: "failed" }, t("failed"));
    }
  }

  // ---------- المحادثة ----------
  async function loadConversation() {
    const key = sessionKey();
    if (!eligible || busy || loadedKey === key) return;
    const mine = epoch;
    log.replaceChildren(el("div", "fa-status", t("loading")));
    try {
      const data = await api("/assistant/conversation");
      if (mine !== epoch || key !== sessionKey()) return;
      loadedKey = key;
      firstName = isText(data.firstName, 40) ? data.firstName : "";
      retentionDays = Number.isInteger(data.retentionDays) ? data.retentionDays : 0;
      log.replaceChildren();
      const messages = Array.isArray(data.messages) ? data.messages.slice(-60) : [];
      if (!messages.length) return showGreeting();
      messages.forEach((message, index) => {
        if (message.role === "user") return isText(message.text, 2000) && userBubble(message.text);
        const node = el("div", "fa-msg fa-bot");
        const live = index === messages.length - 1;
        for (const part of Array.isArray(message.parts) ? message.parts : []) { const child = partNode(part, data.actions, live); if (child) node.append(child); }
        if (message.interrupted) node.append(el("small", "fa-note", t("interrupted")));
        if (node.childNodes.length) log.append(node);
        if (!live) node.querySelectorAll(".fa-live").forEach(group => { group.classList.remove("fa-live"); group.querySelectorAll("button[data-fa-input]").forEach(control => { control.disabled = true; }); });
      });
      scrollDown();
    } catch (error) {
      if (mine !== epoch) return;
      if (error?.status === 404 || error?.status === 401) return checkEligibility();
      const status = el("div", "fa-status fa-error", t("failed"));
      const again = el("button", "fa-retry", t("retry")); again.type = "button"; again.addEventListener("click", loadConversation);
      status.append(again);
      log.replaceChildren(status);
    }
  }

  async function send(request, retryOf = null) {
    if (busy || !eligible) return;
    const payload = retryOf || { clientMessageId: newId(), lang: lang(), ...(request.input ? { input: request.input } : { text: String(request.text || "").trim().slice(0, MAX_CHARS) }) };
    if (!payload.input && !payload.text) return;
    const mine = epoch;
    busy = true; syncComposer();
    controller = new AbortController();
    log.querySelector(".fa-greeting")?.remove();
    disableOldControls();
    const mineBubble = retryOf ? null : userBubble(payload.input ? request.label || "…" : payload.text);
    const bubble = el("div", "fa-msg fa-bot");
    const status = el("div", "fa-typing"); status.append(el("i"), el("i"), el("i"), el("span", "", t("thinking")));
    bubble.append(status);
    log.append(bubble); scrollDown();
    let textNode = null, finished = false, failure = null;
    const showStatus = label => { status.querySelector("span").textContent = label; bubble.append(status); status.hidden = false; };
    const handle = event => {
      if (!event || typeof event !== "object") return;
      if (event.type === "start") { if (mineBubble && isText(event.userText, 2000)) mineBubble.firstChild.textContent = event.userText; return; }
      if (event.type === "status") return showStatus(t(["searching", "cart"].includes(event.state) ? event.state : "thinking"));
      if (event.type === "done") { finished = true; return; }
      if (event.type === "error") { failure = { message: isText(event.message, 300) ? event.message : t("failed"), retryable: event.retryable === true }; return; }
      if (event.type === "text") {
        if (!isText(event.delta, 8000)) return;
        status.hidden = true;
        // عرض تدريجي: كل جزء يُلحق بنفس الفقرة.
        if (!textNode) { textNode = el("p"); bubble.insertBefore(textNode, status); }
        textNode.textContent += event.delta;
        return scrollDown();
      }
      const node = partNode(event, null, true);
      if (!node) return;
      status.hidden = true; textNode = null;
      bubble.insertBefore(node, status);
      scrollDown();
    };
    try {
      const response = await fetch(orderingApiUrl("/assistant/messages"), {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${customerSessionToken}` }, body: JSON.stringify(payload)
      });
      if (mine !== epoch) return;
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 || response.status === 401) { checkEligibility(); return; }
        throw Object.assign(new Error(response.status === 409 ? t("busy") : response.status === 413 ? t("limit")(MAX_CHARS) : (typeof data.error === "string" ? data.error : t("failed"))), { retryable: response.status !== 413 && response.status !== 400 });
      }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        // رد متأخر بعد خروج أو تبديل حساب لا يُعرض.
        if (mine !== epoch) { reader.cancel().catch(() => {}); return; }
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
          if (chunk.startsWith("data: ")) { try { handle(JSON.parse(chunk.slice(6))); } catch { /* حدث تالف يُهمل */ } }
        }
      }
      if (!finished && !failure) throw Object.assign(new Error(t("cut")), { retryable: true });
    } catch (error) {
      if (mine !== epoch) return;
      failure = { message: error?.name === "AbortError" ? t("cut") : error?.retryable === undefined ? t("cut") : error.message, retryable: error?.retryable !== false };
    } finally {
      if (mine === epoch) {
        status.remove();
        if (failure) {
          const box = el("div", "fa-error", failure.message);
          if (failure.retryable) {
            // إعادة المحاولة ترسل نفس معرّف الرسالة: السيرفر يعيد نفس الرد ولا يكرر أي إضافة للسلة.
            const again = el("button", "fa-retry", t("retry")); again.type = "button";
            again.addEventListener("click", () => { bubble.remove(); send(null, payload); });
            box.append(again);
          }
          bubble.append(box);
        }
        if (!bubble.childNodes.length) bubble.remove();
        busy = false; controller = null; syncComposer(); scrollDown();
        if (isOpen && !mobile()) input.focus({ preventScroll: true });
      }
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = ""; input.style.height = ""; syncComposer();
    send({ text });
  });
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 110)}px`; syncComposer(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });

  freshButton.addEventListener("click", async () => {
    if (busy) return;
    try { await api("/assistant/conversation/new", {}); loadedKey = ""; await loadConversation(); input.focus({ preventScroll: true }); }
    catch (error) { toast(error.message, "error"); }
  });
  clearButton.addEventListener("click", () => {
    if (busy) return;
    confirmBar.replaceChildren(el("span", "", t("clearAsk")));
    const yes = el("button", "fa-danger", t("yes")), no = el("button", "", t("no"));
    yes.type = no.type = "button";
    no.addEventListener("click", () => { confirmBar.hidden = true; clearButton.focus(); });
    yes.addEventListener("click", async () => {
      confirmBar.hidden = true;
      try { await api("/assistant/conversation/clear", {}); try { localStorage.removeItem(appliedKey(state.user?.phone)); } catch { /* لا شيء */ } loadedKey = ""; await loadConversation(); toast(t("cleared")); }
      catch (error) { toast(error.message, "error"); }
      input.focus({ preventScroll: true });
    });
    confirmBar.append(yes, no);
    confirmBar.hidden = false;
    no.focus();
  });

  applyLabels();
  syncComposer();
  checkEligibility();
})();
