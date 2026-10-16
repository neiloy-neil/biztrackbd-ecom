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
}: {
  initialCategories: PublicMenuCategory[];
  storeOrigin: string;
}) {
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Restaurant Menu</h1>
          <p className="text-sm text-slate-600 mt-1">
            Organize menu categories, dish availability, and generate contactless table QR codes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openQrModal("")}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <span>📱</span> Table QR Codes
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            + Add Category
          </button>
          <button
            type="button"
            disabled={categories.length === 0}
            onClick={() => {
              setEditingDish(null);
              setDishCategoryId(categories[0]?.id ?? "");
              setShowDishModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            + Add Dish
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryId("all")}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition whitespace-nowrap ${
              activeCategoryId === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Categories ({totalDishes})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategoryId(c.id)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition whitespace-nowrap ${
                activeCategoryId === c.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {c.name} {c.nameBn ? `(${c.nameBn})` : ""} ({c.items.length})
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-600 font-medium">No menu categories yet.</p>
          <p className="text-slate-500 text-sm mt-1">
            Create your first category (e.g. Starters, Main Dishes, Drinks) to start listing dishes.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
          >
            + Create First Category
          </button>
        </div>
      )}

      {/* Category & Dishes List */}
      <div className="space-y-8">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  {cat.name} {cat.nameBn && <span className="text-slate-500 font-normal">({cat.nameBn})</span>}
                </h3>
                {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDish(null);
                    setDishCategoryId(cat.id);
                    setShowDishModal(true);
                  }}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 transition"
                >
                  + Add Dish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(cat);
                    setShowCategoryModal(true);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded hover:bg-slate-200 transition"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded hover:bg-rose-50 transition"
                >
                  Delete
                </button>
              </div>
            </div>

            {cat.items.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No dishes in this category yet. Click &quot;+ Add Dish&quot; to add one.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cat.items.map((dish) => (
                  <div
                    key={dish.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      dish.isAvailable ? "hover:bg-slate-50/50" : "bg-slate-50/80 opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {dish.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={dish.imageUrl}
                          alt={dish.name}
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0">
                          🍽️
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{dish.name}</span>
                          {dish.nameBn && <span className="text-slate-500 text-xs">({dish.nameBn})</span>}
                          {dish.dietaryLabels.map((lbl) => (
                            <span
                              key={lbl}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60"
                            >
                              {lbl.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                        {dish.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dish.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold text-slate-900 text-sm">৳{dish.price}</span>
                          {dish.compareAtPrice && (
                            <span className="text-xs text-slate-400 line-through">
                              ৳{dish.compareAtPrice}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {/* Availability Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(dish)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          dish.isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                        title="Click to toggle Available vs Sold Out"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            dish.isAvailable ? "bg-emerald-500" : "bg-rose-500"
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
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDish(dish)}
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition"
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

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900">
              {editingCategory ? "Edit Category" : "New Category"}
            </h3>
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
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category Name (English) *
                </label>
                <input
                  name="name"
                  defaultValue={editingCategory?.name ?? ""}
                  placeholder="e.g. Starters / Appetizers"
                  required
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  বাংলা নাম (ঐচ্ছিক)
                </label>
                <input
                  name="nameBn"
                  defaultValue={editingCategory?.nameBn ?? ""}
                  placeholder="যেমন: স্টার্টার ও স্যুপ"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description / বর্ণনা
                </label>
                <textarea
                  name="description"
                  defaultValue={editingCategory?.description ?? ""}
                  rows={2}
                  placeholder="Short note about these dishes"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-slate-900">
              {editingDish ? "Edit Dish" : "Add New Dish"}
            </h3>
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
                  });
                  if (res.ok) {
                    setShowDishModal(false);
                    // Update in-memory categories state
                    setCategories((prev) =>
                      prev.map((c) => {
                        // Remove from old category if category changed
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
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
                <select
                  name="categoryId"
                  defaultValue={dishCategoryId}
                  required
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.nameBn ? `(${c.nameBn})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dish Name (English) *
                  </label>
                  <input
                    name="name"
                    defaultValue={editingDish?.name ?? ""}
                    placeholder="e.g. Beef Bhuna Khichuri"
                    required
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    বাংলা নাম (ঐচ্ছিক)
                  </label>
                  <input
                    name="nameBn"
                    defaultValue={editingDish?.nameBn ?? ""}
                    placeholder="যেমন: বিফ ভুনা খিচুড়ি"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price (৳) *</label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={editingDish?.price ?? ""}
                    placeholder="350"
                    required
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Regular / Compare Price (৳)
                  </label>
                  <input
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    defaultValue={editingDish?.compareAtPrice ?? ""}
                    placeholder="400"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Image URL</label>
                <input
                  name="imageUrl"
                  type="url"
                  defaultValue={editingDish?.imageUrl ?? ""}
                  placeholder="https://... or upload from media"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description / Ingredients
                </label>
                <textarea
                  name="description"
                  defaultValue={editingDish?.description ?? ""}
                  rows={2}
                  placeholder="Chinigura rice, tender shank beef, mustard oil, aromatic spices"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Dietary Badges & Labels
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DIETARY_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name={`diet_${opt.id}`}
                        defaultChecked={editingDish?.dietaryLabels?.includes(opt.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDishModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Table QR Code Generator</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Generate QR codes for table stands or print menus. When customers scan, they see the menu
              and can order directly via WhatsApp or call.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Table Number (Optional)
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => handleTableNumberChange(e.target.value)}
                placeholder="e.g. 5 or Booth A (leave blank for universal QR)"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* QR Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              {qrPreviewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrPreviewUrl}
                  alt="Menu QR Code"
                  className="w-48 h-48 rounded-lg shadow-sm bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-sm text-slate-400">
                  Generating QR...
                </div>
              )}
              <div className="mt-2 text-center">
                <span className="text-xs font-semibold text-slate-900">
                  {tableNumber.trim() ? `Table ${tableNumber.trim()}` : "Universal Restaurant Menu"}
                </span>
                <p className="text-[11px] text-slate-500 truncate max-w-xs">{qrTargetUrl}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={qrPreviewUrl ?? "#"}
                download={`menu-qr${tableNumber ? `-table-${tableNumber}` : ""}.png`}
                className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
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
                className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                🖨️ Download Vector SVG
              </button>
            </div>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrTargetUrl);
                  alert("Copied menu link to clipboard!");
                }}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                📋 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
