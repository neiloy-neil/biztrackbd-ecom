import { BrandLockup } from "@biztrackbd/ui";

/** The logo at the top of the sign-in, two-factor, enrol and no-access cards, so the team knows whose door this is. */
export function AuthBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
      <BrandLockup size={36} />
    </div>
  );
}
