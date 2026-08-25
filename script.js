const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const orderingConfig = window.ORDERING_CONFIG || {};
const firebaseServices = window.ORDERING_FIREBASE;
let firebaseAuthUser = null;
let firebaseProfileHydrated = false;
let customerProfileRef = null;
let customerProfileListener = null;

// نطلب من المتصفح حفظ مساحة الموقع بشكل دائم قدر الإمكان. هذا مهم خصوصاً
// في iPhone/Safari حتى لا تُعامل بيانات تسجيل الدخول كتخزين مؤقت.
async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (error) {
    // عدم دعم المتصفح لهذه الميزة لا يعني فشل تسجيل الدخول.
    console.warn("Persistent browser storage is unavailable", error);
    return false;
  }
}

const persistentStorageReady = requestPersistentStorage();

// Safari قد يتعامل مع الجلسة كجلسة مؤقتة إن لم نطلب التخزين الدائم صراحةً.
// نضبطها قبل أي تسجيل دخول، ولا تُمسح إلا عند اختيار العميل «تسجيل خروج».
const firebasePersistenceReady = (async () => {
  if (!firebaseServices?.auth || !window.firebase?.auth?.Auth?.Persistence?.LOCAL) return null;
  try {
    await firebaseServices.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
  } catch (error) {
    console.error("Firebase local persistence setup failed", error);
  }
  return null;
})();

const firebaseIdentityReady = new Promise(resolve => {
  if (!firebaseServices) return resolve(null);
  let unsubscribe = null;
  unsubscribe = firebaseServices.auth.onAuthStateChanged(async user => {
    if (!user) {
      try {
        await firebasePersistenceReady;
        await firebaseServices.auth.signInAnonymously();
      } catch (error) {
        console.error("Firebase anonymous sign-in failed", error);
        unsubscribe?.();
        resolve(null);
      }
      return;
    }
    firebaseAuthUser = user;
    unsubscribe?.();
    resolve(user);
  });
});

const translations = {
  ar: {
    brand: "مخبز التين والزيتون", tagline: "طبيعي، صحي، مصنوع بحب", yourCart: "سلتك",
    deliveryEverywhere: "توصيل لجميع مناطق الكويت", heroTitle: "أكل صحي بطعم<br>يستحق التكرار",
    heroText: "اختر من منتجاتنا الطبيعية والمخبوزات الطازجة، ونحن نتكفل بالباقي.",
    naturalIngredients: "مكونات طبيعية", dailyPreparation: "تحضير يومي", securePayment: "دفع آمن",
    catalogPromise: "جميع مخبوزاتنا من خبز وفطاير وبسكويت يصنع من القمح الكامل والخميرة الطبيعية، أو الرز وخميرة الرز الطبيعية، أو اللوز وخميرة اللوز الطبيعية، ولا نستخدم الطحين الأبيض أو الزيوت المهدرجة أو الخميرة التجارية.", searchPlaceholder: "ابحث عن منتج…", searchStart: "اكتب اسم المنتج لعرض النتائج",
    all: "الكل", products: "منتج", add: "إضافة +", added: "تمت إضافة المنتج", inCart: "في السلة",
    total: "الإجمالي", checkout: "إتمام الدفع ←", back: "رجوع", noResults: "لا توجد منتجات مطابقة",
    order: "طلبك", completeOrder: "إتمام الطلب", review: "المراجعة", deliveryDetails: "تفاصيل التسليم",
    deliveryTime: "وقت التوصيل", pickupTime: "وقت الاستلام", withinTwoHours: "خلال ساعتين", withinTwoHoursHint: "يصلك الطلب في أقرب وقت متاح",
    chooseSpecificTime: "اختيار وقت محدد", chooseSpecificTimeHint: "حدد اليوم والساعة المناسبة لك",
    notifyWhenReady: "إبلاغي عند اكتمال الطلب", notifyWhenReadyHint: "سيتواصل معك الفرع عندما يصبح الطلب جاهزاً",
    chooseArrivalTime: "تحديد وقت الوصول للفرع", chooseArrivalTimeHint: "حدد اليوم والوقت المتوقع لوصولك",
    deliveryDate: "التاريخ", hour: "الساعة", minute: "الدقائق", period: "الفترة",
    morning: "صباحاً", evening: "مساءً", chooseValidTime: "يرجى اختيار تاريخ ووقت قادم",
    chooseTimeAfterMinimum: "للطلبات في نفس اليوم اختر وقتاً بعد ساعتين على الأقل من الوقت الحالي",
    deliveryHoursNotice: "مواعيد التوصيل من 9:30 صباحاً إلى 10:30 مساءً",
    pickupHoursNotice: "ساعات دوام الفرع الرسمية من الساعة ٨ صباحاً حتى الساعة ١٠:٣٠ مساءً.",
    lateDeliveryWarning: "قد يتعرض طلبك للتأجيل بسبب تأخر الوقت.. سارع في إتمام الطلب",
    expectedDeliveryTime: "الوقت المتوقع للتوصيل", betweenTime: "بين", andTime: "إلى",
    scheduledDeliveryTime: "وقت التوصيل المحدد", scheduledPickupTime: "وقت الوصول المحدد",
    pickupStatus: "حالة الاستلام", pickupContactConfirmation: "سيتم التواصل معك من الفرع لتأكيد الطلب",
    confirmPay: "تأكيد ودفع", confirmContinue: "تأكيد ومتابعة", productsTotal: "قيمة المنتجات",
    deliveryFee: "قيمة التوصيل", delivery: "توصيل", pickup: "استلام", chooseBranch: "يرجى اختيار الفرع",
    completeDelivery: "يرجى اختيار عنوان للتوصيل", preparing: "لحظة واحدة…",
    redirecting: "جاري التحويل إلى بوابة الدفع", creatingSecureLink: "ننشئ رابط دفع آمن لطلبك…",
    paymentUnavailable: "خدمة الدفع الإلكتروني ومتابعة حالتها لم يتم ربطهما بالخادم بعد.",
    invalidSecureLink: "رابط الدفع المستلم غير آمن", createFailed: "تعذر إنشاء رابط الدفع",
    createTimeout: "استغرق إنشاء الرابط وقتاً أطول من المتوقع. يمكنك إعادة المحاولة بأمان.",
    checkingPayment: "جارٍ التحقق من الدفع", checkingResult: "نتحقق من نتيجة عملية الدفع",
    autoAccept: "سيتم نقلك إلى صفحة قبول الطلب فور تأكيد العملية.", returnGateway: "العودة إلى بوابة الدفع",
    createNewPaymentLink: "إنشاء رابط دفع جديد",
    stillPending: "الدفع ما زال قيد الانتظار… نتحقق تلقائياً.",
    tempCheckError: "تعذر التحقق مؤقتاً، سنواصل المحاولة تلقائياً…",
    declinedTitle: "لم يتم قبول الدفع", declinedText: "لم يتم اعتماد الطلب ولم يُسجل كطلب مدفوع. يمكنك المحاولة مرة أخرى.",
    retry: "المحاولة من جديد", backToPayment: "العودة للدفع", unconfirmed: "تعذر تأكيد حالة الدفع",
    unconfirmedText: "لن نسجل الطلب كمدفوع حتى نحصل على تأكيد من Bede.", checkAgain: "التحقق مرة أخرى",
    startFailed: "تعذر بدء الدفع", linkNotCreated: "لم يتم إنشاء رابط الدفع", received: "تم استلام الطلب",
    orderNumber: "رقم الطلب", backStore: "العودة للمتجر", downloadInvoice: "تحميل الفاتورة",
    preparingInvoiceDownload: "جاري تجهيز الفاتورة…", customer: "العميل", payOnline: "الدفع: أونلاين",
    quantity: "الكمية", price: "السعر", item: "الصنف", thankYou: "شكراً لزيارتكم!",
    healthPhrase: "صحتك أغلى ما تملك، فتناول شيئاً صحياً.", loadingError: "تعذر تحميل البيانات. يجب رفع جميع الملفات مع index.html.",
    details: "تفاصيل المنتج", addToCart: "إضافة إلى السلة", image: "صورة المنتج", chooseOptions: "اختر الخيارات", optionsRequired: "يرجى اختيار خيار واحد على الأقل", optionOptional: "يمكنك اختيار ما يناسبك", optionSingle: "اختر خياراً واحداً", optionMultiple: "يمكنك اختيار أكثر من خيار",
    login: "تسجيل الدخول", myAccount: "حسابي", loginFirst: "يرجى تسجيل الدخول أولاً",
    phone: "رقم الهاتف", phoneHint: "اكتب رقم الهاتف من 8 أرقام", confirmPhone: "تأكيد الرقم",
    invalidPhone: "رقم الهاتف يجب أن يتكون من 8 أرقام", codeSent: "أرسلنا رمز الدخول إلى واتساب",
    enterCode: "اكتب رمز الدخول المكون من 4 أرقام", resendCode: "إعادة إرسال رمز الدخول",
    resendAfter: "إعادة إرسال رمز الدخول بعد", invalidCode: "رمز الدخول غير صحيح", verifying: "جارٍ التحقق…",
    welcome: "أهلاً بك.. في مخبز التين والزيتون", username: "اسم المستخدم", confirm: "تأكيد",
    nameRequired: "يرجى كتابة اسم المستخدم", myInfo: "معلوماتي", myAddresses: "عناويني", myOrders: "طلباتي",
    logout: "تسجيل خروج", save: "حفظ", edit: "تعديل", delete: "حذف", changePhone: "تغيير رقم الهاتف",
    infoSaved: "تم حفظ معلوماتك", addressesEmpty: "لا يوجد عناوين مسجلة", addAddress: "إضافة عنوان",
    areaSearch: "ابحث عن منطقة", addressDetails: "تفاصيل العنوان", addressPlaceholder: "القطعة، الشارع، المنزل والدور…",
    chooseArea: "اختر المنطقة", addressSaved: "تم حفظ العنوان", selectAddress: "اختر عنوان التوصيل",
    noAddedAddresses: "لا يوجد عناوين مضافة", ordersEmpty: "لا توجد طلبات سابقة",
    viewInvoice: "عرض / طباعة الفاتورة", viewOrderDetails: "عرض تفاصيل الطلب", orderDetails: "تفاصيل الطلب",
    paid: "مدفوع", customerName: "الاسم", choosePaymentMethod: "اختر طريقة الدفع",
    deliveryAddress: "عنوان التوصيل", pickupBranch: "فرع الاستلام", payNow: "ادفع الآن",
    showProducts: "عرض تفاصيل المنتجات", hideProducts: "إخفاء تفاصيل المنتجات",
    knet: "كي نت", knetHint: "الانتقال إلى صفحة الدفع الآمنة من KNET", applePay: "Apple Pay",
    loginServiceUnavailable: "خدمة تسجيل الدخول غير مربوطة حالياً", sendFailed: "تعذر إرسال رمز الدخول",
    verifyFailed: "تعذر التحقق من الرمز", accountSyncFailed: "تعذر فتح بيانات حسابك المحفوظة. حاول تسجيل الدخول مرة أخرى.",
    loggedOut: "تم تسجيل الخروج", invoiceFailed: "تعذر إنشاء الفاتورة. حاول مرة أخرى.",
    noZoom: ""
  },
  en: {
    brand: "Figs & Olives Bakery", tagline: "Natural, healthy, made with love", yourCart: "Cart",
    deliveryEverywhere: "Delivery across Kuwait", heroTitle: "Healthy food with a taste<br>worth repeating",
    heroText: "Choose from our natural products and fresh bakes, and we will handle the rest.",
    naturalIngredients: "Natural ingredients", dailyPreparation: "Prepared daily", securePayment: "Secure payment",
    catalogPromise: "All our bread, fatayer and biscuits are made with whole wheat and natural sourdough, rice and natural rice starter, or almonds and natural almond starter. We never use white flour, hydrogenated oils or commercial yeast.", searchPlaceholder: "Search products…", searchStart: "Type a product name to see results",
    all: "All", products: "products", add: "Add +", added: "Product added", inCart: "In cart",
    total: "Total", checkout: "Checkout →", back: "Back", noResults: "No matching products",
    order: "Your order", completeOrder: "Complete order", review: "Review", deliveryDetails: "Delivery details",
    deliveryTime: "Delivery time", pickupTime: "Pickup time", withinTwoHours: "Within two hours", withinTwoHoursHint: "Your order will arrive as soon as possible",
    chooseSpecificTime: "Choose a specific time", chooseSpecificTimeHint: "Select the day and time that suits you",
    notifyWhenReady: "Notify me when ready", notifyWhenReadyHint: "The branch will contact you when your order is ready",
    chooseArrivalTime: "Choose branch arrival time", chooseArrivalTimeHint: "Select your expected arrival date and time",
    deliveryDate: "Date", hour: "Hour", minute: "Minutes", period: "Period",
    morning: "AM", evening: "PM", chooseValidTime: "Please choose a future date and time",
    chooseTimeAfterMinimum: "For same-day orders, choose a time at least two hours from now",
    deliveryHoursNotice: "Delivery hours are from 9:30 AM to 10:30 PM",
    pickupHoursNotice: "Official branch hours are from 8:00 AM to 10:30 PM.",
    lateDeliveryWarning: "Your order may be delayed because it is late. Please complete it soon.",
    expectedDeliveryTime: "Expected delivery time", betweenTime: "Between", andTime: "and",
    scheduledDeliveryTime: "Scheduled delivery time", scheduledPickupTime: "Scheduled arrival time",
    pickupStatus: "Pickup status", pickupContactConfirmation: "The branch will contact you to confirm the order",
    confirmPay: "Confirm & pay", confirmContinue: "Confirm and continue", productsTotal: "Products value",
    deliveryFee: "Delivery fee", delivery: "Delivery", pickup: "Pickup", chooseBranch: "Please choose a branch",
    completeDelivery: "Please select a delivery address", preparing: "One moment…",
    redirecting: "Redirecting to the payment gateway", creatingSecureLink: "Creating a secure payment link…",
    paymentUnavailable: "Online payment and status tracking are not connected yet.",
    invalidSecureLink: "The received payment link is not secure", createFailed: "Could not create payment link",
    createTimeout: "Creating the link took longer than expected. You can retry safely.",
    checkingPayment: "Checking payment", checkingResult: "Checking your payment result",
    autoAccept: "You will be taken to the accepted order page once payment is confirmed.", returnGateway: "Return to payment",
    createNewPaymentLink: "Create a new payment link",
    stillPending: "Payment is still pending… checking automatically.",
    tempCheckError: "Verification is temporarily unavailable. We will keep trying…",
    declinedTitle: "Payment was not accepted", declinedText: "The payment was not approved and the order was not recorded as paid.",
    retry: "Try again", backToPayment: "Back to payment", unconfirmed: "Payment not confirmed",
    unconfirmedText: "The order will not be marked paid until Bede confirms it.", checkAgain: "Check again",
    startFailed: "Could not start payment", linkNotCreated: "Payment link was not created", received: "Order received",
    orderNumber: "Order number", backStore: "Back to store", downloadInvoice: "Download invoice",
    preparingInvoiceDownload: "Preparing your invoice…", customer: "Customer", payOnline: "Payment: Online",
    quantity: "Qty", price: "Price", item: "Item", thankYou: "Thank you for visiting!",
    healthPhrase: "Your health is precious—choose something healthy.", loadingError: "Could not load data. Upload every file next to index.html.",
    details: "Product details", addToCart: "Add to cart", image: "Product image", chooseOptions: "Choose options", optionsRequired: "Please select at least one option", optionOptional: "You may choose what suits you", optionSingle: "Choose one option", optionMultiple: "You may choose more than one option",
    login: "Login", myAccount: "My account", loginFirst: "Please login first", phone: "Phone number",
    phoneHint: "Enter your 8-digit phone number", confirmPhone: "Confirm number", invalidPhone: "Phone number must be exactly 8 digits",
    codeSent: "We sent your login code on WhatsApp", enterCode: "Enter the 4-digit login code",
    resendCode: "Resend login code", resendAfter: "Resend login code in", invalidCode: "Incorrect login code",
    verifying: "Verifying…", welcome: "Welcome to Figs & Olives Bakery", username: "Username", confirm: "Confirm",
    nameRequired: "Please enter your username", myInfo: "My information", myAddresses: "My addresses",
    myOrders: "My orders", logout: "Logout", save: "Save", edit: "Edit", delete: "Delete",
    changePhone: "Change phone number", infoSaved: "Your information was saved", addressesEmpty: "No saved addresses",
    addAddress: "Add address", areaSearch: "Search for an area", addressDetails: "Address details",
    addressPlaceholder: "Block, street, house and floor…", chooseArea: "Choose an area", addressSaved: "Address saved",
    selectAddress: "Select delivery address", noAddedAddresses: "No addresses added", ordersEmpty: "No previous orders",
    viewInvoice: "View / print invoice", viewOrderDetails: "View order details", orderDetails: "Order details",
    paid: "Paid", customerName: "Name", choosePaymentMethod: "Choose a payment method", deliveryAddress: "Delivery address",
    pickupBranch: "Pickup branch", payNow: "Pay now", showProducts: "Show product details",
    hideProducts: "Hide product details", loginServiceUnavailable: "Login service is not connected",
    knet: "KNET", knetHint: "Continue to the secure KNET payment page", applePay: "Apple Pay",
    sendFailed: "Could not send login code", verifyFailed: "Could not verify the code",
    accountSyncFailed: "Could not open your saved account data. Please log in again.", loggedOut: "Logged out",
    invoiceFailed: "Could not create the invoice. Please try again.", noZoom: ""
  }
};

const branches = [
  { id: "hawalli", nameAr: "فرع حولي", nameEn: "Hawalli Branch", brandAr: "المطبخ الرئيسي", brandEn: "Main Kitchen", addressAr: "حولي، شارع تونس، مجمع علي فهد الخالد، دور الميزانين", addressEn: "Hawalli, Tunis Street, Ali Fahad Al Khaled Complex, Mezzanine Floor", phone: "66906605 | 22085888" },
  { id: "yarmouk", nameAr: "فرع اليرموك", nameEn: "Yarmouk Branch", brandAr: "مخبز التين والزيتون", brandEn: "Figs & Olives Bakery", addressAr: "اليرموك، قطعة 2، شارع 2", addressEn: "Yarmouk, Block 2, Street 2", phone: "22085889 | 65162277" },
  { id: "abu", nameAr: "فرع أبو الحصانية", nameEn: "Abu Al Hasaniya Branch", brandAr: "مطعم التين الطبيعي", brandEn: "Natural Figs Restaurant", addressAr: "أبو الحصانية، مول 30", addressEn: "Abu Al Hasaniya, The 30 Mall", phone: "22085886 | 99176512" }
];

const PROFILE_KEY = "figsOlivesProfilesV1";
const SESSION_KEY = "figsOlivesSessionV1";
const REMEMBERED_SESSION_COOKIE = "figsOlivesRememberedSession";
const LEGACY_CART_KEY = "figsOlivesCartV1";
const CART_KEY = "figsOlivesCartV2";
const CATALOG_CACHE_KEY = "figsOlivesCatalogV2";
const VISITOR_KEY = "figsOlivesVisitorV1";
const visitorId = localStorage.getItem(VISITOR_KEY) || (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
localStorage.setItem(VISITOR_KEY, visitorId);

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function readRememberedSessionPhone() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REMEMBERED_SESSION_COOKIE}=([^;]*)`));
  return match ? normalizePhone(decodeURIComponent(match[1])) : "";
}

function rememberSession(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;
  // نسخة خفيفة من مفتاح الجلسة، لا تحتوي الاسم أو العنوان أو الطلبات.
  document.cookie = `${REMEMBERED_SESSION_COOKIE}=${encodeURIComponent(normalizedPhone)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
}

function forgetRememberedSession() {
  document.cookie = `${REMEMBERED_SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
}

function loadCurrentUser() {
  const session = readJson(SESSION_KEY, null);
  const profiles = readJson(PROFILE_KEY, {});
  const phone = normalizePhone(session?.phone || readRememberedSessionPhone());
  const profile = profiles[phone] || Object.values(profiles).find(item => normalizePhone(item?.phone) === phone);
  if (!phone || !profile) return null;
  return { ...profile };
}

function normalizeLegacyOrder(order) {
  if (!order || typeof order !== "object") return {};
  const orderId = String(order.orderId || order.id || "");
  return {
    ...order,
    orderId,
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal ?? order.total ?? 0),
    deliveryFee: Number(order.deliveryFee || 0),
    total: Number(order.total || 0)
  };
}

// The order tracker and the customer's invoice must always use the same
// completed-order record. Local storage is only a fallback for offline use.
async function canonicalOnlineOrder(order) {
  if (!order?.orderId || !firebaseServices?.database) return order;
  try {
    const snapshot = await firebaseServices.database.ref(`orderingPlatform/onlineOrders/${order.orderId}`).once("value");
    const remote = snapshot.val();
    if (!remote) return order;
    const merged = { ...order, ...remote, items: Array.isArray(remote.items) ? remote.items : (order.items || []) };
    if (state.user?.orders) {
      state.user.orders = state.user.orders.map(item => item.orderId === merged.orderId ? merged : item);
      persistUser();
    }
    if (state.lastInvoice?.orderId === merged.orderId) state.lastInvoice = merged;
    return merged;
  } catch (error) {
    console.warn("Could not refresh completed order", error);
    return order;
  }
}

function cartStorageKey(phone) {
  return phone ? `${CART_KEY}:${normalizePhone(phone)}` : "";
}

function loadUserCart(user) {
  if (!user?.phone) return {};
  const stored = readJson(cartStorageKey(user.phone), null);
  if (stored && typeof stored === "object") return stored;
  const legacy = readJson(LEGACY_CART_KEY, {});
  if (Object.keys(legacy).length) {
    localStorage.setItem(cartStorageKey(user.phone), JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_CART_KEY);
    return legacy;
  }
  return {};
}

const initialUser = loadCurrentUser();
const DEFAULT_APPEARANCE = Object.freeze({
  heroImage: "",
  heroPositionX: 50,
  heroPositionY: 50,
  heroTextColor: "#18352a",
  badgeBackgroundColor: "#ffffff",
  badgeTextColor: "#18352a",
  heroTitle: "",
  heroBadges: []
});
const state = {
  products: [], categories: [], headings: [], areas: [], cart: loadUserCart(initialUser), search: "", activeCategory: "all", activeHeadingId: "", activeSubheadingId: "",
  catalogType: "bakery",
  restaurantEnabled: true,
  lang: localStorage.getItem("storeLanguage") === "en" ? "en" : "ar",
  step: 1, mode: "delivery", area: null, branch: "", addressId: "", address: "",
  name: "", phone: "", order: "", paymentRequestId: "", detailProductId: "",
  paymentMethod: "", deliveryTiming: "asap", scheduledDate: "", scheduledHour: "1",
  scheduledMinute: "00", scheduledPeriod: "pm", user: initialUser, lastInvoice: null,
  appearance: { ...DEFAULT_APPEARANCE },
  advertisement: null,
  productFilters: [],
  activeProductFilterId: ""
};

let imageObserver;
let scrollFrame;
let pendingScrollCategoryId = "";
let pendingScrollUntil = 0;
let toastTimer;
let paymentWatchVersion = 0;
let resendTimer;
let pendingCartProductId = "";
let pendingCartAnchor = null;
let pendingOptionProductId = "";
let pendingOptionAnchor = null;
let productOptionsPopover = null;
let pendingPrimaryOption = null;
let pendingGeneralOptionSelections = [];
let pendingGeneralOptionQuantities = {};
let pendingSelectionFlow = null;
let pendingFlowSelections = {};
let pendingFlowStep = 0;
let authMode = "login";
let authPhone = "";
// تفعيل مؤقت إلى أن يكتمل ربط WhatsApp Business Platform الرسمي.
// أعدها إلى false لإرجاع التحقق برمز واتساب.
const TEMPORARY_PHONE_CONFIRMATION_LOGIN = true;
let accountReturnToCheckout = false;
let catalogScrollPosition = 0;
let userSyncTimer;
let pendingPaymentResumed = false;
let catalogSignature = "";
let shownAdvertisementKey = "";
let restaurantProductImages = {};
let pageScrollLocked = false;
let pageScrollLockY = 0;
const invoiceFileCache = new Map();
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function tr(key) {
  return translations[state.lang][key] || translations.ar[key] || key;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

function validHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function validPercent(value, fallback = 50) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

function normalizeAppearance(value = {}) {
  let heroImage = "";
  try {
    const candidate = new URL(String(value.heroImage || ""));
    if (candidate.protocol === "https:") heroImage = candidate.href;
  } catch {
    heroImage = "";
  }
  return {
    heroImage,
    heroPositionX: validPercent(value.heroPositionX, DEFAULT_APPEARANCE.heroPositionX),
    heroPositionY: validPercent(value.heroPositionY, DEFAULT_APPEARANCE.heroPositionY),
    heroTextColor: validHexColor(value.heroTextColor, DEFAULT_APPEARANCE.heroTextColor),
    badgeBackgroundColor: validHexColor(value.badgeBackgroundColor, DEFAULT_APPEARANCE.badgeBackgroundColor),
    badgeTextColor: validHexColor(value.badgeTextColor, DEFAULT_APPEARANCE.badgeTextColor),
    heroTitle: String(value.heroTitle || "").trim().slice(0, 120),
    heroBadges: Array.isArray(value.heroBadges) ? value.heroBadges.map(text => String(text || "").trim().slice(0, 45)) : []
  };
}

function appearanceForCatalog(value, catalogType = state.catalogType) {
  return normalizeAppearance(value?.catalogs?.[catalogType] || value);
}

function applyStoreAppearance(value) {
  state.catalogAppearance = value || {};
  state.appearance = appearanceForCatalog(state.catalogAppearance);
  const hero = $("#storeHero");
  if (!hero) return;
  const storeName = $("#brandName");
  if (storeName) storeName.textContent = state.lang === "ar"
    ? (state.catalogType === "restaurant" ? "مطعم التين الطبيعي" : "مخبز التين والزيتون")
    : (state.catalogType === "restaurant" ? "Natural Figs Restaurant" : "Figs & Olives Bakery");
  hero.style.setProperty("--hero-title-color", state.appearance.heroTextColor);
  hero.style.setProperty("--hero-badge-background", state.appearance.badgeBackgroundColor);
  hero.style.setProperty("--hero-badge-text", state.appearance.badgeTextColor);
  hero.style.setProperty("--hero-position-x", `${state.appearance.heroPositionX}%`);
  hero.style.setProperty("--hero-position-y", `${state.appearance.heroPositionY}%`);
  const title = $("h1", hero);
  if (title) {
    title.style.color = state.appearance.heroTextColor;
    if (state.appearance.heroTitle) title.innerHTML = escapeHtml(state.appearance.heroTitle).replace(/\n/g, "<br>");
  }
  $$(".hero-badges span", hero).forEach((badge, index) => {
    badge.style.backgroundColor = state.appearance.badgeBackgroundColor;
    badge.style.color = state.appearance.badgeTextColor;
    if (state.appearance.heroBadges[index]) badge.textContent = state.appearance.heroBadges[index];
  });
  hero.classList.toggle("has-hero-image", Boolean(state.appearance.heroImage));
  hero.style.backgroundImage = state.appearance.heroImage
    ? `linear-gradient(rgba(8, 28, 20, .38), rgba(8, 28, 20, .38)), url(${JSON.stringify(state.appearance.heroImage)})`
    : "";
}

function normalizeAdvertisement(value = {}) {
  return { enabled: value?.enabled === true, image: String(value?.image || "").trim(), size: ["square", "portrait", "landscape"].includes(value?.size) ? value.size : "square", targetType: value?.targetType === "link" ? "link" : "product", productId: String(value?.productId || ""), link: String(value?.link || "").trim() };
}

function showAdvertisement(value) {
  const ad = normalizeAdvertisement(value);
  const key = JSON.stringify(ad);
  if (!ad.enabled || !ad.image || shownAdvertisementKey === key) return;
  shownAdvertisementKey = key;
  const modal = $("#advertisementModal"); const card = $("#promotionFrame"); const image = $("#advertisementImageDisplay"); const target = $("#advertisementTarget");
  const href = ad.targetType === "product" ? `#product=${encodeURIComponent(ad.productId)}` : ad.link;
  card.className = `promotion-frame size-${ad.size}`;
  // حماية إضافية من أي قاعدة CSS عامة قد تخفي محتوى النافذة على سطح المكتب.
  card.style.setProperty("display", "block", "important");
  card.style.setProperty("visibility", "visible", "important");
  card.style.setProperty("opacity", "1", "important");
  image.style.setProperty("display", "block", "important");
  image.style.setProperty("visibility", "visible", "important");
  image.src = ad.image; target.href = href || "#";
  modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false");
}

