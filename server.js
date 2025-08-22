app.post("/df-webhook", async (req, res) => {
  try {
    const params = req.body?.sessionInfo?.parameters || {};
    const orderNumber = (params.orderNumber ?? "").toString().trim();

    // Vérifie si aucun numéro n’est fourni
    if (!orderNumber) {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: ["Please provide an order number."] } }]
        }
      });
    }

    // Vérifie si ce n’est pas 12345
    if (orderNumber !== "12345") {
      return res.json({
        fulfillment_response: {
          messages: [{ text: { text: [`Order ${orderNumber} not found.`] } }]
        }
      });
    }

    // Si c’est bien 12345
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


