// --- Filtrage simple avec vérification robuste ---
const result = products.filter(p => {
  const matchColor =
    !color || (p.color && p.color.toLowerCase() === color.toLowerCase());
  const matchCategory =
    !category || (p.category && p.category.toLowerCase() === category.toLowerCase());
  const matchBrand =
    !brand || (p.brand && p.brand.toLowerCase().includes(brand.toLowerCase()));
  const matchPrice =
    !price_max || (p.price && p.price <= Number(price_max));

  return matchColor && matchCategory && matchBrand && matchPrice;
});

let message;
if (result.length > 0) {
  message = t(
    `Here are some ${color || ""} ${category || "products"} I found: ${result.map(p => p.name).join(", ")}.`,
    `Voici quelques ${category || "articles"} ${color || ""} que j'ai trouvés : ${result.map(p => p.name).join(", ")}.`
  );
} else {
  message = t(
    "Sorry, I couldn't find any matching products.",
    "Désolé, je n’ai trouvé aucun produit correspondant."
  );
}

return res.json({
  fulfillment_response: {
    messages: [{ text: { text: [message] } }]
  }
});
