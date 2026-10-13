/**
 * English and Bangla UI text. Pure functions only (no server APIs), so client components can import this too.
 * The shopper's choice lives in a cookie; the store's locale is the default.
 * Product names switch to titleBn when there is one. Keep both languages short and plain.
 */
export type Lang = "en" | "bn";

const en = {
  // header, nav, footer
  menu: "Menu", search: "Search", searchPlaceholder: "Search products", account: "Account", cart: "Cart", cartItems: "Cart, {n} items",
  newArrivals: "New arrivals", all: "All products", sale: "Sale", home: "Home", shop: "Shop", help: "Help", delivery: "Delivery",
  exchange: "Exchange", contact: "Contact", poweredBy: "Powered by BizTrackBD", sisterOf: "a sister concern of", switchLang: "বাংলা",
  // home
  viewAll: "View all", shopByCategory: "Shop by category", sizeGuide: "Size guide",
  trustCodT: "Cash on delivery", trustCodS: "Pay when your parcel arrives.",
  trustMfsT: "bKash and Nagad", trustMfsS: "Pay now and we confirm in 2 hours.",
  trustDeliveryT: "1 to 4 day delivery", trustDeliveryS: "Inside Dhaka in 1 to 2 days.",
  trustExchangeT: "Easy size exchange", trustExchangeS: "Within 7 days of delivery.",
  // product
  inStock: "In stock", soldOut: "Sold out", onlyLeft: "Only {n} left in size {size}", size: "Size", option: "Option", quantity: "Quantity",
  save: "Save {amount}", addToCart: "Add to cart", buyNow: "Buy now", added: "Added to your cart", viewCart: "View cart", description: "Description",
  reviews: "{n} reviews", noReviews: "No reviews yet", goesWith: "Goes well with", chooseSize: "Choose a size",
  assureDeliveryT: "Delivery in 1 to 2 days", assureDeliveryS: "inside Dhaka. 3 to 4 days outside Dhaka.",
  assurePayT: "Pay your way", assurePayS: "Cash on delivery, bKash or Nagad",
  assureExchangeT: "7-day size exchange", assureExchangeS: "Free exchange if it does not fit",
  // listing
  sortBy: "Sort by", sortNewest: "Newest", sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low",
  noProducts: "No products found.", resultsFor: "Results for “{q}”", previous: "Previous", next: "Next", page: "Page {n} of {total}",
  // cart
  yourCart: "Your cart", cartEmpty: "Your cart is empty.", continueShopping: "Continue shopping", remove: "Remove", subtotal: "Subtotal",
  deliveryFee: "Delivery", free: "Free", discount: "Discount", total: "Total", checkout: "Checkout", deliveryAtCheckout: "Added at checkout",
  freeDeliveryAway: "Add {amount} more for free delivery", freeDeliveryGot: "You get free delivery", itemUnavailable: "No longer available",
  itemLowStock: "Only {n} left", updatingPrices: "Updating prices…",
  // checkout
  showSummary: "Show order summary ({n} items)", hideSummary: "Hide order summary", contactSection: "Contact", mobileNumber: "Mobile number", fullName: "Full name",
  email: "Email", optional: "(optional)", deliveryAddress: "Delivery address", division: "Division", district: "District", upazila: "Upazila or thana",
  houseRoad: "House, road and area", note: "Note for delivery", deliverySection: "Delivery", arrives: "Arrives in {min} to {max} days", paymentSection: "Payment",
  cod: "Cash on delivery", codS: "Pay the courier when it arrives", bkash: "bKash", nagad: "Nagad", mfsS: "Send money, then enter the TrxID",
  mfsStep1: "Open {app} and choose Send Money", mfsStep2: "Send {amount} to {number}", mfsStep3: "Enter the TrxID from the SMS below",
  mfsAgent: "This is an agent number: use Cash Out, not Send Money.", mfsNumberMissing: "This store has not set up {app} yet. Choose another way to pay.",
  yourMfsNumber: "Your {app} number", trxId: "TrxID", mfsConfirm: "We confirm your payment within 2 hours and send an SMS.",
  couponCode: "Coupon code", apply: "Apply", couponApplied: "Coupon {code} applied", placeOrder: "Place order", placing: "Placing order…",
  chooseOne: "Choose…", orderTotal: "Total", orderFailed: "Something went wrong. Your order was not placed. Please try again.",
  deliversEverywhere: "We deliver across Bangladesh.", noDelivery: "We do not deliver to that district yet.",
  // success
  thanks: "Thank you, {name}", orderPlaced: "Your order {number} is placed.", sentDetails: "We sent the details to {phone}.",
  checkingPayment: "We are checking your payment", checkingPaymentS: "TrxID {trx} for {amount}. You will get an SMS within 2 hours when it is confirmed. We pack your order after that.",
  codSuccess: "Pay {amount} in cash when it arrives.", deliveryTo: "Delivery to {place}", expectedDelivery: "Expected delivery", trackOrder: "Track my order", callToConfirm: "We will call you to confirm your order.",
  // account
  myOrders: "My orders", signIn: "Sign in", signInS: "Enter your mobile number. We will text you a code.", sendCode: "Send code", enterCode: "Enter the 6-digit code",
  codeSentTo: "We sent a code to {phone}.", verify: "Verify", useOtherNumber: "Use a different number", signOut: "Sign out", noOrders: "You have not placed any orders yet.",
  viewDetails: "View details", contactStore: "Contact store", itemsN: "{n} items",
  // status
  st_PENDING: "Placed", st_CONFIRMED: "Confirmed", st_PROCESSING: "Packing", st_SHIPPED: "On the way", st_DELIVERED: "Delivered", st_CANCELLED: "Cancelled", st_RETURNED: "Returned", st_REFUNDED: "Refunded",
  pay_PENDING_VERIFICATION: "Checking payment", pay_PAID: "Paid", pay_UNPAID: "Pay on delivery",
  // offline / errors
  offlineTitle: "We are taking a short break", offlineText: "Orders are paused for now. Please check back soon, or message us and we will help you directly.",
  pausedBanner: "We are taking a short break: orders are paused for now. You can still look around.", callUs: "Call {phone}", whatsapp: "Message on WhatsApp", facebook: "Visit our Facebook page", notFound: "Page not found", notFoundS: "We could not find what you were looking for.",
  rateLimited: "Too many tries. Please wait a few minutes and try again.",
  reviewsTitle: "Reviews", reviewsAverage: "{avg} out of 5", verifiedBuyer: "Verified buyer", storeReply: "Reply from the store",
  rateYourItems: "Review your items", writeReview: "Write a review", yourRating: "Your rating", reviewTitleOpt: "Headline (optional)", reviewBody: "Your review",
  submitReview: "Submit review", reviewThanks: "Thank you. Your review is live.", reviewThanksPending: "Thank you. Your review will appear after the store has read it.", alreadyReviewed: "You reviewed this",
  reviewFailed: "We could not save your review.", starsN: "{n} stars",
  blog: "Blog", readMore: "Read more", noPosts: "No posts yet.", writtenBy: "By {name}", backToBlog: "All posts", pagesLabel: "Information",
  memberDiscounts: "Member discounts", rewardsTitle: "Reward points", pointsCount: "{n} points", pointsWorth: "worth ৳{v}", pointsPendingN: "{n} more points unlock when your orders are delivered", tierMember: "{tier} member", tierProgress: "Spend ৳{n} more over the next 12 months to reach {next}", tierTop: "You are at our top level", tierPerks: "Your benefits", perkMultiplier: "{x}x reward points", perkDiscount: "{p}% off every order", perkFreeDelivery: "Free delivery everywhere", pointsHistory: "Points history", ledgerEarn: "Earned", ledgerRedeem: "Used", ledgerBonus: "Friend bonus", ledgerManual: "Adjustment", ledgerPending: "waiting for delivery", ledgerVoided: "cancelled", ledgerEmpty: "No points yet. They arrive when an order is delivered.", referTitle: "Refer a friend", referText: "Your friend gets ৳{d} off their first order, and you get {p} points when it is delivered.", shareWhatsapp: "Share on WhatsApp", copyLink: "Copy link", copied: "Copied", yourReferralLink: "Your link", referBanner: "{name} gave you ৳{d} off your first order. It is added at checkout.", referApplied: "Friend's offer applied", referCodeLabel: "Referral code", usePoints: "Use reward points", usePointsHint: "You have {n} points (worth ৳{v})", pointsDiscountLine: "Points discount", vipDiscountLine: "VIP discount", referralDiscountLine: "Friend's offer", signInForPoints: "Sign in to use your reward points and VIP benefits", signInLink: "Sign in", pointsMax: "Up to {n} points on this order", ledgerExpired: "Expired", expiryNote: "Points expire after {m} months with no activity. Any order resets the clock.", birthdayTitle: "Your birthday", birthdayText: "Tell us once and get a ৳{v} voucher every year (Silver level and above).", birthdayMonth: "Month", birthdayDay: "Day", birthdaySave: "Save birthday", birthdaySaved: "Birthday saved: {d}", birthdayBad: "Choose a real date.", birthdayOnce: "It can be saved once. Ask the store to change it.",
  previewOrderForm: "The order form appears here.", lpOrderName: "Your name", lpRibbon: "Pay when it arrives. Nothing to pay now", lpLeadNote: "If you do not finish, we keep your name and number for 30 days so the seller can call you.", lpDays: "days", lpHours: "hours", lpMinutes: "min", lpSeconds: "sec", lpOrderOffer: "Choose your offer", lpOrderSave: "You save", lpOrderBump: "Add to my order", lpOrderPcs: "pcs", lpOrderPhone: "Mobile number", lpOrderAddress: "Full address", lpOrderDivision: "Division", lpOrderDistrict: "District", lpOrderQty: "Quantity", lpOrderOption: "Option", lpOrderTotal: "Pay on delivery", lpOrderChoose: "Choose", lpOrderSubmit: "Place my order", lpOrderSending: "Placing your order…", lpOrderNote: "You pay when the parcel arrives.",
} as const;

