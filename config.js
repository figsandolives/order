window.ORDERING_CONFIG = Object.freeze({
  // بوابة الدفع تعمل عبر Firebase Cloud Functions؛ لا توجد مفاتيح دفع في المتصفح.
  paymentWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/createBedePayment",
  paymentStatusWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/checkBedePayment",
  analyticsWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/trackStoreEvent",
  visitorPresenceWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/reportVisitorPresence",
  // تسجيل الدخول يعمل عبر Firebase Functions؛ لا يعتمد على n8n أو نفق محلي.
  sendLoginCodeWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/sendLoginCode",
  verifyLoginCodeWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/verifyLoginCode"
});