// The selected catalogue is deliberately view-only: a full page load always
// starts at the bakery and never touches the user's saved cart.
function resetCatalogToBakery() {
  state.catalogType = "bakery";
  state.activeCategory = "all";
  applyStoreAppearance(state.catalogAppearance);
}

function applyRestaurantProductImages(items) {
  return items.map(item => {
    const importedImage = restaurantProductImages[String(item.id || "")];
    const currentImage = String(item.image || "");
    return catalogTypeOf(item) === "restaurant" && importedImage && (!currentImage || currentImage === "logo.png")
      ? { ...item, image: importedImage, images: [importedImage] }
      : item;
  });
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizePhone(value) {
  return normalizeDigits(value).replace(/\D/g, "");
}

function normalizeAddressText(value) {
  return normalizeDigits(value);
}

function trLocaleDate(date) {
  return new Date(date).toLocaleString(state.lang === "ar" ? "ar-KW" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function categoryName(category) {
  return state.lang === "ar" ? category.nameAr : (category.nameEn || category.nameAr);
}

function catalogTypeOf(entry) {
  return entry?.catalogType === "restaurant" ? "restaurant" : "bakery";
}

function isCurrentCatalog(entry) {
  return catalogTypeOf(entry) === state.catalogType;
}

function productName(product) {
  return state.lang === "ar" ? product.name : (product.nameEn || product.name);
}

function productDescription(product) {
  return state.lang === "ar" ? (product.description || product.descriptionEn || "") : (product.descriptionEn || product.description || "");
}
function productBadge(product) {
  const filter = activeProductFilter();
  if (filter && filter.products.some(entry => String(entry.productId) === String(product.id))) return state.lang === "ar" ? filter.nameAr : (filter.nameEn || filter.nameAr);
  return state.lang === "ar" ? (product.badgeAr || product.badgeEn || "") : (product.badgeEn || product.badgeAr || "");
}

function productImages(product) {
  return (Array.isArray(product.images) ? product.images : [product.image]).filter(Boolean);
}

function branchField(branch, field) {
  return branch[`${field}${state.lang === "ar" ? "Ar" : "En"}`] || branch[`${field}Ar`];
}

function money(value) {
  return state.lang === "ar" ? `${Number(value).toFixed(3)} د.ك` : `${Number(value).toFixed(3)} KWD`;
}

const minimumOrderUnitLabels = {
  dozen: { ar: "درزن", en: "dozen" }, piece: { ar: "حبة", en: "piece" }, bowl: { ar: "ماعون", en: "bowl" },
  bag: { ar: "كيس", en: "bag" }, kilo: { ar: "كيلو", en: "kilo" }, bottle: { ar: "بطل", en: "bottle" }
};
function minimumOrderConfig(value) {
  if (!value || value.enabled === false) return null;
  const quantity = Math.max(1, Math.min(99, Math.floor(Number(value.quantity) || 1)));
  const unit = minimumOrderUnitLabels[value.unit] ? value.unit : "piece";
  return { quantity, unit };
}
function minimumOrderText(value) {
  const minimum = minimumOrderConfig(value);
  if (!minimum) return "";
  const amount = new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(minimum.quantity);
  return state.lang === "ar" ? `أقل كمية للطلب هي ${amount} ${minimumOrderUnitLabels[minimum.unit].ar}` : `Minimum order: ${amount} ${minimumOrderUnitLabels[minimum.unit].en}`;
}

function product(id) {
  return state.products.find(item => String(item.id) === String(id));
}

function productOptions(item) {
  const config = item?.options;
  if (!config || config.enabled === false || !Array.isArray(config.items)) return null;
  const items = config.items.filter(option => option && (option.nameAr || option.nameEn)).map(option => ({
    id: String(option.id || option.nameAr || option.nameEn), nameAr: String(option.nameAr || option.nameEn || ""), nameEn: String(option.nameEn || option.nameAr || ""), price: Math.max(0, Number(option.price) || 0), preparation: option.preparation || null, image: String(option.image || ""), minimumOrder: minimumOrderConfig(option.minimumOrder),
    subOptions: (Array.isArray(option.subOptions) ? option.subOptions : []).filter(subOption => subOption && (subOption.nameAr || subOption.nameEn)).map(subOption => ({
      id: String(subOption.id || subOption.nameAr || subOption.nameEn), nameAr: String(subOption.nameAr || subOption.nameEn || ""), nameEn: String(subOption.nameEn || subOption.nameAr || ""), price: Math.max(0, Number(subOption.price) || 0)
    }))
  }));
  const nestedEnabled = config.nestedEnabled === true;
  const multiple = nestedEnabled ? false : config.multiple === true;
  return items.length ? { required: nestedEnabled || config.required === true, multiple, maxSelections: multiple ? Math.min(items.length, Math.max(1, Number(config.maxSelections) || items.length)) : 1, titleAr: String(config.titleAr || ""), titleEn: String(config.titleEn || ""), priceBased: nestedEnabled || config.priceBased === true, nestedEnabled, minimumPerOptionEnabled: config.minimumPerOptionEnabled === true, optionQuantityEnabled: config.optionQuantityEnabled === true, items } : null;
}

const STUFFED_BREAD_SELECTION_FLOW = Object.freeze({
  enabled: true,
  steps: [
    {
      id: "dough", titleAr: "اختر نوع العجينة", titleEn: "Choose dough type", required: true, multiple: false,
      items: [
        { id: "dough-wheat", nameAr: "بالقمح الكامل والخميرة الطبيعية", nameEn: "Whole wheat & natural sourdough", price: 0 },
        { id: "dough-rice", nameAr: "بالرز الأبيض الخالي من الجلوتين", nameEn: "White rice - gluten free", price: 1 },
        { id: "dough-almond", nameAr: "بطحين اللوز لنظام الكيتو", nameEn: "Almond flour - Keto", price: 1 },
        { id: "dough-barley", nameAr: "بالشعير الكامل والخميرة الطبيعية", nameEn: "Whole barley & natural sourdough", price: 1, preparation: { first: 1, unit: "day", hasSecond: true, second: 2, secondUnit: "day" } }
      ]
    },
    {
      id: "size", titleAr: "اختر الحجم والكمية", titleEn: "Choose size & quantity", required: true, multiple: false, quantityEnabled: true,
      items: [
        { id: "regular12", nameAr: "صغير عادي (١٢ خبزة = ٢٤ قطعة)", nameEn: "Small regular (12 breads = 24 pieces)", pieces: 24, price: 8 },
        { id: "mini12", nameAr: "حجم ميني (١٢ خبزة)", nameEn: "Mini size (12 breads)", pieces: 12, price: 6 },
        { id: "bite12", nameAr: "حجم لقمة (١٢ خبزة)", nameEn: "Bite size (12 breads)", pieces: 12, price: 4 }
      ]
    },
    {
      id: "fillings", titleAr: "اختر الحشوات", titleEn: "Choose fillings", required: true, multiple: true, quantityEnabled: true,
      distributeQuantity: true, limitFrom: "size",
      items: [
        ["eggplant", "باذنجان", "Eggplant"],
        ["indian-chilli-potatoes", "بطاط هندية حارة", "Indian chilli potatoes"],
        ["potatoes-carrots", "بطاط وجزر وبازلاء", "Potatoes, carrots & peas"],
        ["sprouted-fava-beans", "فول مبرعم", "Sprouted fava beans"],
        ["spinach", "سبانخ", "Spinach"],
        ["mushroom", "مشروم", "Mushroom"],
        ["yellow-squash", "قرع أصفر", "Yellow squash"],
        ["sprouted-falafel", "فلافل مبرعمة", "Sprouted falafel"],
        ["fermented-muhammara", "محمرة مخمرة", "Fermented muhammara"],
        ["purslane", "بربير", "Purslane"],
        ["organic-plain-eggs", "بيض عضوي سادة", "Organic plain eggs"],
        ["organic-eggs-cheese", "بيض عضوي مع الجبن", "Organic eggs with cheese"],
        ["organic-eggs-spinach", "بيض عضوي مع السبانخ", "Organic eggs with spinach"]
      ].map(([id, nameAr, nameEn]) => ({ id, nameAr, nameEn, price: 0 }))
    }
  ]
});

function isFatayerSelectionProduct(item) {
  const label = `${item?.name || ""} ${item?.nameEn || ""}`;
  return /فطاير|فطائر|fatayer/i.test(label);
}

// حشوات الفطاير معرفة برمجياً. ننسخ الحشوة الغنية الموجودة حتى ترث سعرها
// وقواعدها، ولا نُعدّل البيانات الأصلية القادمة من الكتالوج.
function applyFatayerFillingRules(flow) {
  if (!flow?.enabled || !Array.isArray(flow.steps)) return flow;
  return {
    ...flow,
    steps: flow.steps.map(step => {
      const stepLabel = `${step?.id || ""} ${step?.titleAr || ""} ${step?.titleEn || ""}`;
      if (!/fillings|حشوات/i.test(stepLabel)) return step;
      const items = (Array.isArray(step.items) ? step.items : []).filter(option => {
        const optionLabel = `${option?.id || ""} ${option?.nameAr || ""} ${option?.nameEn || ""}`;
        return !/mushroom|مشروم/i.test(optionLabel);
      });
      const alreadyAdded = items.some(option => /عكاوي.*بابريكا|akkawi.*paprika/i.test(`${option?.id || ""} ${option?.nameAr || ""} ${option?.nameEn || ""}`));
      if (alreadyAdded) return { ...step, items };
      const richTemplate = items.find(option => /غنية|rich/i.test(`${option?.groupAr || ""} ${option?.groupEn || ""} ${option?.priceGroup || ""}`));
      return {
        ...step,
        items: [...items, {
          ...(richTemplate ? { ...richTemplate } : { price: 0, groupAr: "الحشوات الغنية", groupEn: "Rich fillings" }),
          id: "akkawi-cheese-paprika",
          nameAr: "جبن عكاوي بالبابريكا",
          nameEn: "Akkawi cheese with paprika"
        }]
      };
    })
  };
}

function productSelectionFlow(item) {
  // هذا المنتج يُعرّف تسلسله في الكود تماماً كالفطاير، ولا يعتمد على خيارات لوحة الإدارة العامة.
  const sourceFlow = String(item?.id) === "9227" ? STUFFED_BREAD_SELECTION_FLOW : item?.options?.selectionFlow;
  const flow = isFatayerSelectionProduct(item) ? applyFatayerFillingRules(sourceFlow) : sourceFlow;
  if (!flow?.enabled || !Array.isArray(flow.steps) || !flow.steps.length) return null;
  const steps = flow.steps.map((step, index) => ({
    id: String(step.id || `step-${index + 1}`),
    titleAr: String(step.titleAr || ""), titleEn: String(step.titleEn || ""),
    required: step.required !== false,
    multiple: step.multiple === true,
    maxSelections: Math.max(1, Number(step.maxSelections) || 1),
    limitFrom: String(step.limitFrom || ""), quantityEnabled: step.quantityEnabled === true,
    items: (Array.isArray(step.items) ? step.items : []).filter(option => option && (option.nameAr || option.nameEn)).map(option => ({
      id: String(option.id || option.nameAr || option.nameEn),
      nameAr: String(option.nameAr || option.nameEn || ""), nameEn: String(option.nameEn || option.nameAr || ""),
      price: Math.max(0, Number(option.price) || 0),
      preparation: option.preparation || null,
      priceGroup: String(option.priceGroup || ""),
      // بعض الحشوات تغيّر سعر الحجم المختار كاملاً، بدلاً من إضافة مبلغ ثابت.
      basePriceOverrideBySize: option.basePriceOverrideBySize && typeof option.basePriceOverrideBySize === "object" ? option.basePriceOverrideBySize : null,
      groupAr: String(option.groupAr || ""),
      groupEn: String(option.groupEn || ""),
      maxFillingSelections: option.maxFillingSelections ?? null,
      pieces: Math.max(1, Number(option.pieces) || 1),
      quantity: Math.max(1, Number(option.quantity) || 1)
    })),
    distributeQuantity: step.distributeQuantity === true
  })).filter(step => step.items.length);
  return steps.length ? { steps } : null;
}

function optionName(option) {
  return state.lang === "ar" ? option.nameAr : (option.nameEn || option.nameAr);
}

function optionSummary(option) {
  const name = optionName(option);
  return option?.showQuantity || option?.isFilling || option?.flowStepId === "fillings"
    ? `${new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(Math.max(1, Number(option.quantity) || 1))} ${name}`
    : name;
}

// الخيار الإلزامي الواحد يعرّف الصنف نفسه (مثل: كيكة بالشوكولاتة)،
// أما الإضافات الاختيارية أو المتعددة فتبقى كسطر تفاصيل منفصل.
function optionBelongsInName(item, option) {
  if (option?.nameSuffix) return true;
  const flowStep = productSelectionFlow(item)?.steps.find(step => step.id === option?.flowStepId);
  if (flowStep) return flowStep.required && !flowStep.multiple;
  const config = productOptions(item);
  return Boolean(config?.required && !config.multiple);
}

function cartDisplayName(item, options = [], language = state.lang) {
  const base = language === "ar" ? item.name : (item.nameEn || item.name);
  const suffixes = (options || [])
    .filter(option => optionBelongsInName(item, option))
    .map(option => language === "ar" ? option.nameAr : (option.nameEn || option.nameAr))
    .filter(Boolean);
  return [base, ...suffixes].filter(Boolean).join(" ");
}

function cartDetailOptions(item, options = []) {
  const config = productOptions(item);
  return (options || []).filter(option => !optionBelongsInName(item, option)).map(option => ({
    ...option,
    showQuantity: option.showQuantity || config?.optionQuantityEnabled === true
  }));
}

function unitPrice(item, selectedOptions = []) {
  const config = productOptions(item);
  if (!config?.priceBased && !productSelectionFlow(item)) return Math.max(0, Number(item?.price) || 0);
  const isSelectionFlow = Boolean(productSelectionFlow(item));
  const groupedPrices = new Map();
  const selectedSize = selectedOptions.find(option => option?.flowStepId === "size");
  const baseOverrides = selectedOptions
    .map(option => Number(option?.basePriceOverrideBySize?.[selectedSize?.id]))
    .filter(Number.isFinite);
  const price = selectedOptions.reduce((sum, option) => {
    const price = Math.max(0, Number(option.price) || 0);
    if (!option.priceGroup) return sum + price * (isSelectionFlow ? 1 : Math.max(1, Number(option.quantity) || 1));
    groupedPrices.set(option.priceGroup, Math.max(groupedPrices.get(option.priceGroup) || 0, price));
    return sum;
  }, 0) + [...groupedPrices.values()].reduce((sum, price) => sum + price, 0);
  // عند اختيار أي حشوة غنية، يستبدل سعر الحجم بسعر الفطاير الغنية نفسه.
  return baseOverrides.length
    ? price + Math.max(...baseOverrides) - Math.max(0, Number(selectedSize?.price) || 0)
    : price;
}

function selectedFlowQuantity(flow, selections) {
  const quantityStep = flow?.steps.find(step => step.quantityEnabled);
  const selected = quantityStep ? (selections?.[quantityStep.id] || [])[0] : null;
  return Math.max(1, Number(selected?.quantity) || 1);
}

function productPriceLabel(item) {
  const config = productOptions(item);
  if (!config?.priceBased && !productSelectionFlow(item)) return money(item.price);
  return state.lang === "ar" ? "السعر عند الاختيار" : "Price on selection";
}

function productPriceMarkup(item) {
  const current = productPriceLabel(item);
  const original = Number(item?.originalPrice || 0);
  if (original > Number(item?.price || 0) && !productOptions(item)?.priceBased && !productSelectionFlow(item)) {
    return `<span class="sale-price"><del>${money(original)}</del><b>${current}</b></span>`;
  }
  return `<span>${current}</span>`;
}

function productIsSoldOut(item) {
  return item?.inventory?.enabled === true && Number(item.inventory.quantity || 0) <= 0;
}

function preparationLabel(item) {
  const prep = item?.preparation || item || {};
  const number = value => state.lang === "ar" ? new Intl.NumberFormat("ar-KW").format(value) : String(value);
  const time = (value, kind) => {
    if (state.lang === "ar") {
      if (kind === "day") return value === 1 ? "يوم" : value === 2 ? "يومين" : `${number(value)} أيام`;
      return value === 1 ? "ساعة" : value === 2 ? "ساعتين" : `${number(value)} ساعات`;
    }
    return `${number(value)} ${kind === "day" ? (value === 1 ? "day" : "days") : (value === 1 ? "hour" : "hours")}`;
  };
  const first = Math.max(1, Number(prep.first) || 2);
  const single = time(first, prep.unit);
  if (!prep.hasSecond || !Number(prep.second)) return state.lang === "ar" ? `خلال ${single}` : `Within ${single}`;
  const second = Math.max(1, Number(prep.second));
  const secondLabel = time(second, prep.secondUnit || prep.unit);
  return state.lang === "ar" ? `خلال ${single} أو ${secondLabel}` : `Within ${single} or ${secondLabel}`;
}

function preparationTakesMoreThanTwoHours(preparation) {
  if (!preparation) return false;
  const toHours = (value, unit) => Math.max(1, Number(value) || 0) * (unit === "day" ? 24 : 1);
  const first = toHours(preparation.first, preparation.unit);
  const second = preparation.hasSecond && Number(preparation.second)
    ? toHours(preparation.second, preparation.secondUnit || preparation.unit)
    : 0;
  return Math.max(first, second) > 2;
}

function cartHasLongPreparationItems() {
  return cartItems().some(({ product: item, options }) => {
    const selectedOptionPreparations = options.map(option => option.preparation).filter(Boolean);
    return selectedOptionPreparations.length
      ? selectedOptionPreparations.some(preparationTakesMoreThanTwoHours)
      : preparationTakesMoreThanTwoHours(item.preparation);
  });
}

function orderHasLongPreparationItems(order) {
  return (order?.items || []).some(item => {
    const selectedOptionPreparations = (item.options || []).map(option => option.preparation).filter(Boolean);
    if (selectedOptionPreparations.length) return selectedOptionPreparations.some(preparationTakesMoreThanTwoHours);
    const catalogProduct = product(item.id);
    return preparationTakesMoreThanTwoHours(item.preparation || catalogProduct?.preparation);
  });
}

function invoicePreparationNotice(order) {
  if (!orderHasLongPreparationItems(order)) return "";
  return `<p class="a4-preparation-notice">ملاحظة: يوجد في طلبك أصناف تأخذ وقت للتجهيز.. لذا يرجى العلم أنه قد يتأخر طلبك أو يتم تأجيله.</p>`;
}

function cartItems() {
  return Object.entries(state.cart).map(([id, value]) => {
    const entry = typeof value === "object" && value ? value : { quantity: value };
    return { product: product(id), quantity: Number(entry.quantity), note: String(entry.note || "").slice(0, 240), options: Array.isArray(entry.options) ? entry.options : [] };
  }).filter(item => item.product && item.quantity > 0);
}

function cartItemMissingRequiredChoice(entry) {
  const options = Array.isArray(entry?.options) ? entry.options : [];
  const flow = productSelectionFlow(entry?.product);
  if (flow) return flow.steps.some(step => !(options || []).some(option => option?.flowStepId === step.id));
  const config = productOptions(entry?.product);
  return Boolean(config?.required && !options.length);
}

function cartItemMinimumIssue(entry) {
  const productMinimum = minimumOrderConfig(entry?.product?.minimumOrder);
  if (productMinimum && Number(entry.quantity) < productMinimum.quantity) return { product: entry.product, minimum: productMinimum };
  const config = productOptions(entry?.product);
  if (config?.minimumPerOptionEnabled) {
    const selected = Array.isArray(entry?.options) ? entry.options : [];
    const invalid = selected.find(option => {
      const minimum = minimumOrderConfig(option.minimumOrder);
      return minimum && Number(option.quantity || 1) < minimum.quantity;
    });
    if (invalid) return { product: entry.product, option: invalid, minimum: minimumOrderConfig(invalid.minimumOrder) };
  }
  return null;
}

function resolveMissingCartChoice(entry) {
  if (!entry?.product) return;
  // هذه سلة محفوظة من نسخة سابقة قبل اختيار المنتج؛ نحذف السطر غير المكتمل
  // ثم نفتح الاختيارات مباشرة حتى لا يصل العميل إلى صفحة فشل الدفع.
  delete state.cart[entry.product.id];
  state.paymentRequestId = "";
  persistCart();
  renderCartBar();
  syncProductQuantityControls(entry.product.id);
  if (productSelectionFlow(entry.product)) openSelectionFlow(entry.product.id);
  else openProductOptions(entry.product.id);
  toast(state.lang === "ar" ? "يرجى اختيار تفاصيل المنتج ثم إكمال الدفع" : "Choose the product details, then complete payment", "error");
}
function cartQuantity(id) {
  const value = state.cart[id];
  return Number(typeof value === "object" && value ? value.quantity : value || 0);
}

function cartCount() {
  return cartItems().reduce((sum, item) => sum + item.quantity, 0);
}

function subtotal() {
  return cartItems().reduce((sum, item) => sum + unitPrice(item.product, item.options) * item.quantity, 0);
}

function deliveryFee() {
  return state.mode === "delivery" && state.area ? Number(state.area.price) : 0;
}

function total() {
  return subtotal() + deliveryFee();
}

function toast(message, variant = "") {
  const element = $("#toast");
  element.textContent = message;
  element.classList.toggle("error", variant === "error");
  element.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add("hidden"), 2200);
}

function persistCart() {
  if (!state.user?.phone) return;
  localStorage.setItem(cartStorageKey(state.user.phone), JSON.stringify(state.cart));
  queueUserSync();
}

function reportVisitorPresence() {
  const endpoint = orderingConfig.visitorPresenceWebhookUrl;
  if (!endpoint) return;
  fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ visitorId, visitorType: state.user?.phone ? "registered" : "new", customer: state.user?.phone ? { name: state.user.name, phone: state.user.phone } : null }),
    cache: "no-store", keepalive: true
  }).catch(() => undefined);
}

function trackStoreEvent(type, details = {}) {
  const endpoint = orderingConfig.analyticsWebhookUrl;
  if (!endpoint) return;
  const onceKey = `figsOlivesEvent:${type}:${new Date().toISOString().slice(0, 10)}`;
  if (type === "visit" && sessionStorage.getItem(onceKey)) return;
  if (type === "visit") sessionStorage.setItem(onceKey, "1");
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ type, visitorId, customer: state.user?.name ? { name: state.user.name, phone: state.user.phone } : null, details }),
    cache: "no-store"
  }).catch(() => undefined);
}

