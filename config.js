window.ORDERING_CONFIG = Object.freeze({
  // بوابة الدفع تعمل عبر Firebase Cloud Functions؛ لا توجد مفاتيح دفع في المتصفح.
  paymentWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/createBedePayment",
  paymentStatusWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/checkBedePayment",
  analyticsWebhookUrl: "https://us-central1-menassafigs.cloudfunctions.net/trackStoreEvent",
  sendLoginCodeWebhookUrl: "https://yards-bottles-choice-terminology.trycloudflare.com/webhook/store/send-login-code",
  verifyLoginCodeWebhookUrl: "https://yards-bottles-choice-terminology.trycloudflare.com/webhook/store/verify-login-code"
});
