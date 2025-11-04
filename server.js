// server.js — ESM, prêt Render

import express from "express";

const app = express();
app.use(express.json());

// --- 0) Santé
app.get("/", (_req, res) => res.send("OK"));

// --- 1) Données simulées

const KNOWN_ORDERS = {
  "12345":  { status: { en: "confirmed",  fr: "confirmée" },   etaDays: 2, carrier: "DHL" },
  "54321":  { status: { en: "shipped",    fr: "expédiée" },    etaDays: 3, carrier: "UPS" },
  "98765":  { status: { en: "delivered",  fr: "livrée" },      etaDays: 0, carrier: "Chrono" },
  "11223":  { status: { en: "processing", fr: "en préparation"},etaDays: 1, carrier: "LaPoste" }
};

const CATALOG = [
  { name: "Black T-shirt", color: "black", price: 25, category: "t-shirt", size: "M", brand: "Nike" },
  { name: "Red Dress",     color: "red",   price: 60, category: "dress",   size: "M", brand: "Zara" },
  { name: "Jean Slim",     color: "blue",  price: 45, category: "jean",    size: "32", brand: "Levi's" },
];

// --- 2) i18n utilitaire
function i18n(lang) {
  const isFr = String(lang || "en").toLowerCase().startsWith("fr");
  return (enTxt, frTxt) => (isFr ? frTxt : enTxt);
}

// --- 3) Normalisation (minuscules + accents + supprime ponctuation)
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // accents
    .replace(/[^a-z0-9 ]/g, " ")                        // ponctuation -> espace
    .replace(/\s+/g, " ")                               // espaces multiples
    .trim();

// --- 4) Dictionnaire FR -> EN (recherche)
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

  // Catégories (avec variantes courantes)
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
  "chaussures": "shoes",
};

// EN -> FR (pour l’affichage)
const enToFr = Object.fromEntries(
  Object.entries(frToEn).map(([fr, en]) => [en, fr])
);

// Traduction souple : si la valeur FR contient un mot-clé du dico, on renvoie l’EN
const translateLoose = (value, map) => {
  const v = normalize(value);
  for (const [fr, en] of Object.entries(map)) {
    if (v.includes(normalize(fr))) return en;
  }
  return value; // rien trouvé -> on laisse tel quel
};

// --- 5) Webhook principal
app.post("/df-webhook", (req, res) => {
  // 5.1 Détection de langue (DFCX + header fallback)
  const lang =
    req.body?.sessionInfo?.languageCode ||
    req.body?.languageCode ||
    req.headers?.["x-goog-dialogflow-language-code"] ||
    "en";

  const t = i18n(lang);

  // 5.2 Tag de fulfillment + paramètres de session
  const tag = req.body?.fulfillmentInfo?.tag ?? "";
  const params = req.body?.sessionInfo?.parameters || {};

  // =============== A) Suivi de commande ===============
  if (tag === "track-order") {
    const orderNumber = String(params.ordernumber ?? params.orderNumber ?? "").trim();

    // 1) Valide 5 chiffres
    if (!/^\d{5}$/.test(orderNumber)) {
      const ask = t(
        "Please provide your 5-digit order number to check the delivery status.",
        "Merci d’indiquer votre numéro de commande (5 chiffres) pour vérifier le statut."
      );
      return res.json({
        fulfillment_response: { messages: [{ text: { text: [ask] } }] }
      });
    }

    // 2) Récupère l’info
    const info = KNOWN_ORDERS[orderNumber];
    if (!info) {
      const notFound = t(
        `I couldn't find order ${orderNumber}. Please check the number.`,
        `Je n’ai pas trouvé la commande ${orderNumber}. Merci de vérifier le numéro.`
      );
      return res.json({
        fulfillment_response: { messages: [{ text: { text: [notFound] } }] }
      });
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

  // =============== B) Recherche de produits (Find_product) ===============
  if (tag === "Find_product") {
    // 1) Lecture robuste des paramètres (plusieurs noms possibles)
    const p = params;
    const origColor =
      (p.color ?? p.couleur ?? p.couleur_name ?? p.colour ?? "").toString();
    const origCategory =
      (p.category ?? p.categorie ?? p.product ?? p.type ?? p.item ?? "").toString();
    const origSize = (p.size ?? p.taille ?? "").toString();
    const origBrand = (p.brand ?? p.marque ?? "").toString();

    // 2) Normalisation pour la recherche (minuscules)
    let color = origColor.toLowerCase();
    let category = origCategory.toLowerCase();
    let size = origSize.toLowerCase();
    let brand = origBrand.toLowerCase();

    // 3) price_max (anti-bruit : ignore “1” venant de “un/une”)
    let priceMax = Number(p.price_max ?? p.max_price ?? p.price ?? undefined);
    if (!Number.isFinite(priceMax)) priceMax = undefined;
    if (priceMax !== undefined && priceMax < 5) priceMax = undefined;

    // 4) Si FR -> trad souple FR->EN pour la recherche
    if (String(lang).toLowerCase().startsWith("fr")) {
      if (color)    color = translateLoose(color, frToEn);
      if (category) category = translateLoose(category, frToEn);
    }

    // 5) Étiquettes d’affichage (ne pas montrer les clés EN si FR)
    const displayColor = String(lang).toLowerCase().startsWith("fr")
      ? (origColor || enToFr[color] || color)
      : color;

    const displayCategory = String(lang).toLowerCase().startsWith("fr")
      ? (origCategory || enToFr[category] || category || "articles")
      : (category || "products");

    // 6) Filtrage
    const result = CATALOG.filter((item) => {
      const okColor = !color || normalize(item.color).includes(normalize(color));
      const okCat   = !category || normalize(item.category).includes(normalize(category));
      const okSize  = !size || normalize(String(item.size)) === normalize(size);
      const okBrand = !brand || normalize(item.brand).includes(normalize(brand));
      const okPrice = priceMax === undefined || item.price <= priceMax;
      return okColor && okCat && okSize && okBrand && okPrice;
    });

// 7) Réponse
let message;

if (result.length > 0) {
  // Traduction inverse (EN -> FR) pour l’affichage global de la requête
  const displayColor = enToFr[color] || color;
  const displayCategory = enToFr[category] || category;

  // Libellé FR pour chaque item : "<catégorie fr> <couleur fr>"
  const itemLabel = (it) => {
    const catFr = enToFr[it.category] || it.category;
    const colFr = enToFr[it.color] || it.color;
    return `${catFr} ${colFr}`.trim(); // ex: "t-shirt noir", "robe rouge"
  };

  const listFr = result.map(itemLabel).join(", ");

  message = t(
    `Here are some ${displayColor || ""} ${displayCategory || "products"} I found: ${result.map(p => p.name).join(", ")}`,
    `Voici quelques ${displayCategory || "articles"} ${displayColor || ""} que j’ai trouvés : ${listFr}`
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

  // =============== C) Fallback tag inconnu ===============
  const sorry = i18n(lang)(
    "Sorry, I didn't understand.",
    "Désolé, je n’ai pas compris."
  );
  return res.json({
    fulfillment_response: { messages: [{ text: { text: [sorry] } }] }
  });
});

// --- 6) Démarrage serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Webhook listening on", PORT));

 