export type Key = keyof typeof en;

const bn: Record<Key, string> = {
  menu: "মেনু", search: "খুঁজুন", searchPlaceholder: "পণ্য খুঁজুন", account: "অ্যাকাউন্ট", cart: "কার্ট", cartItems: "কার্ট, {n}টি পণ্য",
  newArrivals: "নতুন পণ্য", all: "সব পণ্য", sale: "ছাড়", home: "হোম", shop: "দোকান", help: "সাহায্য", delivery: "ডেলিভারি",
  exchange: "বদল", contact: "যোগাযোগ", poweredBy: "BizTrackBD দ্বারা চালিত", sisterOf: "সহযোগী প্রতিষ্ঠান:", switchLang: "English",
  viewAll: "সব দেখুন", shopByCategory: "ক্যাটাগরি অনুযায়ী কিনুন", sizeGuide: "সাইজ গাইড",
  trustCodT: "ক্যাশ অন ডেলিভারি", trustCodS: "পার্সেল হাতে পেয়ে টাকা দিন।",
  trustMfsT: "বিকাশ ও নগদ", trustMfsS: "এখনই দিন, ২ ঘণ্টার মধ্যে নিশ্চিত করি।",
  trustDeliveryT: "১ থেকে ৪ দিনে ডেলিভারি", trustDeliveryS: "ঢাকার ভেতরে ১ থেকে ২ দিনে।",
  trustExchangeT: "সহজ সাইজ বদল", trustExchangeS: "ডেলিভারির ৭ দিনের মধ্যে।",
  inStock: "স্টকে আছে", soldOut: "শেষ", onlyLeft: "{size} সাইজে মাত্র {n}টি আছে", size: "সাইজ", option: "অপশন", quantity: "পরিমাণ",
  save: "{amount} সাশ্রয়", addToCart: "কার্টে যোগ করুন", buyNow: "এখনই কিনুন", added: "কার্টে যোগ হয়েছে", viewCart: "কার্ট দেখুন", description: "বিবরণ",
  reviews: "{n}টি রিভিউ", noReviews: "এখনও কোনো রিভিউ নেই", goesWith: "এর সাথে মানানসই", chooseSize: "সাইজ বেছে নিন",
  assureDeliveryT: "১ থেকে ২ দিনে ডেলিভারি", assureDeliveryS: "ঢাকার ভেতরে। ঢাকার বাইরে ৩ থেকে ৪ দিন।",
  assurePayT: "পছন্দমতো দাম দিন", assurePayS: "ক্যাশ অন ডেলিভারি, বিকাশ বা নগদ",
  assureExchangeT: "৭ দিনে সাইজ বদল", assureExchangeS: "মাপ না মিললে বিনা খরচে বদল",
  sortBy: "সাজান", sortNewest: "নতুন আগে", sortPriceAsc: "দাম: কম থেকে বেশি", sortPriceDesc: "দাম: বেশি থেকে কম",
  noProducts: "কোনো পণ্য পাওয়া যায়নি।", resultsFor: "“{q}” এর ফলাফল", previous: "আগের", next: "পরের", page: "পৃষ্ঠা {n} / {total}",
  yourCart: "আপনার কার্ট", cartEmpty: "আপনার কার্ট খালি।", continueShopping: "কেনাকাটা চালিয়ে যান", remove: "সরান", subtotal: "পণ্যের দাম",
  deliveryFee: "ডেলিভারি", free: "ফ্রি", discount: "ছাড়", total: "মোট", checkout: "চেকআউট", deliveryAtCheckout: "চেকআউটে যোগ হবে",
  freeDeliveryAway: "ফ্রি ডেলিভারির জন্য আরও {amount} যোগ করুন", freeDeliveryGot: "আপনি ফ্রি ডেলিভারি পাচ্ছেন", itemUnavailable: "আর পাওয়া যাচ্ছে না",
  itemLowStock: "মাত্র {n}টি আছে", updatingPrices: "দাম হালনাগাদ হচ্ছে…",
  showSummary: "অর্ডারের সারাংশ দেখুন ({n}টি পণ্য)", hideSummary: "সারাংশ লুকান", contactSection: "যোগাযোগ", mobileNumber: "মোবাইল নম্বর", fullName: "পুরো নাম",
  email: "ইমেইল", optional: "(ঐচ্ছিক)", deliveryAddress: "ডেলিভারির ঠিকানা", division: "বিভাগ", district: "জেলা", upazila: "উপজেলা বা থানা",
  houseRoad: "বাড়ি, রাস্তা ও এলাকা", note: "ডেলিভারির জন্য নোট", deliverySection: "ডেলিভারি", arrives: "{min} থেকে {max} দিনে পৌঁছাবে", paymentSection: "পেমেন্ট",
  cod: "ক্যাশ অন ডেলিভারি", codS: "কুরিয়ার এলে তাকে টাকা দিন", bkash: "বিকাশ", nagad: "নগদ", mfsS: "সেন্ড মানি করে TrxID লিখুন",
  mfsStep1: "{app} খুলে সেন্ড মানি বেছে নিন", mfsStep2: "{number} নম্বরে {amount} পাঠান", mfsStep3: "নিচে SMS থেকে TrxID লিখুন",
  mfsAgent: "এটি এজেন্ট নম্বর: সেন্ড মানি নয়, ক্যাশ আউট করুন।", mfsNumberMissing: "এই দোকান এখনও {app} চালু করেনি। অন্য উপায়ে দাম দিন।",
  yourMfsNumber: "আপনার {app} নম্বর", trxId: "TrxID", mfsConfirm: "২ ঘণ্টার মধ্যে পেমেন্ট নিশ্চিত করে SMS পাঠাব।",
  couponCode: "কুপন কোড", apply: "প্রয়োগ", couponApplied: "কুপন {code} প্রয়োগ হয়েছে", placeOrder: "অর্ডার করুন", placing: "অর্ডার হচ্ছে…",
  chooseOne: "বেছে নিন…", orderTotal: "মোট", orderFailed: "কিছু একটা ভুল হয়েছে। আপনার অর্ডার হয়নি। আবার চেষ্টা করুন।",
  deliversEverywhere: "আমরা সারা বাংলাদেশে ডেলিভারি দিই।", noDelivery: "ওই জেলায় এখনও ডেলিভারি দিই না।",
  thanks: "ধন্যবাদ, {name}", orderPlaced: "আপনার অর্ডার {number} হয়েছে।", sentDetails: "বিস্তারিত {phone} নম্বরে পাঠানো হয়েছে।",
  checkingPayment: "আমরা আপনার পেমেন্ট যাচাই করছি", checkingPaymentS: "{amount} এর TrxID {trx}। নিশ্চিত হলে ২ ঘণ্টার মধ্যে SMS পাবেন। তারপর আমরা প্যাক করব।",
  codSuccess: "পণ্য হাতে পেয়ে {amount} নগদ দিন।", deliveryTo: "ডেলিভারি: {place}", expectedDelivery: "সম্ভাব্য ডেলিভারি", trackOrder: "অর্ডার ট্র্যাক করুন", callToConfirm: "অর্ডার নিশ্চিত করতে আমরা ফোন করব।",
  myOrders: "আমার অর্ডার", signIn: "সাইন ইন", signInS: "মোবাইল নম্বর দিন। আমরা একটি কোড পাঠাব।", sendCode: "কোড পাঠান", enterCode: "৬ অঙ্কের কোড লিখুন",
  codeSentTo: "{phone} নম্বরে কোড পাঠানো হয়েছে।", verify: "যাচাই করুন", useOtherNumber: "অন্য নম্বর ব্যবহার করুন", signOut: "সাইন আউট", noOrders: "আপনি এখনও কোনো অর্ডার করেননি।",
  viewDetails: "বিস্তারিত দেখুন", contactStore: "দোকানে যোগাযোগ", itemsN: "{n}টি পণ্য",
  st_PENDING: "অর্ডার হয়েছে", st_CONFIRMED: "নিশ্চিত", st_PROCESSING: "প্যাক হচ্ছে", st_SHIPPED: "পথে আছে", st_DELIVERED: "পৌঁছেছে", st_CANCELLED: "বাতিল", st_RETURNED: "ফেরত", st_REFUNDED: "টাকা ফেরত",
  pay_PENDING_VERIFICATION: "পেমেন্ট যাচাই চলছে", pay_PAID: "পরিশোধিত", pay_UNPAID: "ডেলিভারিতে দেবেন",
  offlineTitle: "আমরা অল্প সময়ের বিরতিতে আছি", offlineText: "এখন অর্ডার বন্ধ আছে। একটু পরে আবার দেখুন, অথবা আমাদের মেসেজ করুন, সরাসরি সাহায্য করব।",
  pausedBanner: "আমরা অল্প সময়ের বিরতিতে আছি: এখন অর্ডার বন্ধ আছে। আপনি পণ্য দেখতে পারেন।",
  callUs: "ফোন করুন {phone}", whatsapp: "হোয়াটসঅ্যাপে মেসেজ করুন", facebook: "আমাদের ফেসবুক পেজ", notFound: "পাতা পাওয়া যায়নি", notFoundS: "আপনি যা খুঁজছেন তা পাইনি।",
  rateLimited: "অনেকবার চেষ্টা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।",
  reviewsTitle: "রিভিউ", reviewsAverage: "৫ এর মধ্যে {avg}", verifiedBuyer: "যাচাইকৃত ক্রেতা", storeReply: "দোকানের উত্তর",
  rateYourItems: "আপনার পণ্যের রিভিউ দিন", writeReview: "রিভিউ লিখুন", yourRating: "আপনার রেটিং", reviewTitleOpt: "শিরোনাম (ঐচ্ছিক)", reviewBody: "আপনার রিভিউ",
  submitReview: "রিভিউ পাঠান", reviewThanks: "ধন্যবাদ। আপনার রিভিউ প্রকাশিত হয়েছে।", reviewThanksPending: "ধন্যবাদ। দোকান দেখে নেওয়ার পর রিভিউটি প্রকাশিত হবে।", alreadyReviewed: "আপনি রিভিউ দিয়েছেন",
  reviewFailed: "রিভিউ সংরক্ষণ করা যায়নি।", starsN: "{n} তারা",
  blog: "ব্লগ", readMore: "আরও পড়ুন", noPosts: "এখনো কোনো পোস্ট নেই।", writtenBy: "লেখক: {name}", backToBlog: "সব পোস্ট", pagesLabel: "তথ্য",
  memberDiscounts: "মেম্বার ছাড়", rewardsTitle: "রিওয়ার্ড পয়েন্ট", pointsCount: "{n} পয়েন্ট", pointsWorth: "মূল্য ৳{v}", pointsPendingN: "আরও {n} পয়েন্ট অর্ডার পৌঁছালে যোগ হবে", tierMember: "{tier} মেম্বার", tierProgress: "{next} হতে আগামী ১২ মাসে আরও ৳{n} কিনুন", tierTop: "আপনি সর্বোচ্চ স্তরে আছেন", tierPerks: "আপনার সুবিধা", perkMultiplier: "{x}x রিওয়ার্ড পয়েন্ট", perkDiscount: "প্রতি অর্ডারে {p}% ছাড়", perkFreeDelivery: "সারা দেশে ফ্রি ডেলিভারি", pointsHistory: "পয়েন্টের হিসাব", ledgerEarn: "অর্জিত", ledgerRedeem: "ব্যবহৃত", ledgerBonus: "বন্ধুর বোনাস", ledgerManual: "সমন্বয়", ledgerPending: "ডেলিভারির অপেক্ষায়", ledgerVoided: "বাতিল", ledgerEmpty: "এখনো কোনো পয়েন্ট নেই। অর্ডার পৌঁছালে পয়েন্ট যোগ হবে।", referTitle: "বন্ধুকে রেফার করুন", referText: "আপনার বন্ধু প্রথম অর্ডারে ৳{d} ছাড় পাবেন, আর অর্ডার পৌঁছালে আপনি পাবেন {p} পয়েন্ট।", shareWhatsapp: "হোয়াটসঅ্যাপে শেয়ার", copyLink: "লিংক কপি", copied: "কপি হয়েছে", yourReferralLink: "আপনার লিংক", referBanner: "{name} আপনাকে প্রথম অর্ডারে ৳{d} ছাড় উপহার দিয়েছেন। চেকআউটে যোগ হবে।", referApplied: "বন্ধুর অফার যোগ হয়েছে", referCodeLabel: "রেফারেল কোড", usePoints: "রিওয়ার্ড পয়েন্ট ব্যবহার করুন", usePointsHint: "আপনার {n} পয়েন্ট আছে (মূল্য ৳{v})", pointsDiscountLine: "পয়েন্ট ছাড়", vipDiscountLine: "ভিআইপি ছাড়", referralDiscountLine: "বন্ধুর অফার", signInForPoints: "রিওয়ার্ড পয়েন্ট ও ভিআইপি সুবিধা পেতে সাইন ইন করুন", signInLink: "সাইন ইন", pointsMax: "এই অর্ডারে সর্বোচ্চ {n} পয়েন্ট", ledgerExpired: "মেয়াদ শেষ", expiryNote: "{m} মাস কোনো কেনাকাটা না করলে পয়েন্টের মেয়াদ শেষ হয়। যেকোনো অর্ডারে সময় নতুন করে শুরু হয়।", birthdayTitle: "আপনার জন্মদিন", birthdayText: "একবার জানান, প্রতি বছর পাবেন ৳{v} ভাউচার (সিলভার ও তার উপরের স্তরে)।", birthdayMonth: "মাস", birthdayDay: "দিন", birthdaySave: "জন্মদিন সংরক্ষণ", birthdaySaved: "জন্মদিন সংরক্ষিত: {d}", birthdayBad: "সঠিক তারিখ দিন।", birthdayOnce: "একবারই সংরক্ষণ করা যায়। বদলাতে দোকানকে জানান।",
  previewOrderForm: "এখানে অর্ডার ফর্ম দেখা যাবে।", lpOrderName: "আপনার নাম", lpRibbon: "হাতে পেয়ে টাকা দিন। এখন কিছু লাগবে না", lpLeadNote: "অর্ডার শেষ না করলে ৩০ দিন আপনার নাম ও নম্বর রাখা হবে, যাতে বিক্রেতা ফোন করতে পারেন।", lpDays: "দিন", lpHours: "ঘণ্টা", lpMinutes: "মিনিট", lpSeconds: "সেকেন্ড", lpOrderOffer: "আপনার অফার বেছে নিন", lpOrderSave: "আপনি বাঁচাচ্ছেন", lpOrderBump: "আমার অর্ডারে যোগ করুন", lpOrderPcs: "টি", lpOrderPhone: "মোবাইল নম্বর", lpOrderAddress: "পূর্ণ ঠিকানা", lpOrderDivision: "বিভাগ", lpOrderDistrict: "জেলা", lpOrderQty: "পরিমাণ", lpOrderOption: "অপশন", lpOrderTotal: "হাতে পেয়ে দিন", lpOrderChoose: "বেছে নিন", lpOrderSubmit: "অর্ডার করুন", lpOrderSending: "অর্ডার হচ্ছে…", lpOrderNote: "পার্সেল হাতে পেয়ে টাকা দিন।",
};

const DICT = { en, bn } as const;

export function translate(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  const s: string = DICT[lang][key] ?? en[key];
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  return (key, vars) => translate(lang, key, vars);
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]!);

/** ৳ 1,150 in English, ৳ ১,১৫০ in Bangla. */
export function money(n: number, lang: Lang): string {
  const s = Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `৳ ${lang === "bn" ? toBnDigits(s) : s}`;
}

export const num = (n: number | string, lang: Lang) => (lang === "bn" ? toBnDigits(String(n)) : String(n));

export const productTitle = (lang: Lang, title: string, titleBn: string | null) => (lang === "bn" && titleBn ? titleBn : title);

/** Picks translated strings (still containing {placeholders}) to hand to a client component. */
export function pickStrings<K extends Key>(lang: Lang, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, DICT[lang][k] ?? en[k]])) as Record<K, string>;
}

/** Fills {placeholders} in a string from pickStrings. */
export function fmt(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
