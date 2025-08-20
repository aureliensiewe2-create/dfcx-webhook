import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const MOCKAPI_BASE = process.env.MOCKAPI_BASE; // ex: https://689c39ea58a27b18087d553c.mockapi.io

app.post("/df-webhook", async (req, res) => {
  try {
    const params = req.body?.sessionInfo?.parameters || {};
    const orderNumber = (params.orderNumber ?? params.OrderNumber ?? "").toString().trim();

    if (!orderNumber) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["I couldn't find the order number. Please type it again."] } }]
        }
      });
    }

    const r = await fetch(`${MOCKAPI_BASE}/orders/${orderNumber}`);
    if (!r.ok) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: [`I couldn't find order #${orderNumber}. Please check the number.`] } }]
        }
      });
    }
    const data = await r.json();

    const status = data.status || "processing";
    const etaDays = Number.isFinite(data.etaDays) ? data.etaDays : 3;
    const carrier = data.carrier || "our partner";

    return res.json({
      fulfillment_response: {
        messages: [{
          text: {
            text: [
              `Your order #${orderNumber} is ${status}.`,
              status === "delivered"
                ? "It has already been delivered."
                : `Estimated delivery: ${etaDays} day(s) via ${carrier}.`
            ]
          }
        }]
      },
      session_info: { parameters: { lastOrderStatus: status } }
    });
  } catch (e) {
    console.error(e);
    return res.json({
      fulfillment_response: {
        messages: [{ text: { text: ["Sorry, I couldn't reach the order service. Please try again later."] } }]
      }
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Webhook listening on ${PORT}`));
