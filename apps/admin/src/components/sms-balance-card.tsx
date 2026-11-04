import { getSmsBalance, type StaffActor } from "@biztrackbd/core";
import { SmsBuyForm } from "./sms-buy-form";

/** What the store can send: the free monthly SMS, the SMS it bought, and a way to buy more once it is on a paid plan. */
export async function SmsBalanceCard({ tenantId, actor, canBuy }: { tenantId: string; actor: StaffActor; canBuy: boolean }) {
  const b = await getSmsBalance(tenantId, actor);
  const pct = b.monthlyLimit ? Math.min(100, Math.round((b.monthlyUsed / b.monthlyLimit) * 100)) : 0;
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 12 }} data-testid="sms-credits">
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{b.onTrial ? "Free trial SMS" : "Free SMS this month"}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }} data-testid="sms-monthly">
            {b.monthlyLimit === null ? `${b.monthlyUsed.toLocaleString()} sent (no limit)` : `${b.monthlyUsed.toLocaleString()} of ${b.monthlyLimit.toLocaleString()} used`}
          </div>
        </div>
        {!b.onTrial && (
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>SMS you bought</div>
            <div style={{ fontSize: 20, fontWeight: 700 }} data-testid="sms-prepaid">{b.prepaid.toLocaleString()} left</div>
          </div>
        )}
      </div>
      {b.monthlyLimit !== null && (
        <div className="meter-track" aria-hidden="true"><div className={`meter-fill ${pct > 85 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
      )}
      {b.onTrial && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Your free trial includes {b.monthlyLimit} SMS to try. When you pay for a plan you get more every month, and you can buy extra SMS at {(b.pricePaisa / 100).toFixed(2)} taka each (at least {b.minPack}).</p>}
      {!b.onTrial && b.totalLeft === 0 && <p className="notice bad" role="alert" style={{ margin: 0 }}>You are out of SMS, so customer messages are not being sent. Buy more below.</p>}
      {b.waiting && <p className="notice" style={{ margin: 0 }} data-testid="sms-waiting">Your payment for {b.waiting.quantity.toLocaleString()} SMS (৳ {b.waiting.amount.toLocaleString("en-IN")}) is being checked.</p>}
      {b.lastRejection && !b.waiting && <p className="notice bad" role="alert" style={{ margin: 0 }}>Your last payment was not accepted: {b.lastRejection}</p>}
      {b.canBuy && !b.waiting && canBuy && <SmsBuyForm pricePaisa={b.pricePaisa} minPack={b.minPack} step={b.step} payTo={b.payTo} />}
    </div>
  );
}
