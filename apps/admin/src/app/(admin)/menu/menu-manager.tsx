"use client";

import { useState, useTransition } from "react";
import {
  saveCategoryAction,
  deleteCategoryAction,
  saveMenuItemAction,
  toggleAvailabilityAction,
  deleteMenuItemAction,
  generateMenuQrAction,
} from "./actions";
import type { PublicMenuCategory, PublicMenuItem } from "@biztrackbd/core";
import { TableQrStudio } from "./table-qr-studio";
import "./menu.css";

const DIETARY_OPTIONS = [
  { id: "halal", label: "Halal / হালাল" },
  { id: "spicy", label: "Spicy / ঝাল 🌶️" },
  { id: "vegetarian", label: "Vegetarian / নিরামিষ 🥬" },
  { id: "vegan", label: "Vegan" },
  { id: "chef_special", label: "Chef's Special / স্পেশাল ⭐" },
  { id: "popular", label: "Popular / জনপ্রিয় 🔥" },
  { id: "beverage", label: "Beverage / পানীয়" },
];

export function MenuManager({
  initialCategories,
  storeOrigin,
  storeName,
  logoUrl,
}: {
  initialCategories: PublicMenuCategory[];
  storeOrigin: string;
  storeName?: string;
  logoUrl?: string | null;
}) {
  const [activeMainTab, setActiveMainTab] = useState<"dishes" | "qr-studio">("dishes");
  const [categories, setCategories] = useState<PublicMenuCategory[]>(initialCategories);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PublicMenuCategory | null>(null);

  // Dish Modal
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<PublicMenuItem | null>(null);
  const [dishCategoryId, setDishCategoryId] = useState<string>("");

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrTargetUrl, setQrTargetUrl] = useState<string>("");

  const handleToggleAvailability = (dish: PublicMenuItem) => {
    const nextVal = !dish.isAvailable;
    // Optimistic UI update
    setCategories((prev) =>
      prev.map((c) =>
        c.id === dish.categoryId
          ? {
              ...c,
              items: c.items.map((i) => (i.id === dish.id ? { ...i, isAvailable: nextVal } : i)),
            }
          : c
      )
    );

    startTransition(async () => {
      await toggleAvailabilityAction(dish.id, nextVal);
    });
  };

  const handleDeleteDish = (dish: PublicMenuItem) => {
    if (!confirm(`Are you sure you want to delete "${dish.name}"?`)) return;

    setCategories((prev) =>
      prev.map((c) =>
        c.id === dish.categoryId
          ? { ...c, items: c.items.filter((i) => i.id !== dish.id) }
          : c
      )
    );

    startTransition(async () => {
      await deleteMenuItemAction(dish.id);
    });
  };

  const handleDeleteCategory = (cat: PublicMenuCategory) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${cat.name}" and all its ${cat.items.length} items?`
      )
    )
      return;

    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    if (activeCategoryId === cat.id) setActiveCategoryId("all");

    startTransition(async () => {
      await deleteCategoryAction(cat.id);
    });
  };

  const openQrModal = async (tbl = "") => {
    setTableNumber(tbl);
    setShowQrModal(true);
    startTransition(async () => {
      const res = await generateMenuQrAction(tbl || undefined);
      if (res.ok) {
        setQrPreviewUrl(res.dataUrl);
        setQrSvg(res.svg);
        setQrTargetUrl(res.targetUrl);
      }
    });
  };

  const handleTableNumberChange = (val: string) => {
    setTableNumber(val);
    startTransition(async () => {
      const res = await generateMenuQrAction(val.trim() || undefined);
      if (res.ok) {
        setQrPreviewUrl(res.dataUrl);
        setQrSvg(res.svg);
        setQrTargetUrl(res.targetUrl);
      }
    });
  };

  const filteredCategories =
    activeCategoryId === "all"
      ? categories
      : categories.filter((c) => c.id === activeCategoryId);

  const totalDishes = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="menu-workspace">
      {/* Header bar */}
      <div className="menu-header-bar">
        <div className="menu-title-group">
          <h1>
            <span>🍽️</span> Restaurant Menu & Dishes
          </h1>
          <p>
            Organize dish categories, price points, dietary flags, daily availability, and contactless QR dining tables.
          </p>
        </div>
        <div className="menu-header-actions">
          <button
            type="button"
            onClick={() => setActiveMainTab("qr-studio")}
            className="menu-btn-secondary"
          >
            <span>📱</span> Table QR Studio
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            className="menu-btn-secondary"
          >
            <span>+</span> Add Category
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={() => {
              setEditingDish(null);
              setDishCategoryId(categories[0]?.id ?? "");
              setShowDishModal(true);
            }}
            className="menu-btn-primary"
          >
            <span>+</span> Add Dish
          </button>
        </div>
      </div>

      {/* Primary Module Navigation Tabs */}
      <div className="menu-module-tabs">
        <button
          type="button"
          onClick={() => setActiveMainTab("dishes")}
          className={`menu-tab-btn ${activeMainTab === "dishes" ? "active" : ""}`}
        >
          <span>🍽️</span> Menu Categories & Dishes
          <span className="menu-counter-chip">{totalDishes}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("qr-studio")}
          className={`menu-tab-btn ${activeMainTab === "qr-studio" ? "active" : ""}`}
        >
          <span>📱</span> Table QR Studio
          <span className="menu-counter-chip" style={{ background: "rgba(5, 150, 105, 0.12)", color: "#059669" }}>
            Print & Stands
          </span>
        </button>
      </div>

      {activeMainTab === "qr-studio" ? (
        <TableQrStudio
          storeOrigin={storeOrigin}
          storeName={storeName}
          logoUrl={logoUrl}
        />
      ) : (
        <>
          {/* Category Tabs */}
          {categories.length > 0 ? (
            <div className="category-filter-scroll">
              <button
                type="button"
                onClick={() => setActiveCategoryId("all")}
                className={`category-pill-btn ${activeCategoryId === "all" ? "active" : ""}`}
              >
                All Categories ({totalDishes})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`category-pill-btn ${activeCategoryId === c.id ? "active" : ""}`}
                >
                  {c.name} {c.nameBn ? `(${c.nameBn})` : ""} ({c.items.length})
                </button>
              ))}
            </div>
          ) : (
            <div className="menu-empty-state">
              <p className="main">No menu categories yet.</p>
              <p className="sub">
                Create your first category (e.g. Starters, Main Dishes, Drinks) to start listing dishes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                className="menu-btn-primary"
              >
                + Create First Category
              </button>
            </div>
          )}

          {/* Category & Dishes List */}
          <div className="menu-categories-stack">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="menu-category-card">
                <div className="category-card-header">
                  <div className="category-heading-text">
                    <h3>
                      {cat.name} {cat.nameBn && <span className="bn-title">({cat.nameBn})</span>}
                      <span className="menu-counter-chip">{cat.items.length} items</span>
                    </h3>
                    {cat.description && <p>{cat.description}</p>}
                  </div>
                  <div className="category-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDish(null);
                        setDishCategoryId(cat.id);
                        setShowDishModal(true);
                      }}
                      className="cat-action-btn cat-add-dish"
                    >
                      + Add Dish
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(cat);
                        setShowCategoryModal(true);
                      }}
                      className="cat-action-btn cat-edit"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="cat-action-btn cat-delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {cat.items.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--ink-3, #64748b)", fontSize: "0.88rem" }}>
                    No dishes in this category yet. Click &quot;+ Add Dish&quot; to add one.
                  </div>
                ) : (
                  <div className="dish-items-list">
                    {cat.items.map((dish) => (
                      <div
                        key={dish.id}
                        className={`dish-item-row ${dish.isAvailable ? "" : "sold-out"}`}
                      >
                        <div className="dish-main-info">
                          {dish.imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={dish.imageUrl}
                              alt={dish.name}
                              className="dish-thumbnail"
                            />
                          ) : (
                            <div className="dish-thumbnail">
                              🍽️
                            </div>
                          )}
                          <div className="dish-text-block">
                            <div className="dish-title-row">
                              <span className="dish-name-en">{dish.name}</span>
                              {dish.nameBn && <span className="dish-name-bn">({dish.nameBn})</span>}
                              {dish.dietaryLabels.map((lbl) => (
                                <span
                                  key={lbl}
                                  className={`dietary-badge-tag badge-${lbl}`}
                                >
                                  {lbl === "halal" ? "Halal" : lbl === "chef_special" ? "Chef's Special" : lbl.replace("_", " ")}
                                </span>
                              ))}
                            </div>
                            {dish.description && (
                              <p className="dish-description">{dish.description}</p>
                            )}
                            <div className="dish-price-row">
                              <span className="dish-current-price">৳{dish.price}</span>
                              {dish.compareAtPrice && (
                                <span className="dish-compare-price">
                                  ৳{dish.compareAtPrice}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="dish-controls">
                          {/* Availability Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(dish)}
                            className={`availability-toggle-btn ${
                              dish.isAvailable ? "is-available" : "is-sold-out"
                            }`}
                            title="Click to toggle Available vs Sold Out"
                          >
                            <span
                              className={`status-dot ${
                                dish.isAvailable ? "green" : "red"
                              }`}
                            />
                            {dish.isAvailable ? "Available" : "Sold Out / শেষ"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingDish(dish);
                              setDishCategoryId(dish.categoryId);
                              setShowDishModal(true);
                            }}
                            className="dish-edit-btn"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDish(dish)}
                            className="dish-delete-btn"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="menu-modal-backdrop">
          <div className="menu-modal-window" style={{ maxWidth: 460 }}>
            <div className="menu-modal-header">
              <h3>{editingCategory ? "Edit Category" : "New Category"}</h3>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="menu-modal-close"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("name") as HTMLInputElement).value;
                const nameBn = (form.elements.namedItem("nameBn") as HTMLInputElement).value;
                const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;

                startTransition(async () => {
                  const res = await saveCategoryAction({
                    id: editingCategory?.id,
                    name,
                    nameBn: nameBn || null,
                    description: description || null,
                    sortOrder: editingCategory?.sortOrder ?? 0,
                    isActive: true,
                  });
                  if (res.ok) {
                    setShowCategoryModal(false);
                    // Refresh in-state list
                    if (editingCategory) {
                      setCategories((prev) =>
                        prev.map((c) =>
                          c.id === editingCategory.id ? { ...c, name, nameBn, description } : c
                        )
                      );
                    } else {
                      setCategories((prev) => [
                        ...prev,
                        {
                          id: res.data.id,
                          name,
                          nameBn: nameBn || null,
                          description: description || null,
                          descriptionBn: null,
                          sortOrder: prev.length,
                          items: [],
                        },
                      ]);
                    }
                  }
                });
              }}
              className="menu-modal-form"
            >
              <div className="modal-field">
                <label>Category Name (English) *</label>
                <input
                  name="name"
                  defaultValue={editingCategory?.name ?? ""}
                  placeholder="e.g. Starters / Appetizers"
                  required
                />
              </div>
              <div className="modal-field">
                <label>বাংলা নাম (ঐচ্ছিক)</label>
                <input
                  name="nameBn"
                  defaultValue={editingCategory?.nameBn ?? ""}
                  placeholder="যেমন: স্টার্টার ও স্যুপ"
                />
              </div>
              <div className="modal-field">
                <label>Description / বর্ণনা</label>
                <textarea
                  name="description"
                  defaultValue={editingCategory?.description ?? ""}
                  rows={2}
                  placeholder="Short note about these dishes"
                />
              </div>
              <div className="modal-actions-footer">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="menu-btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="menu-btn-primary"
                  style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                >
                  {isPending ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dish Modal */}
      {showDishModal && (
        <div className="menu-modal-backdrop">
          <div className="menu-modal-window">
            <div className="menu-modal-header">
              <h3>{editingDish ? "Edit Dish" : "Add New Dish"}</h3>
              <button
                type="button"
                onClick={() => setShowDishModal(false)}
                className="menu-modal-close"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const categoryId = (form.elements.namedItem("categoryId") as HTMLSelectElement).value;
                const name = (form.elements.namedItem("name") as HTMLInputElement).value;
                const nameBn = (form.elements.namedItem("nameBn") as HTMLInputElement).value;
                const price = parseFloat((form.elements.namedItem("price") as HTMLInputElement).value);
                const comparePriceVal = (form.elements.namedItem("compareAtPrice") as HTMLInputElement).value;
                const compareAtPrice = comparePriceVal ? parseFloat(comparePriceVal) : null;
                const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
                const imageUrl = (form.elements.namedItem("imageUrl") as HTMLInputElement).value;

                // Collect dietary labels
                const selectedLabels: string[] = [];
                DIETARY_OPTIONS.forEach((opt) => {
                  const chk = form.elements.namedItem(`diet_${opt.id}`) as HTMLInputElement;
                  if (chk?.checked) selectedLabels.push(opt.id);
                });

                startTransition(async () => {
                  const res = await saveMenuItemAction({
                    id: editingDish?.id,
                    categoryId,
                    name,
                    nameBn: nameBn || null,
                    description: description || null,
                    price,
                    compareAtPrice,
                    imageUrl: imageUrl || null,
                    dietaryLabels: selectedLabels,
                    isAvailable: editingDish ? editingDish.isAvailable : true,
                    sortOrder: editingDish?.sortOrder ?? 0,
                  });
                  if (res.ok) {
                    setShowDishModal(false);
                    // Update in-memory categories state
                    setCategories((prev) =>
                      prev.map((c) => {
                        const cleanItems = c.items.filter((i) => i.id !== editingDish?.id);
                        if (c.id === categoryId) {
                          const updatedItem: PublicMenuItem = {
                            id: editingDish ? editingDish.id : res.data.id,
                            categoryId,
                            name,
                            nameBn: nameBn || null,
                            description: description || null,
                            descriptionBn: null,
                            price,
                            compareAtPrice,
                            imageUrl: imageUrl || null,
                            dietaryLabels: selectedLabels,
                            isAvailable: editingDish ? editingDish.isAvailable : true,
                            sortOrder: editingDish ? editingDish.sortOrder : c.items.length,
                          };
                          return { ...c, items: [...cleanItems, updatedItem] };
                        }
                        return { ...c, items: cleanItems };
                      })
                    );
                  }
                });
              }}
              className="menu-modal-form"
            >
              <div className="modal-field">
                <label>Category *</label>
                <select
                  name="categoryId"
                  defaultValue={dishCategoryId}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.nameBn ? `(${c.nameBn})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group-grid">
                <div className="modal-field">
                  <label>Dish Name (English) *</label>
                  <input
                    name="name"
                    defaultValue={editingDish?.name ?? ""}
                    placeholder="e.g. Beef Bhuna Khichuri"
                    required
                  />
                </div>
                <div className="modal-field">
                  <label>বাংলা নাম (ঐচ্ছিক)</label>
                  <input
                    name="nameBn"
                    defaultValue={editingDish?.nameBn ?? ""}
                    placeholder="যেমন: বিফ ভুনা খিচুড়ি"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div className="modal-field">
                  <label>Price (৳) *</label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={editingDish?.price ?? ""}
                    placeholder="350"
                    required
                  />
                </div>
                <div className="modal-field">
                  <label>Regular / Compare Price (৳)</label>
                  <input
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    defaultValue={editingDish?.compareAtPrice ?? ""}
                    placeholder="400"
                  />
                </div>
              </div>

              <div className="modal-field">
                <label>Image URL</label>
                <input
                  name="imageUrl"
                  type="url"
                  defaultValue={editingDish?.imageUrl ?? ""}
                  placeholder="https://... or upload from media"
                />
              </div>

              <div className="modal-field">
                <label>Description / Ingredients</label>
                <textarea
                  name="description"
                  defaultValue={editingDish?.description ?? ""}
                  rows={2}
                  placeholder="Chinigura rice, tender shank beef, mustard oil, aromatic spices"
                />
              </div>

              <div className="modal-field">
                <label style={{ marginBottom: 4 }}>Dietary Badges & Labels</label>
                <div className="dietary-checkbox-grid">
                  {DIETARY_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="dietary-checkbox-label"
                    >
                      <input
                        type="checkbox"
                        name={`diet_${opt.id}`}
                        defaultChecked={editingDish?.dietaryLabels?.includes(opt.id)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions-footer">
                <button
                  type="button"
                  onClick={() => setShowDishModal(false)}
                  className="menu-btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="menu-btn-primary"
                  style={{ padding: "8px 18px", fontSize: "0.85rem" }}
                >
                  {isPending ? "Saving..." : "Save Dish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="menu-modal-backdrop">
          <div className="menu-modal-window" style={{ maxWidth: 440 }}>
            <div className="menu-modal-header">
              <h3>Table QR Code Generator</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="menu-modal-close"
              >
                ✕
              </button>
            </div>
            <div className="menu-modal-form">
              <p style={{ fontSize: "0.85rem", color: "var(--ink-3, #64748b)", margin: 0 }}>
                Generate QR codes for table stands or print menus. When customers scan, they see the menu
                and can order directly via WhatsApp or call.
              </p>

              <div className="modal-field">
                <label>Table Number (Optional)</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => handleTableNumberChange(e.target.value)}
                  placeholder="e.g. 5 or Booth A (leave blank for universal QR)"
                />
              </div>

              {/* QR Preview */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                {qrPreviewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrPreviewUrl}
                    alt="Menu QR Code"
                    style={{ width: 180, height: 180, borderRadius: 8, background: "#fff", padding: 8, border: "1px solid #e2e8f0" }}
                  />
                ) : (
                  <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                    Generating QR...
                  </div>
                )}
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                    {tableNumber.trim() ? `Table ${tableNumber.trim()}` : "Universal Restaurant Menu"}
                  </span>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "2px 0 0", wordBreak: "break-all" }}>{qrTargetUrl}</p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 6 }}>
                <a
                  href={qrPreviewUrl ?? "#"}
                  download={`menu-qr${tableNumber ? `-table-${tableNumber}` : ""}.png`}
                  className="menu-btn-secondary"
                  style={{ padding: "8px 12px", fontSize: "0.8rem", textAlign: "center" }}
                >
                  ⬇️ Download PNG
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (!qrSvg) return;
                    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `menu-qr${tableNumber ? `-table-${tableNumber}` : ""}.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="menu-btn-secondary"
                  style={{ padding: "8px 12px", fontSize: "0.8rem", textAlign: "center" }}
                >
                  🖨️ Download SVG
                </button>
              </div>
              <div style={{ textAlign: "center", paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrTargetUrl);
                    alert("Copied menu link to clipboard!");
                  }}
                  style={{ background: "none", border: "none", color: "#059669", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}
                >
                  📋 Copy Menu Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
