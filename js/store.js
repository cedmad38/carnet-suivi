/* ===================================================================
   Accès aux données — même interface en ligne (Supabase) et en démo.
   =================================================================== */
(function () {
  const cfg = window.CARNET_CONFIG;
  const online = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  /* ---------------------------- En ligne ---------------------------- */
  function onlineStore() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

    return {
      online: true,
      async session() {
        const { data } = await sb.auth.getSession();
        return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
      },
      onAuthChange(fn) { sb.auth.onAuthStateChange((event, s) => fn(s ? { id: s.user.id, email: s.user.email } : null, event)); },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
      },
      async signUp(email, password, displayName) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
        if (error) throw new Error(error.message);
        return { needsConfirmation: !data.session };
      },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw new Error(error.message);
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new Error(error.message);
      },
      async signOut() { await sb.auth.signOut(); },
      async myMembership(uid) {
        return must(await sb.from('members').select('*').eq('user_id', uid).maybeSingle());
      },
      async members() { return must(await sb.from('members').select('*').order('created_at')); },
      async requests() { return must(await sb.from('access_requests').select('*').order('created_at')); },
      async approve(uid, role) { must(await sb.rpc('approve_request', { p_user: uid, p_role: role })); },
      async refuse(uid) { must(await sb.from('access_requests').delete().eq('user_id', uid)); },
      async setRole(uid, role) { must(await sb.from('members').update({ role }).eq('user_id', uid)); },
      async rename(uid, display_name) { must(await sb.from('members').update({ display_name }).eq('user_id', uid)); },
      async removeMember(uid) { must(await sb.from('members').delete().eq('user_id', uid)); },
      async entries() { return must(await sb.from('entries').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })); },
      async save(entry) {
        const row = { kind: entry.kind, date: entry.date, data: entry.data };
        if (entry.id) return must(await sb.from('entries').update(row).eq('id', entry.id).select().single());
        return must(await sb.from('entries').insert(row).select().single());
      },
      async remove(id) { must(await sb.from('entries').delete().eq('id', id)); },
      async settings() {
        const rows = must(await sb.from('settings').select('*'));
        return Object.fromEntries(rows.map(r => [r.key, r.data]));
      },
      async saveSetting(key, data) { must(await sb.from('settings').upsert({ key, data })); },
      subscribe(fn) {
        sb.channel('entries').on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, fn).subscribe();
      },
    };
  }

  /* ------------------------------ Démo ------------------------------ */
  function demoStore() {
    const KEY = 'carnet-suivi-demo';
    const me = { id: 'demo', email: 'demo@local' };
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    const db = Object.assign({ entries: [], settings: {} }, load());
    const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
    const member = { user_id: 'demo', display_name: 'Moi (démo)', role: 'admin', created_at: new Date().toISOString() };

    return {
      online: false,
      async session() { return me; },
      onAuthChange() {},
      async signIn() {}, async signUp() { return {}; }, async resetPassword() {}, async updatePassword() {},
      async signOut() {},
      async myMembership() { return member; },
      async members() { return [member]; },
      async requests() { return []; },
      async approve() {}, async refuse() {}, async setRole() {}, async rename() {}, async removeMember() {},
      async entries() {
        return [...db.entries].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
      },
      async save(entry) {
        const now = new Date().toISOString();
        if (entry.kind === 'day' && !entry.id) {
          const dup = db.entries.find(e => e.kind === 'day' && e.date === entry.date);
          if (dup) entry.id = dup.id;
        }
        let row = entry.id && db.entries.find(e => e.id === entry.id);
        if (row) Object.assign(row, { date: entry.date, data: entry.data, updated_at: now, updated_by: 'demo' });
        else { row = { id: uid(), kind: entry.kind, date: entry.date, data: entry.data, created_by: 'demo', updated_by: 'demo', created_at: now, updated_at: now }; db.entries.push(row); }
        persist();
        return row;
      },
      async remove(id) { db.entries = db.entries.filter(e => e.id !== id); persist(); },
      async settings() { return db.settings; },
      async saveSetting(key, data) { db.settings[key] = data; persist(); },
      subscribe() {},
    };
  }

  window.Store = online ? onlineStore() : demoStore();
})();
