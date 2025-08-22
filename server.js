// server.js
import express from "express";

const app = express();
app.use(express.json());

// (Optionnel) si tu utilises MockAPI plus tard
const MOCKAPI_BASE = process.env.MOCKAPI_BASE; 

app.post("/df-webhook", async (req, res) => {
  try {
    const tag = req.body?.fulfillmentInfo?.tag || "";
    const params = req.body?.sessionInfo?.parameters || {};
    const orderNumber = (params.orderNumber ?? "").toString().trim();

    // On ne traite que le tag 'track-order'
    if (tag !== "track-order") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Unhandled webhook tag."] } }]
        }
      });
    }

    // Pas de numéro fourni
    if (!orderNumber) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Please provide an order number."] } }]
        }
      });
    }

    // Si ce n'est pas 12345
    if (orderNumber !== "12345") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: [`Order ${orderNumber} not found.`] } }]
        }
      });
    }

    // Si c'est bien 12345
    return res.json({
      fulfillment_response: {
        messages: [{ text: { text: [`Order ${orderNumber} is confirmed and being processed.`] } }]
      }
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

// Render écoute généralement sur PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Webhook listening on ${PORT}`);
});