function analyticsCartSnapshot() {
  return {
    cartItems: cartItems().map(({ product: item, quantity, options }) => ({
      // التقارير الإدارية تعتمد الاسم العربي دائماً، بغض النظر عن لغة العميل.
      id: String(item.id), name: String(item.name || item.nameAr || item.nameEn || ""), quantity,
      total: Number((unitPrice(item, options) * quantity).toFixed(3))
    })),
    cartValue: Number(subtotal().toFixed(3))
  };
}

function queueUserSync() {
  clearTimeout(userSyncTimer);
  userSyncTimer = setTimeout(() => {
    syncUserToFirebase().catch(error => console.error("Firebase profile sync failed", error));
  }, 500);
}

function persistUser() {
  if (!state.user?.phone) return;
  const profiles = readJson(PROFILE_KEY, {});
  profiles[state.user.phone] = { ...state.user };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  localStorage.setItem(SESSION_KEY, JSON.stringify({ phone: state.user.phone }));
  rememberSession(state.user.phone);
  requestPersistentStorage();
  state.name = state.user.name;
  state.phone = state.user.phone;
  updateAccountButton();
  queueUserSync();
}

async function authenticateFirebaseCustomer(authResult, phone) {
  if (!firebaseServices) return null;
  const customToken = String(authResult?.customToken || "");
  if (!customToken || normalizePhone(phone).length !== 8) {
    throw new Error(tr("accountSyncFailed"));
  }

  try {
    await firebasePersistenceReady;
    const signedIn = await firebaseServices.auth.signInWithCustomToken(customToken);
    firebaseAuthUser = signedIn.user;
    return signedIn.user;
  } catch {
    throw new Error(tr("accountSyncFailed"));
  }
}

