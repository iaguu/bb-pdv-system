const assert = require("assert");
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "renderer",
  "components",
  "orders",
  "OrderFormModal.jsx"
);

const content = fs.readFileSync(filePath, "utf8");

assert.ok(
  content.includes("showDrinkModal") && content.includes("Adicionar Bebida"),
  "OrderFormModal should render the drink modal when showDrinkModal is true."
);
assert.ok(
  content.includes("save_and_print"),
  "OrderFormModal should allow save and print from the action button."
);
assert.ok(
  content.includes("handleEditItem"),
  "OrderFormModal should provide an edit handler for order items."
);
assert.ok(
  content.includes("handleAutoDistanceFromCustomer") &&
    content.includes("Buscar"),
  "OrderFormModal should wire the distance search button."
);

console.log("OrderForm drink modal test: OK");
