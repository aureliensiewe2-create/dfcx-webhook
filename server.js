import express from "express";
const app = express();
app.use(express.json());

// Petit endpoint de test
app.get("/", (req, res) => res.send("OK"));

// Base de données simulée
const KNOWN = {
  "12345": { status: { en: "confirmed", fr: "confirmée" }, etaDays: 2, carrier: "DHL" },
  "54321": { status: { en: "shipped", fr: "expédiée" }, etaDays: 3, carrier: "UPS" },
};

// Webhook principal
app.post("/df-webhook", (req, res) => {
  const tag = req.body?.fulfillmentInfo?.tag ?? "";
  const lang = (req.body?.sessionInfo?.languageCode || "en").toLowerCase();
  const t = (enTxt, frTxt) => (lang.startsWith("fr") ? frTxt : enTxt);

  if (tag === "track-order") {
    const p = req.body?.sessionInfo?.parameters || {};
    const orderNumber = String(p.ordernumber ?? p.orderNumber ?? "").trim();

    // 1️⃣ Si aucun numéro n’est donné ou invalide
    if (!/^\d{5}$/.test(orderNumber)) {
      const ask = t(
        "Please provide your 5-digit order number to check the delivery status.",
        "Merci d’indiquer votre numéro de commande (5 chiffres) pour vérifier le statut."
      );
      return res.json({
        fulfillment_response: { messages: [{ text: { text: [ask] } }] },
      });
    }

    // 2️⃣ Si le numéro n’existe pas dans la base
    const info = KNOWN[orderNumber];
    if (!info) {
      const notFound = t(
        `I couldn't find order ${orderNumber}. Please check the number.`,
        `Je n’ai pas trouvé la commande ${orderNumber}. Merci de vérifier le numéro.`
      );
      return res.json({
        fulfillment_response: { messages: [{ text: { text: [notFound] } }] },
      });
    }

    // 3️⃣ Si tout est bon → renvoie le statut
    const msg = t(
      `Order ${orderNumber} is ${info.status.en}. Estimated delivery: ${info.etaDays} day(s) via ${info.carrier}.`,
      `La commande ${orderNumber} est ${info.status.fr}. Livraison estimée : ${info.etaDays} jour(s) via ${info.carrier}.`
    );
    return res.json({
      fulfillment_response: { messages: [{ text: { text: [msg] } }] },
      session_info: {
        parameters: { lastOrderStatus: info.status.en },
      },
    });
  }

  // Réponse par défaut
  return res.json({
    fulfillment_response: {
      messages: [{ text: { text: [t("Sorry, I didn’t understand.", "Désolé, je n’ai pas compris.")] } }],
    },
  });
});

// Démarrage serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on " + PORT));

