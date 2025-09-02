// Exemple : supporte 12345 et 54321 avec statuts différents, le reste = "processing"
const KNOWN = {
  "12345": { status: "confirmed", etaDays: 2, carrier: "DHL" },
  "54321": { status: "shipped",   etaDays: 3, carrier: "UPS" },
};

const info = KNOWN[orderNumber] || { status: "processing", etaDays: 5, carrier: "FedEx" };

return res.json({
  fulfillment_response: {
    messages: [{
      text: {
        text: [
          `Order ${orderNumber} is ${info.status}. Estimated delivery: ${info.etaDays} day(s) via ${info.carrier}.`
        ]
      }
    }]
  },
  session_info: { parameters: { lastOrderStatus: info.status } }
});

