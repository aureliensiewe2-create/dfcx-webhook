// server.js
import express from "express";

const app = express();
app.use(express.json());

// (optionnel si tu connectes une vraie API plus tard)
const MOCKAPI_BASE = process.env.MOCKAPI_BASE;

// 🗂️ Mini “base” en mémoire pour la démo
const ORDERS = {
  "12345": { status: "confirmed", carrier: "DHL",   etaDays: 2 },
  "67890": { status: "shipped",   carrier: "FedEx", etaDays: 3 },
  "55555": { status: "delivered", carrier: "UPS",   etaDays: 0 }
};

app.post("/df-webhook", async (req, res) => {
  try {
    const tag = req.body?.fulfillmentInfo?.tag || "";
    const params = req.body?.sessionInfo?.parameters || {};

    // Tolère plusieurs noms de paramètres
    const orderNumberRaw =
      params.orderNumber ??
      params.ordernumber ??
      params.number ??
      params.OrderNumber ??
      "";

    const orderNumber = String(orderNumberRaw).trim();

    console.log("Webhook tag:", tag);
    console.log("Webhook params:", JSON.stringify(params));
    console.log("Resolved orderNumber:", orderNumber);

    if (tag !== "track-order") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Unhandled webhook tag."] } }]
        }
      });
    }

    if (!orderNumber) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Please provide an order number."] } }]
        }
      });
    }

    const info = ORDERS[orderNumber];
    if (!info) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: [`Order ${orderNumber} not found.`] } }]
        }
      });
    }

    // Compose le message selon le statut
    let msg;
    if (info.status === "delivered") {
      msg = `Order ${orderNumber} was delivered via ${info.carrier}.`;
    } else {
      const eta = info.etaDays > 0 ? ` Estimated delivery: ${info.etaDays} day(s).` : "";
      msg = `Order ${orderNumber} is ${info.status}.` +
            `${eta} Carrier: ${info.carrier}.`;
    }

    return res.json({
      fulfillment_response: {
        messages: [{ text: { text: [msg] } }]
      },
      // On peut renvoyer des paramètres en session si tu veux les réutiliser
      sessionInfo: {
        parameters: {
          orderNumber,
          lastOrderStatus: info.status
        }
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Webhook listening on ${PORT}`);
});

