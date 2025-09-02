// server.js
import express from "express";

const app = express();
app.use(express.json());

// petit endpoint "santé"
app.get("/", (req, res) => res.send("ok"));

// ---- Webhook DFCX ----
app.post("/df-webhook", async (req, res) => {
  // 1) Récupération sûre des paramètres
  const params = req.body?.sessionInfo?.parameters || {};
  const orderNumberRaw =
    params.orderNumber ??
    params.order_number ??
    params.number ??
    params.OrderNumber ??
    "";
  const orderNumber = orderNumberRaw.toString().trim();

  // 2) Validation 5 chiffres
  if (!/^\d{5}$/.test(orderNumber)) {
    return res.json({
      fulfillment_response: {
        messages: [
          { text: { text: ["Please provide a 5-digit order number."] } }
        ]
      }
    });
  }

  // 3) Logique métier : 12345 / 54321 connus, sinon "processing"
  const KNOWN = {
    "12345": { status: "confirmed", etaDays: 2, carrier: "DHL" },
    "54321": { status: "shipped",   etaDays: 3, carrier: "UPS" }
  };

  const info =
    KNOWN[orderNumber] || { status: "processing", etaDays: 5, carrier: "FedEx" };

  // 4) Réponse DFCX
  return res.json({
    fulfillment_response: {
      messages: [
        {
          text: {
            text: [
              `Order ${orderNumber} is ${info.status}. Estimated delivery: ${info.etaDays} day(s) via ${info.carrier}.`
            ]
          }
        }
      ]
    },
    session_info: {
      parameters: { lastOrderStatus: info.status }
    }
  });
});

// 5) Démarrage serveur (Render fournit le PORT dans process.env.PORT)
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Webhook listening on", PORT));
