// Camada de dados: Supabase quando configurado, senao modo demo (localStorage).
(function () {
  const cfg = window.BODAS_CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  const KEY = "bodas_demo_guests";
  const demoSeed = () => [
    ["Convidado exemplo 1", "confirmed"], ["Convidado exemplo 2", "pending"],
    ["Convidado exemplo 3", "declined"], ["Convidado exemplo 4", "later"], ["Convidado exemplo 5", "pending"]
  ].map((g, i) => ({ id: i + 1, list_no: i + 1, label: g[0], given_name: null, status: g[1],
    later_date: g[1] === "later" ? "2026-11-20" : null, source: "list", updated_at: new Date().toISOString() }));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || demoSeed(); } catch (e) { return demoSeed(); } };
  const save = (rows) => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {} };
  const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const err = (e) => { if (e) throw new Error(e.message || String(e)); };

  window.Store = {
    live,

    async submitRsvp(name, status, laterDate) {
      if (live) {
        const { error } = await sb.rpc("submit_rsvp", { p_name: name, p_status: status, p_later_date: laterDate || null });
        return err(error);
      }
      const rows = load();
      const hit = rows.find(r => r.source === "form" && r.label.toLowerCase() === name.toLowerCase());
      if (hit) { hit.status = status; hit.later_date = status === "later" ? laterDate : null; hit.updated_at = new Date().toISOString(); }
      else rows.push({ id: nextId(rows), list_no: null, label: name, given_name: null, status, source: "form",
        later_date: status === "later" ? laterDate : null, updated_at: new Date().toISOString() });
      save(rows);
    },

    // ---- admin ----
    async session() {
      if (!live) return true;
      const { data } = await sb.auth.getSession();
      return !!data.session;
    },
    async login(email, password) {
      if (!live) return;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return err(error);
    },
    async logout() { if (live) await sb.auth.signOut(); },

    async list() {
      if (live) {
        const { data, error } = await sb.from("guests").select("*").order("list_no", { nullsFirst: false }).order("updated_at", { ascending: false });
        err(error); return data;
      }
      return load();
    },
    async update(id, patch) {
      patch = Object.assign({}, patch, { updated_at: new Date().toISOString() });
      if (patch.status && patch.status !== "later") patch.later_date = patch.later_date || null;
      if (live) { const { error } = await sb.from("guests").update(patch).eq("id", id); return err(error); }
      const rows = load(); const r = rows.find(x => x.id === id); if (r) Object.assign(r, patch); save(rows);
    },
    async add(label) {
      if (live) { const { error } = await sb.from("guests").insert({ label, source: "manual" }); return err(error); }
      const rows = load(); rows.push({ id: nextId(rows), list_no: null, label, given_name: null, status: "pending", later_date: null, source: "manual", updated_at: new Date().toISOString() }); save(rows);
    },
    async remove(id) {
      if (live) { const { error } = await sb.from("guests").delete().eq("id", id); return err(error); }
      save(load().filter(r => r.id !== id));
    },
    async reset() { if (!live) { try { localStorage.removeItem(KEY); } catch (e) {} } }
  };
})();
