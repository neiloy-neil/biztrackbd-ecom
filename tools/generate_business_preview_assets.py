"""
Generates crisp, high-fidelity WebP template preview assets for BizTrackBD Business & Portfolio templates:
- Desktop: 960x600
- Phone: 390x844
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "apps", "marketing", "public", "templates")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Fonts
FONT_BOLD_PATH = "C:/Windows/Fonts/segoeuib.ttf" if os.path.exists("C:/Windows/Fonts/segoeuib.ttf") else "C:/Windows/Fonts/arialbd.ttf"
FONT_REG_PATH = "C:/Windows/Fonts/segoeui.ttf" if os.path.exists("C:/Windows/Fonts/segoeui.ttf") else "C:/Windows/Fonts/arial.ttf"

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

TEMPLATES = [
    {
        "id": "dhaka-bistro",
        "name": "Dhaka Bistro",
        "tagline": "ARTISANAL BENGALI & CONTINENTAL DINING",
        "headline": "Authentic Flavors, Reimagined",
        "sub": "Handcrafted slow-cooked Kacchi, fresh seasonal catch, and signature desserts.",
        "top_announcement": "Dhaka Bistro • Dine-In, Takeout & Reserve a Table • Gulshan-2, Dhaka",
        "nav_links": ["Digital Menu", "Dishes & Combos", "Reservations", "Contact"],
        "cta_main": "Explore Digital Menu",
        "cta_sec": "Reserve a Table",
        "section_title": "Chef's Signature Dishes",
        "accent": "#D97706",
        "accent_text": "#FFFFFF",
        "bg_top": "#1C1917",
        "bg_body": "#FFFDF8",
        "card_bg": "#FFFFFF",
        "text_main": "#1C1917",
        "text_sub": "#78716C",
        "border_color": "#F5EBE1",
        "cards": [
            {"title": "Smoked Kacchi Biryani", "sub": "Slow cooked with baby goat & aromatic chinigura rice", "meta": "৳ 750", "badge": "Chef's Special", "badge_color": "#D97706"},
            {"title": "Mustard Ilish Steak", "sub": "Steamed Padma Hilsa in artisanal ground mustard oil", "meta": "৳ 920", "badge": "Seasonal", "badge_color": "#059669"},
            {"title": "Saffron Pistachio Firni", "sub": "Traditional earthen clay pot dessert with nuts", "meta": "৳ 280", "badge": "Dessert", "badge_color": "#B45309"},
            {"title": "Grilled Jumbo Prawn", "sub": "Charcoal grilled Bay of Bengal king prawn platter", "meta": "৳ 1,150", "badge": "Popular", "badge_color": "#DC2626"}
        ]
    },
    {
        "id": "modern-clinic",
        "name": "Modern Clinic & Chambers",
        "tagline": "BMDC VERIFIED SPECIALIST PRACTICE",
        "headline": "Prof. Dr. Mohammad Rahman",
        "sub": "MBBS, FCPS (Medicine), MD, FACP (USA) — Senior Consultant, Internal Medicine & Diabetes",
        "top_announcement": "BMDC Reg. A-24810 • Visiting Chambers: Popular (Dhanmondi) & Ibn Sina (Mirpur)",
        "nav_links": ["About Doctor", "Qualifications", "Chambers & Timings", "Appointment"],
        "cta_main": "Book Chamber Appointment",
        "cta_sec": "Visiting Schedule",
        "section_title": "Chambers & Visiting Schedules",
        "accent": "#0284C7",
        "accent_text": "#FFFFFF",
        "bg_top": "#0F172A",
        "bg_body": "#F8FAFC",
        "card_bg": "#FFFFFF",
        "text_main": "#0F172A",
        "text_sub": "#64748B",
        "border_color": "#E2E8F0",
        "cards": [
            {"title": "Popular Diagnostic Centre", "sub": "Room 408, Dhanmondi Branch • Sat - Wed: 5 PM - 9 PM", "meta": "Dhanmondi", "badge": "Chamber 1", "badge_color": "#0284C7"},
            {"title": "Ibn Sina Medical Complex", "sub": "House 48, Mirpur-10 • Thu & Fri: 6 PM - 9:30 PM", "meta": "Mirpur", "badge": "Chamber 2", "badge_color": "#0284C7"},
            {"title": "Comprehensive Health Review", "sub": "Full diagnostic assessment & prescription protocol", "meta": "৳ 1,500", "badge": "Consultation", "badge_color": "#10B981"},
            {"title": "Follow-Up & Report Desk", "sub": "Lab report verification within 14 calendar days", "meta": "৳ 800", "badge": "Follow-up", "badge_color": "#6366F1"}
        ]
    },
    {
        "id": "apex-corporate",
        "name": "Apex Corporate Advisory",
        "tagline": "STRATEGIC ENTERPRISE & LEGAL ADVISORY",
        "headline": "Trusted Counsel for Growth",
        "sub": "Navigating complex FDI regulations, corporate taxation, and joint ventures in Bangladesh.",
        "top_announcement": "Apex Corporate Advisory Ltd. • Strategic Business & Legal Counsel • Banani, Dhaka",
        "nav_links": ["Practice Areas", "Leadership", "Case Studies", "Insights"],
        "cta_main": "Explore Practice Areas",
        "cta_sec": "Download Profile (PDF)",
        "section_title": "Core Practice Areas",
        "accent": "#1E40AF",
        "accent_text": "#FFFFFF",
        "bg_top": "#1E293B",
        "bg_body": "#FFFFFF",
        "card_bg": "#F8FAFC",
        "text_main": "#0F172A",
        "text_sub": "#475569",
        "border_color": "#E2E8F0",
        "cards": [
            {"title": "Corporate Taxation & VAT Audit", "sub": "NBR compliance, transfer pricing, and statutory appeals", "meta": "Advisory", "badge": "Taxation", "badge_color": "#1E40AF"},
            {"title": "Foreign Direct Investment (FDI)", "sub": "BIDA approvals, RJSC company registration & setup", "meta": "Regulatory", "badge": "FDI Desk", "badge_color": "#2563EB"},
            {"title": "M&A and Joint Ventures", "sub": "Due diligence, commercial drafting & shareholder terms", "meta": "Transactions", "badge": "M&A", "badge_color": "#0D9488"},
            {"title": "Corporate Secretarial Governance", "sub": "Annual filings, compliance audits, and board resolutions", "meta": "Compliance", "badge": "Governance", "badge_color": "#475569"}
        ]
    },
    {
        "id": "local-service-pro",
        "name": "Local Service Pro",
        "tagline": "TRANSPARENT, FLAT-RATE SERVICES",
        "headline": "Professional AC, Electric & Plumbing",
        "sub": "Certified master technicians at your doorstep within 90 minutes anywhere in Dhaka.",
        "top_announcement": "Verified Technicians • 100% Satisfaction Guarantee • Dhaka Metro Coverage",
        "nav_links": ["Services", "Upfront Pricing", "Coverage Map", "Reviews"],
        "cta_main": "View Upfront Prices",
        "cta_sec": "WhatsApp Us Instantly",
        "section_title": "Popular Service Packages",
        "accent": "#0D9488",
        "accent_text": "#FFFFFF",
        "bg_top": "#134E4A",
        "bg_body": "#F0FDF4",
        "card_bg": "#FFFFFF",
        "text_main": "#111827",
        "text_sub": "#4B5563",
        "border_color": "#CCFBF1",
        "cards": [
            {"title": "Master AC Overhaul & Jet Wash", "sub": "Indoor & outdoor deep coil chemical cleanse", "meta": "৳ 1,200", "badge": "Best Seller", "badge_color": "#0D9488"},
            {"title": "Full Electrical Safety Audit", "sub": "Circuit inspection, earthing test & breaker check", "meta": "৳ 1,500", "badge": "Certified", "badge_color": "#0D9488"},
            {"title": "Plumbing Leak & Pipe Repair", "sub": "Concealed leak detection & sanitary fixture install", "meta": "৳ 800", "badge": "Same Day", "badge_color": "#0284C7"},
            {"title": "Commercial Facility Retainer", "sub": "Monthly maintenance protocol for corporate offices", "meta": "Custom Quote", "badge": "B2B Retainer", "badge_color": "#6366F1"}
        ]
    },
    {
        "id": "portfolio-focus",
        "name": "Naimul Kabir Portfolio",
        "tagline": "SENIOR PRODUCT DESIGNER & ARCHITECT",
        "headline": "Designing Systems that Scale",
        "sub": "Crafting intuitive, high-velocity fintech, commerce, and enterprise products in Bangladesh.",
        "top_announcement": "Available for Select Q4 Product Design & Architecture Engagements",
        "nav_links": ["Case Studies", "Tech Stack", "Experience", "Testimonials"],
        "cta_main": "View Featured Projects",
        "cta_sec": "Download CV (PDF)",
        "section_title": "Featured Case Studies",
        "accent": "#6366F1",
        "accent_text": "#FFFFFF",
        "bg_top": "#0F172A",
        "bg_body": "#1E1B4B",
        "card_bg": "#111827",
        "text_main": "#F8FAFC",
        "text_sub": "#94A3B8",
        "border_color": "#312E81",
        "cards": [
            {"title": "FinTech BDT Payment Rail", "sub": "High concurrency gateway routing 85k daily transactions", "meta": "Case Study", "badge": "Fintech", "badge_color": "#6366F1"},
            {"title": "Nationwide Courier Hub Engine", "sub": "Automated dispatch dispatcher for 64 districts in BD", "meta": "Logistics", "badge": "Next.js + Go", "badge_color": "#06B6D4"},
            {"title": "Telemedicine Specialist Portal", "sub": "Real-time queueing, prescriptions, and BMDC validation", "meta": "Healthcare", "badge": "React + Node", "badge_color": "#10B981"},
            {"title": "Bangla Design System & Typo", "sub": "Subsetting Hind Siliguri for 99+ PageSpeed performance", "meta": "Design System", "badge": "Figma + CSS", "badge_color": "#F59E0B"}
        ]
    },
    {
        "id": "public-profile",
        "name": "Syed Farhan Ahmed",
        "tagline": "AUTHOR, ECONOMIST & KEYNOTE SPEAKER",
        "headline": "Shaping the Dialogue on Growth",
        "sub": "Keynotes on emerging markets, digital economic infrastructure, and institutional governance.",
        "top_announcement": "New Bestselling Book 'Bangladesh 2030' Available in Bookstores Nationwide",
        "nav_links": ["Biography", "Books", "Keynote Speeches", "Press Kit"],
        "cta_main": "Invite for Keynote",
        "cta_sec": "Read Op-Eds & Articles",
        "section_title": "Keynote Topics & Publications",
        "accent": "#991B1B",
        "accent_text": "#FFFFFF",
        "bg_top": "#450A0A",
        "bg_body": "#FFFBEB",
        "card_bg": "#FFFFFF",
        "text_main": "#1C1917",
        "text_sub": "#78716C",
        "border_color": "#FDE68A",
        "cards": [
            {"title": "Bangladesh 2030: The Digital Leap", "sub": "Keynote speech at Asian Development Bank forum", "meta": "Book & Keynote", "badge": "Featured", "badge_color": "#991B1B"},
            {"title": "Digital Financial Inclusion & BDT Rails", "sub": "Published research on cashless rural commerce adoption", "meta": "Policy Paper", "badge": "Economics", "badge_color": "#B45309"},
            {"title": "Institutional Governance in Emerging Asia", "sub": "Guest lecture at Dhaka University Economics faculty", "meta": "Lecture", "badge": "Governance", "badge_color": "#1E40AF"},
            {"title": "Official Press Kit & High-Res Bio", "sub": "Download photography, bio briefs & conference intro", "meta": "Press Kit", "badge": "Media Kit", "badge_color": "#475569"}
        ]
    }
]

def render_desktop(tpl, out_path):
    w, h = 960, 600
    im = Image.new("RGB", (w, h), tpl["bg_body"])
    draw = ImageDraw.Draw(im)

    font_xs = get_font(FONT_REG_PATH, 11)
    font_sm = get_font(FONT_REG_PATH, 13)
    font_sm_b = get_font(FONT_BOLD_PATH, 13)
    font_brand = get_font(FONT_BOLD_PATH, 20)
    font_eyebrow = get_font(FONT_BOLD_PATH, 11)
    font_headline = get_font(FONT_BOLD_PATH, 30)
    font_sub = get_font(FONT_REG_PATH, 14)
    font_btn = get_font(FONT_BOLD_PATH, 13)
    font_sec_title = get_font(FONT_BOLD_PATH, 18)
    font_card_title = get_font(FONT_BOLD_PATH, 14)
    font_card_sub = get_font(FONT_REG_PATH, 11)
    font_badge = get_font(FONT_BOLD_PATH, 10)

    # 1. Top announcement bar
    draw.rectangle([0, 0, w, 28], fill=tpl["bg_top"])
    draw.text((w // 2, 14), tpl["top_announcement"], fill="#FFFFFF", font=font_xs, anchor="mm")

    # 2. Main Navigation Header
    header_y = 28
    header_h = 56
    draw.rectangle([0, header_y, w, header_y + header_h], fill="#FFFFFF")
    draw.line([0, header_y + header_h, w, header_y + header_h], fill=tpl["border_color"], width=1)

    # Brand Logo / Title
    draw.text((40, header_y + 28), tpl["name"], fill=tpl["text_main"], font=font_brand, anchor="lm")

    # Nav links
    nav_x = 320
    for link in tpl["nav_links"]:
        bbox = draw.textbbox((nav_x, header_y + 28), link, font=font_sm, anchor="lm")
        draw.text((nav_x, header_y + 28), link, fill="#4B5563", font=font_sm, anchor="lm")
        nav_x = bbox[2] + 24

    # Header Action Button
    btn_w, btn_h = 130, 34
    btn_x = w - 40 - btn_w
    btn_y = header_y + (header_h - btn_h) // 2
    draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=6, fill=tpl["accent"])
    draw.text((btn_x + btn_w // 2, btn_y + btn_h // 2), "Contact Us", fill=tpl["accent_text"], font=font_btn, anchor="mm")

    # 3. Hero Section
    hero_y = header_y + header_h
    hero_h = 240
    # Optional subtle gradient / tint for hero
    draw.rectangle([0, hero_y, w, hero_y + hero_h], fill=tpl["bg_body"])
    draw.line([0, hero_y + hero_h, w, hero_y + hero_h], fill=tpl["border_color"], width=1)

    # Hero Content
    draw.text((40, hero_y + 36), tpl["tagline"], fill=tpl["accent"], font=font_eyebrow, anchor="lm")
    draw.text((40, hero_y + 72), tpl["headline"], fill=tpl["text_main"], font=font_headline, anchor="lm")
    draw.text((40, hero_y + 115), tpl["sub"], fill=tpl["text_sub"], font=font_sub, anchor="lm")

    # CTA Buttons
    cta1_w, cta1_h = 180, 40
    draw.rounded_rectangle([40, hero_y + 155, 40 + cta1_w, hero_y + 155 + cta1_h], radius=7, fill=tpl["accent"])
    draw.text((40 + cta1_w // 2, hero_y + 155 + cta1_h // 2), tpl["cta_main"], fill=tpl["accent_text"], font=font_btn, anchor="mm")

    cta2_w = 170
    cta2_x = 40 + cta1_w + 14
    draw.rounded_rectangle([cta2_x, hero_y + 155, cta2_x + cta2_w, hero_y + 155 + cta1_h], radius=7, fill="#FFFFFF", outline=tpl["border_color"], width=1)
    draw.text((cta2_x + cta2_w // 2, hero_y + 155 + cta1_h // 2), tpl["cta_sec"], fill=tpl["text_main"], font=font_btn, anchor="mm")

    # Hero Graphic Illustration on right
    gfx_x = 640
    gfx_y = hero_y + 30
    gfx_w = 280
    gfx_h = 180
    draw.rounded_rectangle([gfx_x, gfx_y, gfx_x + gfx_w, gfx_y + gfx_h], radius=12, fill="#FFFFFF", outline=tpl["border_color"], width=1)
    # Inner illustration badge & mock details
    draw.rounded_rectangle([gfx_x + 16, gfx_y + 16, gfx_x + gfx_w - 16, gfx_y + 50], radius=6, fill=tpl["accent"])
    draw.text((gfx_x + gfx_w // 2, gfx_y + 33), "VERIFIED OFFICIAL PARTNER", fill="#FFFFFF", font=font_badge, anchor="mm")
    draw.text((gfx_x + 20, gfx_y + 80), tpl["name"], fill=tpl["text_main"], font=font_card_title)
    draw.text((gfx_x + 20, gfx_y + 105), "• Bangladesh Native Operations", fill=tpl["text_sub"], font=font_card_sub)
    draw.text((gfx_x + 20, gfx_y + 125), "• Direct WhatsApp Customer Routing", fill=tpl["text_sub"], font=font_card_sub)
    draw.text((gfx_x + 20, gfx_y + 145), "• Edge Serverless 68ms Latency", fill=tpl["text_sub"], font=font_card_sub)

    # 4. Featured Section Title
    sec_y = hero_y + hero_h + 24
    draw.text((40, sec_y), tpl["section_title"], fill=tpl["text_main"], font=font_sec_title, anchor="lm")
    draw.text((w - 40, sec_y), "View all details →", fill=tpl["accent"], font=font_sm_b, anchor="rm")

    # 4 Grid Cards
    card_w = 205
    card_h = 180
    card_spacing = 16
    start_x = 40
    cards_y = sec_y + 20

    for i, c in enumerate(tpl["cards"]):
        cx = start_x + i * (card_w + card_spacing)
        draw.rounded_rectangle([cx, cards_y, cx + card_w, cards_y + card_h], radius=10, fill=tpl["card_bg"], outline=tpl["border_color"], width=1)

        # Card header badge
        badge_w = 80
        draw.rounded_rectangle([cx + 12, cards_y + 12, cx + 12 + badge_w, cards_y + 32], radius=4, fill=c["badge_color"])
        draw.text((cx + 12 + badge_w // 2, cards_y + 22), c["badge"], fill="#FFFFFF", font=font_badge, anchor="mm")

        # Card text
        draw.text((cx + 12, cards_y + 50), c["title"], fill=tpl["text_main"], font=font_card_title)
        
        # Multiline subtext wrap
        words = c["sub"].split(" ")
        line1 = " ".join(words[:4])
        line2 = " ".join(words[4:])
        draw.text((cx + 12, cards_y + 80), line1, fill=tpl["text_sub"], font=font_card_sub)
        if line2:
            draw.text((cx + 12, cards_y + 98), line2, fill=tpl["text_sub"], font=font_card_sub)

        # Bottom meta / price pill
        draw.line([cx + 12, cards_y + 135, cx + card_w - 12, cards_y + 135], fill=tpl["border_color"], width=1)
        draw.text((cx + 12, cards_y + 155), c["meta"], fill=tpl["accent"], font=font_sm_b, anchor="lm")
        draw.text((cx + card_w - 12, cards_y + 155), "Details →", fill=tpl["text_sub"], font=font_xs, anchor="rm")

    im.save(out_path, "WEBP", quality=92)
    print(f"Generated Desktop WebP: {out_path}")

def render_phone(tpl, out_path):
    w, h = 390, 844
    im = Image.new("RGB", (w, h), tpl["bg_body"])
    draw = ImageDraw.Draw(im)

    font_xs = get_font(FONT_REG_PATH, 11)
    font_sm = get_font(FONT_REG_PATH, 12)
    font_brand = get_font(FONT_BOLD_PATH, 18)
    font_eyebrow = get_font(FONT_BOLD_PATH, 10)
    font_headline = get_font(FONT_BOLD_PATH, 24)
    font_sub = get_font(FONT_REG_PATH, 13)
    font_btn = get_font(FONT_BOLD_PATH, 13)
    font_sec_title = get_font(FONT_BOLD_PATH, 16)
    font_card_title = get_font(FONT_BOLD_PATH, 13)
    font_card_sub = get_font(FONT_REG_PATH, 11)
    font_badge = get_font(FONT_BOLD_PATH, 10)

    # 1. Top bar
    draw.rectangle([0, 0, w, 28], fill=tpl["bg_top"])
    draw.text((w // 2, 14), tpl["name"] + " • Official Site", fill="#FFFFFF", font=font_xs, anchor="mm")

    # 2. Mobile Header
    header_y = 28
    header_h = 52
    draw.rectangle([0, header_y, w, header_y + header_h], fill="#FFFFFF")
    draw.line([0, header_y + header_h, w, header_y + header_h], fill=tpl["border_color"], width=1)

    # Hamburger lines
    hx = 20
    hy = header_y + 20
    draw.line([hx, hy, hx + 18, hy], fill="#1E293B", width=2)
    draw.line([hx, hy + 6, hx + 18, hy + 6], fill="#1E293B", width=2)
    draw.line([hx, hy + 12, hx + 18, hy + 12], fill="#1E293B", width=2)

    # Brand Title
    draw.text((w // 2, header_y + 26), tpl["name"], fill=tpl["text_main"], font=font_brand, anchor="mm")

    # Phone action icon / badge
    draw.rounded_rectangle([w - 48, header_y + 14, w - 20, header_y + 38], radius=6, fill=tpl["accent"])
    draw.text((w - 34, header_y + 26), "✓", fill="#FFFFFF", font=font_btn, anchor="mm")

    # 3. Hero Section
    hero_y = header_y + header_h
    hero_h = 290
    draw.rectangle([0, hero_y, w, hero_y + hero_h], fill=tpl["bg_body"])
    draw.line([0, hero_y + hero_h, w, hero_y + hero_h], fill=tpl["border_color"], width=1)

    draw.text((20, hero_y + 28), tpl["tagline"], fill=tpl["accent"], font=font_eyebrow, anchor="lm")
    
    # Multiline headline for phone
    h_words = tpl["headline"].split(" ")
    h_line1 = " ".join(h_words[:3])
    h_line2 = " ".join(h_words[3:])
    draw.text((20, hero_y + 60), h_line1, fill=tpl["text_main"], font=font_headline, anchor="lm")
    if h_line2:
        draw.text((20, hero_y + 92), h_line2, fill=tpl["text_main"], font=font_headline, anchor="lm")

    # Subtitle
    sub_words = tpl["sub"].split(" ")
    s_line1 = " ".join(sub_words[:6])
    s_line2 = " ".join(sub_words[6:12])
    draw.text((20, hero_y + 130), s_line1, fill=tpl["text_sub"], font=font_sub, anchor="lm")
    if s_line2:
        draw.text((20, hero_y + 150), s_line2, fill=tpl["text_sub"], font=font_sub, anchor="lm")

    # Main Action Button (full width on phone)
    draw.rounded_rectangle([20, hero_y + 185, w - 20, hero_y + 230], radius=8, fill=tpl["accent"])
    draw.text((w // 2, hero_y + 207), tpl["cta_main"], fill=tpl["accent_text"], font=font_btn, anchor="mm")

    # Secondary action
    draw.rounded_rectangle([20, hero_y + 240, w - 20, hero_y + 280], radius=8, fill="#FFFFFF", outline=tpl["border_color"], width=1)
    draw.text((w // 2, hero_y + 260), tpl["cta_sec"], fill=tpl["text_main"], font=font_btn, anchor="mm")

    # 4. Featured Section
    sec_y = hero_y + hero_h + 20
    draw.text((20, sec_y), tpl["section_title"], fill=tpl["text_main"], font=font_sec_title, anchor="lm")

    # Render 2 cards stacked vertically
    cards_y = sec_y + 18
    for i, c in enumerate(tpl["cards"][:2]):
        cy = cards_y + i * 160
        draw.rounded_rectangle([20, cy, w - 20, cy + 145], radius=10, fill=tpl["card_bg"], outline=tpl["border_color"], width=1)

        badge_w = 75
        draw.rounded_rectangle([32, cy + 12, 32 + badge_w, cy + 30], radius=4, fill=c["badge_color"])
        draw.text((32 + badge_w // 2, cy + 21), c["badge"], fill="#FFFFFF", font=font_badge, anchor="mm")

        draw.text((32, cy + 46), c["title"], fill=tpl["text_main"], font=font_card_title)
        draw.text((32, cy + 70), c["sub"][:45] + "...", fill=tpl["text_sub"], font=font_card_sub)

        draw.line([32, cy + 102, w - 32, cy + 102], fill=tpl["border_color"], width=1)
        draw.text((32, cy + 122), c["meta"], fill=tpl["accent"], font=font_btn, anchor="lm")
        draw.text((w - 32, cy + 122), "View Details →", fill=tpl["text_sub"], font=font_xs, anchor="rm")

    im.save(out_path, "WEBP", quality=92)
    print(f"Generated Phone WebP: {out_path}")

def main():
    print("Starting template asset generation...")
    for tpl in TEMPLATES:
        desktop_path = os.path.join(OUTPUT_DIR, f"{tpl['id']}.webp")
        phone_path = os.path.join(OUTPUT_DIR, f"{tpl['id']}-phone.webp")
        render_desktop(tpl, desktop_path)
        render_phone(tpl, phone_path)
    print("All 12 template preview assets successfully generated!")

if __name__ == "__main__":
    main()