async function syncUserToFirebase() {
  const identity = firebaseAuthUser || await firebaseIdentityReady;
  if (!identity || !state.user?.phone || !state.user?.name) return;
  const profile = state.user;
  const phone = normalizePhone(profile.phone);
  // A browser can briefly restore an old local profile before its cloud copy
  // finishes loading. Never let that empty copy erase saved orders/addresses.
  await firebaseServices.database.ref(`orderingPlatform/customers/${identity.uid}`).transaction(current => {
    const remote = current && typeof current === "object" ? current : {};
    const localAddresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    const localOrders = Array.isArray(profile.orders) ? profile.orders : [];
    return {
      ...remote,
      phone,
      name: String(profile.name || remote.name || "").slice(0, 80),
      addresses: !firebaseProfileHydrated && !localAddresses.length && Array.isArray(remote.addresses) ? remote.addresses : localAddresses,
      orders: !firebaseProfileHydrated && !localOrders.length && Array.isArray(remote.orders) ? remote.orders : localOrders,
      cart: state.cart && typeof state.cart === "object" ? state.cart : (remote.cart || {}),
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  });
  firebaseProfileHydrated = true;
}

async function hydrateUserFromFirebase() {
  const identity = firebaseAuthUser || await firebaseIdentityReady;
  if (!identity || !state.user?.phone) return;
  try {
    const snapshot = await firebaseServices.database.ref(`orderingPlatform/customers/${identity.uid}`).once("value");
    const remote = snapshot.val();
    if (!remote || normalizePhone(remote.phone) !== normalizePhone(state.user.phone)) {
      await syncUserToFirebase();
      return;
    }
    state.user = {
      ...state.user,
      ...remote,
      phone: normalizePhone(remote.phone),
      addresses: Array.isArray(remote.addresses) ? remote.addresses : [],
      orders: Array.isArray(remote.orders) ? remote.orders : []
    };
    if (remote.cart && typeof remote.cart === "object") {
      state.cart = remote.cart;
      localStorage.setItem(cartStorageKey(state.user.phone), JSON.stringify(state.cart));
      renderCartBar();
      syncAllProductQuantityControls();
    }
    const profiles = readJson(PROFILE_KEY, {});
    profiles[state.user.phone] = { ...state.user };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    state.name = state.user.name;
    state.phone = state.user.phone;
    firebaseProfileHydrated = true;
    updateAccountButton();
    watchCustomerCart(identity.uid);
  } catch (error) {
    console.error("Firebase profile load failed", error);
  }
}

// حتى لو حُذفت نسخة الجلسة المحلية أو انتهت بعد فترة، Firebase يعيد جلسة
// العميل المعتمدة تلقائياً. نسترجع ملفه من UID نفسه بدل إجباره على طلب رمز OTP.
async function restoreSavedCustomerSession() {
  if (state.user?.phone || !firebaseServices?.database) return;
  try {
    await persistentStorageReady;
    const identity = firebaseAuthUser || await firebaseIdentityReady;
    if (!identity || identity.isAnonymous) return;
    const snapshot = await firebaseServices.database.ref(`orderingPlatform/customers/${identity.uid}`).once("value");
    const profile = snapshot.val();
    if (!profile || normalizePhone(profile.phone).length !== 8 || !String(profile.name || "").trim()) return;
    state.user = {
      ...profile,
      phone: normalizePhone(profile.phone),
      name: String(profile.name).trim(),
      addresses: Array.isArray(profile.addresses) ? profile.addresses : [],
      orders: Array.isArray(profile.orders) ? profile.orders : []
    };
    state.cart = profile.cart && typeof profile.cart === "object" ? profile.cart : loadUserCart(state.user);
    localStorage.setItem(cartStorageKey(state.user.phone), JSON.stringify(state.cart));
    persistUser();
    firebaseProfileHydrated = true;
    watchCustomerCart(identity.uid);
    updateAccountButton();
    renderCartBar();
    syncAllProductQuantityControls();
    reportVisitorPresence();
  } catch (error) {
    console.warn("Saved customer session could not be restored", error);
  }
}

// الحساب نفسه يملك نسخة سلة واحدة في Firebase. عند فتحه من جهاز آخر، نأخذ
// آخر نسخة محفوظة فوراً بدلاً من إبقاء نسخة محلية قديمة كسلة مستقلة.
function watchCustomerCart(uid) {
  if (!uid || !state.user?.phone) return;
  if (customerProfileRef && customerProfileListener) customerProfileRef.off("value", customerProfileListener);
  customerProfileRef = firebaseServices.database.ref(`orderingPlatform/customers/${uid}`);
  customerProfileListener = snapshot => {
    const remote = snapshot.val();
    if (!remote || normalizePhone(remote.phone) !== normalizePhone(state.user?.phone) || !remote.cart || typeof remote.cart !== "object") return;
    const remoteCart = remote.cart;
    if (JSON.stringify(remoteCart) === JSON.stringify(state.cart)) return;
    state.cart = remoteCart;
    localStorage.setItem(cartStorageKey(state.user.phone), JSON.stringify(state.cart));
    renderCartBar();
    syncAllProductQuantityControls();
  };
  customerProfileRef.on("value", customerProfileListener);
}

function updateAccountButton() {
  const button = $("#accountButton");
  const label = $("#accountButtonLabel");
  if (state.user?.name) {
    button.classList.add("logged-in");
    label.textContent = state.user.name;
    button.setAttribute("aria-label", tr("myAccount"));
  } else {
    button.classList.remove("logged-in");
    label.textContent = tr("login");
    button.setAttribute("aria-label", tr("login"));
  }
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = state.lang === "ar" ? "منصة طلبات التين والزيتون" : "Figs & Olives Ordering";
  $$("[data-i18n]").forEach(element => element.textContent = tr(element.dataset.i18n));
  $$("[data-i18n-html]").forEach(element => element.innerHTML = tr(element.dataset.i18nHtml));
  $$("[data-i18n-placeholder]").forEach(element => element.placeholder = tr(element.dataset.i18nPlaceholder));
  $("#languageLabel").textContent = state.lang === "ar" ? "English" : "العربية";
  applyStoreAppearance(state.catalogAppearance);
  renderCatalogSwitch();
  renderProductFilters();
  $(".steps [data-step='1'] span").textContent = tr("review");
  $(".steps [data-step='2'] span").textContent = tr("deliveryDetails");
  $(".steps [data-step='3'] span").textContent = tr("deliveryTime");
  $(".steps [data-step='4'] span").textContent = tr("confirmPay");
  updateAccountButton();
}

function setLanguage(language) {
  state.lang = language;
  localStorage.setItem("storeLanguage", language);
  applyLanguage();
  renderCategories();
  renderProductFilters();
  renderProductSections();
  renderSearchResults();
  renderCartBar();
  if (!$("#checkoutModal").classList.contains("hidden")) renderCheckout();
  if (!$("#accountDrawer").classList.contains("hidden")) renderAccountHome();
  if (state.detailProductId) renderProductDetail(state.detailProductId);
}

function sortedCategories() {
  return state.categories.filter(isCurrentCatalog).slice().sort((a, b) => Number(a.order) - Number(b.order));
}

function categoryProducts(categoryId) {
  return state.products.filter(item => item.category === categoryId && isCurrentCatalog(item) && productMatchesActiveFilter(item)).sort((a, b) => Number(a.order) - Number(b.order));
}

function activeProductFilter() { return state.productFilters.find(filter => filter.id === state.activeProductFilterId) || null; }
function productMatchesActiveFilter(item) { const filter = activeProductFilter(); return !filter || filter.products.some(entry => String(entry.productId) === String(item.id)); }
function filterOptionIds(productId, stepId) {
  const entry = activeProductFilter()?.products.find(item => String(item.productId) === String(productId));
  if (!entry) return null;
  const step = entry.steps?.find(value => String(value.stepId) === String(stepId));
  if (step) return step.optionIds || [];
  return entry.firstStepId === stepId ? entry.optionIds || [] : null;
}
function filterLabel(filter) { return state.lang === "ar" ? filter.nameAr : (filter.nameEn || filter.nameAr); }
function renderProductFilters() {
  const menu = $("#productFilterMenu"), toggle = $("#productFilterToggle"), clear = $("#productFilterClear");
  if (!menu || !toggle || !clear) return;
  const filter = activeProductFilter();
  toggle.querySelector("b").textContent = filter ? filterLabel(filter) : (state.lang === "ar" ? "فلترة المنتجات" : "Filter products");
  clear.classList.toggle("hidden", !filter); clear.textContent = state.lang === "ar" ? "حذف الفلتر" : "Clear filter";
  menu.innerHTML = state.productFilters.filter(entry => entry.products.some(product => state.products.some(item => String(item.id) === String(product.productId) && isCurrentCatalog(item)))).map(entry => `<button type="button" data-product-filter="${escapeHtml(entry.id)}" class="${entry.id === state.activeProductFilterId ? "active" : ""}">${escapeHtml(filterLabel(entry))}<small>${entry.products.length}</small></button>`).join("") || `<span>${state.lang === "ar" ? "لا توجد فلاتر متاحة" : "No filters available"}</span>`;
}

function cartHasRestaurantItems() {
  return cartItems().some(({ product }) => catalogTypeOf(product) === "restaurant");
}

function setCatalogType(type) {
  const next = type === "restaurant" ? "restaurant" : "bakery";
  if (next === state.catalogType) return;
  state.catalogType = next;
  applyStoreAppearance(state.catalogAppearance);
  state.activeCategory = "all";
  state.activeHeadingId = "";
  state.activeSubheadingId = "";
  const restaurant = next === "restaurant";
  $("#catalogTransitionTitle").textContent = state.lang === "ar"
    ? (restaurant ? "جاري الانتقال إلى أصناف المطعم" : "جاري الانتقال إلى أصناف المخبز")
    : (restaurant ? "Moving to restaurant items" : "Moving to bakery items");
  $("#catalogTransitionHint").textContent = state.lang === "ar" ? "لحظة من فضلك" : "One moment please";
  $("#catalogTransition").classList.remove("hidden");
  window.setTimeout(() => {
    $("#catalogTransition").classList.add("hidden");
    renderCatalogSwitch();
    renderCategories();
    renderProductSections();
    // Each catalogue has its own banner, so return to the top to show it.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 1000);
}

function renderCatalogSwitch() {
  const button = $("#catalogSwitch");
  if (!button) return;
  if (!state.restaurantEnabled && state.catalogType === "bakery") { button.classList.add("hidden"); return; }
  button.classList.remove("hidden");
  const nextRestaurant = state.catalogType !== "restaurant";
  const label = state.lang === "ar" ? (nextRestaurant ? "أصناف المطعم" : "أصناف المخبز") : (nextRestaurant ? "Restaurant items" : "Bakery items");
  const icon = nextRestaurant
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 3v6.2a3.2 3.2 0 0 0 6.4 0V3M7.6 3v5.2M9.8 3v5.2M8.7 12.4V21M17.2 3v18M17.2 3c2.3 1.5 2.3 6.3 0 7.8h-2.1"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5h17M5.5 20.5v-8.2a6.5 6.5 0 0 1 13 0v8.2M8 20.5v-5.2a4 4 0 0 1 8 0v5.2M9 9.7h6M12 5.7c.9 1.1 1.4 2 1.4 2.8a1.4 1.4 0 1 1-2.8 0c0-.8.5-1.7 1.4-2.8Z"/></svg>`;
  button.innerHTML = `<span class="catalog-switch-icon">${icon}</span><span>${label}</span><i>‹</i>`;
  button.dataset.catalogTarget = nextRestaurant ? "restaurant" : "bakery";
}

function renderCategories() {
  const buttons = [];
  const linkedCategoryIds = new Set((state.headings || []).filter(item => catalogTypeOf(item) === state.catalogType).flatMap(item => [...(item.categoryIds || []), ...(item.subheadings || []).flatMap(group => group.categoryIds || [])]));
  const entries = [
    ...(state.headings || []).filter(item => catalogTypeOf(item) === state.catalogType).map(item => ({ type: "heading", item })),
    ...sortedCategories().filter(category => !linkedCategoryIds.has(category.id) && categoryProducts(category.id).length).map(item => ({ type: "category", item }))
  ].sort((a, b) => Number(a.item.order) - Number(b.item.order) || (a.type === "heading" ? -1 : 1));
  entries.forEach(({ type, item }) => {
    if (type === "heading") buttons.push(`<button class="heading-category-link ${state.activeHeadingId === item.id ? "active" : ""}" data-heading-link="${escapeHtml(item.id)}">${escapeHtml(state.lang === "ar" ? item.nameAr : (item.nameEn || item.nameAr))}</button>`);
    else buttons.push(`<button class="${state.activeCategory === item.id ? "active" : ""}" data-category-link="${escapeHtml(item.id)}">${escapeHtml(categoryName(item))} <small>${categoryProducts(item.id).length}</small></button>`);
  });
  $("#categories").innerHTML = buttons.join("");
  updateHeadingNavigation();
  syncHeadingNavigationOffset();
}

function currentHeading() {
  return (state.headings || []).find(item => item.id === state.activeHeadingId && catalogTypeOf(item) === state.catalogType);
}

function linkedGroupForCategory(heading, categoryId) {
  if (!heading) return null;
  const subheadings = Array.isArray(heading.subheadings) ? heading.subheadings : [];
  if (subheadings.length) return subheadings.find(group => (group.categoryIds || []).includes(categoryId)) || null;
  return (heading.categoryIds || []).includes(categoryId) ? { id: "", categoryIds: heading.categoryIds || [] } : null;
}

function updateHeadingNavigation() {
  const host = $("#headingNavigation"), subheadingRow = $("#subheadingNavigation"), categoryRow = $("#linkedCategoryNavigation"), heading = currentHeading();
  if (!host || !subheadingRow || !categoryRow) return;
  if (!heading) { host.classList.add("hidden"); return; }
  const subheadings = Array.isArray(heading.subheadings) ? heading.subheadings : [];
  const group = subheadings.length ? (subheadings.find(item => item.id === state.activeSubheadingId) || subheadings.find(item => (item.categoryIds || []).includes(state.activeCategory)) || subheadings[0]) : { id: "", categoryIds: heading.categoryIds || [] };
  state.activeSubheadingId = group?.id || "";
  host.classList.remove("hidden");
  subheadingRow.classList.toggle("hidden", !subheadings.length);
  subheadingRow.innerHTML = subheadings.map(item => `<button class="${item.id === state.activeSubheadingId ? "active" : ""}" data-heading-nav="${escapeHtml(heading.id)}" data-subheading-nav="${escapeHtml(item.id)}">${escapeHtml(state.lang === "ar" ? item.nameAr : (item.nameEn || item.nameAr))}</button>`).join("");
  const categories = (group?.categoryIds || []).map(id => state.categories.find(item => item.id === id)).filter(Boolean);
  categoryRow.classList.toggle("hidden", !categories.length);
  categoryRow.innerHTML = categories.map(category => `<button class="${category.id === state.activeCategory ? "active" : ""}" data-linked-nav="${escapeHtml(category.id)}">${escapeHtml(categoryName(category))}</button>`).join("");
  subheadingRow.querySelector(".active")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  categoryRow.querySelector(".active")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  syncHeadingNavigationOffset();
}

function syncHeadingNavigationOffset() {
  const categories = $("#categories");
  const navigation = $("#headingNavigation");
  if (!categories || !navigation) return;
  const bottom = Math.ceil(categories.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty("--categories-height", `${Math.ceil(categories.offsetHeight)}px`);
  navigation.style.top = `${Math.max(0, bottom)}px`;
}

function productQuantityControl(id, quantity, detail = false) {
  const escapedId = escapeHtml(id);
  const item = product(id);
  if ((item?.availability?.status && item.availability.status !== "available") || productIsSoldOut(item)) {
    return `<button class="${detail ? "primary detail-add" : "product-add"} unavailable-add" data-availability-notify="${escapedId}">أبلغني عندما يتوفر</button>`;
  }
  if (!quantity) {
    const hasOptions = Boolean(productOptions(product(id)) || productSelectionFlow(product(id)));
    const label = hasOptions ? (state.lang === "ar" ? "اختيار" : "Select") : (detail ? tr("addToCart") : tr("add"));
    return `<button class="${detail ? "primary detail-add" : "product-add"}" data-product-add="${escapedId}">${label}</button>`;
  }
  return `<div class="product-qty ${detail ? "detail-product-qty" : ""}" aria-label="${escapeHtml(item ? productName(item) : "")}">
    <button type="button" data-product-plus="${escapedId}" aria-label="+">+</button>
    <strong>${quantity}</strong>
    <button type="button" data-product-minus="${escapedId}" aria-label="${quantity === 1 ? "×" : "−"}">${quantity === 1 ? "×" : "−"}</button>
  </div>`;
}

function productCard(item, category) {
  const source = productImages(item)[0] || "logo.png";
  const quantity = cartQuantity(item.id);
  const badge = productBadge(item);
  const optionConfig = productOptions(item);
  const hasOptionPreparation = optionConfig?.items.some(option => option.preparation);
  const availability = productIsSoldOut(item) ? "sold_out" : (item.availability?.status || "available");
  const availabilityText = availability === "sold_out" ? "نفذت الكمية" : availability === "unavailable" ? "غير متوفر" : "";
  return `
    <article class="product-card ${availabilityText ? "unavailable" : ""}" data-product="${escapeHtml(item.id)}" tabindex="0">
      <div class="product-image">
        <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" data-src="${escapeHtml(source)}" width="640" height="580" alt="${escapeHtml(productName(item))}" decoding="async" fetchpriority="low">
        ${badge ? `<span class="product-feature-badge">${escapeHtml(badge)}</span>` : ""}
        ${availabilityText ? `<b class="availability-overlay">${availabilityText}</b>` : ""}
        <b class="in-cart ${quantity ? "" : "hidden"}" data-cart-badge="${escapeHtml(item.id)}">${quantity ? `${tr("inCart")} × ${quantity}` : ""}</b>
      </div>
      <div class="product-info">
        ${availabilityText ? "" : (minimumOrderConfig(item.minimumOrder) ? `<div class="minimum-order-badge">${escapeHtml(minimumOrderText(item.minimumOrder))}</div>` : "")}
        ${availabilityText || hasOptionPreparation ? "" : `<span class="preparation-badge" aria-label="${escapeHtml(preparationLabel(item))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>${escapeHtml(preparationLabel(item))}</span>`}
        <h3>${escapeHtml(productName(item))}</h3>
        <p>${escapeHtml(productDescription(item) || item.nameEn || item.name)}</p>
        <div class="product-foot"><strong>${productPriceMarkup(item)}</strong><div class="product-quantity-slot" data-product-quantity="${escapeHtml(item.id)}">${productQuantityControl(item.id, quantity)}</div></div>
      </div>
    </article>`;
}

function renderProductSections() {
  const sections = [];
  const ordered = sortedCategories();
  const used = new Set();
  const headings = (state.headings || []).filter(item => catalogTypeOf(item) === state.catalogType).sort((a, b) => Number(a.order) - Number(b.order));
  const linkedCategoryIds = new Set(headings.flatMap(item => [...(item.categoryIds || []), ...(item.subheadings || []).flatMap(group => group.categoryIds || [])]));
  const renderCategory = category => {
    const matches = categoryProducts(category.id);
    if (!matches.length) return "";
    const sectionImage = String(category.sectionImage || "").trim();
    return `
      <section class="category-section" id="category-${encodeURIComponent(category.id)}" data-category-section="${escapeHtml(category.id)}">
        <div class="section-heading"><h2>${escapeHtml(categoryName(category))}</h2></div>
        ${sectionImage ? `<button type="button" class="category-illustration" data-category-illustration="${escapeHtml(sectionImage)}" aria-label="تكبير الصورة التوضيحية لقسم ${escapeHtml(categoryName(category))}"><img src="${escapeHtml(sectionImage)}" alt="${escapeHtml(categoryName(category))}" loading="lazy"></button>` : ""}
        <div class="product-grid">${matches.map(item => productCard(item, category)).join("")}</div>
      </section>`;
  };
  const entries = [
    ...headings.map(item => ({ type: "heading", item })),
    ...ordered.map(item => ({ type: "category", item }))
  ].sort((a, b) => Number(a.item.order) - Number(b.item.order) || (a.type === "heading" ? -1 : 1));
  entries.forEach(({ type, item }) => {
    if (type === "category") {
      if (!linkedCategoryIds.has(item.id) && !used.has(item.id)) { const markup = renderCategory(item); if (markup) sections.push(markup); }
      return;
    }
    const subheadings = Array.isArray(item.subheadings) ? item.subheadings : [];
    const groups = subheadings.length ? subheadings : [{ nameAr: "", nameEn: "", categoryIds: item.categoryIds || [] }];
    const groupMarkup = groups.map(group => { const linked = (group.categoryIds || []).map(id => ordered.find(category => category.id === id)).filter(Boolean); linked.forEach(category => used.add(category.id)); if (!linked.length) return ""; return `<section class="catalog-subheading-group" data-subheading-section="${escapeHtml(group.id || "")}">${linked.map(renderCategory).join("")}</section>`; }).join("");
    if (groupMarkup) sections.push(`<section class="catalog-heading-group" id="heading-${encodeURIComponent(item.id)}" data-heading-section="${escapeHtml(item.id)}">${groupMarkup}</section>`);
  });
  $("#productSections").innerHTML = sections.length ? sections.join("") : `<div class="loading">${tr("noResults")}</div>`;
  observeImages();
}

function matchingSearchProducts(query) {
  const normalized = String(query || "").trim().toLocaleLowerCase();
  if (!normalized) return [];
  return state.products.filter(item =>
    [item.name, item.nameEn, item.description, item.descriptionEn]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized)
  ).slice(0, 12);
}

function renderSearchResults() {
  const results = $("#searchResults");
  if (!results) return;
  const query = state.search.trim();
  if (!query) {
    results.innerHTML = `<div class="search-empty">${tr("searchStart")}</div>`;
    return;
  }
  const matches = matchingSearchProducts(query);
  results.innerHTML = matches.length ? matches.map(item => {
    const source = productImages(item)[0] || "logo.png";
    return `<article class="search-result" data-search-product="${escapeHtml(item.id)}">
      <img src="${escapeHtml(source)}" alt="${escapeHtml(productName(item))}" loading="lazy">
      <div><strong>${escapeHtml(productName(item))}</strong><small>${productPriceLabel(item)}</small></div>
      <button type="button" data-search-add="${escapeHtml(item.id)}">${tr("add")}</button>
    </article>`;
  }).join("") : `<div class="search-empty">${tr("noResults")}</div>`;
}

function openHeaderSearch() {
  $("#searchPopover").classList.remove("hidden");
  $("#searchToggle").setAttribute("aria-expanded", "true");
  renderSearchResults();
  requestAnimationFrame(() => $("#searchInput").focus());
}

function closeHeaderSearch() {
  $("#searchPopover").classList.add("hidden");
  $("#searchToggle").setAttribute("aria-expanded", "false");
  state.search = "";
  $("#searchInput").value = "";
}

function visibleLayer(selector) {
  const element = $(selector);
  return Boolean(element && !element.classList.contains("hidden"));
}

function syncPageScrollLock() {
  const shouldLock = visibleLayer("#productPage") || visibleLayer("#productOptionsModal") || visibleLayer("#checkoutModal")
    || visibleLayer("#accountDrawer") || visibleLayer("#authModal") || visibleLayer("#searchPopover") || Boolean(productOptionsPopover);
  if (shouldLock && !pageScrollLocked) {
    pageScrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("page-scroll-locked");
    document.body.classList.add("page-scroll-locked");
    document.body.style.top = `-${pageScrollLockY}px`;
    pageScrollLocked = true;
  } else if (!shouldLock && pageScrollLocked) {
    document.documentElement.classList.remove("page-scroll-locked");
    document.body.classList.remove("page-scroll-locked");
    document.body.style.top = "";
    pageScrollLocked = false;
    requestAnimationFrame(() => window.scrollTo({ top: pageScrollLockY, behavior: "auto" }));
  }
}

function toggleHeaderSearch() {
  if ($("#searchPopover").classList.contains("hidden")) openHeaderSearch();
  else closeHeaderSearch();
}

function observeImages() {
  imageObserver?.disconnect();
  imageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target;
      const source = image.dataset.src;
      if (!source) continue;
      image.onload = () => image.closest(".product-image")?.classList.add("loaded");
      image.onerror = () => { image.src = "logo.png"; image.closest(".product-image")?.classList.add("loaded"); };
      image.src = source;
      image.removeAttribute("data-src");
      imageObserver.unobserve(image);
    }
  }, { rootMargin: "650px 0px" });
  $$("img[data-src]").forEach(image => imageObserver.observe(image));
}

function scrollToCategory(categoryId) {
  if (categoryId !== "all") trackStoreEvent("category_click", { categoryId, categoryName: categoryName(state.categories.find(item => item.id === categoryId) || {}) });
  if (categoryId === "all") return window.scrollTo({ top: 0, behavior: "smooth" });
  const section = document.querySelector(`[data-category-section="${CSS.escape(categoryId)}"]`);
  if (!section) return;
  const headerHeight = $(".site-header")?.offsetHeight || 0;
  const categoriesHeight = $("#categories")?.offsetHeight || 0;
  const headingNavigationHeight = $("#headingNavigation")?.classList.contains("hidden") ? 0 : ($("#headingNavigation")?.offsetHeight || 0);
  const top = window.scrollY + section.getBoundingClientRect().top - headerHeight - categoriesHeight - headingNavigationHeight - 10;
  pendingScrollCategoryId = categoryId;
  pendingScrollUntil = Date.now() + 5000;
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "smooth" });
  window.setTimeout(() => {
    if (pendingScrollCategoryId !== categoryId) return;
    pendingScrollCategoryId = "";
    updateCategoryFromScroll();
  }, 5200);
}

function centerCategoryButton(categoryId) {
  const container = $("#categories");
  const button = document.querySelector(`[data-category-link="${CSS.escape(categoryId)}"]`);
  if (!container || !button) return;
  const containerRect = container.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const horizontalDifference = buttonRect.left + buttonRect.width / 2
    - (containerRect.left + containerRect.width / 2);
  if (Math.abs(horizontalDifference) < 4) return;
  container.scrollBy({ left: horizontalDifference, top: 0, behavior: "smooth" });
}

function syncActiveNavigation() {
  const heading = (state.headings || []).filter(item => catalogTypeOf(item) === state.catalogType).find(item => linkedGroupForCategory(item, state.activeCategory));
  state.activeHeadingId = heading?.id || "";
  state.activeSubheadingId = heading ? (linkedGroupForCategory(heading, state.activeCategory)?.id || "") : "";
  $$("[data-category-link]").forEach(button => button.classList.toggle("active", button.dataset.categoryLink === state.activeCategory));
  $$("[data-heading-link]").forEach(button => button.classList.toggle("active", button.dataset.headingLink === state.activeHeadingId));
  if (state.activeHeadingId) document.querySelector(`[data-heading-link="${CSS.escape(state.activeHeadingId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  else centerCategoryButton(state.activeCategory);
  updateHeadingNavigation();
}

function updateCategoryFromScroll() {
  scrollFrame = null;
  syncHeadingNavigationOffset();
  if (pendingScrollCategoryId && Date.now() < pendingScrollUntil) {
    if (state.activeCategory !== pendingScrollCategoryId) {
      state.activeCategory = pendingScrollCategoryId;
      syncActiveNavigation();
    }
    return;
  }
  pendingScrollCategoryId = "";
  const sections = $$("[data-category-section]");
  if (!sections.length) return;
  let active = "all";
  const fixedNavigationHeight = ($(".site-header")?.offsetHeight || 0)
    + ($("#categories")?.offsetHeight || 0)
    + ($("#headingNavigation")?.classList.contains("hidden") ? 0 : ($("#headingNavigation")?.offsetHeight || 0));
  const threshold = fixedNavigationHeight + 38;
  for (const section of sections) if (section.getBoundingClientRect().top <= threshold) active = section.dataset.categorySection;
  if (active === state.activeCategory && active !== "all") return;
  state.activeCategory = active;
  syncActiveNavigation();
}

function changeQuantity(id, difference) {
  const wasEmpty = cartCount() === 0;
  const existing = typeof state.cart[id] === "object" && state.cart[id] ? state.cart[id] : { quantity: state.cart[id] || 0, note: "" };
  state.cart[id] = { ...existing, quantity: Math.max(0, Number(existing.quantity || 0) + difference) };
  if (!state.cart[id]) delete state.cart[id];
  state.paymentRequestId = "";
  persistCart();
  renderCartBar();
  syncProductQuantityControls(id);
  if (difference > 0 && wasEmpty) trackStoreEvent("cart_created", { productId: id, ...analyticsCartSnapshot() });
  else trackStoreEvent("cart_updated", { productId: id, ...analyticsCartSnapshot() });
  if (!$("#checkoutModal").classList.contains("hidden")) renderCheckout();
}

function updateCartNote(id, note) {
  const existing = typeof state.cart[id] === "object" && state.cart[id] ? state.cart[id] : { quantity: state.cart[id] || 0 };
  if (!Number(existing.quantity)) return;
  state.cart[id] = { ...existing, note: String(note || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 240) };
  state.paymentRequestId = "";
  persistCart();
  trackStoreEvent("cart_updated", { productId: id, ...analyticsCartSnapshot() });
}

function requestAddToCart(id, anchor = null) {
  if (!state.user?.name) {
    pendingCartProductId = id;
    pendingCartAnchor = anchor;
    openAuth("login");
    return;
  }
  const item = product(id);
  if (productSelectionFlow(item)) return openSelectionFlow(id, anchor);
  if (productOptions(item)) return openProductOptions(id, anchor);
  changeQuantity(id, 1);
  toast(tr("added"));
}

function openSelectionFlow(id, anchor = null) {
  closeProductOptions();
  pendingOptionProductId = id;
  pendingOptionAnchor = anchor || document.querySelector(`[data-product-add="${CSS.escape(String(id))}"]`);
  pendingSelectionFlow = productSelectionFlow(product(id));
  pendingFlowSelections = {};
  pendingFlowStep = 0;
  productOptionsPopover = document.createElement("section");
  productOptionsPopover.className = "product-options-popover selection-flow-popover";
  const optionsBackdrop = document.createElement("div");
  optionsBackdrop.className = "product-options-backdrop";
  document.body.append(optionsBackdrop);
  document.body.append(productOptionsPopover);
  syncPageScrollLock();
  productOptionsPopover.place = () => {
    const rect = pendingOptionAnchor?.getBoundingClientRect();
    if (!rect) return;
    const width = productOptionsPopover.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    let top = rect.top - productOptionsPopover.offsetHeight - 10;
    if (top < 8) top = Math.min(window.innerHeight - productOptionsPopover.offsetHeight - 8, rect.bottom + 10);
    Object.assign(productOptionsPopover.style, { left: `${left}px`, top: `${Math.max(8, top)}px` });
  };
  autoSelectSingleFilteredFlowSteps();
  if (pendingFlowStep >= pendingSelectionFlow.steps.length) {
    const chosen = pendingSelectionFlow.steps.flatMap(step => pendingFlowSelections[step.id] || []);
    return addSelectedOptionsToCart(id, chosen, selectedFlowQuantity(pendingSelectionFlow, pendingFlowSelections));
  }
  renderSelectionFlowStep();
}

// لا نعرض للعميل خطوة لا تحتوي - بسبب الفلتر - إلا خياراً واحداً محدداً.
// يضاف هذا الخيار تلقائياً إلى اسم المنتج ويستمر التسلسل إلى الخطوة التالية.
function autoSelectSingleFilteredFlowSteps() {
  const item = product(pendingOptionProductId);
  const flow = pendingSelectionFlow;
  while (item && flow?.steps?.[pendingFlowStep]) {
    const step = flow.steps[pendingFlowStep];
    const allowedIds = filterOptionIds(item.id, step.id);
    if (!Array.isArray(allowedIds)) break;
    const choices = step.items.filter(option => allowedIds.includes(String(option.id)));
    if (choices.length !== 1) break;
    const choice = choices[0];
    const quantity = step.distributeQuantity ? Math.max(1, flowFillingRequirement(step) || 1) : 1;
    pendingFlowSelections[step.id] = [{ ...choice, quantity, flowStepId: step.id, isFilling: step.distributeQuantity === true, nameSuffix: step.required !== false }];
    pendingFlowStep++;
  }
}

function flowLimit(step) {
  // في مرحلة الحشوات لا نحد عدد الأنواع؛ القيد الوحيد هو إكمال عدد الحبات.
  if (step.distributeQuantity) return step.items.length;
  if (!step.limitFrom) return Math.min(step.items.length, step.maxSelections);
  const source = pendingFlowSelections[step.limitFrom]?.[0];
  const limit = source?.maxFillingSelections;
  if (limit === "quantity") return Math.max(1, Number(source.quantity) || 1);
  return Math.min(step.items.length, Math.max(1, Number(limit) || step.maxSelections));
}

function flowFillingRequirement(step) {
  if (!step?.distributeQuantity || !step.limitFrom) return 0;
  const source = pendingFlowSelections[step.limitFrom]?.[0];
  return Math.max(1, Number(source?.pieces) || 1) * Math.max(1, Number(source?.quantity) || 1);
}

function flowSelectedQuantity(selected) {
  return selected.reduce((total, option) => total + Math.max(1, Number(option.quantity) || 1), 0);
}

function selectionFlowPreviousSurcharge(flow, stepIndex) {
  return flow.steps.slice(0, stepIndex)
    .flatMap(step => pendingFlowSelections[step.id] || [])
    .reduce((total, option) => total + Math.max(0, Number(option.price) || 0), 0);
}

function renderSelectionFlowStep() {
  const item = product(pendingOptionProductId);
  const flow = pendingSelectionFlow;
  const step = flow?.steps[pendingFlowStep];
  if (!item || !step || !productOptionsPopover) return closeProductOptions();
  const allowedIds = filterOptionIds(item.id, step.id);
  const visibleItems = Array.isArray(allowedIds) ? step.items.filter(option => allowedIds.includes(String(option.id))) : step.items;
  const selected = pendingFlowSelections[step.id] || [];
  const limit = flowLimit(step);
  const fillingRequirement = flowFillingRequirement(step);
  const selectedFillingQuantity = flowSelectedQuantity(selected);
  const type = step.multiple ? "checkbox" : "radio";
  const title = state.lang === "ar" ? step.titleAr : step.titleEn;
  const hint = fillingRequirement
    ? (state.lang === "ar" ? `وزّع ${new Intl.NumberFormat("ar-KW").format(fillingRequirement)} حبة على الحشوات` : `Distribute ${fillingRequirement} pieces across fillings`)
    : (step.multiple ? (state.lang === "ar" ? `يمكنك اختيار حتى ${new Intl.NumberFormat("ar-KW").format(limit)} خيارات` : `Choose up to ${limit} options`) : "");
  const isLast = pendingFlowStep === flow.steps.length - 1;
  const currentPrice = unitPrice(item, flow.steps.flatMap(flowStep => pendingFlowSelections[flowStep.id] || [])) * selectedFlowQuantity(flow, pendingFlowSelections);
  const listScrollTop = productOptionsPopover.querySelector(".product-options-list")?.scrollTop || 0;
  const fillingStatus = fillingRequirement ? `<div class="filling-progress">${state.lang === "ar" ? "الحشوات المختارة" : "Selected fillings"}: <b class="${selectedFillingQuantity === fillingRequirement ? "complete" : ""}">${new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(selectedFillingQuantity)} / ${new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(fillingRequirement)}</b></div>` : "";
  const previousSurcharge = step.id === "size" ? selectionFlowPreviousSurcharge(flow, pendingFlowStep) : 0;
  let previousGroup = "";
  const optionsMarkup = visibleItems.map(option => {
    const groupTitle = state.lang === "ar" ? option.groupAr : (option.groupEn || option.groupAr);
    const groupHeading = groupTitle && groupTitle !== previousGroup
      ? `<h4 class="flow-option-group-title">${escapeHtml(groupTitle)}</h4>`
      : "";
    if (groupTitle) previousGroup = groupTitle;
    const chosen = selected.find(selectedOption => selectedOption.id === option.id);
    const displayedPrice = Math.max(0, Number(option.price) || 0) + previousSurcharge;
    const showPrice = step.id !== "dough" && displayedPrice > 0;
    const perUnitHint = showPrice && option.priceGroup ? `<small class="per-unit-price">${state.lang === "ar" ? "* للكمية الواحدة" : "* per quantity"}</small>` : "";
    return `${groupHeading}<div class="flow-option-row"><label class="product-option-choice"><input type="${type}" name="selection-flow-option" value="${escapeHtml(option.id)}" ${chosen ? "checked" : ""}><span><b>${escapeHtml(optionName(option))}</b><small>${escapeHtml(state.lang === "ar" ? option.nameEn : option.nameAr)}</small>${option.preparation ? `<i>◷ ${escapeHtml(preparationLabel(option.preparation))}</i>` : ""}</span>${showPrice ? `<em>+ ${money(displayedPrice)}${perUnitHint}</em>` : ""}${step.quantityEnabled && chosen ? `<div class="flow-choice-quantity-wrap"><small>${state.lang === "ar" ? "الكمية" : "Quantity"}</small><div class="qty flow-choice-quantity"><button type="button" data-flow-quantity="plus" data-flow-option-id="${escapeHtml(option.id)}">+</button><span>${new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(chosen.quantity || 1)}</span><button type="button" data-flow-quantity="minus" data-flow-option-id="${escapeHtml(option.id)}">${chosen.quantity === 1 ? "×" : "−"}</button></div></div>` : ""}</label></div>`;
  }).join("");
  productOptionsPopover.innerHTML = `<header><div><small>${state.lang === "ar" ? `الخطوة ${new Intl.NumberFormat("ar-KW").format(pendingFlowStep + 1)} من ${new Intl.NumberFormat("ar-KW").format(flow.steps.length)}` : `Step ${pendingFlowStep + 1} of ${flow.steps.length}`}</small><strong>${escapeHtml(productName(item))}</strong></div><button type="button" data-close-options aria-label="${state.lang === "ar" ? "إغلاق" : "Close"}">×</button></header><div class="option-group-title"><strong>${escapeHtml(title)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>${fillingStatus}<div class="product-options-list">${optionsMarkup}</div><div class="selection-flow-footer"><div class="selection-price"><span>${state.lang === "ar" ? "السعر الحالي" : "Current price"}</span><b>${money(currentPrice)}</b></div><button type="button" class="primary" data-flow-next ${selected.length ? "" : "disabled"}>${isLast ? (state.lang === "ar" ? "إضافة إلى السلة" : "Add to cart") : (state.lang === "ar" ? "التالي" : "Next")}</button></div>`;
  productOptionsPopover.place?.();
  const optionsList = productOptionsPopover.querySelector(".product-options-list");
  if (optionsList) optionsList.scrollTop = listScrollTop;
  productOptionsPopover.querySelector("[data-close-options]").onclick = closeProductOptions;
  productOptionsPopover.querySelectorAll('input[name="selection-flow-option"]').forEach(input => input.onchange = () => {
    const choice = step.items.find(option => option.id === input.value);
    if (!choice) return;
    let next = step.multiple ? [...(pendingFlowSelections[step.id] || [])] : [];
    if (input.checked && !next.some(option => option.id === choice.id)) next.push({ ...choice, quantity: 1, flowStepId: step.id, isFilling: step.distributeQuantity === true, nameSuffix: step.required !== false && step.multiple !== true });
    if (!input.checked) next = next.filter(option => option.id !== choice.id);
    if (next.length > limit) return toast(state.lang === "ar" ? `الحد الأقصى ${new Intl.NumberFormat("ar-KW").format(limit)} خيارات` : `Maximum ${limit} options`, "error"), renderSelectionFlowStep();
    pendingFlowSelections[step.id] = next;
    renderSelectionFlowStep();
  });
  productOptionsPopover.querySelectorAll("[data-flow-quantity]").forEach(button => button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    const current = pendingFlowSelections[step.id]?.find(option => option.id === button.dataset.flowOptionId);
    if (!current) return;
    const amount = Number(current.quantity || 1);
    if (button.dataset.flowQuantity === "plus" && fillingRequirement && flowSelectedQuantity(pendingFlowSelections[step.id] || []) >= fillingRequirement) {
      return toast(state.lang === "ar" ? "لقد اكتمل عدد الحشوات المطلوب" : "The required fillings quantity is complete", "error");
    }
    current.quantity = Math.max(1, amount + (button.dataset.flowQuantity === "plus" ? 1 : -1));
    renderSelectionFlowStep();
  });
  productOptionsPopover.querySelector("[data-flow-next]").onclick = event => {
    event.stopPropagation();
    if (!selected.length) return;
    if (isLast && fillingRequirement && selectedFillingQuantity !== fillingRequirement) {
      return toast(state.lang === "ar" ? "ارجو اكمال اختيار الحشوات للكمية كاملة" : "Please complete filling selections for the full quantity", "error");
    }
    if (!isLast) {
      pendingFlowStep++;
      autoSelectSingleFilteredFlowSteps();
      if (pendingFlowStep < flow.steps.length) return renderSelectionFlowStep();
    }
    const chosen = flow.steps.flatMap(flowStep => pendingFlowSelections[flowStep.id] || []);
    addSelectedOptionsToCart(pendingOptionProductId, chosen, selectedFlowQuantity(flow, pendingFlowSelections));
  };
}

function openProductOptions(id, anchor = null) {
  const item = product(id);
  const config = productOptions(item);
  if (!item || !config) return requestAddToCart(id);
  const optionIds = filterOptionIds(id, "options");
  const allowed = Array.isArray(optionIds) ? config.items.filter(option => optionIds.includes(String(option.id))) : [];
  const singleFilteredOption = Array.isArray(optionIds) && allowed.length === 1;
  if (singleFilteredOption && config.required && !config.multiple && !config.nestedEnabled) return addSelectedOptionsToCart(id, [{ ...allowed[0], quantity: 1, nameSuffix: true }]);
  closeProductOptions();
  pendingOptionProductId = id;
  pendingOptionAnchor = anchor || document.querySelector(`[data-product-add="${CSS.escape(String(id))}"]`);
  pendingGeneralOptionSelections = [];
  pendingGeneralOptionQuantities = {};
  pendingPrimaryOption = singleFilteredOption && config.required && !config.multiple && config.nestedEnabled ? { ...allowed[0], nameSuffix: true } : null;
  productOptionsPopover = document.createElement("section");
  productOptionsPopover.className = "product-options-popover";
  const optionsBackdrop = document.createElement("div");
  optionsBackdrop.className = "product-options-backdrop";
  document.body.append(optionsBackdrop);
  document.body.append(productOptionsPopover);
  syncPageScrollLock();
  const placePopover = () => {
    const rect = pendingOptionAnchor?.getBoundingClientRect();
    if (!rect) return;
    const width = productOptionsPopover.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    let top = rect.top - productOptionsPopover.offsetHeight - 10;
    if (top < 8) top = Math.min(window.innerHeight - productOptionsPopover.offsetHeight - 8, rect.bottom + 10);
    Object.assign(productOptionsPopover.style, { left: `${left}px`, top: `${Math.max(8, top)}px` });
  };
  productOptionsPopover.place = placePopover;
  renderProductOptionsStep();
}

function renderProductOptionsStep() {
  const id = pendingOptionProductId;
  const item = product(id);
  const config = productOptions(item);
  if (!productOptionsPopover || !item || !config) return closeProductOptions();
  const choosingSubOption = Boolean(pendingPrimaryOption);
  const filterIds = filterOptionIds(item.id, choosingSubOption ? "subOptions" : "options");
  const rawChoices = choosingSubOption ? pendingPrimaryOption.subOptions : config.items;
  const choices = Array.isArray(filterIds) ? rawChoices.filter(option => filterIds.includes(choosingSubOption ? `${pendingPrimaryOption.id}::${option.id}` : String(option.id))) : rawChoices;
  if (choosingSubOption && Array.isArray(filterIds) && choices.length === 1) return addSelectedOptionsToCart(id, [{ ...pendingPrimaryOption, nameSuffix: true }, { ...choices[0], quantity: 1, nameSuffix: true }]);
  const choiceName = choosingSubOption ? "product-sub-option" : "product-option";
  const type = choosingSubOption ? "radio" : (config.multiple ? "checkbox" : "radio");
  const stepText = choosingSubOption
    ? (state.lang === "ar" ? `اختر الخيار المرتبط بـ «${optionName(pendingPrimaryOption)}»` : `Choose an option for ${optionName(pendingPrimaryOption)}`)
    : (config.required ? tr("optionsRequired") : tr("optionOptional"));
  const actionText = choosingSubOption ? (state.lang === "ar" ? "إضافة إلى السلة" : "Add to cart") : (config.nestedEnabled ? (state.lang === "ar" ? "التالي" : "Next") : (state.lang === "ar" ? "إضافة إلى السلة" : "Add to cart"));
  const optionsTitle = !choosingSubOption && config.multiple ? (state.lang === "ar" ? config.titleAr : config.titleEn) : "";
  const maxHint = !choosingSubOption && config.multiple ? (state.lang === "ar" ? `يمكنك اختيار حتى ${new Intl.NumberFormat("ar-KW").format(config.maxSelections)} خيارات` : `Choose up to ${config.maxSelections} options`) : "";
  const showNestedCurrentPrice = choosingSubOption && Number(pendingPrimaryOption?.price || 0) > 0 && choices.some(option => Number(option.price || 0) > 0);
  const selectedOptionIds = new Set(choosingSubOption ? [] : pendingGeneralOptionSelections);
  productOptionsPopover.innerHTML = `<header><div><small>${state.lang === "ar" ? (choosingSubOption ? "الخيار الثاني" : "خيارات المنتج") : (choosingSubOption ? "Second option" : "Product options")}</small><strong>${escapeHtml(productName(item))}</strong></div><button type="button" data-close-options aria-label="${state.lang === "ar" ? "إغلاق" : "Close"}">×</button></header><p>${escapeHtml(stepText)}</p>${optionsTitle ? `<div class="option-group-title"><strong>${escapeHtml(optionsTitle)}</strong><small>${escapeHtml(maxHint)}</small></div>` : ""}<div class="product-options-list">${choices.map(option => { const chosen = selectedOptionIds.has(option.id); const quantity = Math.max(1, Number(pendingGeneralOptionQuantities[option.id]) || 1); return `<label class="product-option-choice"><input type="${type}" name="${choiceName}" value="${escapeHtml(option.id)}" ${chosen ? "checked" : ""}>${option.image ? `<img src="${escapeHtml(option.image)}" alt="">` : ""}<span><b>${escapeHtml(optionName(option))}</b><small>${escapeHtml(state.lang === "ar" ? option.nameEn : option.nameAr)}</small>${option.preparation ? `<i>◷ ${escapeHtml(preparationLabel(option.preparation))}</i>` : ""}${config.minimumPerOptionEnabled && option.minimumOrder ? `<i class="option-minimum-note">${escapeHtml(minimumOrderText(option.minimumOrder))}</i>` : ""}</span>${config.priceBased ? `<em>${money(option.price)}</em>` : ""}${!choosingSubOption && config.optionQuantityEnabled && chosen ? `<div class="option-choice-quantity-wrap"><small>${state.lang === "ar" ? "الكمية" : "Quantity"}</small><div class="qty option-choice-quantity"><button type="button" data-option-quantity-action="plus" data-option-id="${escapeHtml(option.id)}">+</button><span>${new Intl.NumberFormat(state.lang === "ar" ? "ar-KW" : "en").format(quantity)}</span><button type="button" data-option-quantity-action="minus" data-option-id="${escapeHtml(option.id)}">${quantity === 1 ? "×" : "−"}</button></div></div>` : ""}</label>`; }).join("")}</div>${showNestedCurrentPrice ? `<div class="selection-price hidden" data-option-current-price><span>${state.lang === "ar" ? "السعر الحالي" : "Current price"}</span><b></b></div>` : ""}<button type="button" class="primary" data-option-confirm ${config.required && !selectedOptionIds.size ? "disabled" : ""}>${actionText}</button>`;
  productOptionsPopover.place?.();
  productOptionsPopover.querySelector("[data-close-options]").onclick = closeProductOptions;
  productOptionsPopover.querySelectorAll(`input[name="${choiceName}"]`).forEach(input => input.onchange = () => {
    const selected = productOptionsPopover.querySelectorAll(`input[name="${choiceName}"]:checked`);
    if (!choosingSubOption && config.multiple && selected.length > config.maxSelections) {
      input.checked = false;
      return toast(state.lang === "ar" ? `الحد الأقصى ${new Intl.NumberFormat("ar-KW").format(config.maxSelections)} خيارات` : `Maximum ${config.maxSelections} options`, "error");
    }
    if (!choosingSubOption) {
      pendingGeneralOptionSelections = [...productOptionsPopover.querySelectorAll(`input[name="${choiceName}"]:checked`)].map(option => option.value);
      pendingGeneralOptionSelections.forEach(optionId => { pendingGeneralOptionQuantities[optionId] ||= 1; });
      return renderProductOptionsStep();
    }
    productOptionsPopover.querySelector("[data-option-confirm]").disabled = config.required && !productOptionsPopover.querySelector(`input[name="${choiceName}"]:checked`);
    const currentPrice = productOptionsPopover.querySelector("[data-option-current-price]");
    if (currentPrice && input.checked) {
      const selectedOption = choices.find(option => option.id === input.value);
      currentPrice.classList.remove("hidden");
      $("b", currentPrice).textContent = money(Number(pendingPrimaryOption?.price || 0) + Number(selectedOption?.price || 0));
    }
  });
  productOptionsPopover.querySelectorAll("[data-option-quantity-action]").forEach(button => button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const optionId = button.dataset.optionId;
      const amount = Math.max(1, Number(pendingGeneralOptionQuantities[optionId]) || 1);
      pendingGeneralOptionQuantities[optionId] = Math.max(1, Math.min(99, amount + (button.dataset.optionQuantityAction === "plus" ? 1 : -1)));
      renderProductOptionsStep();
    });
  productOptionsPopover.querySelector("[data-option-confirm]").onclick = event => {
    event.stopPropagation();
    confirmProductOptions();
  };
}

function closeProductOptions() {
  pendingOptionProductId = "";
  pendingOptionAnchor = null;
  pendingPrimaryOption = null;
  pendingGeneralOptionSelections = [];
  pendingGeneralOptionQuantities = {};
  pendingSelectionFlow = null;
  pendingFlowSelections = {};
  pendingFlowStep = 0;
  productOptionsPopover?.remove();
  $$(".product-options-backdrop").forEach(backdrop => backdrop.remove());
  productOptionsPopover = null;
  syncPageScrollLock();
}

function confirmProductOptions() {
  const id = pendingOptionProductId;
  const config = productOptions(product(id));
  if (!id || !config) return closeProductOptions();
  if (pendingPrimaryOption) {
    const selectedId = productOptionsPopover?.querySelector('input[name="product-sub-option"]:checked')?.value;
    const selectedSubOption = pendingPrimaryOption.subOptions.find(option => option.id === selectedId);
    if (!selectedSubOption) return toast(tr("optionsRequired"), "error");
    return addSelectedOptionsToCart(id, [{ ...pendingPrimaryOption, nameSuffix: true }, { ...selectedSubOption, nameSuffix: true }]);
  }
  const selectedIds = pendingGeneralOptionSelections.length ? pendingGeneralOptionSelections : $$('input[name="product-option"]:checked', productOptionsPopover || document).map(input => input.value);
  if (config.required && !selectedIds.length) return toast(tr("optionsRequired"), "error");
  const selected = config.items.filter(option => selectedIds.includes(option.id)).map(option => ({ ...option, quantity: Math.max(1, Number(pendingGeneralOptionQuantities[option.id]) || 1), showQuantity: config.optionQuantityEnabled === true, nameSuffix: config.required === true && config.multiple !== true }));
  if (config.nestedEnabled) {
    pendingPrimaryOption = selected[0] || null;
    if (!pendingPrimaryOption) return toast(tr("optionsRequired"), "error");
    if (!pendingPrimaryOption.subOptions.length) return toast(state.lang === "ar" ? "لا توجد خيارات مرتبطة بهذا الخيار بعد" : "No linked options are available yet", "error");
    return renderProductOptionsStep();
  }
  addSelectedOptionsToCart(id, selected);
}

function addSelectedOptionsToCart(id, selected, quantity = 1) {
  const wasEmpty = cartCount() === 0;
  const existing = typeof state.cart[id] === "object" && state.cart[id] ? state.cart[id] : { quantity: 0, note: "" };
  state.cart[id] = { ...existing, options: selected, quantity: Number(existing.quantity || 0) + Math.max(1, Number(quantity) || 1) };
  state.paymentRequestId = "";
  persistCart();
  renderCartBar();
  syncProductQuantityControls(id);
  trackStoreEvent(wasEmpty ? "cart_created" : "cart_updated", { productId: id, ...analyticsCartSnapshot() });
  closeProductOptions();
  toast(tr("added"));
}

function syncProductQuantityControls(id) {
  const quantity = cartQuantity(id);
  $$(`[data-product-quantity="${CSS.escape(String(id))}"]`).forEach(slot => {
    slot.innerHTML = productQuantityControl(id, quantity, slot.dataset.detailQuantity === "true");
  });
  $$(`[data-cart-badge="${CSS.escape(String(id))}"]`).forEach(badge => {
    badge.classList.toggle("hidden", !quantity);
    badge.textContent = quantity ? `${tr("inCart")} × ${quantity}` : "";
  });
}

function syncAllProductQuantityControls() {
  $$("[data-product-quantity]").forEach(slot => {
    const id = slot.dataset.productQuantity;
    slot.innerHTML = productQuantityControl(id, cartQuantity(id), slot.dataset.detailQuantity === "true");
  });
  $$("[data-cart-badge]").forEach(badge => {
    const quantity = cartQuantity(badge.dataset.cartBadge);
    badge.classList.toggle("hidden", !quantity);
    badge.textContent = quantity ? `${tr("inCart")} × ${quantity}` : "";
  });
}

function renderCartBar() {
  const count = cartCount();
  $("#floatingCart").classList.toggle("hidden", !count);
  $("#cartBadge").textContent = count;
  $("#headerCount").textContent = count;
  $("#cartTotal").textContent = money(subtotal());
}

function renderProductDetail(id) {
  const item = product(id);
  if (!item) return closeProductPage(false);
  const category = state.categories.find(entry => entry.id === item.category);
  const images = productImages(item);
  const main = images[0] || "logo.png";
  const quantity = cartQuantity(item.id);
  $("#productDetail").innerHTML = `
    <div class="product-detail-grid">
      <div class="product-gallery">
        <div class="product-gallery-main"><img id="detailMainImage" src="${escapeHtml(main)}" alt="${escapeHtml(productName(item))}"></div>
        ${images.length > 1 ? `<div class="product-thumbs">${images.map((image, index) => `<button class="${index === 0 ? "active" : ""}" data-detail-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="product-detail-copy">
        <span class="kicker">${escapeHtml(category ? categoryName(category) : "")}</span><h1>${escapeHtml(productName(item))}</h1>
        <p>${escapeHtml(productDescription(item) || item.nameEn || item.name)}</p>
      </div>
    </div>
    <div class="detail-purchase-bar">
      <div><small>${escapeHtml(productName(item))}</small><strong class="detail-price">${productPriceMarkup(item)}</strong></div>
      <div class="product-quantity-slot" data-product-quantity="${escapeHtml(item.id)}" data-detail-quantity="true">${productQuantityControl(item.id, quantity, true)}</div>
    </div>`;
}

function openProductPage(id, push = true) {
  const trackedProduct = product(id);
  if (trackedProduct) trackStoreEvent("product_click", { productId: trackedProduct.id, productName: trackedProduct.name || trackedProduct.nameEn || "" });
  if (!state.detailProductId && push) catalogScrollPosition = window.scrollY;
  state.detailProductId = String(id);
  renderProductDetail(id);
  $("#productPage").classList.remove("hidden");
  $("#productPage").setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-open");
  $("#productPage").scrollTop = 0;
  if (push && location.hash !== `#product=${encodeURIComponent(id)}`) {
    history.pushState({ product: id, catalogScrollPosition }, "", `#product=${encodeURIComponent(id)}`);
  }
}

function clearProductRoute() {
  if (!location.hash.startsWith("#product=")) return;
  history.replaceState(
    { catalogScrollPosition },
    "",
    `${location.pathname}${location.search}`
  );
}

function closeProductPage(useHistory = true) {
  const productPage = $("#productPage");
  if (productPage.contains(document.activeElement)) $("#headerCart")?.focus({ preventScroll: true });
  state.detailProductId = "";
  productPage.classList.add("hidden");
  productPage.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");
  if (useHistory) clearProductRoute();
  restoreCatalogScrollPosition();
}

function restoreCatalogScrollPosition() {
  const restore = () => window.scrollTo({ top: catalogScrollPosition, behavior: "auto" });
  requestAnimationFrame(() => {
    restore();
    setTimeout(restore, 120);
  });
}

function syncProductRoute() {
  const match = location.hash.match(/^#product=(.+)$/);
  if (match) {
    if (history.state?.catalogScrollPosition != null) catalogScrollPosition = Number(history.state.catalogScrollPosition);
    openProductPage(decodeURIComponent(match[1]), false);
  } else if (state.detailProductId) {
    closeProductPage(false);
  }
}

function setAuthMessage(message, success = false) {
  const element = $("#authMessage");
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("success", success);
}

function openAuth(mode = "login") {
  authMode = mode;
  authPhone = mode === "changePhone" ? state.user?.phone || "" : "";
  clearInterval(resendTimer);
  $("#authModal").classList.remove("hidden");
  $("#authModal").setAttribute("aria-hidden", "false");
  $("#authModal .auth-panel").classList.remove("no-close");
  renderPhoneAuth();
}

function closeAuth() {
  if ($("#authModal .auth-panel").classList.contains("no-close")) return;
  clearInterval(resendTimer);
  if (authMode === "login") { pendingCartProductId = ""; pendingCartAnchor = null; }
  $("#authModal").classList.add("hidden");
  $("#authModal").setAttribute("aria-hidden", "true");
}

function authBrand(title, text) {
  return `<div class="auth-brand"><img src="logo.png" alt=""><h2 id="authTitle">${escapeHtml(title)}</h2><p>${escapeHtml(text || "")}</p></div>`;
}

function renderPhoneAuth() {
  $("#authBody").innerHTML = `${authBrand(authMode === "changePhone" ? tr("changePhone") : tr("loginFirst"), tr("phoneHint"))}
    <form class="auth-form" id="phoneAuthForm">
      <label>${tr("phone")}<input class="phone-field" id="loginPhone" inputmode="numeric" pattern="[0-9]*" autocomplete="tel" maxlength="16" placeholder="99999999" value="${escapeHtml(authPhone)}"></label>
      <p class="auth-message" id="authMessage"></p>
      <button class="primary" id="sendCodeButton" type="submit">${tr("confirmPhone")}</button>
    </form>`;
  const input = $("#loginPhone");
  input.oninput = event => {
    event.target.value = normalizePhone(event.target.value);
    authPhone = event.target.value;
    setAuthMessage("");
  };
  $("#phoneAuthForm").onsubmit = event => {
    event.preventDefault();
    authPhone = normalizePhone(authPhone || $("#loginPhone")?.value);
    if (authPhone.length !== 8) return setAuthMessage(tr("invalidPhone"));
    if (TEMPORARY_PHONE_CONFIRMATION_LOGIN) return renderPhoneConfirmation();
    sendLoginCode();
  };
  setTimeout(() => input.focus(), 60);
}

function renderPhoneConfirmation() {
  const arabic = state.lang === "ar";
  const title = arabic ? "هل أنت متأكد من رقم الهاتف؟" : "Is this phone number correct?";
  const hint = arabic ? "سيتم الدخول باستخدام هذا الرقم" : "You will sign in with this number";
  const yes = arabic ? "نعم، الرقم صحيح" : "Yes, this is correct";
  const no = arabic ? "تعديل الرقم" : "Edit number";
  $("#authBody").innerHTML = `${authBrand(title, hint)}
    <div class="auth-form phone-confirmation">
      <strong class="phone-confirmation-number">${escapeHtml(authPhone)}</strong>
      <button class="primary" id="confirmPhoneLogin" type="button">${yes}</button>
      <button class="secondary" id="editPhoneLogin" type="button">${no}</button>
    </div>`;
  $("#confirmPhoneLogin").onclick = completePhoneConfirmationLogin;
  $("#editPhoneLogin").onclick = renderPhoneAuth;
}

async function completePhoneConfirmationLogin() {
  const button = $("#confirmPhoneLogin");
  if (button) { button.disabled = true; button.innerHTML = `<span class="auth-loader"></span>`; }
  let authResult;
  try {
    const response = await fetch(orderingConfig.temporaryPhoneConfirmationWebhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ phone: authPhone }), cache: "no-store"
    });
    authResult = await response.json().catch(() => ({}));
    if (!response.ok || !authResult.ok) throw new Error(authResult.message || tr("loginServiceUnavailable"));
    await authenticateFirebaseCustomer(authResult, authPhone);
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = state.lang === "ar" ? "نعم، الرقم صحيح" : "Yes, this is correct"; }
    return setAuthMessage(error.message || tr("loginServiceUnavailable"));
  }
  const profiles = readJson(PROFILE_KEY, {});
  if (authMode === "changePhone" && state.user) {
    const previousPhone = state.user.phone;
    const previousCart = { ...state.cart };
    state.user.phone = authPhone;
    if (profiles[previousPhone]) delete profiles[previousPhone];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
    localStorage.setItem(cartStorageKey(authPhone), JSON.stringify(previousCart));
    persistUser();
    closeAuth();
    openAccountDrawer("info");
    return toast(tr("infoSaved"));
  }
  const profile = profiles[authPhone] || { phone: authPhone, name: "", addresses: [], orders: [] };
  state.user = { ...profile, phone: authPhone, addresses: profile.addresses || [], orders: profile.orders || [] };
  state.cart = loadUserCart(state.user);
  await hydrateUserFromFirebase();
  state.name = state.user.name;
  state.phone = state.user.phone;
  if (!state.user.name) return renderUsernameAuth();
  persistUser();
  completeLogin();
}

async function sendLoginCode(isResend = false) {
  authPhone = normalizePhone(authPhone || $("#loginPhone")?.value);
  if (authPhone.length !== 8) return setAuthMessage(tr("invalidPhone"));
  if (!orderingConfig.sendLoginCodeWebhookUrl) return setAuthMessage(tr("loginServiceUnavailable"));
  const button = $("#sendCodeButton");
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span class="auth-loader"></span>`;
  }
  try {
    const response = await fetch(orderingConfig.sendLoginCodeWebhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ phone: authPhone }), cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      if (data.retryAfter && $("#otpInput")) startResendCountdown(Number(data.retryAfter));
      throw new Error(data.message || tr("sendFailed"));
    }
    if (!isResend || !$("#otpInput")) renderOtpAuth();
    else {
      setAuthMessage(tr("codeSent"), true);
      $("#otpInput").value = "";
      $("#otpInput").focus();
    }
    startResendCountdown(Number(data.retryAfter || 30));
  } catch (error) {
    setAuthMessage(error.message || tr("sendFailed"));
    if (button) {
      button.disabled = false;
      button.textContent = tr("confirmPhone");
    }
  }
}

function renderOtpAuth() {
  $("#authBody").innerHTML = `${authBrand(tr("codeSent"), `${tr("enterCode")} — ${authPhone}`)}
    <div class="auth-form">
      <label>${tr("enterCode")}<input class="otp-field" id="otpInput" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="4" placeholder="- - - -"></label>
      <p class="auth-message success" id="authMessage">${tr("codeSent")}</p>
      <div class="resend-row"><button class="resend-link" id="resendCode" type="button" disabled></button></div>
    </div>`;
  const input = $("#otpInput");
  input.oninput = event => {
    event.target.value = normalizePhone(event.target.value).slice(0, 4);
    setAuthMessage("");
    if (event.target.value.length === 4) verifyLoginCode(event.target.value);
  };
  setTimeout(() => input.focus(), 60);
}

function startResendCountdown(seconds = 30) {
  clearInterval(resendTimer);
  let remaining = Math.max(0, Math.ceil(seconds));
  const button = $("#resendCode");
  const update = () => {
    const current = $("#resendCode");
    if (!current) return clearInterval(resendTimer);
    current.disabled = remaining > 0;
    current.textContent = remaining > 0 ? `${tr("resendAfter")} ${remaining} ${state.lang === "ar" ? "ثانية" : "sec"}` : tr("resendCode");
    if (remaining <= 0) {
      clearInterval(resendTimer);
      current.onclick = () => sendLoginCode(true);
    }
    remaining--;
  };
  if (button) update();
  resendTimer = setInterval(update, 1000);
}

async function verifyLoginCode(code) {
  const input = $("#otpInput");
  if (!input || input.disabled) return;
  if (!orderingConfig.verifyLoginCodeWebhookUrl) return setAuthMessage(tr("loginServiceUnavailable"));
  input.disabled = true;
  setAuthMessage(tr("verifying"), true);
  try {
    const response = await fetch(orderingConfig.verifyLoginCodeWebhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ phone: authPhone, code }), cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.message || tr("invalidCode"));
    clearInterval(resendTimer);
    if (authMode === "changePhone" && state.user) {
      const profiles = readJson(PROFILE_KEY, {});
      const previousPhone = state.user.phone;
      const previousCart = { ...state.cart };
      state.user.phone = authPhone;
      await authenticateFirebaseCustomer(data, authPhone);
      if (profiles[previousPhone]) delete profiles[previousPhone];
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
      localStorage.setItem(cartStorageKey(authPhone), JSON.stringify(previousCart));
      persistUser();
      closeAuth();
      openAccountDrawer("info");
      return toast(tr("infoSaved"));
    }
    const profiles = readJson(PROFILE_KEY, {});
    const profile = profiles[authPhone] || { phone: authPhone, name: "", addresses: [], orders: [] };
    state.user = { ...profile, phone: authPhone, addresses: profile.addresses || [], orders: profile.orders || [] };
    state.cart = loadUserCart(state.user);
    await authenticateFirebaseCustomer(data, authPhone);
    await hydrateUserFromFirebase();
    state.name = state.user.name;
    state.phone = state.user.phone;
    if (!state.user.name) return renderUsernameAuth();
    persistUser();
    completeLogin();
  } catch (error) {
    input.disabled = false;
    input.value = "";
    input.focus();
    setAuthMessage(error.message || tr("verifyFailed"));
  }
}

function renderUsernameAuth() {
  $("#authModal .auth-panel").classList.add("no-close");
  $("#authBody").innerHTML = `${authBrand(tr("welcome"), "")}
    <form class="auth-form" id="usernameForm">
      <label>${tr("username")}<input id="usernameInput" autocomplete="name" maxlength="80"></label>
      <p class="auth-message" id="authMessage"></p>
      <button class="primary" type="submit">${tr("confirm")}</button>
    </form>`;
  $("#usernameForm").onsubmit = event => {
    event.preventDefault();
    const name = $("#usernameInput").value.trim();
    if (!name) return setAuthMessage(tr("nameRequired"));
    state.user.name = name;
    persistUser();
    trackStoreEvent("account_created");
    completeLogin();
  };
  setTimeout(() => $("#usernameInput").focus(), 60);
}

function completeLogin() {
  $("#authModal .auth-panel").classList.remove("no-close");
  $("#authModal").classList.add("hidden");
  $("#authModal").setAttribute("aria-hidden", "true");
  updateAccountButton();
  reportVisitorPresence();
  renderCartBar();
  syncAllProductQuantityControls();
  if (pendingCartProductId) {
    const id = pendingCartProductId;
    const anchor = pendingCartAnchor;
    pendingCartProductId = "";
    pendingCartAnchor = null;
    requestAddToCart(id, anchor);
  }
}

async function logout() {
  persistCart();
  clearTimeout(userSyncTimer);
  try {
    await syncUserToFirebase();
  } catch (error) {
    console.error("Firebase profile sync before logout failed", error);
  }
  if (customerProfileRef && customerProfileListener) customerProfileRef.off("value", customerProfileListener);
  customerProfileRef = null;
  customerProfileListener = null;
  firebaseProfileHydrated = false;
  localStorage.removeItem(SESSION_KEY);
  forgetRememberedSession();
  firebaseAuthUser = null;
  if (firebaseServices) {
    try {
      await firebaseServices.auth.signOut();
      const credential = await firebaseServices.auth.signInAnonymously();
      firebaseAuthUser = credential.user;
    } catch (error) {
      console.error("Firebase logout failed", error);
    }
  }
  state.user = null;
  state.cart = {};
  state.name = "";
  state.phone = "";
  closeAccountDrawer();
  updateAccountButton();
  renderCartBar();
  syncAllProductQuantityControls();
  toast(tr("loggedOut"));
}

function openAccountDrawer(page = "home", options = {}) {
  if (!state.user?.name) return openAuth("login");
  $("#accountDrawer").classList.toggle("order-detail-mode", page === "orderDetails");
  accountReturnToCheckout = Boolean(options.returnToCheckout);
  if (accountReturnToCheckout) $("#checkoutModal").classList.add("hidden");
  $("#accountDrawer").classList.remove("hidden");
  $("#accountDrawer").setAttribute("aria-hidden", "false");
  if (page === "info") renderAccountInfo();
  else if (page === "addresses") renderAddresses();
  else if (page === "orders") renderOrders();
  else if (page === "orderDetails") renderOrderDetails(options.orderId || "", options.fromSuccess === true);
  else if (page === "addressForm") renderAddressForm(options.addressId || "");
  else renderAccountHome();
}

function closeAccountDrawer(returnToCheckout = false) {
  const restoreCheckout = returnToCheckout && accountReturnToCheckout;
  accountReturnToCheckout = false;
  $("#accountDrawer").classList.add("hidden");
  $("#accountDrawer").setAttribute("aria-hidden", "true");
  if (restoreCheckout) {
    $("#checkoutModal").classList.remove("hidden");
    renderCheckout();
  }
}

function resetAccountDrawerScroll() {
  const drawer = $(".account-drawer");
  if (drawer) {
    drawer.scrollTop = 0;
    drawer.scrollLeft = 0;
  }
}

const accountIcons = {
  info: `<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"/></svg>`,
  address: `<svg viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>`,
  order: `<svg viewBox="0 0 24 24"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6M9 12h6"/></svg>`,
  logout: `<svg viewBox="0 0 24 24"><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/></svg>`,
  phone: `<svg viewBox="0 0 24 24"><path d="M8.1 3.5 5.4 4.8c-1.2.6-.9 3.2.8 6.4s4.8 6.3 8 7.9c3.2 1.6 5.7 1.5 6.2.2l1.1-2.8-4.8-2.3-1.5 2c-1.6-.8-3.3-2.1-4.8-3.6-1.4-1.5-2.6-3.1-3.3-4.6l2-1.4-1-3.1Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 1.8"/></svg>`,
  card: `<svg viewBox="0 0 24 24"><path d="M3 6.5h18v12H3v-12Zm0 4h18M7 15h3"/></svg>`,
  box: `<svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10"/></svg>`
};

function renderAccountHome() {
  if (!state.user) return;
  resetAccountDrawerScroll();
  $("#accountContent").innerHTML = `
    <section class="account-welcome"><small>${tr("welcome")}</small><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.phone)}</p></section>
    <nav class="account-menu">
      <button id="openInfo">${accountIcons.info}<span>${tr("myInfo")}</span></button>
      <button id="openAddresses">${accountIcons.address}<span>${tr("myAddresses")}</span></button>
      <button id="openOrders">${accountIcons.order}<span>${tr("myOrders")}</span></button>
      <button class="logout" id="logoutButton">${accountIcons.logout}<span>${tr("logout")}</span></button>
    </nav>`;
  $("#openInfo").onclick = renderAccountInfo;
  $("#openAddresses").onclick = renderAddresses;
  $("#openOrders").onclick = renderOrders;
  $("#logoutButton").onclick = logout;
}

function drawerPageHeader(title, extra = "") {
  return `<div class="drawer-page-head"><button class="drawer-page-back" data-drawer-back>‹</button><h2>${escapeHtml(title)}</h2>${extra}</div>`;
}

function bindDrawerBack(target = "home") {
  $("[data-drawer-back]")?.addEventListener("click", () => target === "addresses" ? renderAddresses() : renderAccountHome());
}

function renderAccountInfo() {
  resetAccountDrawerScroll();
  $("#accountContent").innerHTML = `${drawerPageHeader(tr("myInfo"))}
    <form class="profile-form" id="profileForm">
      <label>${tr("username")}<input id="profileName" value="${escapeHtml(state.user.name)}" maxlength="80"></label>
      <label>${tr("phone")}<div class="profile-phone"><input value="${escapeHtml(state.user.phone)}" readonly><button class="secondary" id="changePhoneButton" type="button">${tr("changePhone")}</button></div></label>
      <button class="primary" type="submit">${tr("save")}</button>
    </form>`;
  bindDrawerBack();
  $("#changePhoneButton").onclick = () => openAuth("changePhone");
  $("#profileForm").onsubmit = event => {
    event.preventDefault();
    const name = $("#profileName").value.trim();
    if (!name) return toast(tr("nameRequired"));
    state.user.name = name;
    persistUser();
    toast(tr("infoSaved"));
    renderAccountInfo();
  };
}

function renderAddresses() {
  const addresses = state.user.addresses || [];
  resetAccountDrawerScroll();
  $("#accountContent").innerHTML = `${drawerPageHeader(tr("myAddresses"), `<button class="primary" id="addAddressTop">＋ ${tr("addAddress")}</button>`)}
    ${addresses.length ? `<div class="address-list">${addresses.map(address => `
      <article class="address-card">
        <h3>${escapeHtml(address.areaName)}</h3><p>${escapeHtml(address.details)}</p>
        <div class="card-actions"><button data-edit-address="${escapeHtml(address.id)}">${tr("edit")}</button><button class="delete" data-delete-address="${escapeHtml(address.id)}">${tr("delete")}</button></div>
      </article>`).join("")}</div>` : `<div class="empty-state">${accountIcons.address}<h3>${tr("addressesEmpty")}</h3></div>`}`;
  bindDrawerBack();
  $("#addAddressTop").onclick = () => renderAddressForm("");
  $$("[data-edit-address]").forEach(button => button.onclick = () => renderAddressForm(button.dataset.editAddress));
  $$("[data-delete-address]").forEach(button => button.onclick = () => {
    if (!confirm(tr("delete"))) return;
    state.user.addresses = state.user.addresses.filter(address => address.id !== button.dataset.deleteAddress);
    if (state.addressId === button.dataset.deleteAddress) {
      state.addressId = "";
      state.area = null;
      state.address = "";
    }
    persistUser();
    renderAddresses();
  });
}

function renderAddressForm(addressId = "") {
  const existing = (state.user.addresses || []).find(address => address.id === addressId);
  resetAccountDrawerScroll();
  let selectedArea = existing ? { name: existing.areaName, price: existing.price } : null;
  let pendingArea = null;
  let areaQuery = selectedArea?.name || "";
  let areaResults = "";
  let confirmedAreaName = selectedArea?.name || "";
  const areaLabel = area => state.lang === "ar" ? (area.nameAr || area.name) : (area.nameEn || area.nameAr || area.name);
  const areaFieldLabel = () => selectedArea
    ? (state.lang === "ar" ? "المنطقة" : "Area")
    : tr("areaSearch");
  const resultsHtml = query => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) return "";
    return state.areas.filter(area => [area.name, area.nameAr, area.nameEn].filter(Boolean).some(name => name.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()))).slice(0, 60).map(area =>
      `<button type="button" class="${selectedArea?.name === area.name ? "selected" : ""}" data-pick-area="${escapeHtml(area.name)}"><span class="area-name">${selectedArea?.name === area.name ? "<i>✓</i>" : ""}${escapeHtml(areaLabel(area))}</span><b>${money(area.price)}</b></button>`
    ).join("");
  };
  const areaPickerHtml = () => {
    const confirmedArea = selectedArea || (confirmedAreaName ? state.areas.find(area => area.name === confirmedAreaName) : null);
    if (confirmedArea) return `
    <div class="confirmed-area">
      <span class="confirmed-area-check" aria-hidden="true">✓</span>
      <div><strong>${escapeHtml(areaLabel(confirmedArea))}</strong><small>${tr("deliveryFee")}: ${money(confirmedArea.price)}</small></div>
      <button type="button" class="edit-area-button" id="editAddressArea">${tr("edit")}</button>
    </div>`;
    return `
    <input id="addressAreaSearch" value="${escapeHtml(areaQuery)}" placeholder="${tr("areaSearch")}" autocomplete="off">
    <div class="area-results${areaResults ? "" : " hidden"}" id="addressAreaResults">${areaResults}</div>
    ${pendingArea ? `<div class="area-confirmation" role="dialog" aria-modal="true" aria-labelledby="area-confirm-title">
      <div class="area-confirm-card"><span class="area-confirm-icon" aria-hidden="true">⌖</span>
        <h3 id="area-confirm-title">${state.lang === "ar" ? `هل تريد اختيار منطقة ${escapeHtml(areaLabel(pendingArea))}؟` : `Do you want to choose ${escapeHtml(areaLabel(pendingArea))}?`}</h3>
        <p>${tr("deliveryFee")}: ${money(pendingArea.price)}</p>
        <div class="area-confirm-actions"><button type="button" class="primary" id="confirmAddressArea" data-confirm-area="${escapeHtml(pendingArea.name)}">${state.lang === "ar" ? "نعم" : "Yes"}</button><button type="button" class="secondary" id="cancelAddressArea">${state.lang === "ar" ? "لا" : "No"}</button></div>
      </div>
    </div>` : ""}`;
  };
  $("#accountContent").innerHTML = `${drawerPageHeader(existing ? tr("edit") : tr("addAddress"))}
    <form class="address-form" id="addressForm">
      <label><span id="addressAreaLabel">${areaFieldLabel()}</span>
        <div class="area-picker" id="addressAreaPicker">${areaPickerHtml()}</div>
      </label>
      <label>${tr("addressDetails")}<textarea id="addressDetails" placeholder="${tr("addressPlaceholder")}">${escapeHtml(existing?.details || "")}</textarea></label>
      <p class="auth-message" id="addressMessage"></p>
      <button class="primary" type="submit">${tr("save")}</button>
    </form>`;
  $("[data-drawer-back]").onclick = () => {
    if (accountReturnToCheckout) {
      closeAccountDrawer(true);
    } else renderAddresses();
  };
  const renderAreaPicker = () => {
    const label = $("#addressAreaLabel");
    if (label) label.textContent = areaFieldLabel();
    const picker = $("#addressAreaPicker");
    picker.innerHTML = areaPickerHtml();
    const confirmPendingArea = areaName => {
      const confirmedArea = state.areas.find(area => area.name === areaName) || pendingArea;
      if (!confirmedArea) return;
      selectedArea = { ...confirmedArea };
      confirmedAreaName = confirmedArea.name;
      pendingArea = null;
      areaQuery = "";
      areaResults = "";
      renderAreaPicker();
    };
    picker.onclick = event => {
      const target = event.target.closest("button");
      if (!target) return;

      const pickedAreaName = target.dataset.pickArea;
      if (pickedAreaName) {
        pendingArea = state.areas.find(area => area.name === pickedAreaName) || null;
        renderAreaPicker();
        return;
      }

      if (target.id === "confirmAddressArea") {
        confirmPendingArea(target.dataset.confirmArea);
        return;
      }

      if (target.id === "cancelAddressArea") {
        pendingArea = null;
        renderAreaPicker();
        return;
      }

      if (target.id === "editAddressArea") {
        selectedArea = null;
        confirmedAreaName = "";
        pendingArea = null;
        areaQuery = "";
        areaResults = "";
        renderAreaPicker();
        $("#addressAreaSearch")?.focus();
      }
    };
    $("#confirmAddressArea")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      confirmPendingArea(event.currentTarget.dataset.confirmArea);
    });
    $("#addressAreaSearch")?.addEventListener("input", event => {
      areaQuery = event.target.value;
      areaResults = resultsHtml(areaQuery);
      const results = $("#addressAreaResults");
      results.innerHTML = areaResults;
      results.classList.toggle("hidden", !areaResults);
    });
  };
  renderAreaPicker();
  $("#addressDetails").oninput = event => { event.target.value = normalizeAddressText(event.target.value); };
  $("#addressForm").onsubmit = event => {
    event.preventDefault();
    const details = normalizeAddressText($("#addressDetails").value).trim();
    if (!selectedArea) return $("#addressMessage").textContent = tr("chooseArea");
    if (!details) return $("#addressMessage").textContent = tr("addressDetails");
    const saved = { id: existing?.id || `address-${Date.now().toString(36)}`, areaName: selectedArea.name, price: Number(selectedArea.price), details };
    const addresses = state.user.addresses || [];
    const index = addresses.findIndex(address => address.id === saved.id);
    if (index >= 0) addresses[index] = saved; else addresses.push(saved);
    state.user.addresses = addresses;
    persistUser();
    toast(tr("addressSaved"));
    if (accountReturnToCheckout) {
      state.addressId = saved.id;
      state.area = state.areas.find(area => area.name === saved.areaName) || { name: saved.areaName, price: saved.price };
      state.address = saved.details;
      closeAccountDrawer(true);
    } else renderAddresses();
  };
}

