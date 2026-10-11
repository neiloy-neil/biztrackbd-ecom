// Talks to the sms.net.bd account named by SMS_NET_BD_API_KEY in .env.local.
//   node tools/sms-test.mjs --balance                                      shows the balance (free, sends nothing)
//   node tools/sms-test.mjs --to 01712345678 --msg "Hello" --yes           sends ONE real message (it costs balance)
// Until the account's first recharge, the provider only delivers to the account owner's registered number (error 421).
try { process.loadEnvFile(new URL("../.env.local", import.meta.url)); } catch { /* use the environment */ }
const key = process.env.SMS_NET_BD_API_KEY;
if (!key) throw new Error("SMS_NET_BD_API_KEY is not set in .env.local");
const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

if (args.includes("--balance") || !val("--to")) {
  const j = await (await fetch(`https://api.sms.net.bd/user/balance/?api_key=${encodeURIComponent(key)}`)).json();
  console.log(j.error === 0 ? `balance: ${j.data.balance}` : `provider said: error ${j.error} ${j.msg}`);
  process.exit(0);
}
const to = val("--to").replace(/[^0-9]/g, "");
const msg = val("--msg") ?? "BizTrackBD test message";
const number = to.startsWith("880") ? to : to.startsWith("0") ? `88${to}` : to;
if (!/^8801[3-9]\d{8}$/.test(number)) throw new Error("--to must be a Bangladesh mobile number like 01712345678");
console.log(`would send to ${number}: "${msg}"`);
if (!args.includes("--yes")) { console.log("nothing sent (add --yes)"); process.exit(0); }
const r = await fetch("https://api.sms.net.bd/sendsms", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ api_key: key, msg, to: number }) });
const j = await r.json();
console.log(j.error === 0 ? `accepted by the provider (request ${j.data?.request_id})` : `provider refused: error ${j.error} ${j.msg}`);
