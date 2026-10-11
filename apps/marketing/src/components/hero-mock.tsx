/** A drawn picture of the store admin for the home page hero. Plain HTML and CSS, so it is sharp on every screen and never goes stale. */
export function HeroMock() {
  return (
    <div className="mock" role="img" aria-label="The BizTrackBD admin: today's orders, sales and payments to check">
      <div className="mock-frame">
        <div className="mock-bar"><i /><i /><i /><span>yourshop.biztrack.bd/admin</span></div>
        <div className="mock-body">
          <ul className="mock-nav" aria-hidden>
            <li className="on">Home</li><li>Orders</li><li>Products</li><li>Customers</li><li>Reports</li>
          </ul>
          <div className="mock-main" aria-hidden>
            <b>Good morning, Nusrat</b>
            <div className="mock-stats">
              <div><span>New orders</span><strong>12</strong></div>
              <div><span>To pack</span><strong>4</strong></div>
              <div><span>Sales today</span><strong>৳ 18,450</strong></div>
              <div><span>Payments to check</span><strong>3</strong></div>
            </div>
            <div className="mock-rows">
              <div><em>BT-10482</em><span>Tania Akter</span><u className="warn">Check bKash</u><b>৳ 2,450</b></div>
              <div><em>BT-10481</em><span>Rakib Hasan</span><u>COD</u><b>৳ 1,890</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