function renderOrders() {
  $("#accountDrawer").classList.remove("order-detail-mode");
  const orders = (state.user.orders || []).map(normalizeLegacyOrder).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  state.user.orders = orders;
  persistUser();
  resetAccountDrawerScroll();
  $("#accountContent").innerHTML = `${drawerPageHeader(tr("myOrders"))}
    ${orders.length ? `<div class="order-list">${orders.map(order => `
      <article class="order-card">
        <div class="order-card-head"><div><strong class="order-number">${escapeHtml(order.orderId)}</strong><p>${escapeHtml(trLocaleDate(order.createdAt))}</p></div><span class="paid-badge">${tr("paid")}</span></div>
        <div class="order-total"><span>${tr("total")}</span><b>${money(order.total)}</b></div>
        <button class="primary" data-order-details="${escapeHtml(order.orderId)}">${tr("viewOrderDetails")}</button>
      </article>`).join("")}</div>` : `<div class="empty-state">${accountIcons.order}<h3>${tr("ordersEmpty")}</h3></div>`}`;
  bindDrawerBack();
  $$("[data-order-details]").forEach(button => button.onclick = () => renderOrderDetails(button.dataset.orderDetails));
}

function orderDestination(order) {
  if (order.mode === "delivery") return `${order.areaName || ""} — ${order.address || ""}`;
  const branch = branches.find(item => item.id === order.branchId);
  return branch ? `${branchField(branch, "name")} — ${branchField(branch, "address")}` : "";
}

