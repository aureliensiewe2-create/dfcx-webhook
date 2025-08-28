// server.js
import express from "express";

const app = express();
app.use(express.json());

// Optionnel si tu utilises MockAPI plus tard
const MOCKAPI_BASE = process.env.MOCKAPI_BASE;

app.post("/df-webhook", async (req, res) => {
  try {
    // Tag défini dans Dialogflow (Webhook settings → Tag)
    const tag = req.body?.fulfillmentInfo?.tag || "";

    // On récupère les paramètres de session
    const params = req.body?.sessionInfo?.parameters || {};

    // ✅ Accepte plusieurs noms de paramètre
    const orderNumberRaw =
      params.orderNumber ??
      params.ordernumber ??
      params.number ??
      params.OrderNumber ??
      "";

    const orderNumber = String(orderNumberRaw).trim();

    // Logs utiles visibles dans Render → Deploy logs
    console.log("Webhook tag:", tag);
    console.log("Webhook params:", JSON.stringify(params));
    console.log("Resolved orderNumber:", orderNumber);

    // On ne traite que le tag attendu
    if (tag !== "track-order") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Unhandled webhook tag."] } }]
        }
      });
    }

    // Pas de numéro → on le demande
    if (!orderNumber) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Please provide an order number."] } }]
        }
      });
    }

    // Mauvais numéro → non trouvé
    if (orderNumber !== "12345") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: [`Order ${orderNumber} not found.`] } }]
        }
      });
    }

    // ✅ Bon numéro → confirmé
    return res.json({
      fulfillment_response: {
        messages: [
          { text: { text: [`Order ${orderNumber} is confirmed and being processed.`] } }
        ]
      },
      // (optionnel) renvoi du paramètre normalisé dans la session
      sessionInfo: { parameters: { orderNumber } }
    });

  } catch (err) {
    console.error("Webhook error:", err);
    return res.json({
      fulfillment_response: {
        messages: [{ text: { text: ["Sorry, something went wrong."] } }]
      }
    });
  }
});

// Render écoute sur ce port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Webhook listening on ${PORT}`);
});

