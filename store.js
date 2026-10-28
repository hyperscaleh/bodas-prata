// Camada de dados: API (n8n + Notion) quando configurada, senao modo demo (localStorage).
(function () {
  const API = (window.BODAS_CONFIG || {}).API_URL || "";
  const live = !!API;

  // text/plain evita o pedido "preflight" do CORS.
  async function call(payload) {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "erro");
    return j;
  }
  const getTok = () => { try { return sessionStorage.getItem("bodas_tok") || ""; } catch (e) { return ""; } };
  const setTok = (t) => { try { t ? sessionStorage.setItem("bodas_tok", t) : sessionStorage.removeItem("bodas_tok"); } catch (e) {} };
  const adm = (p) => call(Object.assign({ token: getTok() }, p));

  const KEY = "bodas_demo_guests";
  const demoSeed = () => [
    ["Convidado exemplo 1", "confirmed"], ["Convidado exemplo 2", "pending"],
    ["Convidado exemplo 3", "declined"], ["Convidado exemplo 4", "later"], ["Convidado exemplo 5", "pending"]
  ].map((g, i) => ({ id: String(i + 1), list_no: i + 1, label: g[0], given_name: null, status: g[1],
    later_date: g[1] === "later" ? "2026-11-20" : null, source: "list", updated_at: new Date().toISOString() }));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || demoSeed(); } catch (e) { return demoSeed(); } };
  const save = (rows) => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {} };
  const nextId = (rows) => String(rows.reduce((m, r) => Math.max(m, +r.id), 0) + 1);

  window.Store = {
    live,

    async submitRsvp(name, status, laterDate, email) {
      if (live) { await call({ action: "rsvp", name, status, later_date: laterDate || "", email }); return; }
      const rows = load();
      const hit = rows.find(r => r.source === "form" && r.label.toLowerCase() === name.toLowerCase());
      if (hit) { hit.status = status; hit.later_date = status === "later" ? laterDate : null; hit.updated_at = new Date().toISOString(); }
      else rows.push({ id: nextId(rows), list_no: null, label: name, given_name: null, email, status, source: "form",
        later_date: status === "later" ? laterDate : null, updated_at: new Date().toISOString() });
      save(rows);
    },

    // ---- admin ----
    async session() { return live ? !!getTok() && this.list().then(() => true, () => { setTok(""); return false; }) : true; },
    async login(password) { if (!live) return; setTok(password.trim()); try { await this.list(); } catch (e) { setTok(""); throw e; } },
    async logout() { setTok(""); },

    async list() {
      let rows;
      if (live) rows = (await adm({ action: "list" })).rows; else rows = load();
      return rows.sort((a, b) => (a.list_no == null) - (b.list_no == null) || (a.list_no || 0) - (b.list_no || 0) || String(b.updated_at).localeCompare(String(a.updated_at)));
    },
    async update(id, patch) {
      if (live) { await adm({ action: "update", id, status: patch.status, later_date: patch.later_date || null,
        ...("given_name" in patch ? { given_name: patch.given_name } : {}),
        ...("email" in patch ? { email: patch.email } : {}) }); return; }
      const rows = load(); const r = rows.find(x => x.id === id); if (r) Object.assign(r, patch, { updated_at: new Date().toISOString() }); save(rows);
    },
    async add(label) {
      if (live) { await adm({ action: "add", label }); return; }
      const rows = load(); rows.push({ id: nextId(rows), list_no: null, label, given_name: null, status: "pending", later_date: null, source: "manual", updated_at: new Date().toISOString() }); save(rows);
    },
    async remove(id) {
      if (live) { await adm({ action: "remove", id }); return; }
      save(load().filter(r => r.id !== id));
    }
  };
})();