async function renderOrderDetails(orderId, fromSuccess = false) {
  let order = (state.user?.orders || []).map(normalizeLegacyOrder).find(item => item.orderId === orderId) ||
    (state.lastInvoice?.orderId === orderId ? state.lastInvoice : null);
  if (!order) return renderOrders();
  order = await canonicalOnlineOrder(order);
  $("#accountDrawer").classList.add("order-detail-mode");
  resetAccountDrawerScroll();
  $("#accountContent").innerHTML = `${drawerPageHeader(tr("orderDetails"))}
    <section class="order-detail">
      <div class="order-detail-hero">
        <div class="order-detail-brand"><img src="logo.png" alt=""><div><small>${tr("orderNumber")}</small><strong>${escapeHtml(order.orderId)}</strong><p>${escapeHtml(trLocaleDate(order.createdAt))}</p></div></div>
        <span class="paid-badge">${tr("paid")}</span>
      </div>
      <div class="detail-section-title"><span class="detail-title-icon">${accountIcons.info}</span><div><small>${tr("customer")}</small><b>${tr("deliveryDetails")}</b></div></div>
      <div class="order-detail-grid">
        <div><span class="detail-item-icon">${accountIcons.info}</span><span><small>${tr("customerName")}</small><strong>${escapeHtml(order.customerName || state.user?.name || "")}</strong></span></div>
        <div><span class="detail-item-icon">${accountIcons.phone}</span><span><small>${tr("phone")}</small><strong class="phone">${escapeHtml(order.phone || state.user?.phone || "")}</strong></span></div>
        <div><span class="detail-item-icon">${accountIcons.address}</span><span><small>${order.mode === "delivery" ? tr("deliveryAddress") : tr("pickupBranch")}</small><strong>${escapeHtml(orderDestination(order))}</strong></span></div>
        <div><span class="detail-item-icon">${accountIcons.clock}</span><span><small>${order.mode === "pickup" ? tr("pickupStatus") : tr("expectedDeliveryTime")}</small><strong class="delivery-time-lines">${deliveryTimeSummaryMarkup(order)}</strong></span></div>
      </div>
      <div class="detail-section-title"><span class="detail-title-icon">${accountIcons.box}</span><div><small>${(order.items || []).length} ${tr("products")}</small><b>${tr("showProducts")}</b></div></div>
      <div class="order-detail-body">
        <div class="order-detail-items">${(order.items || []).map((item, index) => `
          <article><i>${index + 1}</i><span><b>${escapeHtml(orderItemName(item))}</b><small>${tr("quantity")}: ${item.quantity} × ${money(item.unitPrice || (item.total / item.quantity))}</small></span><strong>${money(item.total)}</strong></article>`).join("")}</div>
        <div class="order-detail-totals">
          <span>${tr("productsTotal")} <b>${money(order.subtotal)}</b></span>
          <span>${tr("deliveryFee")} <b>${money(order.deliveryFee)}</b></span>
          <strong>${tr("total")} <b>${money(order.total)}</b></strong>
          <small>${accountIcons.card} ${tr("payOnline")}</small>
        </div>
      </div>
      <button class="primary download-invoice-button" id="downloadOrderInvoice">${tr("downloadInvoice")}</button>
    </section>`;
  const back = $("[data-drawer-back]");
  if (back) back.onclick = () => {
    if (fromSuccess) {
      closeAccountDrawer();
      $("#checkoutModal").classList.remove("hidden");
    } else {
      renderOrders();
    }
  };
  const downloadButton = $("#downloadOrderInvoice");
  downloadButton.onclick = () => downloadPdf(order);
  prepareInvoiceFile(order, downloadButton);
}

function openCheckout() {
  if (!cartCount()) {
    toast(state.lang === "ar" ? "أضف منتجاً إلى السلة أولاً" : "Add a product to your cart first");
    return;
  }
  if (!state.user?.name) return openAuth("login");
  clearProductRoute();
  if (state.detailProductId) closeProductPage(false);
  state.name = state.user.name;
  state.phone = state.user.phone;
  state.step = 1;
  $("#steps").classList.remove("hidden");
  $("#checkoutModal").classList.remove("hidden");
  renderCheckout();
}

function setSteps() {
  $$(".steps [data-step]").forEach(element => {
    const step = Number(element.dataset.step);
    element.classList.toggle("active", step === state.step);
    element.classList.toggle("done", step < state.step);
    if (step === 3) {
      const label = $("span", element);
      if (label) label.textContent = state.mode === "pickup" ? tr("pickupTime") : tr("deliveryTime");
    }
  });
}

function renderCheckout() {
  setSteps();
  $("#checkoutTitle").textContent = state.step === 3
    ? (state.mode === "pickup" ? tr("pickupTime") : tr("deliveryTime"))
    : state.step === 4 ? tr("confirmPay") : tr("completeOrder");
  if (state.step === 1) renderReview();
  else if (state.step === 2) renderDelivery();
  else if (state.step === 3) renderDeliveryTime();
  else renderConfirmation();
}

function totalsHtml() {
  return `<div class="totals"><span>${tr("productsTotal")} <b>${money(subtotal())}</b></span>${deliveryFee() ? `<span>${tr("deliveryFee")} <b>${money(deliveryFee())}</b></span>` : ""}<strong>${tr("total")} <b>${money(total())}</b></strong></div>`;
}

function hasMinimumOrderValue() {
  return subtotal() >= 5;
}

function minimumOrderNotice() {
  return state.lang === "ar" ? "أقل قيمة لقبول الطلب: 5 د.ك" : "Minimum order value: 5 KWD";
}

function renderReview() {
  $("#checkoutBody").innerHTML = `
    <section class="checkout-review"><div class="cart-list">${cartItems().map(({ product: item, quantity, note, options }) => { const minimumIssue = cartItemMinimumIssue({ product: item, quantity, options }); return `
      <div class="cart-row ${minimumIssue ? "minimum-order-warning" : ""}"><img src="${escapeHtml(productImages(item)[0] || "logo.png")}" alt="">
        <div class="cart-copy"><h4>${escapeHtml(cartDisplayName(item, options))}</h4>${cartDetailOptions(item, options).length ? `<small class="cart-options">${escapeHtml(cartDetailOptions(item, options).map(optionSummary).join("، "))}</small>` : ""}${minimumIssue ? `<small class="minimum-order-warning-note">${escapeHtml(minimumOrderText(minimumIssue.minimum))}</small>` : ""}<strong>${money(unitPrice(item, options) * quantity)}</strong></div><label class="cart-note-label"><textarea aria-label="${state.lang === "ar" ? "ترك ملاحظة" : "Leave a note"}" data-cart-note="${escapeHtml(item.id)}" maxlength="240" placeholder="${state.lang === "ar" ? "ترك ملاحظة" : "Leave a note"}">${escapeHtml(note)}</textarea></label>
        <div class="qty"><button data-plus="${escapeHtml(item.id)}">+</button><span>${quantity}</span><button data-minus="${escapeHtml(item.id)}">${quantity === 1 ? "×" : "−"}</button></div>
      </div>`; }).join("")}</div><div class="checkout-sticky-actions">${cartHasLongPreparationItems() ? `<p class="long-preparation-notice">${state.lang === "ar" ? "ملاحظة: يوجد في طلبك أصناف تأخذ وقت للتجهيز.. لذا يرجى العلم أنه قد يتأخر طلبك أو يتم تأجيله." : "Note: Your order includes items that need extra preparation time, so it may be delayed or rescheduled."}</p>` : ""}${totalsHtml()}<button class="primary" id="next1">${tr("confirmContinue")}</button></div></section>`;
  $$('[data-cart-note]').forEach(input => input.onchange = () => updateCartNote(input.dataset.cartNote, input.value));
  $("#next1").onclick = () => {
    if (!cartCount()) return toast(state.lang === "ar" ? "لا يمكن المتابعة وسلتك فارغة" : "You cannot continue with an empty cart");
    if (cartItems().some(cartItemMinimumIssue)) return toast(state.lang === "ar" ? "ارجو إكمال كمية المنتج المطلوبة" : "Please complete the required product quantity", "error");
    if (!hasMinimumOrderValue()) return toast(minimumOrderNotice(), "error");
    state.step = 2;
    renderCheckout();
  };
}

function selectSavedAddress(addressId) {
  const saved = (state.user.addresses || []).find(address => address.id === addressId);
  if (!saved) return;
  state.addressId = saved.id;
  state.area = state.areas.find(area => area.name === saved.areaName) || { name: saved.areaName, price: saved.price };
  state.address = saved.details;
  state.paymentRequestId = "";
  renderDelivery();
}

function renderDelivery() {
  if (state.mode === "pickup" && !branches.some(branch => branch.id === state.branch)) state.branch = "";
  const restaurantPickup = state.mode === "pickup" && cartHasRestaurantItems();
  if (restaurantPickup && state.branch !== "abu") state.branch = "";
  const addresses = state.user.addresses || [];
  const deliveryForm = addresses.length ? `
    <h3>${tr("selectAddress")}</h3><div class="checkout-addresses">${addresses.map(address => `
      <button class="checkout-address ${state.addressId === address.id ? "selected" : ""}" data-checkout-address="${escapeHtml(address.id)}">
        <span class="radio">${state.addressId === address.id ? "✓" : ""}</span><div><strong>${escapeHtml(address.areaName)} — ${money(address.price)}</strong><small>${escapeHtml(address.details)}</small></div>
      </button>`).join("")}</div><button class="add-address-button" id="checkoutAddAddress">＋ ${tr("addAddress")}</button>` :
    `<div class="empty-state">${accountIcons.address}<h3>${tr("noAddedAddresses")}</h3><button class="primary" id="checkoutAddAddress">＋ ${tr("addAddress")}</button></div>`;
  const pickupForm = `${restaurantPickup ? `<p class="pickup-restaurant-notice" role="alert">أصناف المطعم يتم استلامها من فرع أبو الحصانية فقط</p>` : ""}<div class="branches">${branches.map(branch => {
    const unavailable = restaurantPickup && branch.id !== "abu";
    return `
    <button class="option branch-option ${state.branch === branch.id ? "selected" : ""} ${unavailable ? "unavailable" : ""}" data-branch="${branch.id}" aria-disabled="${unavailable}">
      <span class="radio"></span>
      <div class="branch-main"><strong>${escapeHtml(branchField(branch, "name"))}</strong><b>${escapeHtml(branchField(branch, "brand"))}</b></div>
      <div class="branch-meta"><small>${escapeHtml(branchField(branch, "address"))}</small><small class="branch-phone">${escapeHtml(branch.phone)}</small></div>
    </button>`;
  }).join("")}</div>`;
  $("#checkoutBody").innerHTML = `
    <div class="tabs"><button class="${state.mode === "delivery" ? "active" : ""}" id="deliveryTab">🚚 ${tr("delivery")}</button><button class="${state.mode === "pickup" ? "active" : ""}" id="pickupTab">⌂ ${tr("pickup")}</button></div>
    ${state.mode === "delivery" ? deliveryForm : pickupForm}
    <div class="actions"><button class="secondary" id="back1">${tr("back")}</button><button class="primary" id="next2">${tr("confirmContinue")}</button></div>`;
  $("#deliveryTab").onclick = () => {
    state.mode = "delivery";
    if (state.deliveryTiming === "notify") state.deliveryTiming = "asap";
    state.paymentRequestId = "";
    renderDelivery();
  };
  $("#pickupTab").onclick = () => {
    state.mode = "pickup";
    if (state.deliveryTiming === "asap") state.deliveryTiming = "notify";
    state.paymentRequestId = "";
    renderDelivery();
  };
  $("#back1").onclick = () => { state.step = 1; renderCheckout(); };
  $("#checkoutAddAddress")?.addEventListener("click", () => openAccountDrawer("addressForm", { returnToCheckout: true }));
  $$("[data-checkout-address]").forEach(button => button.onclick = () => selectSavedAddress(button.dataset.checkoutAddress));
  $$("[data-branch]").forEach(button => button.onclick = () => {
    if (button.getAttribute("aria-disabled") === "true") return toast(state.lang === "ar" ? "أصناف المطعم يتم استلامها من فرع أبو الحصانية فقط" : "Restaurant items can only be picked up from Abu Al Hasaniya branch", "error");
    state.branch = button.dataset.branch; state.paymentRequestId = ""; renderDelivery();
  });
  $("#next2").onclick = () => {
    if (!cartCount()) return toast(state.lang === "ar" ? "لا يمكن المتابعة وسلتك فارغة" : "You cannot continue with an empty cart");
    if (state.mode === "delivery" && !state.addressId) return toast(tr("completeDelivery"));
    if (state.mode === "pickup" && !state.branch) return toast(tr("chooseBranch"));
    state.step = 3;
    renderCheckout();
  };
}

function deliverySummary() {
  if (state.mode === "pickup") {
    const branch = branches.find(item => item.id === state.branch);
    return branch ? `${branchField(branch, "name")} — ${branchField(branch, "address")}` : "";
  }
  return `${state.area?.name || ""} — ${state.address}`;
}

