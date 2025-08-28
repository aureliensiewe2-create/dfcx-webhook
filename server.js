const params = req.body?.sessionInfo?.parameters || {};

// ✅ accepte plusieurs noms possibles
const orderNumberRaw =
  params.orderNumber ??
  params.ordernumber ??
  params.number ??
  params.OrderNumber ??
  "";

const orderNumber = orderNumberRaw.toString().trim();

// (optionnel mais très utile pour debug Render)
console.log("Webhook params:", JSON.stringify(params));
console.log("Resolved orderNumber:", orderNumber);

