import type { Metadata } from "next";
import { can, getLoyaltyOverview, getLoyaltySettings } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { adjustPointsAction, saveLoyaltySettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Loyalty and referrals" };

const DONE: Record<string, string> = { saved: "Settings saved.", adjusted: "Points changed." };

function Num({ name, label, value, hint, min = 0, max = 1000000 }: { name: string; label: string; value: number; hint?: string; min?: number; max?: number }) {
  return (
    <div className="field m-0">
      <label className="label" htmlFor={`l-${name}`}>{label}</label>
      <input id={`l-${name}`} className="input" name={name} type="number" inputMode="numeric" min={min} max={max} step={1} defaultValue={value} required />
      {hint && <div className="muted text-xs mt-xs">{hint}</div>}
    </div>
  );
}

export default async function Loyalty({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const canEdit = can(s.user.role, "marketing", "edit");
  const [cfg, ov] = await Promise.all([getLoyaltySettings(s.tenantId, s.actor), getLoyaltyOverview(s.tenantId, s.actor)]);
  const err = one(sp.err);
  const done = one(sp.done);
  const wa = (phone: string, name: string) => `https://wa.me/88${phone}?text=${encodeURIComponent(`Hi ${name.split(" ")[0]}, thank you for being one of our best customers!`)}`;

  return (
    <>
      <PageHeader
        title="Loyalty & Referrals"
        crumbs={[{ label: "Marketing", href: "/marketing" }, { label: "Loyalty" }]}
        sub="Customers earn points on delivered orders, move up VIP levels, and bring friends. Points unlock only when the parcel is delivered, so a returned order earns nothing."
      />
      {err && <div className="notice bad mb-sm" role="alert" data-testid="loyalty-error">{err}</div>}
      {done && DONE[done] && <div className="notice good mb-sm" role="status">{DONE[done]}</div>}

      <div data-testid="loyalty-stats" className="grid-150 mb-md">
        <div className="card p-md"><div className="muted text-sm">Members</div><b className="text-xl">{ov.accounts}</b></div>
        <div className="card p-md"><div className="muted text-sm">Points to spend</div><b className="text-xl" data-testid="points-outstanding">{ov.pointsOutstanding}</b><div className="muted text-xs">about {taka(ov.liabilityBdt)} of discounts</div></div>
        <div className="card p-md"><div className="muted text-sm">Waiting for delivery</div><b className="text-xl">{ov.pointsPending}</b></div>
        <div className="card p-md"><div className="muted text-sm">Friends referred</div><b className="text-xl">{ov.referrals.total}</b><div className="muted text-xs">{ov.referrals.rewarded} delivered and rewarded</div></div>
      </div>

      <form action={saveLoyaltySettingsAction} className="card stack" data-testid="loyalty-settings">
        <h2 className="text-base font-bold m-0">Settings</h2>
        <label className="row nowrap items-center gap-sm">
          <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} disabled={!canEdit} />
          <b>Reward points and VIP levels are on</b>
        </label>
        <div className="row-2">
          <Num name="spendPerPoint" label="Spend this much (৳) to earn 1 point" value={cfg.spendPerPoint} min={1} hint="Silver, Gold and Platinum earn 1.25, 1.5 and 2 times as many." />
          <Num name="maxCartPercent" label="Points can pay at most (% of the cart)" value={cfg.maxCartPercent} min={1} max={100} />
        </div>
        <div className="row-2">
          <Num name="pointsPerBlock" label="Spend this many points ..." value={cfg.pointsPerBlock} min={1} />
          <Num name="bdtPerBlock" label="... to take off this many taka (৳)" value={cfg.bdtPerBlock} min={1} />
        </div>
        <label className="row nowrap items-center gap-sm">
          <input type="checkbox" name="referralEnabled" defaultChecked={cfg.referralEnabled} disabled={!canEdit} />
          <b>Refer a friend is on</b>
        </label>
        <div className="row-3">
          <Num name="refereeDiscount" label="Friend's discount (৳)" value={cfg.refereeDiscount} />
          <Num name="refereeMinCart" label="Smallest cart for it (৳)" value={cfg.refereeMinCart} />
          <Num name="referrerReward" label="Reward for the referrer (points)" value={cfg.referrerReward} hint="Paid when the friend's order is delivered." />
        </div>
        <h3 className="mt-xs text-base font-bold">VIP levels</h3>
        <div className="row-3">
          <Num name="vipSilverMin" label="Silver from (৳ delivered in 12 months)" value={cfg.vip.silverMin} min={1} max={100000000} />
          <Num name="vipGoldMin" label="Gold from (৳)" value={cfg.vip.goldMin} min={1} max={100000000} />
          <Num name="vipPlatinumMin" label="Platinum from (৳)" value={cfg.vip.platinumMin} min={1} max={100000000} />
        </div>
        <div className="row-2">
          <Num name="vipGoldDiscount" label="Gold takes this % off every order" value={cfg.vip.goldDiscount} max={50} />
          <Num name="vipPlatinumDiscount" label="Platinum takes this % off, plus free delivery" value={cfg.vip.platinumDiscount} max={50} />
        </div>
        <div className="row-2">
          <Num name="expiryMonths" label="Points expire after this many months with no activity (0 = never)" value={cfg.expiryMonths} max={60} hint="Customers get one text about two weeks before." />
          <Num name="birthdayVoucher" label="Birthday voucher for Silver and above (৳, 0 = none)" value={cfg.birthdayVoucher} max={100000} hint="Valid for 14 days, once a year." />
        </div>
        <div className="muted text-sm">Gold and Platinum orders are packed first. The VIP discount and spending points need the customer to be signed in.</div>
        {canEdit && <div><SubmitButton pending="Saving…">Save settings</SubmitButton></div>}
      </form>

      <section className="card mt-md" data-testid="tier-split">
        <h2 className="text-base font-bold mb-sm">VIP levels</h2>
        <div className="row gap-md">{ov.tiers.map((t) => <span key={t.level}><b>{t.customers}</b> <span className="muted">{t.label}</span></span>)}</div>
      </section>

      <section className="card mt-md" data-testid="leaderboard">
        <h2 className="text-base font-bold mb-sm">Top customers</h2>
        {ov.leaderboard.length === 0 ? <p className="muted text-sm">Nobody yet. Customers appear here after their first delivered order.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Customer</th><th scope="col">Level</th><th scope="col" className="num">Spent in 12 months</th><th scope="col" className="num">Points</th><th scope="col">Message</th></tr></thead>
              <tbody>
                {ov.leaderboard.map((c) => (
                  <tr key={c.customerId} data-testid="leader-row">
                    <td>{c.name}<div className="muted num text-xs">{prettyPhone(c.phone)}</div></td>
                    <td>{c.tier.charAt(0) + c.tier.slice(1).toLowerCase()}</td>
                    <td className="num">{taka(c.spend12m)}</td>
                    <td className="num">{c.points}</td>
                    <td><a className="link" href={wa(c.phone, c.name)} target="_blank" rel="noopener noreferrer" aria-label={`Message ${c.name} on WhatsApp`}>WhatsApp</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit && (
        <form action={adjustPointsAction} className="card stack mt-md" data-testid="adjust-points">
          <h2 className="text-base font-bold m-0">Add or remove points by hand</h2>
          <div className="row-3">
            <div className="field m-0"><label className="label" htmlFor="a-phone">Customer&apos;s mobile</label><input id="a-phone" className="input" name="phone" inputMode="tel" placeholder="01712345678" required /></div>
            <div className="field m-0"><label className="label" htmlFor="a-points">Points (use a minus to remove)</label><input id="a-points" className="input" name="points" type="number" step={1} required /></div>
            <div className="field m-0"><label className="label" htmlFor="a-reason">Reason</label><input id="a-reason" className="input" name="reason" minLength={3} maxLength={200} required /></div>
          </div>
          <div><SubmitButton className="btn btn-secondary" pending="Saving…">Change points</SubmitButton></div>
          <p className="muted text-sm">Every change is recorded in the audit log with your name and the reason.</p>
        </form>
      )}
    </>
  );
}