function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduledDateTime() {
  if (!state.scheduledDate) return null;
  let hour = Number(state.scheduledHour);
  if (state.scheduledPeriod === "pm" && hour !== 12) hour += 12;
  if (state.scheduledPeriod === "am" && hour === 12) hour = 0;
  const result = new Date(`${state.scheduledDate}T${String(hour).padStart(2, "0")}:${state.scheduledMinute}:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function minimumScheduledDateTime(now = new Date()) {
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

function minutesSinceMidnight(value = new Date()) {
  return value.getHours() * 60 + value.getMinutes();
}

function isWithinDeliveryHours(value) {
  const minutes = minutesSinceMidnight(value);
  return minutes >= 9 * 60 + 30 && minutes <= 22 * 60 + 30;
}

function isWithinPickupHours(value) {
  const minutes = minutesSinceMidnight(value);
  return minutes >= 8 * 60 && minutes <= 22 * 60 + 30;
}

function isAsapDeliveryUnavailable(value = new Date()) {
  const minutes = minutesSinceMidnight(value);
  return minutes >= 22 * 60 || minutes < 7 * 60 + 30;
}

function nextDeliveryOpening(value = new Date()) {
  const result = new Date(value);
  if (minutesSinceMidnight(result) >= 22 * 60) result.setDate(result.getDate() + 1);
  result.setHours(9, 30, 0, 0);
  return result;
}

function normalizeToDeliveryHours(value) {
  const result = new Date(value);
  const minutes = minutesSinceMidnight(result);
  if (minutes < 9 * 60 + 30) {
    result.setHours(9, 30, 0, 0);
    return result;
  }
  if (minutes > 22 * 60 + 30) {
    result.setDate(result.getDate() + 1);
    result.setHours(9, 30, 0, 0);
  }
  return result;
}

function asapDeliveryWindow(value = new Date()) {
  let start = new Date(value.getTime() + 60 * 60 * 1000);
  const opening = nextDeliveryOpening(value);
  if (start.getTime() < opening.getTime()) start = opening;
  return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}

function isLateAsapDelivery(value = new Date()) {
  return asapDeliveryWindow(value).end.getTime() > new Date(
    value.getFullYear(), value.getMonth(), value.getDate(), 22, 30, 0, 0
  ).getTime();
}

function roundUpToHalfHour(value) {
  const result = new Date(value);
  result.setSeconds(0, 0);
  const minutes = result.getMinutes();
  if (minutes === 0 || minutes === 30) return result;
  if (minutes < 30) result.setMinutes(30);
  else {
    result.setHours(result.getHours() + 1);
    result.setMinutes(0);
  }
  return result;
}

function setScheduledFields(value) {
  const date = new Date(value);
  const hour24 = date.getHours();
  state.scheduledDate = dateInputValue(date);
  state.scheduledHour = String(hour24 % 12 || 12);
  state.scheduledMinute = date.getMinutes() >= 30 ? "30" : "00";
  state.scheduledPeriod = hour24 >= 12 ? "pm" : "am";
}

function ensureFutureScheduledDefault() {
  const minimum = minimumScheduledDateTime();
  const selected = scheduledDateTime();
  if (!selected || selected.getTime() < minimum.getTime()) {
    const candidate = roundUpToHalfHour(minimum);
    setScheduledFields(state.mode === "delivery" ? normalizeToDeliveryHours(candidate) : candidate);
  }
}

function isScheduledTimeAllowed(value, now = new Date()) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false;
  return value.getTime() >= minimumScheduledDateTime(now).getTime();
}

function renderDeliveryTime() {
  if (state.mode === "pickup" && state.deliveryTiming === "asap") state.deliveryTiming = "notify";
  if (state.mode === "delivery" && state.deliveryTiming === "notify") state.deliveryTiming = "asap";
  const asapUnavailable = state.mode === "delivery" && isAsapDeliveryUnavailable();
  if (asapUnavailable && state.deliveryTiming !== "scheduled") {
    state.deliveryTiming = "scheduled";
    setScheduledFields(nextDeliveryOpening());
  }
  const immediateTiming = state.mode === "pickup" ? "notify" : "asap";
  state.scheduledDate = state.scheduledDate || dateInputValue();
  const specific = state.deliveryTiming === "scheduled";
  const showLateWarning = state.mode === "delivery" && !specific && isLateAsapDelivery();
  const immediateTitle = state.mode === "pickup" ? tr("notifyWhenReady") : tr("withinTwoHours");
  const immediateHint = state.mode === "pickup" ? tr("notifyWhenReadyHint") : tr("withinTwoHoursHint");
  const scheduledTitle = state.mode === "pickup" ? tr("chooseArrivalTime") : tr("chooseSpecificTime");
  const scheduledHint = state.mode === "pickup" ? tr("chooseArrivalTimeHint") : tr("chooseSpecificTimeHint");
  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  $("#checkoutBody").innerHTML = `
    <section class="delivery-time-panel">
      <button class="time-choice ${specific ? "" : "selected"} ${asapUnavailable ? "disabled" : ""}" id="asapTime" type="button" ${asapUnavailable ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="radio">${specific ? "" : "✓"}</span><span><strong>${immediateTitle}</strong><small>${immediateHint}</small></span>
      </button>
      ${showLateWarning ? `<p class="time-warning">${tr("lateDeliveryWarning")}</p>` : ""}
      <button class="time-choice ${specific ? "selected" : ""}" id="scheduledTime" type="button">
        <span class="radio">${specific ? "✓" : ""}</span><span><strong>${scheduledTitle}</strong><small>${scheduledHint}</small></span>
      </button>
      ${state.mode === "pickup" && specific ? `<p class="pickup-hours-warning">${tr("pickupHoursNotice")}</p>` : ""}
      ${specific ? `<div class="time-fields">
        <label class="time-date">${tr("deliveryDate")}<input id="scheduledDate" type="date" min="${dateInputValue()}" value="${escapeHtml(state.scheduledDate)}"></label>
        <label class="time-period">${tr("period")}<select id="scheduledPeriod"><option value="am" ${state.scheduledPeriod === "am" ? "selected" : ""}>${tr("morning")}</option><option value="pm" ${state.scheduledPeriod === "pm" ? "selected" : ""}>${tr("evening")}</option></select></label>
        <label class="time-minute">${tr("minute")}<select id="scheduledMinute"><option value="00" ${state.scheduledMinute === "00" ? "selected" : ""}>00</option><option value="30" ${state.scheduledMinute === "30" ? "selected" : ""}>30</option></select></label>
        <label class="time-hour">${tr("hour")}<select id="scheduledHour">${hours.map(hour => `<option value="${hour}" ${String(hour) === String(state.scheduledHour) ? "selected" : ""}>${hour}</option>`).join("")}</select></label>
      </div>` : ""}
      <div class="actions"><button class="secondary" id="backTime">${tr("back")}</button><button class="primary" id="confirmTime">${tr("confirmContinue")}</button></div>
    </section>`;
  $("#asapTime").onclick = () => { state.deliveryTiming = immediateTiming; state.paymentRequestId = ""; renderDeliveryTime(); };
  $("#scheduledTime").onclick = () => {
    ensureFutureScheduledDefault();
    state.deliveryTiming = "scheduled";
    state.paymentRequestId = "";
    renderDeliveryTime();
  };
  $("#scheduledDate")?.addEventListener("change", event => { state.scheduledDate = event.target.value; state.paymentRequestId = ""; });
  $("#scheduledHour")?.addEventListener("change", event => { state.scheduledHour = event.target.value; state.paymentRequestId = ""; });
  $("#scheduledMinute")?.addEventListener("change", event => { state.scheduledMinute = event.target.value; state.paymentRequestId = ""; });
  $("#scheduledPeriod")?.addEventListener("change", event => { state.scheduledPeriod = event.target.value; state.paymentRequestId = ""; });
  $("#backTime").onclick = () => { state.step = 2; renderCheckout(); };
  $("#confirmTime").onclick = () => {
    if (state.deliveryTiming === "scheduled") {
      const selected = scheduledDateTime();
      if (!selected) return toast(tr("chooseValidTime"));
      if (state.mode === "delivery" && !isWithinDeliveryHours(selected)) return toast(tr("deliveryHoursNotice"));
      if (state.mode === "pickup" && !isWithinPickupHours(selected)) return toast(tr("pickupHoursNotice"), "error");
      if (!isScheduledTimeAllowed(selected)) return toast(tr("chooseTimeAfterMinimum"));
    }
    state.step = 4;
    renderCheckout();
  };
}

function formatDeliveryTime(value) {
  return new Date(value).toLocaleTimeString(state.lang === "ar" ? "ar-KW" : "en-GB", { hour: "numeric", minute: "2-digit" });
}

function formatScheduleDate(value) {
  return new Date(value).toLocaleDateString(state.lang === "ar" ? "ar-KW" : "en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function scheduledWindowSummary(value, mode = state.mode) {
  const end = new Date(value);
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const label = mode === "pickup" ? tr("scheduledPickupTime") : tr("scheduledDeliveryTime");
  return `${label}: ${formatScheduleDate(end)}، ${tr("betweenTime")} ${formatDeliveryTime(start)} ${tr("andTime")} ${formatDeliveryTime(end)}`;
}

function deliveryTimeSummary(source = state) {
  if (source.mode === "pickup" && source.status === "paid") return tr("pickupContactConfirmation");
  if (source.deliveryTiming === "scheduled" && source.scheduledAt) {
    return scheduledWindowSummary(source.scheduledAt, source.mode);
  }
  if (source.deliveryTiming === "scheduled") {
    const scheduled = scheduledDateTime();
    return scheduled ? scheduledWindowSummary(scheduled, source.mode) : tr("chooseSpecificTime");
  }
  if (source.mode === "pickup" || source.deliveryTiming === "notify") return tr("notifyWhenReady");
  if (source.expectedStart && source.expectedEnd) {
    return `${tr("betweenTime")} ${formatDeliveryTime(source.expectedStart)} ${tr("andTime")} ${formatDeliveryTime(source.expectedEnd)}`;
  }
  return tr("withinTwoHours");
}

function deliveryTimeSummaryLines(source = state) {
  let scheduled = null;
  if (source.deliveryTiming === "scheduled" && source.scheduledAt) scheduled = new Date(source.scheduledAt);
  else if (source.deliveryTiming === "scheduled") scheduled = scheduledDateTime();
  if (!scheduled || Number.isNaN(scheduled.getTime())) return [deliveryTimeSummary(source)];
  const start = new Date(scheduled.getTime() - 60 * 60 * 1000);
  const label = source.mode === "pickup" ? tr("scheduledPickupTime") : tr("scheduledDeliveryTime");
  return [
    `${label}:`,
    `${formatScheduleDate(scheduled)}،`,
    `${tr("betweenTime")} ${formatDeliveryTime(start)} ${tr("andTime")} ${formatDeliveryTime(scheduled)}`
  ];
}

function deliveryTimeSummaryMarkup(source = state) {
  return deliveryTimeSummaryLines(source).map(line => `<span>${escapeHtml(line)}</span>`).join("");
}

function renderConfirmation() {
  const appleSafari = isIphoneSafari();
  if (!appleSafari) state.paymentMethod = "knet";
  const paymentMark = method => method === "applepay"
    ? `<span class="apple-pay-mark" aria-label="Apple Pay"> Pay</span>`
    : `<span class="knet-mark"><img src="knet-logo.png" alt="KNET"></span>`;
  const paymentChoices = appleSafari ? `<div class="payment-method-choices" role="radiogroup" aria-label="${tr("choosePaymentMethod")}">
    <button type="button" class="payment-choice ${state.paymentMethod === "applepay" ? "selected" : ""}" data-payment-method="applepay" role="radio" aria-checked="${state.paymentMethod === "applepay"}"><span class="payment-radio"></span>${paymentMark("applepay")}<strong>${tr("applePay")}</strong></button>
    <button type="button" class="payment-choice ${state.paymentMethod === "knet" ? "selected" : ""}" data-payment-method="knet" role="radio" aria-checked="${state.paymentMethod === "knet"}"><span class="payment-radio"></span>${paymentMark("knet")}<strong>${tr("knet")}</strong></button>
  </div>` : "";
  $("#checkoutTitle").textContent = tr("confirmPay");
  $("#checkoutBody").innerHTML = `
    <section class="confirmation-card">
      <div class="confirmation-heading"><span class="detail-title-icon">${accountIcons.info}</span><div><small>${tr("customer")}</small><b>${tr("deliveryDetails")}</b></div></div>
      <div class="customer-summary">
        <div class="summary-box"><span class="summary-icon">${accountIcons.info}</span><span><small>${tr("customerName")}</small><strong>${escapeHtml(state.user.name)}</strong></span></div>
        <div class="summary-box"><span class="summary-icon">${accountIcons.phone}</span><span><small>${tr("phone")}</small><strong class="phone">${escapeHtml(state.user.phone)}</strong></span></div>
        <div class="summary-box"><span class="summary-icon">${accountIcons.address}</span><span><small>${state.mode === "delivery" ? tr("deliveryAddress") : tr("pickupBranch")}</small><strong>${escapeHtml(deliverySummary())}</strong></span></div>
        <div class="summary-box"><span class="summary-icon">${accountIcons.clock}</span><span><small>${state.mode === "pickup" ? tr("pickupTime") : tr("deliveryTime")}</small><strong class="delivery-time-lines">${deliveryTimeSummaryMarkup()}</strong></span></div>
      </div>
      <div class="price-summary">
        <button class="price-row products-toggle" id="productsToggle"><span><b class="arrow">‹</b> ${tr("productsTotal")}</span><strong>${money(subtotal())}</strong></button>
        <div class="confirmation-products hidden" id="confirmationProducts">${cartItems().map(({ product: item, quantity, options }) => `
          <div class="confirmation-product"><img src="${escapeHtml(productImages(item)[0] || "logo.png")}" alt=""><span>${escapeHtml(productName(item))} × ${quantity}</span><b>${money(unitPrice(item, options) * quantity)}</b></div>`).join("")}</div>
        <div class="price-row"><span>${tr("deliveryFee")}</span><strong>${money(deliveryFee())}</strong></div>
        <div class="price-row total-row"><span>${tr("total")}</span><strong>${money(total())}</strong></div>
      </div>
      <div class="confirmation-sticky-actions">${paymentChoices}<div class="actions"><button class="secondary" id="back2">${tr("back")}</button><button class="primary pay-now" id="finish" aria-label="${tr("payNow")}">${state.paymentMethod ? paymentMark(state.paymentMethod) : ""}<span>${tr("payNow")}</span></button></div></div>
    </section>`;
  $("#productsToggle").onclick = () => {
    const details = $("#confirmationProducts");
    const open = details.classList.toggle("hidden") === false;
    $("#productsToggle").classList.toggle("open", open);
    $("#productsToggle").setAttribute("aria-label", open ? tr("hideProducts") : tr("showProducts"));
  };
  $("#back2").onclick = () => { state.step = 3; renderCheckout(); };
  $$('[data-payment-method]').forEach(button => button.onclick = () => { state.paymentMethod = button.dataset.paymentMethod; state.paymentRequestId = ""; renderConfirmation(); });
  $("#finish").onclick = beginPayment;
}

function requestId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function isAppleMobileDevice() {
  const userAgent = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isIphoneSafari() {
  const userAgent = navigator.userAgent || "";
  return isAppleMobileDevice() && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(userAgent);
}

function beginPayment() {
  if (state.paymentMethod === "knet" && total() < .100) {
    return paymentError(state.lang === "ar" ? "الحد الأدنى للدفع عبر KNET هو 0.100 د.ك. زد كمية المنتج أو اختر Apple Pay." : "KNET requires a minimum order of 0.100 KWD. Increase the quantity or use Apple Pay.");
  }
  return finishOrder();
}

function isAllowedPaymentGatewayUrl(target) {
  if (!(target instanceof URL) || target.protocol !== "https:") return false;
  const host = target.hostname.toLowerCase();
  return host === "kpaytest.com.kw"
    || host.endsWith(".kpaytest.com.kw")
    || host === "kpay.com.kw"
    || host.endsWith(".kpay.com.kw")
    || host === "bede.kw"
    || host.endsWith(".bede.kw")
    || host === "bookeey.com"
    || host.endsWith(".bookeey.com");
}

function paymentPayload(paymentMethod = state.paymentMethod) {
  return {
    idempotencyKey: state.paymentRequestId,
    customer: { name: state.user.name.trim(), phone: normalizePhone(state.user.phone) },
    items: cartItems().map(({ product: item, quantity, note, options }) => ({ id: String(item.id), quantity, note, options })),
    delivery: { mode: state.mode, areaName: state.area?.name || "", branchId: state.branch || "", address: state.address || "" },
    paymentMethod,
    deliveryTime: {
      type: state.deliveryTiming,
      scheduledAt: state.deliveryTiming === "scheduled" ? scheduledDateTime()?.toISOString() || "" : ""
    }
  };
}

function pendingSnapshot(payment) {
  return {
    ...payment,
    checkout: {
      cart: state.cart, mode: state.mode, areaName: state.area?.name || "", branch: state.branch,
      addressId: state.addressId, address: state.address, name: state.user.name, phone: state.user.phone,
      lang: state.lang, paymentMethod: state.paymentMethod, deliveryTiming: state.deliveryTiming,
      scheduledDate: state.scheduledDate, scheduledHour: state.scheduledHour,
      scheduledMinute: state.scheduledMinute, scheduledPeriod: state.scheduledPeriod
    }
  };
}

function restorePending(pending) {
  const saved = pending.checkout || {};
  state.cart = saved.cart || state.cart;
  state.mode = saved.mode || state.mode;
  state.area = state.areas.find(area => area.name === saved.areaName) || state.area;
  state.branch = saved.branch || state.branch;
  state.addressId = saved.addressId || state.addressId;
  state.address = saved.address || state.address;
  state.name = saved.name || state.name;
  state.phone = saved.phone || state.phone;
  state.paymentMethod = saved.paymentMethod || "knet";
  state.deliveryTiming = saved.deliveryTiming === "scheduled"
    ? "scheduled"
    : saved.deliveryTiming === "notify" ? "notify" : "asap";
  state.scheduledDate = saved.scheduledDate || state.scheduledDate;
  state.scheduledHour = saved.scheduledHour || state.scheduledHour;
  state.scheduledMinute = saved.scheduledMinute || state.scheduledMinute;
  state.scheduledPeriod = saved.scheduledPeriod || state.scheduledPeriod;
  state.order = pending.orderId || "";
  if (saved.lang && saved.lang !== state.lang) setLanguage(saved.lang);
  persistCart();
  renderCartBar();
}

async function finishOrder() {
  if (!cartCount()) return paymentError(state.lang === "ar" ? "لا يمكن إنشاء طلب من سلة فارغة" : "Cannot create an order from an empty cart");
  if (!state.user?.name || normalizePhone(state.user.phone).length !== 8) return openAuth("login");
  const incompleteItem = cartItems().find(cartItemMissingRequiredChoice);
  if (incompleteItem) return resolveMissingCartChoice(incompleteItem);
  if (cartItems().some(cartItemMinimumIssue)) return paymentError(state.lang === "ar" ? "ارجو إكمال كمية المنتج المطلوبة" : "Please complete the required product quantity");
  if (!orderingConfig.paymentWebhookUrl || !orderingConfig.paymentStatusWebhookUrl) return paymentError(tr("paymentUnavailable"));
  if (!state.paymentMethod) return toast(tr("choosePaymentMethod"));
  clearProductRoute();
  if (state.detailProductId) closeProductPage(false);
  state.paymentRequestId = state.paymentRequestId || requestId();
  $("#steps").classList.add("hidden");
  $("#checkoutTitle").textContent = tr("redirecting");
  $("#checkoutBody").innerHTML = `<div class="loading-state"><div class="spinner"></div><h3>${tr("redirecting")}</h3><p>${tr("creatingSecureLink")}</p></div>`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(orderingConfig.paymentWebhookUrl, {
      method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(paymentPayload(state.paymentMethod)), signal: controller.signal, cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || tr("createFailed"));
    const target = new URL(data.paymentUrl);
    if (!isAllowedPaymentGatewayUrl(target)) throw new Error(tr("invalidSecureLink"));
    state.order = data.orderId || "";
    const pending = pendingSnapshot({
      orderId: state.order, paymentReference: data.paymentReference || data.orderId || "", statusToken: data.statusToken || "", paymentUrl: target.href,
      paymentMethod: state.paymentMethod, paymentGateway: data.paymentGateway || "", createdAt: Date.now()
    });
    sessionStorage.setItem("pendingBedeOrder", JSON.stringify(pending));
    window.location.assign(target.href);
  } catch (error) {
    paymentError(error.name === "AbortError" ? tr("createTimeout") : error.message);
  } finally {
    clearTimeout(timer);
  }
}

function showPaymentWaiting(pending) {
  $("#checkoutTitle").textContent = tr("checkingPayment");
  $("#checkoutBody").innerHTML = `<div class="loading-state"><div class="spinner"></div><h3>${tr("checkingResult")}</h3><p id="paymentStatusText">${tr("autoAccept")}</p><button class="secondary" id="reopenPayment" style="width:min(360px,100%);margin-top:18px">${tr("createNewPaymentLink")}</button></div>`;
  $("#reopenPayment").onclick = createFreshPaymentLink;
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function watchPayment(pending) {
  const version = ++paymentWatchVersion;
  const started = Date.now();
  let errors = 0;
  let firstCheck = true;
  while (version === paymentWatchVersion && Date.now() - started < 30 * 60 * 1000) {
    if (!firstCheck) await delay(5000);
    firstCheck = false;
    try {
      const response = await fetch(orderingConfig.paymentStatusWebhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ paymentReference: pending.paymentReference || pending.orderId, statusToken: pending.statusToken }), cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Verification failed");
      errors = 0;
      if (data.status === "paid") {
        if (data.orderId) {
          state.order = data.orderId;
          pending.orderId = data.orderId;
        }
        trackStoreEvent("checkout_complete", { orderId: pending.orderId });
        paymentWatchVersion++;
        sessionStorage.removeItem("pendingBedeOrder");
        history.replaceState({}, "", location.pathname);
        return showSuccess();
      }
      if (data.status === "failed") {
        paymentWatchVersion++;
        sessionStorage.removeItem("pendingBedeOrder");
        history.replaceState({}, "", location.pathname);
        return paymentDeclined();
      }
      if ($("#paymentStatusText")) $("#paymentStatusText").textContent = tr("stillPending");
    } catch {
      errors++;
      if (errors >= 3 && $("#paymentStatusText")) $("#paymentStatusText").textContent = tr("tempCheckError");
    }
  }
  if (version === paymentWatchVersion) paymentPendingTimeout(pending);
}

function paymentDeclined() {
  state.paymentRequestId = "";
  $("#checkoutTitle").textContent = tr("declinedTitle");
  $("#checkoutBody").innerHTML = `<div class="payment-error"><div class="error-mark">×</div><h3>${tr("declinedTitle")}</h3><p>${tr("declinedText")}</p><div class="actions"><button class="secondary" id="declinedBack">${tr("backToPayment")}</button><button class="primary" id="declinedRetry">${tr("retry")}</button></div></div>`;
  $("#declinedBack").onclick = $("#declinedRetry").onclick = () => { state.step = 4; $("#steps").classList.remove("hidden"); renderCheckout(); };
}

function paymentPendingTimeout(pending) {
  $("#checkoutTitle").textContent = tr("unconfirmed");
  $("#checkoutBody").innerHTML = `<div class="payment-error"><div class="error-mark">!</div><h3>${tr("unconfirmed")}</h3><p>${tr("unconfirmedText")}</p><div class="actions"><button class="secondary" id="pendingOpen">${tr("createNewPaymentLink")}</button><button class="primary" id="pendingCheck">${tr("checkAgain")}</button></div></div>`;
  $("#pendingOpen").onclick = createFreshPaymentLink;
  $("#pendingCheck").onclick = () => { showPaymentWaiting(pending); watchPayment(pending); };
}

function createFreshPaymentLink() {
  paymentWatchVersion++;
  sessionStorage.removeItem("pendingBedeOrder");
  state.paymentRequestId = "";
  $("#steps").classList.add("hidden");
  finishOrder();
}

function paymentError(message) {
  $("#steps").classList.remove("hidden");
  state.step = 4;
  setSteps();
  $("#checkoutTitle").textContent = tr("startFailed");
  $("#checkoutBody").innerHTML = `<div class="payment-error"><div class="error-mark">!</div><h3>${tr("linkNotCreated")}</h3><p>${escapeHtml(message || tr("createFailed"))}</p><div class="actions"><button class="secondary" id="paymentBack">${tr("back")}</button><button class="primary" id="paymentRetry">${tr("retry")}</button></div></div>`;
  $("#paymentBack").onclick = () => { state.step = 4; renderCheckout(); };
  $("#paymentRetry").onclick = finishOrder;
}

function paymentReturnResult() {
  const value = new URLSearchParams(location.search).get("payment");
  return value === "success" || value === "failed" ? value : "";
}

function readPendingPayment() {
  const raw = sessionStorage.getItem("pendingBedeOrder");
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    if (!(pending.paymentReference || pending.orderId) || !pending.statusToken || !pending.paymentUrl) throw new Error("Invalid payment state");
    return pending;
  } catch {
    sessionStorage.removeItem("pendingBedeOrder");
    return null;
  }
}

function showReturnedPaymentFailure(pending) {
  paymentWatchVersion++;
  pendingPaymentResumed = true;
  sessionStorage.removeItem("pendingBedeOrder");
  restorePending(pending);
  $("#checkoutModal").classList.remove("hidden");
  $("#steps").classList.add("hidden");
  history.replaceState({}, "", location.pathname);
  paymentDeclined();
}

function resumePendingPayment() {
  if (pendingPaymentResumed) return;
  pendingPaymentResumed = true;
  const pending = readPendingPayment();
  if (!pending) return;
  if (paymentReturnResult() !== "success") return showReturnedPaymentFailure(pending);
  restorePending(pending);
  $("#checkoutModal").classList.remove("hidden");
  $("#steps").classList.add("hidden");
  showPaymentWaiting(pending);
  watchPayment(pending);
}

function currentInvoiceModel() {
  const approvedAt = Date.now();
  const scheduled = state.deliveryTiming === "scheduled" ? scheduledDateTime() : null;
  const asapWindow = state.mode === "delivery" && state.deliveryTiming === "asap"
    ? asapDeliveryWindow(new Date(approvedAt))
    : null;
  return {
    orderId: state.order, catalogType: cartHasRestaurantItems() ? "restaurant" : "bakery", createdAt: approvedAt, customerName: state.user?.name || state.name,
    phone: state.user?.phone || state.phone, mode: state.mode, areaName: state.area?.name || "",
    address: state.address, branchId: state.branch,
    deliveryTiming: state.deliveryTiming,
    scheduledAt: scheduled?.getTime() || null,
    expectedStart: asapWindow?.start.getTime() || null,
    expectedEnd: asapWindow?.end.getTime() || null,
    items: cartItems().map(({ product: item, quantity, note, options }) => ({ id: String(item.id), nameAr: cartDisplayName(item, options, "ar"), nameEn: cartDisplayName(item, options, "en"), preparation: item.preparation || null, quantity, note, options, unitPrice: unitPrice(item, options), total: unitPrice(item, options) * quantity })),
    subtotal: subtotal(), deliveryFee: deliveryFee(), total: total(), paymentMethod: state.paymentMethod || "knet", status: "paid"
  };
}

function saveCompletedOrder(order) {
  if (!state.user) return;
  state.user.orders = state.user.orders || [];
  if (!state.user.orders.some(item => item.orderId === order.orderId)) state.user.orders.unshift(order);
  persistUser();
}

function showSuccess() {
  const order = currentInvoiceModel();
  state.lastInvoice = order;
  saveCompletedOrder(order);
  buildInvoice(order);
  // لا ننتظر الإرسال حتى لا تتأخر صفحة نجاح الطلب؛ الفاتورة نفسها تُولّد من قالب A4 الحالي.
  sendInvoiceToWhatsApp(order);
  state.cart = {};
  persistCart();
  renderCartBar();
  syncAllProductQuantityControls();
  $("#checkoutTitle").textContent = tr("received");
  $("#checkoutBody").innerHTML = `<div class="success"><div class="check">✓</div><h3>${tr("received")}</h3><p>${tr("orderNumber")}</p><strong class="order-no">${escapeHtml(state.order)}</strong><div class="success-delivery-time"><small>${order.mode === "pickup" ? tr("pickupStatus") : tr("expectedDeliveryTime")}</small><strong>${escapeHtml(deliveryTimeSummary(order))}</strong></div><div class="actions" style="width:min(420px,100%)"><button class="secondary" id="newOrder">${tr("backStore")}</button><button class="primary" id="orderDetailsButton">${tr("viewOrderDetails")}</button></div></div>`;
  $("#newOrder").onclick = () => {
    state.cart = {};
    persistCart();
    renderCartBar();
    syncAllProductQuantityControls();
    $("#checkoutModal").classList.add("hidden");
  };
  $("#orderDetailsButton").onclick = () => {
    $("#checkoutModal").classList.add("hidden");
    openAccountDrawer("orderDetails", { orderId: order.orderId, fromSuccess: true });
  };
}

function orderItemName(item) {
  return state.lang === "ar" ? (item.nameAr || item.nameEn) : (item.nameEn || item.nameAr);
}

function invoiceDeliveryTime(order) {
  if (!order.scheduledAt) return escapeHtml(deliveryTimeSummary(order));
  const end = new Date(order.scheduledAt), start = new Date(end.getTime() - 60 * 60 * 1000);
  const date = new Intl.DateTimeFormat("ar-KW", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(end);
  const time = value => new Intl.DateTimeFormat("ar-KW", { hour: "numeric", minute: "2-digit" }).format(value);
  return `وقت التوصيل المحدد:<br>${date}،<br>بين ${time(start)} إلى ${time(end)}`;
}

function buildInvoice(order) {
  const pickup = branches.find(branch => branch.id === order.branchId);
  const destination = order.mode === "delivery" ? `${order.areaName || ""} - ${order.address || ""}` : `${state.lang === "ar" ? "استلام من" : "Pickup from"} ${pickup ? branchField(pickup, "name") : ""}`;
  const locale = state.lang === "ar" ? "ar-KW" : "en-GB";
  const createdAt = new Date(order.createdAt);
  const customerLine = [order.customerName || tr("customer"), order.phone || "—", destination].filter(Boolean).map(escapeHtml).join("&nbsp; · &nbsp;");
  const deliveryTime = invoiceDeliveryTime(order);
  const productsValue = Number.isFinite(Number(order.subtotal)) ? Number(order.subtotal) : Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0));
  $("#invoice").innerHTML = `<section class="a4-invoice"><header class="a4-head"><img src="logo.png" alt=""><div><h1>فاتورة شراء</h1><p>Purchase Invoice</p></div></header><section class="a4-meta"><div><b>رقم الفاتورة</b><strong>#${escapeHtml(order.orderId)}</strong><b>تاريخ الإصدار</b><strong>${createdAt.toLocaleDateString(locale)}</strong></div><div class="a4-company">شركة صحي ولذيذ للتجهيزات الغذائية<br>حولي، شارع تونس، مجمع علي فهد الخالد، دور الميزانين<br><span dir="ltr">66906605 · 22085888</span></div></section><p class="a4-customer-line">${customerLine}</p><table class="a4-items"><thead><tr><th>#</th><th>الصنف</th><th>الملاحظات</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${order.items.map((item, index) => { const detailOptions = (item.options || []).filter(option => !option?.nameSuffix); return `<tr><td>${index + 1}</td><td><b>${escapeHtml(item.nameAr || item.nameEn || item.id)}</b><small dir="ltr">${escapeHtml(item.nameEn || item.nameAr || item.id)}</small>${detailOptions.length ? `<small>${escapeHtml(detailOptions.map(optionSummary).join("، "))}</small>` : ""}</td><td>${escapeHtml(item.note || "—")}</td><td>${item.quantity}</td><td>${money(item.unitPrice || (item.total / item.quantity))}</td><td><b>${money(item.total)}</b></td></tr>`; }).join("")}</tbody></table>${invoicePreparationNotice(order)}<section class="a4-summary-row"><section class="a4-delivery-time"><small>${order.mode === "pickup" ? tr("pickup") : tr("deliveryTime")}</small><strong>${order.mode === "pickup" ? destination : deliveryTime}</strong></section><section class="a4-total"><span><b>${tr("productsTotal")}</b><strong>${money(productsValue)}</strong></span><span><b>${tr("deliveryFee")}</b><strong>${money(order.deliveryFee)}</strong></span><span class="a4-grand-total"><b>${tr("total")}</b><strong>${money(order.total)}</strong></span></section></section><div class="a4-paid">✓&nbsp; مدفوع: ${escapeHtml(String(order.paymentMethod || "KNET").toUpperCase())}</div></section>`;
  $("#invoice").setAttribute("dir", state.lang === "ar" ? "rtl" : "ltr");
  const phoneLabel = $("#invoice .a4-phone");
  if (phoneLabel) phoneLabel.textContent = `☎︎ ${order.phone || "—"}`;
}

async function createInvoiceFile(order) {
    const cacheKey = `${order.orderId}:${order.paymentMethod || "knet"}:${order.updatedAt || order.paidAt || ""}:${state.lang}`;
    if (invoiceFileCache.has(cacheKey)) return invoiceFileCache.get(cacheKey);
    const promise = (async () => {
      buildInvoice(order);
      if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error("PDF libraries unavailable");
      await document.fonts?.ready;
    const invoiceNode = $("#invoice .a4-invoice");
    if (!invoiceNode) throw new Error("Invoice template unavailable");
    const logo = invoiceNode.querySelector("img");
    if (logo?.decode) await logo.decode().catch(() => undefined);
    const canvas = await html2canvas(invoiceNode, { scale: 2, backgroundColor: "#fff", useCORS: true, logging: false });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 190;
    const pageHeight = 277;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    const image = canvas.toDataURL("image/jpeg", .94);
    let remaining = imageHeight;
    let y = 10;
    pdf.addImage(image, "JPEG", 10, y, pageWidth, imageHeight, undefined, "FAST");
    remaining -= pageHeight;
    while (remaining > 0.5) {
      pdf.addPage();
      // The first page starts at 10mm. Subsequent pages start at the exact
      // next image position, otherwise the last 10mm is duplicated.
      y = -(imageHeight - remaining);
      pdf.addImage(image, "JPEG", 10, y, pageWidth, imageHeight, undefined, "FAST");
      remaining -= pageHeight;
    }
    const filename = `invoice-${order.orderId}.pdf`;
    const blob = pdf.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  })();
  invoiceFileCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    invoiceFileCache.delete(cacheKey);
    throw error;
  }
}

async function sendInvoiceToWhatsApp(order) {
  const endpoint = String(orderingConfig.invoiceWhatsappWebhookUrl || "").trim();
  if (!endpoint || !order?.orderId || !normalizePhone(order.phone)) return;
  try {
    const file = await createInvoiceFile(order);
    const pdfBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Could not read invoice PDF"));
      reader.readAsDataURL(file);
    });
    if (!pdfBase64) throw new Error("Invoice PDF is empty");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: String(order.orderId),
        phone: `965${normalizePhone(order.phone)}`,
        pdfBase64
      })
    });
    if (!response.ok) throw new Error(`Invoice WhatsApp webhook failed (${response.status})`);
  } catch (error) {
    // يبقى إتمام الطلب مستقلاً عن الإشعار؛ الفشل هنا لا يوقف دفع العميل أو حفظ طلبه.
    console.warn("Could not send invoice through WhatsApp workflow", error);
  }
}

