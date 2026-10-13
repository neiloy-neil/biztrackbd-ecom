import base from "./playwright.config";
export default { ...base, webServer: (base.webServer as { url: string }[]).filter((w) => !/:40\d\d\//.test(w.url)) };
