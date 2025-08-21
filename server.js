import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const MOCKAPI_BASE = process.env.MOCKAPI_BASE; // ex: https://xxxx.mockapi.io

app.post("/df-webhook", async (req, res) => {
  try {
    const tag = req.body.fulfillmentInfo?.tag;   // 🔹 récupère le tag
    const params = req.body?.sessionInfo?.parameters || {};

    if (tag === "track-order") {
      const orderNumber = (params.orderNumber ?? params.OrderNumber ?? "").toString().trim();

      if (!orderNumber) {
        return res.json({
          fulfillment_response: {
            messages: [
              { text: { text: ["I couldn't find the order number. Please type it again."] } }
            ]
          }
        });
      }

      // 🔹 Appel à MockAPI
      const r = await fetch(`${MOCKAPI_BASE}/orders/${orderNumber}`);
      const order = await r.json();

      return res.json({
        fulfillment_response: {
          messages: [
            {
              text: {
                text: [
                  `Your order #${orderNumber} is ${order.status}.`,
                  `Estimated delivery: ${order.deliveryDays} day(s) via ${order.carrier}.`
                ]
              }
            }
          ]
        },
        session_info: {
          parameters: {
            lastOrderStatus: order.status
          }
        }
      });
    }

    // Réponse par défaut si le tag ne correspond pas
    return res.json({
      fulfillment_response: {
        messages: [{ text: { text: ["Sorry, I didn't understand that."] } }]
      }
    });

  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Error processing the request");
  }
});

// Lancement serveur
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