function prepareInvoiceFile(order, button) {
  if (!button) return;
  button.disabled = true;
  button.textContent = tr("preparingInvoiceDownload");
  createInvoiceFile(order).then(() => {
    if (!button.isConnected) return;
    button.disabled = false;
    button.textContent = tr("downloadInvoice");
  }).catch(error => {
    console.error(error);
    if (!button.isConnected) return;
    button.disabled = false;
    button.textContent = tr("downloadInvoice");
  });
}

async function downloadPdf(order = state.lastInvoice || currentInvoiceModel()) {
  try {
    toast(tr("preparingInvoiceDownload"));
    const file = await createInvoiceFile(await canonicalOnlineOrder(order));
    if (isAppleMobileDevice() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  } catch (error) {
    console.error(error);
    toast(tr("invoiceFailed"));
  }
}

$("#languageToggle").onclick = () => setLanguage(state.lang === "ar" ? "en" : "ar");
const whatsappWidget = $("#whatsappWidget");
const whatsappToggle = $("#whatsappToggle");
if (matchMedia("(max-width: 760px)").matches) Object.assign(whatsappWidget.style, { position: "fixed", left: "auto", right: "0", insetInlineStart: "auto", insetInlineEnd: "0" });
function setWhatsAppMenu(open) {
  whatsappWidget.classList.toggle("open", open);
  whatsappToggle.setAttribute("aria-expanded", String(open));
  $("#whatsappMenu").setAttribute("aria-hidden", String(!open));
}
whatsappToggle.onclick = event => { event.stopPropagation(); setWhatsAppMenu(!whatsappWidget.classList.contains("open")); };
document.addEventListener("click", event => { if (!whatsappWidget.contains(event.target)) setWhatsAppMenu(false); });
document.addEventListener("keydown", event => { if (event.key === "Escape") setWhatsAppMenu(false); });
$("#searchToggle").onclick = event => {
  event.stopPropagation();
  toggleHeaderSearch();
};
$("#searchPopover").onclick = event => event.stopPropagation();
$("#searchInput").oninput = event => {
  state.search = event.target.value;
  renderSearchResults();
};
$("#searchResults").onclick = event => {
  const addButton = event.target.closest("[data-search-add]");
  if (addButton) {
    event.preventDefault();
    event.stopPropagation();
    requestAddToCart(addButton.dataset.searchAdd, addButton);
    return;
  }
  const result = event.target.closest("[data-search-product]");
  if (!result) return;
  const id = result.dataset.searchProduct;
  closeHeaderSearch();
  openProductPage(id);
};
document.addEventListener("pointerdown", event => {
  if (!$("#searchPopover").classList.contains("hidden") && !$("#headerSearch").contains(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    closeHeaderSearch();
  }
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#searchPopover").classList.contains("hidden")) closeHeaderSearch();
});
$("#accountButton").onclick = () => state.user?.name ? openAccountDrawer() : openAuth("login");
$("#authClose").onclick = closeAuth;
$("#authModal").onclick = event => { if (event.target === $("#authModal")) closeAuth(); };
$("#drawerClose").onclick = () => closeAccountDrawer(true);
$("#drawerBackdrop").onclick = () => closeAccountDrawer(true);
$("#categories").onclick = event => {
  const headingButton = event.target.closest("[data-heading-link]");
  if (headingButton) { const heading = (state.headings || []).find(item => item.id === headingButton.dataset.headingLink); const group = Array.isArray(heading?.subheadings) && heading.subheadings.length ? heading.subheadings[0] : { id: "", categoryIds: heading?.categoryIds || [] }; const category = group?.categoryIds?.[0]; state.activeHeadingId = headingButton.dataset.headingLink; state.activeSubheadingId = group?.id || ""; state.activeCategory = category || "all"; syncActiveNavigation(); if (category) scrollToCategory(category); return; }
  const button = event.target.closest("[data-category-link]");
  if (button) { state.activeCategory = button.dataset.categoryLink; syncActiveNavigation(); scrollToCategory(button.dataset.categoryLink); }
};
$("#headingNavigation").onclick = event => {
  const subheadingButton = event.target.closest("[data-subheading-nav]");
  if (subheadingButton) { const heading = currentHeading(); const group = heading?.subheadings?.find(item => item.id === subheadingButton.dataset.subheadingNav); const category = group?.categoryIds?.[0]; state.activeSubheadingId = subheadingButton.dataset.subheadingNav; state.activeCategory = category || "all"; updateHeadingNavigation(); if (category) scrollToCategory(category); return; }
  const categoryButton = event.target.closest("[data-linked-nav]");
  if (categoryButton) { state.activeCategory = categoryButton.dataset.linkedNav; syncActiveNavigation(); scrollToCategory(categoryButton.dataset.linkedNav); }
};
$("#catalogSwitch").onclick = event => setCatalogType(event.currentTarget.dataset.catalogTarget);
$("#productFilterToggle").onclick = event => {
  event.stopPropagation();
  const menu = $("#productFilterMenu"), open = menu.classList.toggle("hidden");
  $("#productFilterToggle").setAttribute("aria-expanded", String(!open));
};
$("#productFilterMenu").onclick = event => {
  const button = event.target.closest("[data-product-filter]"); if (!button) return;
  state.activeProductFilterId = button.dataset.productFilter;
  state.activeCategory = "all"; state.activeHeadingId = ""; state.activeSubheadingId = "";
  $("#productFilterMenu").classList.add("hidden"); $("#productFilterToggle").setAttribute("aria-expanded", "false");
  renderProductFilters(); renderCategories(); renderProductSections(); window.scrollTo({ top: 0, behavior: "smooth" });
};
$("#productFilterClear").onclick = () => {
  state.activeProductFilterId = ""; state.activeCategory = "all"; state.activeHeadingId = ""; state.activeSubheadingId = "";
  renderProductFilters(); renderCategories(); renderProductSections();
};
document.addEventListener("pointerdown", event => { const wrap = $("#catalogFilterWrap"); if (wrap && !wrap.contains(event.target)) { $("#productFilterMenu").classList.add("hidden"); $("#productFilterToggle").setAttribute("aria-expanded", "false"); } });
function handleProductQuantityEvent(event) {
  const notify = event.target.closest("[data-availability-notify]");
  const add = event.target.closest("[data-product-add]");
  const plus = event.target.closest("[data-product-plus]");
  const minus = event.target.closest("[data-product-minus]");
  const control = notify || add || plus || minus;
  if (!control) return false;
  event.preventDefault();
  event.stopPropagation();
  if (notify) requestAvailabilityNotification(notify.dataset.availabilityNotify);
  if (add) requestAddToCart(add.dataset.productAdd, add);
  if (plus) changeQuantity(plus.dataset.productPlus, 1);
  if (minus) changeQuantity(minus.dataset.productMinus, -1);
  return true;
}

async function requestAvailabilityNotification(id) {
  const item = product(id);
  if (!item || item.availability?.status === "available") return;
  if (!state.user?.name || !state.user?.phone) { toast("سجّل دخولك أولاً ليصلك التنبيه", "error"); return openAuth("login"); }
  const identity = await firebaseIdentityReady;
  if (!identity || !firebaseServices) return toast("تعذر حفظ طلب التنبيه", "error");
  try {
    await firebaseServices.database.ref(`orderingPlatform/availabilityNotifications/${id}/${identity.uid}`).set({
      name: String(state.user.name).slice(0, 80), phone: normalizePhone(state.user.phone).slice(-8),
      cycleId: String(item.availability?.cycleId || ""), createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    showAvailabilityConfirmation(item);
  } catch (error) { console.error(error); toast("تعذر تسجيل طلب التنبيه", "error"); }
}

function showAvailabilityConfirmation(item) {
  const modal = document.createElement("section");
  modal.className = "availability-confirmation modal";
  modal.innerHTML = `<div class="availability-confirmation-card"><div class="check">✓</div><h2>سيتم إبلاغك عند توفر المنتج مباشرة...</h2><img src="${escapeHtml(productImages(item)[0] || "logo.png")}" alt=""><strong>${escapeHtml(productName(item))}</strong><button class="primary">حسناً</button></div>`;
  modal.querySelector("button").onclick = () => modal.remove();
  document.body.append(modal);
}

function openCategoryImageViewer(source, alt = "") {
  const viewer = document.createElement("section");
  viewer.className = "category-image-viewer";
  viewer.innerHTML = `<div class="category-image-viewer-card" role="dialog" aria-modal="true" aria-label="الصورة التوضيحية"><button type="button" class="category-image-close" aria-label="إغلاق">×</button><div class="category-image-stage"><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" draggable="false"></div><div class="category-image-tools"><button type="button" data-category-zoom="out" aria-label="تصغير">−</button><button type="button" data-category-zoom="reset">100%</button><button type="button" data-category-zoom="in" aria-label="تكبير">＋</button><small>اسحب الصورة للتنقل</small></div></div>`;
  const stage = $(".category-image-stage", viewer);
  const image = $("img", stage);
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  const apply = () => {
    image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    image.style.cursor = scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in";
  };
  const setScale = value => {
    scale = Math.max(1, Math.min(4, value));
    if (scale === 1) { offsetX = 0; offsetY = 0; }
    apply();
  };
  const close = () => viewer.remove();
  $(".category-image-close", viewer).onclick = close;
  viewer.addEventListener("click", event => { if (event.target === viewer) close(); });
  $(".category-image-tools", viewer).onclick = event => {
    const action = event.target.closest("[data-category-zoom]")?.dataset.categoryZoom;
    if (!action) return;
    if (action === "in") setScale(scale + .35);
    else if (action === "out") setScale(scale - .35);
    else setScale(1);
  };
  stage.addEventListener("wheel", event => { event.preventDefault(); setScale(scale + (event.deltaY < 0 ? .22 : -.22)); }, { passive: false });
  stage.addEventListener("pointerdown", event => {
    if (scale === 1) { setScale(1.7); return; }
    dragging = true;
    startX = event.clientX - offsetX;
    startY = event.clientY - offsetY;
    stage.setPointerCapture(event.pointerId);
    apply();
  });
  stage.addEventListener("pointermove", event => {
    if (!dragging) return;
    offsetX = event.clientX - startX;
    offsetY = event.clientY - startY;
    apply();
  });
  const stopDragging = () => { dragging = false; apply(); };
  stage.addEventListener("pointerup", stopDragging);
  stage.addEventListener("pointercancel", stopDragging);
  document.body.append(viewer);
  apply();
}
$("#productSections").onclick = event => {
  if (handleProductQuantityEvent(event)) return;
  const illustration = event.target.closest("[data-category-illustration]");
  if (illustration) return openCategoryImageViewer(illustration.dataset.categoryIllustration, illustration.querySelector("img")?.alt || "");
  const card = event.target.closest("[data-product]");
  if (card) openProductPage(card.dataset.product);
};
$("#productSections").onkeydown = event => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest("[data-product]");
  if (card) { event.preventDefault(); openProductPage(card.dataset.product); }
};
$("#productDetail").onclick = event => {
  if (handleProductQuantityEvent(event)) return;
  const imageButton = event.target.closest("[data-detail-image]");
  if (imageButton) {
    $("#detailMainImage").src = imageButton.dataset.detailImage;
    $$(".product-thumbs button").forEach(button => button.classList.toggle("active", button === imageButton));
  }
};
$("#productBack").onclick = () => closeProductPage();
const closeProductOptionsButton = $("#closeProductOptions");
const confirmProductOptionsButton = $("#confirmProductOptions");
const productOptionsModal = $("#productOptionsModal");
if (closeProductOptionsButton) closeProductOptionsButton.onclick = closeProductOptions;
if (confirmProductOptionsButton) confirmProductOptionsButton.onclick = confirmProductOptions;
if (productOptionsModal) productOptionsModal.onclick = event => { if (event.target === productOptionsModal) closeProductOptions(); };
window.addEventListener("resize", () => { productOptionsPopover?.place?.(); syncHeadingNavigationOffset(); });
$("#checkoutBtn").onclick = openCheckout;
$("#cartSummary").onclick = openCheckout;
$("#headerCart").onclick = openCheckout;
$("#closeCheckout").onclick = () => $("#checkoutModal").classList.add("hidden");
$("#checkoutBody").onclick = event => {
  const plus = event.target.closest("[data-plus]");
  const minus = event.target.closest("[data-minus]");
  if (plus) changeQuantity(plus.dataset.plus, 1);
  if (minus) changeQuantity(minus.dataset.minus, -1);
};
window.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(updateCategoryFromScroll);
}, { passive: true });
window.addEventListener("scrollend", () => {
  if (!pendingScrollCategoryId) return;
  pendingScrollCategoryId = "";
  pendingScrollUntil = 0;
  updateCategoryFromScroll();
}, { passive: true });
window.addEventListener("hashchange", syncProductRoute);
window.addEventListener("popstate", syncProductRoute);
document.addEventListener("gesturestart", event => event.preventDefault(), { passive: false });

const overlayStateObserver = new MutationObserver(syncPageScrollLock);
["#productPage", "#productOptionsModal", "#checkoutModal", "#accountDrawer", "#authModal", "#searchPopover"].forEach(selector => {
  const element = $(selector);
  if (element) overlayStateObserver.observe(element, { attributes: true, attributeFilter: ["class"] });
});
syncPageScrollLock();
document.addEventListener("gesturechange", event => event.preventDefault(), { passive: false });
document.addEventListener("gestureend", event => event.preventDefault(), { passive: false });
document.addEventListener("touchmove", event => { if (event.touches.length > 1) event.preventDefault(); }, { passive: false });
window.addEventListener("pageshow", () => {
  if (paymentReturnResult() === "success") return;
  const pending = readPendingPayment();
  if (pending) showReturnedPaymentFailure(pending);
});

reportVisitorPresence();
setInterval(reportVisitorPresence, 30000);

applyLanguage();
if (state.user) {
  state.name = state.user.name;
  state.phone = state.user.phone;
}

function applyCatalog(catalog, cache = true) {
  if (!Array.isArray(catalog?.products) || !Array.isArray(catalog?.categories) || !Array.isArray(catalog?.deliveryAreas)) return false;
  const signature = JSON.stringify([
    catalog.version || "", catalog.updatedAt || "",
    catalog.restaurantEnabled !== false,
    catalog.appearance || {}, catalog.advertisement || {},
    catalog.headings || [], catalog.productFilters || [],
    catalog.categories.map(category => [category.id, category.catalogType || "bakery", category.active !== false, category.order, category.nameAr, category.nameEn]),
    catalog.products.map(item => [item.id, item.catalogType || "bakery", item.active !== false, item.availability || null, item.inventory || null, item.originalPrice || 0, item.category, item.order, item.price, item.name, item.nameEn, item.image, item.options || null, item.preparation || null]),
    catalog.deliveryAreas.map(area => [area.id, area.nameAr || area.name, area.nameEn, area.price, area.order])
  ]);
  if (signature === catalogSignature) return true;
  catalogSignature = signature;
  const visibleCategories = catalog.categories.filter(category => category.active !== false);
  const visibleCategoryIds = new Set(visibleCategories.map(category => String(category.id)));
  const visibleProducts = catalog.products.filter(item =>
    item.active !== false && visibleCategoryIds.has(String(item.category || ""))
  );
  state.categories = visibleCategories;
  state.restaurantEnabled = catalog.restaurantEnabled !== false;
  if (!state.restaurantEnabled && state.catalogType === "restaurant") state.catalogType = "bakery";
  renderCatalogSwitch();
  state.headings = Array.isArray(catalog.headings) ? catalog.headings : [];
  state.productFilters = Array.isArray(catalog.productFilters) ? catalog.productFilters.map((filter, index) => ({ id: String(filter.id || `filter-${index}`), nameAr: String(filter.nameAr || filter.name || ""), nameEn: String(filter.nameEn || filter.nameAr || filter.name || ""), products: (Array.isArray(filter.products) ? filter.products : []).map(entry => ({ productId: String(entry?.productId || entry?.id || entry || ""), firstStepId: String(entry?.firstStepId || ""), optionIds: Array.isArray(entry?.optionIds) ? entry.optionIds.map(String) : [], steps: (Array.isArray(entry?.steps) ? entry.steps : []).map(step => ({ stepId: String(step?.stepId || step?.id || ""), optionIds: Array.isArray(step?.optionIds) ? step.optionIds.map(String) : [] })).filter(step => step.stepId) })) })) : [];
  if (!state.productFilters.some(filter => filter.id === state.activeProductFilterId)) state.activeProductFilterId = "";
  state.products = applyRestaurantProductImages(visibleProducts);
  state.areas = Array.isArray(catalog?.deliveryAreas) ? catalog.deliveryAreas : [];
  if (state.area) {
    const currentAreaName = state.area.name || state.area.nameAr;
    state.area = state.areas.find(area => (area.name || area.nameAr) === currentAreaName) || null;
  }
  applyStoreAppearance(catalog.appearance);
  renderProductFilters();
  state.advertisement = normalizeAdvertisement(catalog.advertisement);
  const visibleProductIds = new Set(visibleProducts.map(item => String(item.id)));
  let removedCartItem = false;
  Object.keys(state.cart).forEach(id => {
    if (visibleProductIds.has(String(id))) return;
    delete state.cart[id];
    removedCartItem = true;
  });
  if (removedCartItem) persistCart();
  if (state.activeCategory !== "all" && !visibleCategoryIds.has(String(state.activeCategory))) state.activeCategory = "all";
  if (!(state.headings || []).some(item => item.id === state.activeHeadingId && catalogTypeOf(item) === state.catalogType)) {
    state.activeHeadingId = "";
    state.activeSubheadingId = "";
  }
  if (cache) {
    try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog)); } catch { /* يتوفر products.json كنسخة احتياطية */ }
  }
  renderCategories();
  renderProductSections();
  renderCartBar();
  syncProductRoute();
  setTimeout(() => showAdvertisement(state.advertisement), 250);
  return true;
}

async function loadLocalCatalog() {
  const [products, categories, deliveryAreas, imageMap] = await Promise.all([
    fetch("products.json", { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error("products.json");
      return response.json();
    }),
    fetch("categories.json", { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error("categories.json");
      return response.json();
    }),
    fetch("delivery-areas.json", { cache: "force-cache" }).then(response => {
      if (!response.ok) throw new Error("delivery-areas.json");
      return response.json();
    }),
    fetch("restaurant-product-images.json", { cache: "force-cache" }).then(response => response.ok ? response.json() : {})
  ]);
  restaurantProductImages = imageMap || {};
  return { products, categories, deliveryAreas };
}

async function initializeStoreData() {
  // Do not restore the previously viewed catalogue after a refresh. Cart data
  // lives in its own local-storage key and is intentionally left unchanged.
  resetCatalogToBakery();
  const cachedCatalog = readJson(CATALOG_CACHE_KEY, null);
  let hasCatalog = applyCatalog(cachedCatalog, false);
  if (!hasCatalog) {
    const localCatalog = await loadLocalCatalog();
    hasCatalog = applyCatalog(localCatalog);
  }
  if (hasCatalog) resumePendingPayment();
  if (state.user?.phone) {
    rememberSession(state.user.phone);
    requestPersistentStorage();
    hydrateUserFromFirebase();
  } else {
    await restoreSavedCustomerSession();
  }
  trackStoreEvent("visit");
  if (firebaseServices) {
    const catalogRef = firebaseServices.database.ref("orderingPlatform/catalog");
    catalogRef.on("value", liveSnapshot => {
      if (!liveSnapshot.exists()) return;
      applyCatalog(liveSnapshot.val());
    }, error => console.error("Firebase catalog listener failed", error));
  }
}

initializeStoreData().catch(error => {
  console.error(error);
  $("#productSections").innerHTML = `<div class="loading">${tr("loadingError")}</div>`;
});

function hideAdvertisement() {
  const modal = $("#advertisementModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

window.closeAdvertisement = event => { event?.preventDefault(); event?.stopPropagation(); hideAdvertisement(); };
window.openAdvertisementTarget = event => {
  event?.preventDefault(); event?.stopPropagation();
  const target = $("#advertisementTarget");
  const href = target?.getAttribute("href") || "";
  hideAdvertisement();
  if (href.startsWith("#product=")) { history.pushState(null, "", href); syncProductRoute(); }
  else if (/^https?:\/\//i.test(href)) window.location.assign(href);
  return false;
};

// نستخدم pointerup و click في وضع الالتقاط حتى تستجيب النافذة على الهاتف
// حتى مع منع تمرير الصفحة خلف الإعلان.
document.addEventListener("pointerup", event => {
  const close = event.target.closest("#closeAdvertisement");
  if (close) { window.closeAdvertisement(event); return; }
  const target = event.target.closest("#advertisementTarget");
  if (!target) return;
  event.preventDefault(); event.stopPropagation();
  window.openAdvertisementTarget(event);
}, true);
document.addEventListener("click", event => {
  if (event.target === $("#advertisementModal")) hideAdvertisement();
}, true);
