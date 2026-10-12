/**
 * Razor-Sharp Authentic Admin Window for the marketing hero.
 * Handcrafted, realistic operational UI showing real Bangladeshi store workflows:
 * bKash TrxID verification, Steadfast courier booking, and delivery return check.
 * Pure HTML/CSS with zero AI-style glowing neon fluff.
 */
export function HeroMock() {
  return (
    <div className="hero-mock-window" role="img" aria-label="BizTrackBD live store admin: real orders, bKash verification, and courier bookings">
      {/* Top Browser Bar */}
      <div className="mock-window-bar">
        <div className="window-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <div className="window-address">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>yourshop.biztrack.bd/admin</span>
        </div>
        <div className="window-status">
          <span className="status-live-dot" />
          <span>Store Live</span>
        </div>
      </div>

      {/* Admin Body Container */}
      <div className="mock-window-body">
        {/* Left Admin Navigation */}
        <aside className="admin-side">
          <div className="admin-brand">
            <span className="admin-avatar">N</span>
            <div className="admin-brand-info">
              <b>Nusrat&apos;s Boutique</b>
              <small>Dhanmondi, Dhaka</small>
            </div>
          </div>
          <nav className="admin-menu">
            <div className="admin-menu-item active">
              <span className="menu-icon">📊</span>
              <span>Dashboard</span>
            </div>
            <div className="admin-menu-item">
              <span className="menu-icon">📦</span>
              <span>Orders</span>
              <span className="admin-pill">12</span>
            </div>
            <div className="admin-menu-item">
              <span className="menu-icon">🏷️</span>
              <span>Products</span>
            </div>
            <div className="admin-menu-item">
              <span className="menu-icon">⚡</span>
              <span>Check bKash</span>
              <span className="admin-pill warn">3</span>
            </div>
            <div className="admin-menu-item">
              <span className="menu-icon">🚚</span>
              <span>Couriers</span>
            </div>
            <div className="admin-menu-item">
              <span className="menu-icon">⚙️</span>
              <span>Settings</span>
            </div>
          </nav>
        </aside>

        {/* Main Operational Area */}
        <main className="admin-main">
          {/* Header Bar */}
          <div className="admin-top-bar">
            <div>
              <h3>Good morning, Nusrat</h3>
              <p>12 new orders today · 4 parcels ready for Steadfast pickup</p>
            </div>
            <div className="admin-top-actions">
              <span className="action-tag">🟢 COD Auto-Check Active</span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="admin-metrics">
            <div className="metric-box">
              <span className="metric-label">Today&apos;s Sales</span>
              <strong className="metric-value num">৳ 18,450</strong>
              <span className="metric-note up">↑ 24% vs yesterday</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">To Pack & Ship</span>
              <strong className="metric-value num">4 orders</strong>
              <span className="metric-note">Dhaka & Chittagong</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Check bKash</span>
              <strong className="metric-value num warn">3 pending</strong>
              <span className="metric-note">1-click approve</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Courier Status</span>
              <strong className="metric-value num">8 booked</strong>
              <span className="metric-note">Steadfast & Pathao</span>
            </div>
          </div>

          {/* Real Orders Desk */}
          <div className="admin-desk">
            <div className="desk-header-row">
              <b>Live Orders Desk</b>
              <span>Auto-refreshes every 30s</span>
            </div>
            <div className="desk-table">
              {/* Order 1: bKash verification with courier reputation check */}
              <div className="desk-item">
                <div className="col-id">BT-10482</div>
                <div className="col-customer">
                  <b>Tania Akter</b>
                  <small>Mirpur 10, Dhaka · Jamdani Saree (Red)</small>
                </div>
                <div className="col-check">
                  <span className="rep-safe">✓ 98% Courier Score</span>
                </div>
                <div className="col-status">
                  <span className="tag-bkash">Check bKash (Trx: 9HJ428)</span>
                </div>
                <div className="col-amount num">৳ 2,450</div>
              </div>

              {/* Order 2: COD with Steadfast pickup booked */}
              <div className="desk-item">
                <div className="col-id">BT-10481</div>
                <div className="col-customer">
                  <b>Rakib Hasan</b>
                  <small>Agrabad, Chittagong · Wireless ANC Earbuds</small>
                </div>
                <div className="col-check">
                  <span className="rep-safe">✓ 95% Courier Score</span>
                </div>
                <div className="col-status">
                  <span className="tag-courier">🚚 Steadfast Booked (SF-89210)</span>
                </div>
                <div className="col-amount num">৳ 1,890</div>
              </div>

              {/* Order 3: COD Confirmed via SMS */}
              <div className="desk-item">
                <div className="col-id">BT-10480</div>
                <div className="col-customer">
                  <b>Arif Chowdhury</b>
                  <small>Sylhet Sadar · Linen Cotton Panjabi</small>
                </div>
                <div className="col-check">
                  <span className="rep-safe">✓ 100% Courier Score</span>
                </div>
                <div className="col-status">
                  <span className="tag-cod">📦 COD Confirmed via SMS</span>
                </div>
                <div className="col-amount num">৳ 3,200</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
