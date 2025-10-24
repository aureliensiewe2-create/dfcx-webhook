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
const lang =
  (req.body?.languageCode ||
   req.body?.queryResult?.languageCode ||
   req.headers["x-goog-dialogflow-language-code"] ||
   req.body?.sessionInfo?.languageCode ||
   "en"
  ).toLowerCase();
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
// --- Recherche de produits ---
app.post("/search-products", async (req, res) => {
  const params = req.body.sessionInfo?.parameters || {};
  const lang = (req.body.sessionInfo?.languageCode || "en").toLowerCase();
  const t = (enTxt, frTxt) => (lang.startsWith("fr") ? frTxt : enTxt);

  const { color, price_max, category, size, brand } = params;

  // Base de données simulée
  const products = [
    { name: "Nike Air Sneakers", color: "blue", price: 80, category: "shoes", size: "42", brand: "Nike" },
    { name: "Black T-Shirt", color: "black", price: 25, category: "t-shirt", size: "M", brand: "Adidas" },
    { name: "Red Dress", color: "red", price: 60, category: "dress", size: "S", brand: "Zara" },
    { name: "Jeans Slim", color: "blue", price: 45, category: "jean", size: "32", brand: "Levis" },
  ];
// --- Filtrage simple avec vérification robuste ---
const result = products.filter(p => {
  const matchColor =
    !color || (p.color && p.color.toLowerCase() === color.toLowerCase());
  const matchCategory =
    !category || (p.category && p.category.toLowerCase() === category.toLowerCase());
  const matchBrand =
    !brand || (p.brand && p.brand.toLowerCase().includes(brand.toLowerCase()));
  const matchPrice =
    !price_max || (p.price && p.price <= Number(price_max));

  return matchColor && matchCategory && matchBrand && matchPrice;
});

let message;
if (result.length > 0) {
  message = t(
    `Here are some ${color || ""} ${category || "products"} I found: ${result.map(p => p.name).join(", ")}.`,
    `Voici quelques ${category || "articles"} ${color || ""} que j'ai trouvés : ${result.map(p => p.name).join(", ")}.`
  );
} else {
  message = t(
    "Sorry, I couldn't find any matching products.",
    "Désolé, je n’ai trouvé aucun produit correspondant."
  );
}

return res.json({
  fulfillment_response: {
    messages: [{ text: { text: [message] } }]
  }
});


app.listen(PORT, () => console.log("Webhook listening on " + PORT));

