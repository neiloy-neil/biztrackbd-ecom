"use client";

interface Props {
  whatsappNumber: string | null;
  greeting?: string | null;
}

export function WhatsAppFloatingButton({ whatsappNumber, greeting }: Props) {
  if (!whatsappNumber) return null;

  const raw = whatsappNumber.trim().replace(/[^\d+]/g, "");
  if (!raw) return null;

  // Format Bangladesh phone to international format (8801...)
  let formatted = raw.replace(/^\+/, "");
  if (formatted.startsWith("01")) {
    formatted = `88${formatted}`;
  }

  const text = greeting?.trim() || "Hello! I have an inquiry about your products.";
  const href = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;

  return (
    <aside aria-label="WhatsApp Support">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        data-testid="whatsapp-floating-widget"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "24px",
          zIndex: 999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#25D366",
          color: "#ffffff",
          padding: "10px 14px",
          borderRadius: "9999px",
          boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4), 0 2px 6px rgba(0,0,0,0.15)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "13.5px",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.06) translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(37, 211, 102, 0.55), 0 3px 8px rgba(0,0,0,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(37, 211, 102, 0.4), 0 2px 6px rgba(0,0,0,0.15)";
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.58 3.39 17.07L2.05 22L7.11 20.68C8.55 21.52 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.04 16.47C16.83 17.06 15.82 17.61 15.34 17.68C14.86 17.75 14.24 17.77 12.28 16.96C9.77 15.93 8.16 13.38 8.03 13.21C7.91 13.04 7.02 11.86 7.02 10.63C7.02 9.4 7.65 8.8 7.88 8.55C8.11 8.3 8.41 8.24 8.58 8.24C8.75 8.24 8.92 8.24 9.06 8.25C9.21 8.26 9.41 8.2 9.61 8.68C9.82 9.19 10.32 10.42 10.38 10.55C10.44 10.68 10.49 10.84 10.39 11.02C10.3 11.2 10.22 11.3 10.08 11.46C9.94 11.62 9.79 11.81 9.67 11.95C9.53 12.1 9.38 12.26 9.55 12.55C9.72 12.84 10.31 13.8 11.17 14.57C12.28 15.56 13.19 15.87 13.51 16C13.83 16.13 14.02 16.1 14.21 15.88C14.4 15.66 14.88 15.09 15.07 14.81C15.26 14.53 15.45 14.57 15.72 14.67C15.99 14.77 17.43 15.48 17.72 15.63C18.01 15.78 18.2 15.85 18.27 15.97C18.34 16.09 18.34 16.66 17.04 16.47Z"
            fill="currentColor"
          />
        </svg>
        <span style={{ whiteSpace: "nowrap" }}>WhatsApp</span>
      </a>
    </aside>
  );
}
