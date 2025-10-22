app.post("/df-webhook", (req, res) => {
  const tag = req.body?.fulfillmentInfo?.tag ?? "";
  const lang = (req.body?.sessionInfo?.languageCode || "en").toLowerCase();
  const en = (s) => s;
  const fr = (s) => s;
  const t = (enTxt, frTxt) => (lang.startsWith("fr") ? frTxt : enTxt);

  if (tag === "track-order") {
    const p = req.body?.sessionInfo?.parameters || {};
    const orderNumber = String(p.ordernumber ?? p.orderNumber ?? "").trim();

    // 1) Demander le numéro s'il est manquant / invalide
    if (!/^\d{5}$/.test(orderNumber)) {
      const ask = t(
        "Please provide your 5-digit order number to check the delivery status.",
        "Merci d’indiquer votre numéro de commande (5 chiffres) pour vérifier le statut."
      );
      return res.json({
        fulfillment_response: { messages: [{ text: { text: [ask] } }] },
      });
    }

    // 2) Numéro présent : vérifier s'il est connu
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

    // 3) OK, retourner le statut
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

  // tag inconnu
  return res.json({
    fulfillment_response: {
      messages: [{ text: { text: [t("Sorry, I didn’t understand.", "Désolé, je n’ai pas compris.")] } }],
    },
  });
});
