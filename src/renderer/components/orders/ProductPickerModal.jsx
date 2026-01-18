import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../common/Modal";
import { emitToast } from "../../utils/toast";

function findById(id, list) {
  return list.find((item) => String(item.id) === String(id));
}

function buildLineId() {
  return `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function getDefaultType(pizzas, drinks) {
  if (pizzas && pizzas.length > 0) return "pizza";
  if (drinks && drinks.length > 0) return "drink";
  return "pizza";
}

function getPriceForSize(prices = {}, size = "grande") {
  if (!prices || typeof prices !== "object") return 0;
  if (size === "broto") return Number(prices.broto || prices.grande || 0);
  return Number(prices.grande || prices.broto || 0);
}

const ProductPickerModal = ({
  isOpen,
  onClose,
  onAddItem,
  pizzas = [],
  drinks = [],
  extras = [],
  formatCurrency,
  initialType,
}) => {
  const [type, setType] = useState("pizza");
  const [size, setSize] = useState("grande");
  const [quantity, setQuantity] = useState(1);
  const [drinkQuantity, setDrinkQuantity] = useState(1);
  const [search, setSearch] = useState("");
  const [flavorCount, setFlavorCount] = useState(3);
  const [activeFlavorSlot, setActiveFlavorSlot] = useState(1);
  const [flavors, setFlavors] = useState({ 1: "", 2: "", 3: "" });
  const [selectedDrinkId, setSelectedDrinkId] = useState("");
  const [selectedExtras, setSelectedExtras] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const defaultType = getDefaultType(pizzas, drinks);
    const preferredType =
      initialType === "drink" && drinks.length > 0
        ? "drink"
        : initialType === "pizza" && pizzas.length > 0
          ? "pizza"
          : null;
    setType(preferredType || defaultType);
    setSearch("");
    setSize("grande");
    setQuantity(1);
    setDrinkQuantity(1);
    setFlavorCount(3);
    setActiveFlavorSlot(1);
    setSelectedExtras([]);
    setSelectedDrinkId(drinks[0]?.id || "");
    setFlavors({
      1: pizzas[0]?.id || "",
      2: "",
      3: "",
    });
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, pizzas, drinks, initialType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddItem();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, type, size, quantity, drinkQuantity, flavors, selectedDrinkId, selectedExtras]);

  const filteredPizzas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pizzas;
    return pizzas.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.description || "").toLowerCase().includes(term) ||
        (p.categoria || "").toLowerCase().includes(term)
    );
  }, [search, pizzas]);

  const filteredDrinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drinks;
    return drinks.filter(
      (d) =>
        (d.name || "").toLowerCase().includes(term) ||
        (d.description || "").toLowerCase().includes(term) ||
        (d.categoria || "").toLowerCase().includes(term)
    );
  }, [search, drinks]);

  const extrasUnitTotal = useMemo(() => {
    if (!selectedExtras.length) return 0;
    return selectedExtras.reduce((acc, extraId) => {
      const extra = findById(extraId, extras);
      if (!extra) return acc;
      const price = getPriceForSize(extra?.prices, size);
      return acc + (price || 0);
    }, 0);
  }, [selectedExtras, extras, size]);

  const unitPizzaPrice = useMemo(() => {
    const pizza1 = findById(flavors[1], pizzas);
    if (!pizza1) return 0;

    const prices = [getPriceForSize(pizza1?.prices, size)];
    if (flavorCount >= 2 && flavors[2]) {
      const pizza2 = findById(flavors[2], pizzas);
      if (pizza2) prices.push(getPriceForSize(pizza2?.prices, size));
    }
    if (flavorCount === 3 && flavors[3]) {
      const pizza3 = findById(flavors[3], pizzas);
      if (pizza3) prices.push(getPriceForSize(pizza3?.prices, size));
    }

    return Math.max(...prices) + extrasUnitTotal;
  }, [flavors, pizzas, size, flavorCount, extrasUnitTotal]);

  const unitDrinkPrice = useMemo(() => {
    const drink = findById(selectedDrinkId, drinks);
    if (!drink) return 0;
    return getPriceForSize(drink?.prices, "grande");
  }, [selectedDrinkId, drinks]);

  const selectedDrink = useMemo(
    () => findById(selectedDrinkId, drinks),
    [selectedDrinkId, drinks]
  );

  const lineTotal = useMemo(() => {
    if (type === "pizza") {
      return unitPizzaPrice * (Number(quantity) || 0);
    }
    return unitDrinkPrice * (Number(drinkQuantity) || 0);
  }, [type, unitPizzaPrice, unitDrinkPrice, quantity, drinkQuantity]);

  const handleSelectFlavorCard = (pizzaId) => {
    if (!pizzaId) return;
    setFlavors((prev) => ({
      ...prev,
      [activeFlavorSlot]: pizzaId,
    }));
  };

  const handleToggleExtra = (extraId) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

  const handleAddItem = () => {
    if (type === "pizza") {
      if (!pizzas.length) {
        emitToast({
          type: "warning",
          message: "Nenhuma pizza cadastrada.",
        });
        return;
      }
      const q = Number(quantity) || 0;
      if (q <= 0) {
        emitToast({
          type: "warning",
          message: "Quantidade invalida.",
        });
        return;
      }
      const pizza1 = findById(flavors[1], pizzas);
      if (!pizza1) {
        emitToast({
          type: "warning",
          message: "Selecione o 1o sabor.",
        });
        return;
      }

      let pizza2 = null;
      if (flavorCount >= 2) {
        if (!flavors[2]) {
          emitToast({
            type: "warning",
            message: "Selecione o 2o sabor.",
          });
          return;
        }
        pizza2 = findById(flavors[2], pizzas);
        if (!pizza2) {
          emitToast({
            type: "warning",
            message: "Sabor 2 invalido.",
          });
          return;
        }
      }

      let pizza3 = null;
      if (flavorCount === 3) {
        if (!flavors[3]) {
          emitToast({
            type: "warning",
            message: "Selecione o 3o sabor.",
          });
          return;
        }
        pizza3 = findById(flavors[3], pizzas);
        if (!pizza3) {
          emitToast({
            type: "warning",
            message: "Sabor 3 invalido.",
          });
          return;
        }
      }

      const sizeLabel = size === "broto" ? "Broto" : "Grande";
      const extrasDetail = selectedExtras
        .map((extraId) => {
          const extra = findById(extraId, extras);
          if (!extra) return null;
          const price = getPriceForSize(extra?.prices, size);
          return {
            id: extra.id,
            name: extra.name,
            unitPrice: price,
          };
        })
        .filter(Boolean);

      const newItem = {
        lineId: buildLineId(),
        kind: "pizza",
        size,
        sizeLabel,
        quantity: q,
        flavor1Id: pizza1.id,
        flavor1Name: pizza1.name,
        flavor2Id: pizza2.id || null,
        flavor2Name: pizza2.name || null,
        flavor3Id: pizza3.id || null,
        flavor3Name: pizza3.name || null,
        twoFlavors: !!pizza2,
        threeFlavors: !!pizza3,
        extras: extrasDetail,
        unitPrice: unitPizzaPrice,
        total: unitPizzaPrice * q,
      };

      onAddItem?.(newItem);
      setQuantity(1);
      setFlavorCount(1);
      setActiveFlavorSlot(1);
      setSelectedExtras([]);
      return;
    }

    if (!drinks.length) {
      emitToast({
        type: "warning",
        message: "Nenhuma bebida cadastrada.",
      });
      return;
    }
    const q = Number(drinkQuantity) || 0;
    if (q <= 0) {
      emitToast({
        type: "warning",
        message: "Quantidade invalida.",
      });
      return;
    }
    const drink = findById(selectedDrinkId, drinks);
    if (!drink) {
      emitToast({
        type: "warning",
        message: "Selecione uma bebida.",
      });
      return;
    }
    const unit = getPriceForSize(drink?.prices, "grande");
    if (!unit) {
      emitToast({
        type: "warning",
        message: "Bebida sem preco configurado.",
      });
      return;
    }

    const newItem = {
      lineId: buildLineId(),
      kind: "drink",
      productId: drink.id,
      productName: drink.name,
      quantity: q,
      unitPrice: unit,
      total: unit * q,
    };
    onAddItem?.(newItem);
    setDrinkQuantity(1);
  };

  const canShowExtras = type === "pizza" && extras.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="product-picker-modal"
      bodyClassName="product-picker-body"
      title="Adicionar item"
      footer={
        <div className="product-picker-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Fechar
          </button>
          <div className="product-picker-footer-summary">
            <span className="chip chip-outline">
              Unitario {formatCurrency(type === "pizza" ? unitPizzaPrice : unitDrinkPrice)}
            </span>
            <span className="chip">
              Total {formatCurrency(lineTotal)}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAddItem}
            disabled={type === "pizza" ? !pizzas.length : !drinks.length}
          >
            Adicionar ao pedido
          </button>
        </div>
      }
    >
      <div className="product-picker-tabs">
        <button
          type="button"
          className={`product-picker-tab${type === "pizza" ? " active" : ""}`}
          onClick={() => setType("pizza")}
          disabled={!pizzas.length}
        >
          Pizza
        </button>
        <button
          type="button"
          className={`product-picker-tab${type === "drink" ? " active" : ""}`}
          onClick={() => setType("drink")}
          disabled={!drinks.length}
        >
          Bebida
        </button>
      </div>

      <div className="product-picker-grid">
        <div className="product-picker-column">
          <label className="field-label">Buscar</label>
          <input
            ref={searchRef}
            className="field-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={type === "pizza" ? "Nome, categoria ou ingrediente..." : "Ex: Coca, Guarana..."}
          />

          <div className="product-picker-panel product-picker-panel--list">
            <div
              className={
                "product-picker-list " +
                (type === "pizza"
                  ? "product-picker-list--pizza"
                  : "product-picker-list--drink")
              }
            >
              {type === "pizza" && (
                <>
                  {filteredPizzas.length === 0 && (
                    <div className="empty small">Nenhuma pizza encontrada.</div>
                  )}
                  {filteredPizzas.map((pizza) => {
                    const price = getPriceForSize(pizza?.prices, size);
                    const isSelected =
                      String(pizza.id) === String(flavors[1]) ||
                      String(pizza.id) === String(flavors[2]) ||
                      String(pizza.id) === String(flavors[3]);
                    return (
                      <button
                        key={pizza.id}
                        type="button"
                        className={`product-card${isSelected ? " selected" : ""}`}
                        onClick={() => handleSelectFlavorCard(pizza.id)}
                      >
                        <div className="product-card-main">
                          <div className="product-card-title">{pizza.name}</div>
                          <div className="product-card-price">{formatCurrency(price)}</div>
                        </div>
                        {pizza.categoria && (
                          <div className="product-card-sub">{pizza.categoria}</div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {type === "drink" && (
                <>
                  {filteredDrinks.length === 0 && (
                    <div className="empty small">Nenhuma bebida encontrada.</div>
                  )}
                  {filteredDrinks.map((drink) => {
                    const unit = getPriceForSize(drink?.prices, "grande");
                    const selected = String(drink.id) === String(selectedDrinkId);
                    return (
                      <button
                        key={drink.id}
                        type="button"
                        className={`product-card${selected ? " selected" : ""}`}
                        onClick={() => setSelectedDrinkId(drink.id)}
                      >
                        <div className="product-card-main">
                          <div className="product-card-title">{drink.name}</div>
                          <div className="product-card-price">{formatCurrency(unit)}</div>
                        </div>
                        {drink.categoria && (
                          <div className="product-card-sub">{drink.categoria}</div>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="product-picker-column">
          {type === "pizza" && (
            <>
              <div className="product-picker-panel">
                <div className="product-picker-block">
                  <div className="field-label">Tamanho</div>
                  <div className="field-pill-group">
                    <button
                      type="button"
                      className={`field-pill${size === "broto" ? " field-pill-active" : ""}`}
                      onClick={() => setSize("broto")}
                    >
                      Broto
                    </button>
                    <button
                      type="button"
                      className={`field-pill${size === "grande" ? " field-pill-active" : ""}`}
                      onClick={() => setSize("grande")}
                    >
                      Grande
                    </button>
                  </div>
                </div>

                <div className="product-picker-block">
                  <div className="field-label">Quantidade</div>
                  <input
                    className="field-input"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <div className="product-picker-block">
                  <div className="field-label">Quantidade de sabores</div>
                  <div className="field-pill-group">
                    {[1, 2, 3].map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={`field-pill${flavorCount === count ? " field-pill-active" : ""}`}
                        onClick={() => {
                          setFlavorCount(count);
                          setActiveFlavorSlot(count);
                          setFlavors((prev) => ({
                            ...prev,
                            2: count >= 2 ? prev[2] : "",
                            3: count === 3 ? prev[3] : "",
                          }));
                        }}
                      >
                        {count} sabor{count > 1 ? "es" : ""}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="product-picker-block">
                  <div className="field-label">Sabores selecionados</div>
                  <div className="field-pill-group">
                    {[1, 2, 3].slice(0, flavorCount).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`field-pill flavor-slot-pill${activeFlavorSlot === slot ? " field-pill-active" : ""}`}
                        onClick={() => setActiveFlavorSlot(slot)}
                      >
                        {slot}o sabor
                        {flavors[slot] && (
                          <span className="flavor-slot-sub">
                            {findById(flavors[slot], pizzas).name || "Selecionado"}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {canShowExtras && (
                <div className="product-picker-panel">
                  <div className="product-picker-block">
                    <div className="product-picker-block-head">
                      <div>
                        <div className="field-label">Adicionais</div>
                      </div>
                      <button
                        type="button"
                        className="extras-toggle-chip"
                        onClick={() => setSelectedExtras([])}
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="extras-list">
                      {extras.map((extra) => {
                        const checked = selectedExtras.includes(extra.id);
                        const price = getPriceForSize(extra?.prices, size);
                        return (
                          <label
                            key={extra.id}
                            className={`extras-item${checked ? " extras-item-active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleExtra(extra.id)}
                            />
                            <span className="extras-item-name">{extra.name}</span>
                            <span className="extras-item-price">
                              + {formatCurrency(price)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="extras-summary">
                      Adicionais: {formatCurrency(extrasUnitTotal)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {type === "drink" && (
            <>
              <div className="product-picker-panel">
                <div className="product-picker-block">
                  <div className="field-label">Bebida selecionada</div>
                  <div className="product-picker-inline">
                    <div className="selected-drink-card">
                      <div className="selected-drink-name">
                        {selectedDrink.name || "Selecione uma bebida"}
                      </div>
                      <div className="selected-drink-price">
                        {formatCurrency(unitDrinkPrice)}
                      </div>
                    </div>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      value={drinkQuantity}
                      onChange={(e) => setDrinkQuantity(e.target.value)}
                      placeholder="Qtd"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProductPickerModal;
