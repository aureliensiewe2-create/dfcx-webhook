import express from "express";
const app = express();
app.use(express.json());

const KNOWN = {
  "12345": { status: { en: "confirmed", fr: "confirmée" }, etaDays: 2, carrier: "DHL" },
  "54321": { status: { en: "shipped",   fr: "expédiée"  }, etaDays: 3, carrier: "UPS" }
};

app.post("/df-webhook", (req, res) => {
  const tag  = req.body?.fulfillmentInfo?.tag || "";
  const lang = (req.body?.sessionInfo?.languageCode || "en").toLowerCase();
  const p    = req.body?.sessionInfo?.parameters || {};
  const orderNumber = String(p.orderNumber ?? p.ordernumber ?? "").trim();

  const t = (en, fr) => (lang.startsWith("fr") ? fr : en);

  if (tag === "track-order") {
    const info = KNOWN[orderNumber] || { status: { en: "processing", fr: "en cours" }, etaDays: 5, carrier: "FedEx" };
    const msg = t(
      `Order ${orderNumber} is ${info.status.en}. Estimated delivery: ${info.etaDays} day(s) via ${info.carrier}.`,
      `La commande ${orderNumber} est ${info.status.fr}. Livraison estimée : ${info.etaDays} jour(s) via ${info.carrier}.`
    );
    return res.json({
      fulfillment_response: { messages: [{ text: { text: [msg] } }] },
      session_info: { parameters: { lastOrderStatus: info.status.en } }
    });
  }

  return res.json({
    fulfillment_response: { messages: [{ text: { text: [t("Sorry, I didn’t understand.", "Désolé, je n’ai pas compris.")] } }] }
  });
});

app.get("/", (_, res) => res.send("OK"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on " + PORT));

