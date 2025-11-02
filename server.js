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
  { name: "red dress",         color: "red",   price: 60, category: "dress",   size: "M",  brand: "Zara"   },
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

// Normalisation : minuscules, sans accents, et on enlève la ponctuation/espaces
const normalize = s =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // retire les accents
    .replace(/[^a-z0-9]/g, "");                        // retire tout sauf a-z0-9

// Dictionnaire FR -> EN pour couleurs & catégories
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
  "tee-shirt": "t-shirt",
  "tee shirt": "t-shirt",
  "chemise": "shirt",
  "jean": "jean",
  "jeans": "jean",
  "pantalon": "jean",
  "pantalons": "jean",
  "chaussure": "shoes",
  "chaussures": "shoes"
}; // <<< ✅ très important : PAS de virgule avant cette accolade
// Trouve une traduction en cherchant un mot-clé FR contenu dans la valeur
const translateLoose = (value, map) => {
  const v = normalize(value);
  for (const [fr, en] of Object.entries(map)) {
    if (v.includes(normalize(fr))) return en;
  }
  return value; // si rien trouvé, on garde tel quel
};
  // --- B) Recherche de produits ---
if (tag === "search-products" || tag === "Find_product") {
 // Récupération robuste des paramètres (essaie plusieurs noms possibles)
const p = req.body?.sessionInfo?.parameters || {};
let color    = (p.color ?? p.couleur ?? p.couleur_name ?? p.colour ?? "").toString();
let category = (p.category ?? p.categorie ?? p.product ?? p.type ?? p.item ?? "").toString();
let size     = (p.size ?? p.taille ?? "").toString();
let brand    = (p.brand ?? p.marque ?? "").toString();
const priceMax = Number(p.price_max ?? p.max_price ?? p.price ?? undefined) || undefined;

// normalisation en minuscules (on laisse la fonction normalize gérer les accents/espace)
color    = color.toLowerCase();
category = category.toLowerCase();
size     = size.toLowerCase();
brand    = brand.toLowerCase();
  
  console.log("PARAMS RAW:", JSON.stringify(p));

// Si la langue détectée est FR, on traduit les paramètres (souple)
  if (lang.startsWith("fr")) {
    if (color)    color    = translateLoose(color, frToEn);
    if (category) category = translateLoose(category, frToEn);
  }
  console.log("DEBUG", { color, category });

const result = CATALOG.filter(item => {
    const okColor = !color || normalize(item.color).includes(normalize(color));
    const okCat   = !category || normalize(item.category).includes(normalize(category));
    const okSize  = !size || normalize(String(item.size)) === normalize(size);
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

  return res.json({
    fulfillment_response: { messages: [{ text: { text: [message] } }] }
  });
}

  const sorry = t("Sorry, I didn't understand.", "Désolé, je n’ai pas compris.");
  return res.json({ fulfillment_response: { messages: [{ text: { text: [sorry] } }] } });
});

// ---------- 3) Démarrage serveur ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on", PORT));

