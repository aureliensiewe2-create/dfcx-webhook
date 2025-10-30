// server.js — propre, ESM

import express from "express";

const app = express();
app.use(express.json());

// Santé
app.get("/", (req, res) => res.send("OK"));

// ---------- 1) Données simulées ----------
const KNOWN_ORDERS = {
  "12345": { status: { en: "confirmed", fr: "confirmée" }, etaDays: 2, carrier: "DHL" },
  "54321": { status: { en: "shipped",   fr: "expédiée"  }, etaDays: 3, carrier: "UPS"  },
  "98765": { status: { en: "delivered", fr: "livrée"    }, etaDays: 0, carrier: "Chronopost" },
  "11223": { status: { en: "processing",fr: "en préparation" }, etaDays: 1, carrier: "La Poste" }
};

const CATALOG = [
  { name: "Nike Air Sneakers", color: "blue",  price: 80, category: "shoes",   size: "42", brand: "Nike"   },
  { name: "Black T-shirt",     color: "black", price: 25, category: "t-shirt", size: "M",  brand: "Adidas" },
  { name: "Red Dress",         color: "red",   price: 60, category: "dress",   size: "M",  brand: "Zara"   },
  { name: "Jean Slim",         color: "blue",  price: 45, category: "jean",    size: "32", brand: "Levi's" }
];

// Helper langue
function i18n(lang) {
  const isFr = String(lang || "en").toLowerCase().startsWith("fr");
  return (enTxt, frTxt) => (isFr ? frTxt : enTxt);
}

// ---------- 2) Webhook principal DFCX ----------
app.post("/df-webhook", (req, res) => {
// 🔎 Détection automatique de la langue (robuste)
const lang =
  (req.body?.sessionInfo?.languageCode) ||   // Dialogflow CX (classique)
  (req.body?.languageCode) ||                // Conversational Agents (top-level)
  (req.headers?.["x-goog-dialogflow-language-code"]) || // Fallback header
  "en";

console.log("LANG sources:", {
  sessionInfo: req.body?.sessionInfo?.languageCode,
  topLevel: req.body?.languageCode,
  header: req.headers?.["x-goog-dialogflow-language-code"],
});

const t = i18n(lang);

const tag = req.body?.fulfillmentInfo?.tag ?? "";
const params = req.body?.sessionInfo?.parameters || {};


  // --- A) Suivi de commande ---
  if (tag === "track-order") {
    const orderNumber = String(params.ordernumber ?? params.orderNumber ?? "").trim();

    // 1) Valide 5 chiffres
    if (!/^\d{5}$/.test(orderNumber)) {
      const ask = t(
        "Please provide your 5-digit order number to check the delivery status.",
        "Merci d’indiquer votre numéro de commande (5 chiffres) pour vérifier le statut."
      );
      return res.json({ fulfillment_response: { messages: [{ text: { text: [ask] } }] } });
    }

    // 2) Récupère l’info
    const info = KNOWN_ORDERS[orderNumber];
    if (!info) {
      const notFound = t(
        `I couldn't find order ${orderNumber}. Please check the number.`,
        `Je n’ai pas trouvé la commande ${orderNumber}. Merci de vérifier le numéro.`
      );
      return res.json({ fulfillment_response: { messages: [{ text: { text: [notFound] } }] } });
    }

    // 3) Compose la réponse
    const msg = t(
      `Order ${orderNumber} is ${info.status.en}. Estimated delivery: ${info.etaDays} day(s) via ${info.carrier}.`,
      `La commande ${orderNumber} est ${info.status.fr}. Livraison estimée : ${info.etaDays} jour(s) via ${info.carrier}.`
    );

    return res.json({
      fulfillment_response: { messages: [{ text: { text: [msg] } }] },
      session_info: { parameters: { lastOrderStatus: info.status.en } }
    });
  }

// --- B) Recherche de produits ---
if (tag === "search-products") {
  let color = params.color?.toString()?.toLowerCase() ?? "";
  let category = params.category?.toString()?.toLowerCase() ?? "";
  const size = params.size?.toString()?.toLowerCase() ?? "";
  const brand = params.brand?.toString()?.toLowerCase() ?? "";
  const priceMax = Number(params.price_max) || undefined;


 const normalize = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Traduction rapide FR → EN pour les couleurs et catégories
const frToEn = {
  // Couleurs
  "rouge": "red",
  "bleu": "blue",
  "noir": "black",
  "blanc": "white",
  "vert": "green",
  "jaune": "yellow",
  "gris": "gray",
  "rose": "pink",
  // Catégories
  "robe": "dress",
  "tshirt": "t-shirt",
  "chemise": "shirt",
  "jean": "jean",
  "chaussure": "shoes"
};

// Si la langue détectée est FR, on traduit les paramètres avant la recherche
if (lang.startsWith("fr")) {
  if (frToEn[color]) color = frToEn[color];
  if (frToEn[category]) category = frToEn[category];
}
const result = CATALOG.filter(item => {
  const okColor = !color || normalize(item.color).includes(normalize(color));
  const okCat = !category || normalize(item.category).includes(normalize(category));
  const okSize = !size || normalize(item.size) === normalize(size);
  const okBrand = !brand || normalize(item.brand).includes(normalize(brand));
  const okPrice = priceMax === undefined || item.price <= priceMax;
  return okColor && okCat && okSize && okBrand && okPrice;
});


    let message;
    if (result.length > 0) {
      message = t(
        `Here are some ${color || ""} ${category || "products"} I found: ${result.map(p => p.name).join(", ")}.`,
        `Voici quelques ${category || "articles"} ${color || ""} que j’ai trouvés : ${result.map(p => p.name).join(", ")}.`
      );
    } else {
      message = t(
        "Sorry, I couldn't find any matching products.",
        "Désolé, je n’ai trouvé aucun produit correspondant."
      );
    }

    return res.json({ fulfillment_response: { messages: [{ text: { text: [message] } }] } });
  }

  // --- C) Tag inconnu (fallback)
  const sorry = t("Sorry, I didn't understand.", "Désolé, je n’ai pas compris.");
  return res.json({ fulfillment_response: { messages: [{ text: { text: [sorry] } }] } });
});

// ---------- 3) Démarrage serveur ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on", PORT));

