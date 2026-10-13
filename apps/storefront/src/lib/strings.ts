// Translation keys each client component needs. Kept out of the "use client" files: a server page that imports a
// non-component export from a client module receives a client reference, not the array.

export const CART_STRINGS = [
  "yourCart", "cartEmpty", "continueShopping", "remove", "subtotal", "deliveryFee", "deliveryAtCheckout", "total", "checkout",
  "freeDeliveryAway", "freeDeliveryGot", "itemUnavailable", "itemLowStock", "updatingPrices", "quantity", "free", "discount",
] as const;

export const CHECKOUT_STRINGS = [
  "contactSection", "mobileNumber", "fullName", "email", "optional", "deliveryAddress", "division", "district", "upazila", "houseRoad", "note",
  "deliverySection", "arrives", "paymentSection", "cod", "codS", "bkash", "nagad", "mfsS", "mfsStep1", "mfsStep2", "mfsStep3", "mfsAgent",
  "mfsNumberMissing", "yourMfsNumber", "trxId", "mfsConfirm", "couponCode", "apply", "couponApplied", "placeOrder", "placing", "chooseOne",
  "orderFailed", "showSummary", "hideSummary", "subtotal", "deliveryFee", "free", "discount", "total", "deliversEverywhere", "cartEmpty",
  "continueShopping", "yourCart", "deliveryAtCheckout", "itemUnavailable", "itemLowStock", "updatingPrices", "freeDeliveryAway", "quantity",
] as const;

/** The words the checkout needs for points, the VIP discount and a friend's offer. */
export const LOYALTY_STRINGS = ["usePoints", "usePointsHint", "pointsDiscountLine", "vipDiscountLine", "referralDiscountLine", "signInForPoints", "signInLink", "pointsMax", "referApplied", "referCodeLabel", "apply", "memberDiscounts"] as const;

export const LOGIN_STRINGS = ["signIn", "signInS", "mobileNumber", "sendCode", "enterCode", "codeSentTo", "verify", "useOtherNumber"] as const;

/** The words the landing page order form needs, picked on the server (a function cannot be handed to a client component). */
export const LP_FORM_KEYS = ["lpOrderName", "lpLeadNote", "lpOrderOffer", "lpOrderSave", "lpOrderBump", "lpOrderPcs", "lpOrderPhone", "lpOrderAddress", "lpOrderDivision", "lpOrderDistrict", "lpOrderQty", "lpOrderOption", "lpOrderTotal", "lpOrderChoose", "lpOrderSubmit", "lpOrderSending", "lpOrderNote", "soldOut"] as const;
