/* ===================================================================
   Carnet de suivi — application
   Axes de travail : somatique, situations nouvelles, sensoriel,
   communication du mal-être / prévention de la crise, suivi des essais.
   =================================================================== */
(function () {
  // Le prénom n'est jamais écrit dans le code (dépôt public) : il est lu dans la base, après connexion.
  let PRENOM = window.CARNET_CONFIG.PRENOM || 'l’enfant';
  const Store = window.Store;

  /* ============================ Référentiels ============================ */
  const EP_TYPES = [
    ['precrise', 'Signes de pré-crise'],
    ['crise', 'Crise / passage à l’acte'],
    ['douleur', 'Douleur suspectée'],
    ['transit', 'Transit / constipation'],
    ['reflux', 'Mérycisme / reflux'],
    ['alim', 'Recherche alimentaire'],
    ['sommeil', 'Sommeil'],
    ['autre', 'Autre observation'],
  ];
  const CONTEXTS = ['Changement imprévu', 'Situation nouvelle', 'Attente', 'Transition entre activités', 'Avant un repas',
    'Après un repas', 'Fatigue', 'Bruit / beaucoup de monde', 'Consigne difficile à comprendre', 'Au réveil', 'Le soir'];
  const BASE_MEASURES = ['Doliprane', 'Traitement « si besoin »', 'Pictogramme « Ça ne va pas »', 'TLA présenté',
    'Moins de paroles', 'Timer', 'Visuel / emploi du temps', 'Phrases courtes + temps pour comprendre', 'Distance de sécurité'];
  const EFFECTS = [['apaise', 'Apaisé'], ['mieux', 'Un peu mieux'], ['rien', 'Pas d’effet'], ['pire', 'Aggravation'], ['nsp', 'Pas encore observé']];
  const YESNO = [['oui', 'Oui'], ['non', 'Non']];
  const REACTIONS = [['aime', 'Apprécie'], ['neutre', 'Neutre'], ['refus', 'Refus / inconfort']];
  const DAY_FIELDS = [
    ['optifibre', 'OptiFibre donné', [['oui', 'Oui'], ['non', 'Non']]],
    ['selles', 'Selles', [['normales', 'Normales'], ['difficiles', 'Difficiles'], ['aucune', 'Aucune']]],
    ['sommeil', 'Sommeil de la nuit', [['bon', 'Bon'], ['moyen', 'Moyen'], ['mauvais', 'Mauvais']]],
    ['reflux', 'Mérycisme / reflux', [['non', 'Non'], ['peu', 'Un peu'], ['beaucoup', 'Beaucoup']]],
    ['alim', 'Recherches alimentaires', [['faibles', 'Faibles'], ['moderees', 'Modérées'], ['fortes', 'Fortes']]],
    ['tension', 'Tension générale', [['1', '1 calme'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 très tendu']]],
  ];
  const DEFAULT_SIGNS = ['Changement du regard', 'Agitation', 'Gestes répétitifs', 'Recherche d’obscurité',
    'Augmentation des demandes', 'Se tape la tête', 'Voix modifiée'];
  const DEFAULT_REGUL = ['Espace calme ou sombre', 'Faire une pause', 'Vibration', 'Sentir une odeur appréciée', 'Écouter quelque chose'];
  const TABS = [['jour', 'Aujourd’hui'], ['episodes', 'Épisodes'], ['sensoriel', 'Sensoriel'], ['changements', 'Changements'],
    ['essais', 'Essais'], ['bilan', 'Bilan'], ['reglages', 'Réglages']];
  const ROLES = [['famille', 'Famille'], ['pro', 'Professionnel(le)'], ['admin', 'Administrateur']];

  const label = (list, v) => (list.find(x => x[0] === v) || [, v || ''])[1];

  /* ============================== État ============================== */
  const S = {
    user: null, member: null, members: [], requests: [], entries: [], settings: {},
    tab: 'jour', day: todayISO(), epFilter: '', epSearch: '',
    bilanFrom: addDays(todayISO(), -29), bilanTo: todayISO(),
    authView: 'login', recovery: false, stale: false,
  };
  const signs = () => S.settings.signs || DEFAULT_SIGNS;
  const regul = () => S.settings.regul || DEFAULT_REGUL;
  const measures = () => uniq([...BASE_MEASURES, ...regul()]);

  /* ============================ Utilitaires ============================ */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function uniq(a) { return [...new Set(a.filter(Boolean))]; }
  function todayISO() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function nowHM() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function fmtDate(iso, long) {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
  function author(id) { const m = S.members.find(x => x.user_id === id); return m ? m.display_name : (id ? 'Ancien membre' : ''); }
  function canDelete(e) { return S.member && (S.member.role === 'admin' || e.created_by === S.user.id); }
  const isAdmin = () => S.member && S.member.role === 'admin';
  const byKind = k => S.entries.filter(e => e.kind === k);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  /* ---------- Composants de saisie ---------- */
  function seg(name, options, value) {
    return `<div class="chips" data-seg="${name}" role="radiogroup">${options.map(([v, l]) =>
      `<button type="button" class="chip${String(value) === v ? ' on' : ''}" data-v="${esc(v)}" role="radio" aria-checked="${String(value) === v}">${esc(l)}</button>`).join('')}</div>`;
  }
  function multi(name, options, values = [], custom = true) {
    const all = uniq([...options, ...values]);
    return `<div class="chips" data-multi="${name}">${all.map(v =>
      `<button type="button" class="chip${values.includes(v) ? ' on' : ''}" data-v="${esc(v)}" aria-pressed="${values.includes(v)}">${esc(v)}</button>`).join('')}
      ${custom ? '<input type="text" class="chip-new" placeholder="+ autre" aria-label="Ajouter un autre choix">' : ''}</div>`;
  }
  function readForm(root) {
    const out = {};
    $$('[data-seg]', root).forEach(el => { out[el.dataset.seg] = ($('.chip.on', el) || {}).dataset?.v || ''; });
    $$('[data-multi]', root).forEach(el => { out[el.dataset.multi] = $$('.chip.on', el).map(c => c.dataset.v); });
    $$('[name]', root).forEach(el => { out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    return out;
  }
  document.addEventListener('click', ev => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    const box = chip.parentElement;
    if (box.dataset.seg !== undefined) {
      const was = chip.classList.contains('on');
      $$('.chip', box).forEach(c => { c.classList.remove('on'); c.setAttribute('aria-checked', 'false'); });
      if (!was) { chip.classList.add('on'); chip.setAttribute('aria-checked', 'true'); }
    } else if (box.dataset.multi !== undefined) {
      chip.classList.toggle('on');
      chip.setAttribute('aria-pressed', chip.classList.contains('on'));
    }
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('keydown', ev => {
    if (!ev.target.classList.contains('chip-new') || ev.key !== 'Enter') return;
    ev.preventDefault();
    addCustomChip(ev.target);
  });
  document.addEventListener('focusout', ev => { if (ev.target.classList?.contains('chip-new')) addCustomChip(ev.target); });
  function addCustomChip(input) {
    const v = input.value.trim();
    if (!v) return;
    const box = input.parentElement;
    let chip = $$('.chip', box).find(c => c.dataset.v.toLowerCase() === v.toLowerCase());
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.dataset.v = v; chip.textContent = v;
      box.insertBefore(chip, input);
    }
    chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true');
    input.value = '';
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ============================== Données ============================== */
  async function loadAll() {
    const [entries, settings, members] = await Promise.all([Store.entries(), Store.settings(), Store.members()]);
    S.entries = entries; S.settings = settings; S.members = members;
    if (settings.prenom) PRENOM = settings.prenom;
    if (isAdmin()) S.requests = await Store.requests();
  }
  async function saveEntry(entry) {
    try {
      const row = await Store.save(entry);
      const i = S.entries.findIndex(e => e.id === row.id);
      if (i >= 0) S.entries[i] = row; else S.entries.unshift(row);
      S.entries.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
      return row;
    } catch (err) {
      // Fiche du jour créée en même temps par quelqu'un d'autre : on la récupère et on met à jour.
      if (entry.kind === 'day' && !entry.id && /duplicate|unique/i.test(err.message)) {
        S.entries = await Store.entries();
        const existing = S.entries.find(e => e.kind === 'day' && e.date === entry.date);
        if (existing) return saveEntry({ ...entry, id: existing.id, data: { ...existing.data, ...entry.data } });
      }
      toast('Erreur d’enregistrement : ' + err.message);
      throw err;
    }
  }
  async function deleteEntry(id) {
    if (!confirm('Supprimer définitivement cette note ?')) return false;
    try { await Store.remove(id); S.entries = S.entries.filter(e => e.id !== id); toast('Supprimé'); return true; }
    catch (err) { toast('Suppression impossible : ' + err.message); return false; }
  }

  /* ============================ Connexion ============================ */
  async function start() {
    Store.onAuthChange(async (user, event) => {
      if (event === 'PASSWORD_RECOVERY') { S.recovery = true; S.user = user; renderAuth(); return; }
      if (event === 'SIGNED_IN' && user && !S.member && !S.recovery) { S.user = user; await enter(); }
      if (event === 'SIGNED_OUT') { S.user = null; S.member = null; renderAuth(); }
    });
    S.user = await Store.session();
    if (S.user && !location.hash.includes('type=recovery')) await enter();
    else if (!S.user) renderAuth();
  }
  let entering = false, subscribed = false;
  async function enter() {
    if (entering) return;
    entering = true;
    try {
      S.member = await Store.myMembership(S.user.id);
      if (!S.member) { renderPending(); return; }
      await loadAll();
      renderShell();
      if (!subscribed) { Store.subscribe(onRemoteChange); subscribed = true; }
    } catch (err) {
      $('#app').innerHTML = `<div class="auth card"><h2>Connexion à la base impossible</h2><p class="muted">${esc(err.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
    } finally { entering = false; }
  }
  let remoteTimer;
  function onRemoteChange() {
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(async () => {
      S.entries = await Store.entries();
      if ($('#modal').open || document.activeElement?.closest('#dayForm')) { S.stale = true; return; }
      renderMain();
    }, 800);
  }

  function renderAuth() {
    const v = S.recovery ? 'recovery' : S.authView;
    const titles = { login: 'Connexion', signup: 'Créer mon compte', forgot: 'Mot de passe oublié', recovery: 'Nouveau mot de passe' };
    $('#app').innerHTML = `
      <div class="auth">
        <h1>Carnet de suivi</h1>
        <p class="muted">Espace privé partagé entre les parents et les professionnels invités.</p>
        <form class="card fields" id="authForm">
          <h2>${titles[v]}</h2>
          ${v === 'signup' ? '<label class="field"><span>Prénom (affiché aux autres)</span><input type="text" name="name" required autocomplete="given-name"></label>' : ''}
          ${v !== 'recovery' ? '<label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>' : ''}
          ${v !== 'forgot' ? `<label class="field"><span>Mot de passe</span><input type="password" name="password" required minlength="8" autocomplete="${v === 'login' ? 'current-password' : 'new-password'}"></label>` : ''}
          <div id="authMsg" class="small" role="alert"></div>
          <button class="btn primary" type="submit">${{ login: 'Se connecter', signup: 'Créer le compte', forgot: 'Recevoir un lien', recovery: 'Enregistrer' }[v]}</button>
          <div class="row small">
            ${v !== 'login' && v !== 'recovery' ? '<button type="button" class="btn ghost sm" data-auth="login">J’ai déjà un compte</button>' : ''}
            ${v === 'login' ? '<button type="button" class="btn ghost sm" data-auth="signup">Créer un compte</button><button type="button" class="btn ghost sm" data-auth="forgot">Mot de passe oublié</button>' : ''}
          </div>
        </form>
      </div>`;
    $$('[data-auth]').forEach(b => b.onclick = () => { S.authView = b.dataset.auth; renderAuth(); });
    $('#authForm').onsubmit = async ev => {
      ev.preventDefault();
      const f = readForm(ev.target), msg = $('#authMsg'), btn = $('button[type=submit]', ev.target);
      btn.disabled = true; msg.textContent = '';
      try {
        if (v === 'login') await Store.signIn(f.email, f.password);
        if (v === 'signup') {
          const r = await Store.signUp(f.email, f.password, f.name);
          if (r.needsConfirmation) { msg.textContent = 'Compte créé. Ouvre l’email de confirmation reçu, puis reviens te connecter.'; S.authView = 'login'; }
        }
        if (v === 'forgot') { await Store.resetPassword(f.email); msg.textContent = 'Si ce compte existe, un email avec un lien vient d’être envoyé.'; }
        if (v === 'recovery') {
          await Store.updatePassword(f.password);
          S.recovery = false; history.replaceState(null, '', location.pathname);
          toast('Mot de passe modifié'); await enter();
        }
      } catch (err) { msg.textContent = err.message; }
      btn.disabled = false;
    };
  }
  function renderPending() {
    $('#app').innerHTML = `
      <div class="auth card stack">
        <h2>Compte en attente de validation</h2>
        <p>Ton compte (<b>${esc(S.user.email)}</b>) est bien créé. Pour protéger les informations du carnet,
        l’administrateur du carnet doit maintenant accepter ta demande. Préviens-le, puis recharge cette page.</p>
        <div class="row"><button class="btn primary" onclick="location.reload()">Recharger</button><button class="btn" id="logout">Se déconnecter</button></div>
      </div>`;
    $('#logout').onclick = () => Store.signOut();
  }

  /* ============================== Coquille ============================== */
  function renderShell() {
    $('#app').innerHTML = `
      ${Store.online ? '' : '<div class="banner">Mode démo : les données restent dans ce navigateur et ne sont pas partagées.</div>'}
      <header class="topbar">
        <div class="topbar-row">
          <div class="brand">Carnet de ${esc(PRENOM)}<small>${esc(S.member.display_name)}${S.requests.length ? ` · <b style="color:var(--warn)">${S.requests.length} demande(s) d’accès</b>` : ''}</small></div>
          ${Store.online ? '<button class="btn sm" id="logout">Déconnexion</button>' : ''}
        </div>
        <nav class="tabs" aria-label="Rubriques">${TABS.map(([k, l]) => `<button class="tab" data-tab="${k}">${l}</button>`).join('')}</nav>
      </header>
      <main id="main"></main>
      <button class="fab" id="fab" aria-label="Noter un épisode maintenant">+ Épisode</button>`;
    $$('.tab').forEach(t => t.onclick = () => { S.tab = t.dataset.tab; renderMain(); window.scrollTo(0, 0); });
    $('#fab').onclick = () => openEpisode();
    if ($('#logout')) $('#logout').onclick = () => Store.signOut();
    renderMain();
  }
  function renderMain() {
    S.stale = false;
    $$('.tab').forEach(t => { if (t.dataset.tab === S.tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
    const views = { jour: viewDay, episodes: viewEpisodes, sensoriel: viewSensory, changements: viewChanges, essais: viewTrials, bilan: viewBilan, reglages: viewSettings };
    views[S.tab]();
  }

  /* ========================= Fenêtre modale ========================= */
  function openModal(title, bodyHTML, { onSave, onDelete, saveLabel = 'Enregistrer' } = {}) {
    const dlg = $('#modal'), form = $('#modalForm');
    form.innerHTML = `
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn ghost sm" data-close aria-label="Fermer">✕</button></div>
      <div class="modal-body fields">${bodyHTML}</div>
      <div class="modal-foot">
        ${onDelete ? '<button type="button" class="btn danger" data-del>Supprimer</button><span class="spacer"></span>' : ''}
        <button type="button" class="btn" data-close>Annuler</button>
        ${onSave ? `<button type="submit" class="btn primary">${saveLabel}</button>` : ''}
      </div>`;
    $$('[data-close]', form).forEach(b => b.onclick = () => dlg.close());
    if (onDelete) $('[data-del]', form).onclick = async () => { if (await onDelete()) dlg.close(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      if (!onSave) return;
      const btn = $('button[type=submit]', form); btn.disabled = true;
      try { if ((await onSave(form)) !== false) dlg.close(); } catch { /* message déjà affiché */ }
      btn.disabled = false;
    };
    dlg.onclose = () => { renderMain(); };
    dlg.showModal();
    return form;
  }

  /* ============================ AUJOURD'HUI ============================ */
  function viewDay() {
    const day = byKind('day').find(e => e.date === S.day);
    const d = day?.data || {};
    const eps = byKind('episode').filter(e => e.date === S.day);
    const sens = byKind('sensory').filter(e => e.date === S.day);
    const changesSoon = byKind('change').filter(e => e.date >= todayISO() && e.date <= addDays(todayISO(), 7));
    const activeTrials = byKind('trial').filter(t => !t.data.fin);
    $('#main').innerHTML = `
      <div class="stack">
        <div class="row">
          <button class="btn sm" id="prevDay" aria-label="Jour précédent">‹</button>
          <input type="date" id="dayPick" value="${S.day}" max="${todayISO()}" style="max-width:180px" aria-label="Date">
          <button class="btn sm" id="nextDay" aria-label="Jour suivant" ${S.day >= todayISO() ? 'disabled' : ''}>›</button>
          <h2 style="margin-left:6px">${fmtDate(S.day, true)}</h2>
        </div>
        ${changesSoon.length ? `<div class="alert"><b>Changements dans les 7 jours :</b> ${changesSoon.map(c => `${esc(c.data.titre)} (${fmtDate(c.date)})`).join(' · ')} — penser à l’annoncer tôt, avec un visuel.</div>` : ''}
        ${activeTrials.length ? `<div class="alert info"><b>Essai en cours :</b> ${activeTrials.map(t => esc(t.data.titre)).join(', ')} — noter son effet dans « Essais ».</div>` : ''}
        <div class="grid2">
          <section class="card" id="dayForm">
            <div class="card-head"><h3>Fiche du jour</h3><span class="saved" id="daySaved">${day ? 'Par ' + esc(author(day.updated_by)) : ''}</span></div>
            <p class="muted small">Axe somatique : repérer les liens entre transit, sommeil, reflux, alimentation et comportements.</p>
            <div class="fields">
              ${DAY_FIELDS.map(([k, l, opts]) => `<div><span class="field-label">${l}</span>${seg(k, opts, d[k])}</div>`).join('')}
              <label class="field"><span>Remarques de la journée</span><textarea name="note" rows="2">${esc(d.note)}</textarea></label>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h3>Noté ce jour-là</h3></div>
            <div class="row" style="margin:10px 0">
              <button class="btn primary sm" id="addEp">+ Épisode / observation</button>
              <button class="btn sm" id="addSens">+ Séance sensorielle</button>
            </div>
            ${eps.length + sens.length === 0 ? '<div class="empty">Rien de noté pour l’instant.</div>' :
              [...eps.map(episodeHTML), ...sens.map(sensoryHTML)].join('')}
          </section>
        </div>
      </div>`;
    $('#dayPick').onchange = e => { if (e.target.value) { S.day = e.target.value; renderMain(); } };
    $('#prevDay').onclick = () => { S.day = addDays(S.day, -1); renderMain(); };
    $('#nextDay').onclick = () => { S.day = addDays(S.day, 1); renderMain(); };
    $('#addEp').onclick = () => openEpisode(null, S.day);
    $('#addSens').onclick = () => openSensory(null, S.day);
    bindEntryButtons($('#main'));

    let timer, dayId = day?.id;
    const form = $('#dayForm');
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const vals = readForm(form);
        $('#daySaved').textContent = 'Enregistrement…';
        try {
          const row = await saveEntry({ id: dayId, kind: 'day', date: S.day, data: vals });
          dayId = row.id;
          $('#daySaved').textContent = 'Enregistré ✓';
        } catch { $('#daySaved').textContent = 'Non enregistré'; }
      }, 700);
    };
    form.addEventListener('change', save);
    form.addEventListener('input', save);
    form.addEventListener('focusout', () => setTimeout(() => { if (S.stale && !form.contains(document.activeElement)) renderMain(); }, 1500));
  }

  function bindEntryButtons(root) {
    $$('[data-edit]', root).forEach(b => b.onclick = () => {
      const e = S.entries.find(x => x.id === b.dataset.edit);
      if (!e) return;
      ({ episode: openEpisode, sensory: openSensory, change: openChange, trial: openTrial })[e.kind](e);
    });
    $$('[data-followup]', root).forEach(b => b.onclick = () => openFollowUp(S.entries.find(x => x.id === b.dataset.followup)));
  }

  /* ============================== ÉPISODES ============================== */
  function effectTag(v) {
    if (!v) return '';
    const cls = { apaise: 'ok', mieux: 'ok', pire: 'crise', rien: 'warn' }[v] || '';
    return `<span class="tag ${cls}">${esc(label(EFFECTS, v))}</span>`;
  }
  function episodeHTML(e) {
    const d = e.data;
    return `<article class="entry">
      <div class="row"><span class="tag ${d.type}">${esc(label(EP_TYPES, d.type))}</span>${effectTag(d.effet)}
        ${d.signale === 'oui' ? '<span class="tag ok">A signalé lui-même</span>' : ''}
        <span class="spacer"></span><button class="btn sm" data-edit="${e.id}">Ouvrir</button></div>
      <div class="entry-meta">${fmtDate(e.date)}${d.heure ? ' · ' + esc(d.heure) : ''} · ${esc(author(e.created_by))}</div>
      ${d.contexte?.length || d.contexteTxt ? `<p class="kv"><b>Contexte :</b> ${esc([...(d.contexte || []), d.contexteTxt].filter(Boolean).join(', '))}</p>` : ''}
      ${d.signes?.length ? `<p class="kv"><b>Signes :</b> ${esc(d.signes.join(', '))}</p>` : ''}
      ${d.mesures?.length ? `<p class="kv"><b>Mesures :</b> ${esc(d.mesures.join(', '))}${d.delai ? ` · effet en ${esc(d.delai)} min` : ''}</p>` : ''}
      ${d.evitee ? `<p class="kv"><b>Crise évitée :</b> ${esc(label(YESNO, d.evitee))}</p>` : ''}
      ${d.notes ? `<p class="kv">${esc(d.notes)}</p>` : ''}
    </article>`;
  }
  function openEpisode(entry, date) {
    const d = entry?.data || { heure: nowHM() };
    const body = `
      <div class="fields two">
        <label class="field"><span>Date</span><input type="date" name="date" value="${entry?.date || date || todayISO()}" required></label>
        <label class="field"><span>Heure</span><input type="time" name="heure" value="${esc(d.heure)}"></label>
      </div>
      <div><span class="field-label">Type</span>${seg('type', EP_TYPES, d.type || '')}</div>
      <div><span class="field-label">Contexte</span>${multi('contexte', CONTEXTS, d.contexte)}
        <input type="text" name="contexteTxt" value="${esc(d.contexteTxt)}" placeholder="Précisions (lieu, personne, ce qui venait de se passer…)" style="margin-top:8px"></div>
      <div><span class="field-label">Signes observés</span>${multi('signes', signs(), d.signes)}</div>
      <div><span class="field-label">Mesures prises</span>${multi('mesures', measures(), d.mesures)}</div>
      <div><span class="field-label">Effet</span>${seg('effet', EFFECTS, d.effet)}</div>
      <div class="fields two">
        <label class="field"><span>Effet au bout de (minutes)</span><input type="number" name="delai" min="0" inputmode="numeric" value="${esc(d.delai)}"></label>
        <label class="field"><span>Durée de l’apaisement</span><input type="text" name="duree" value="${esc(d.duree)}" placeholder="ex. 2 h"></label>
      </div>
      <div><span class="field-label">Crise évitée ?</span>${seg('evitee', YESNO, d.evitee)}</div>
      <div><span class="field-label">${esc(PRENOM)} a signalé son mal-être lui-même (picto, TLA…) ?</span>${seg('signale', YESNO, d.signale)}</div>
      <label class="field"><span>Notes</span><textarea name="notes" rows="3">${esc(d.notes)}</textarea></label>
      <p class="muted small">Pendant les signes de pré-crise : peu de paroles, présenter le pictogramme et le TLA, laisser de l’espace. Pas de massage ni d’approche physique rapprochée.</p>`;
    openModal(entry ? 'Épisode' : 'Nouvel épisode', body, {
      onSave: async form => {
        const f = readForm(form);
        if (!f.type) { toast('Choisis le type d’épisode'); return false; }
        const { date: dt, ...data } = f;
        await saveEntry({ id: entry?.id, kind: 'episode', date: dt, data });
        // Un nouveau signe observé rejoint la liste des signes de pré-crise propres à l'enfant.
        const newSigns = (data.signes || []).filter(x => !signs().includes(x));
        if (newSigns.length) { try { const list = [...signs(), ...newSigns]; await Store.saveSetting('signs', list); S.settings.signs = list; } catch { /* non bloquant */ } }
        toast('Épisode enregistré');
      },
      onDelete: entry && canDelete(entry) ? () => deleteEntry(entry.id) : null,
    });
  }
  function viewEpisodes() {
    const q = S.epSearch.toLowerCase();
    const list = byKind('episode').filter(e => (!S.epFilter || e.data.type === S.epFilter) && (!q || JSON.stringify(e.data).toLowerCase().includes(q)));
    $('#main').innerHTML = `
      <div class="stack">
        <div class="row"><h2>Épisodes et observations</h2><span class="spacer"></span><button class="btn primary" id="add">+ Nouvel épisode</button></div>
        <p class="muted small">Date, contexte, signes, mesures et effet : les informations précises à transmettre aux médecins.</p>
        <div class="card fields">
          ${seg('filter', EP_TYPES, S.epFilter)}
          <input type="text" id="search" placeholder="Rechercher (ex. Doliprane, transition…)" value="${esc(S.epSearch)}" aria-label="Rechercher">
        </div>
        <section class="card">${list.length ? list.map(episodeHTML).join('') : '<div class="empty">Aucun épisode.</div>'}</section>
      </div>`;
    $('#add').onclick = () => openEpisode();
    $('[data-seg="filter"]').addEventListener('change', e => { S.epFilter = ($('.chip.on', e.currentTarget) || {}).dataset?.v || ''; renderMain(); });
    $('#search').oninput = e => { S.epSearch = e.target.value; clearTimeout(S._st); S._st = setTimeout(() => { renderMain(); const s = $('#search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 400); };
    bindEntryButtons($('#main'));
  }

  /* ============================== SENSORIEL ============================== */
  const SENS_ITEMS = [
    ['massage', 'Massage doux épaules / nuque', 'Sans pression forte, arrêter au moindre inconfort.'],
    ['vibrations', 'Vibrations bouche / gorge', 'Selon les modalités validées avec l’orthophoniste.'],
  ];
  function sensoryHTML(e) {
    const d = e.data;
    const parts = [];
    if (d.massage?.fait) parts.push(`Massage${d.massage.coussin ? ' (coussin vibrant)' : ''} : ${label(REACTIONS, d.massage.reaction) || '—'}`);
    if (d.vibrations?.fait) parts.push(`Vibrations${d.vibrations.zones?.length ? ' (' + d.vibrations.zones.join(', ') + ')' : ''} : ${label(REACTIONS, d.vibrations.reaction) || '—'}`);
    (d.senteurs || []).forEach(s => parts.push(`Senteur « ${s.nom} » : ${label(REACTIONS, s.reaction) || '—'}`));
    (d.gouts || []).forEach(s => parts.push(`Goût « ${s.nom} » : ${label(REACTIONS, s.reaction) || '—'}`));
    return `<article class="entry">
      <div class="row"><span class="tag">Séance sensorielle</span>${effectTag(d.effet)}<span class="spacer"></span><button class="btn sm" data-edit="${e.id}">Ouvrir</button></div>
      <div class="entry-meta">${fmtDate(e.date)}${d.heure ? ' · ' + esc(d.heure) : ''} · ${esc(author(e.created_by))}</div>
      ${parts.length ? `<p class="kv">${esc(parts.join(' · '))}</p>` : ''}
      ${d.alimApres ? `<p class="kv"><b>Recherches alimentaires ensuite :</b> ${esc(label(ALIM_AFTER, d.alimApres))}</p>` : ''}
      ${d.notes ? `<p class="kv">${esc(d.notes)}</p>` : ''}
    </article>`;
  }
  const ALIM_AFTER = [['moins', 'Moins'], ['pareil', 'Pareil'], ['plus', 'Plus']];
  function knownNames(field) { return uniq(byKind('sensory').flatMap(e => (e.data[field] || []).map(x => x.nom))).sort(); }
  function subRowHTML(field, item = {}) {
    return `<div class="subrow" data-sub="${field}">
      <input type="text" data-subname value="${esc(item.nom)}" placeholder="${field === 'senteurs' ? 'ex. lavande' : 'ex. moutarde'}" list="dl-${field}" aria-label="Nom">
      ${seg('reaction', REACTIONS, item.reaction)}
      <button type="button" class="btn ghost sm" data-subdel aria-label="Retirer">✕</button></div>`;
  }
  function openSensory(entry, date) {
    const d = entry?.data || { heure: nowHM() };
    const body = `
      <div class="fields two">
        <label class="field"><span>Date</span><input type="date" name="date" value="${entry?.date || date || todayISO()}" required></label>
        <label class="field"><span>Heure</span><input type="time" name="heure" value="${esc(d.heure)}"></label>
      </div>
      <p class="muted small">Un temps court, au calme, quand ${esc(PRENOM)} est disponible et d’accord. Profil plutôt hyposensoriel : des stimulations nettes et variées.</p>
      ${SENS_ITEMS.map(([k, l, hint]) => `
        <fieldset data-block="${k}">
          <legend>${l}</legend>
          <label class="row"><input type="checkbox" data-fait ${d[k]?.fait ? 'checked' : ''}> Proposé</label>
          ${k === 'massage' ? `<label class="row"><input type="checkbox" data-coussin ${d.massage?.coussin ? 'checked' : ''}> Avec le petit coussin vibrant</label>` : ''}
          ${k === 'vibrations' ? `<div style="margin-top:8px">${multi('zones', ['Autour de la bouche', 'Dans la bouche', 'Gorge'], d.vibrations?.zones || [], false)}</div>` : ''}
          <div style="margin-top:8px"><span class="field-label">Réaction</span>${seg('reaction', REACTIONS, d[k]?.reaction)}</div>
          <p class="muted small" style="margin:6px 0 0">${hint}</p>
        </fieldset>`).join('')}
      ${[['senteurs', 'Atelier olfactif', 'Repérer les senteurs appréciées, à mettre ensuite dans un contenant fermé (pochette, banane).'],
         ['gouts', 'Goûts marqués', 'Très petites quantités, sous surveillance : épices douces, moutarde, ail, oignon…']].map(([k, l, hint]) => `
        <fieldset>
          <legend>${l}</legend>
          <div data-list="${k}">${(d[k] || []).map(it => subRowHTML(k, it)).join('')}</div>
          <datalist id="dl-${k}">${knownNames(k).map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          <button type="button" class="btn sm" data-subadd="${k}">+ Ajouter</button>
          <p class="muted small" style="margin:6px 0 0">${hint}</p>
        </fieldset>`).join('')}
      <div><span class="field-label">Après la séance, ${esc(PRENOM)} paraît</span>${seg('effet', EFFECTS, d.effet)}</div>
      <div><span class="field-label">Recherches alimentaires ensuite</span>${seg('alimApres', ALIM_AFTER, d.alimApres)}</div>
      <label class="field"><span>Durée de l’effet</span><input type="text" name="duree" value="${esc(d.duree)}" placeholder="ex. 1 h 30"></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="2">${esc(d.notes)}</textarea></label>`;
    const form = openModal(entry ? 'Séance sensorielle' : 'Nouvelle séance sensorielle', body, {
      onSave: async form => {
        const data = { heure: $('[name=heure]', form).value, duree: $('[name=duree]', form).value.trim(), notes: $('[name=notes]', form).value.trim() };
        data.effet = ($('[data-seg="effet"] .chip.on', form) || {}).dataset?.v || '';
        data.alimApres = ($('[data-seg="alimApres"] .chip.on', form) || {}).dataset?.v || '';
        SENS_ITEMS.forEach(([k]) => {
          const fs = $(`[data-block="${k}"]`, form);
          data[k] = {
            fait: $('[data-fait]', fs).checked,
            reaction: ($('[data-seg="reaction"] .chip.on', fs) || {}).dataset?.v || '',
          };
          if (k === 'massage') data[k].coussin = $('[data-coussin]', fs).checked;
          if (k === 'vibrations') data[k].zones = $$('[data-multi="zones"] .chip.on', fs).map(c => c.dataset.v);
          if (data[k].reaction) data[k].fait = true;
        });
        ['senteurs', 'gouts'].forEach(k => {
          data[k] = $$(`[data-list="${k}"] .subrow`, form).map(r => ({
            nom: $('[data-subname]', r).value.trim(),
            reaction: ($('.chip.on', r) || {}).dataset?.v || '',
          })).filter(x => x.nom);
        });
        await saveEntry({ id: entry?.id, kind: 'sensory', date: $('[name=date]', form).value, data });
        toast('Séance enregistrée');
      },
      onDelete: entry && canDelete(entry) ? () => deleteEntry(entry.id) : null,
    });
    // Les champs de saisie ne doivent pas être lus comme « name » génériques : gestion manuelle ci-dessus.
    form.addEventListener('click', ev => {
      const add = ev.target.closest('[data-subadd]');
      if (add) {
        const list = $(`[data-list="${add.dataset.subadd}"]`, form);
        list.insertAdjacentHTML('beforeend', subRowHTML(add.dataset.subadd));
        $('.subrow:last-child input', list).focus();
      }
      const del = ev.target.closest('[data-subdel]');
      if (del) del.closest('.subrow').remove();
    });
  }
  function preferences() {
    const tally = field => {
      const m = {};
      byKind('sensory').forEach(e => (e.data[field] || []).forEach(({ nom, reaction }) => {
        const key = nom.trim().toLowerCase();
        m[key] = m[key] || { nom: nom.trim(), aime: 0, neutre: 0, refus: 0 };
        if (reaction) m[key][reaction]++;
      }));
      return Object.values(m).sort((a, b) => (b.aime - b.refus) - (a.aime - a.refus));
    };
    return { senteurs: tally('senteurs'), gouts: tally('gouts') };
  }
  function viewSensory() {
    const list = byKind('sensory');
    const prefs = preferences();
    const week = list.filter(e => e.date > addDays(todayISO(), -7)).length;
    const prefTable = (rows, empty) => rows.length ? `<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Apprécie</th><th>Neutre</th><th>Refus</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${r.aime > r.refus ? '★ ' : ''}${esc(r.nom)}</td><td>${r.aime}</td><td>${r.neutre}</td><td>${r.refus}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${empty}</div>`;
    $('#main').innerHTML = `
      <div class="stack">
        <div class="row"><h2>Prévention et régulation sensorielle</h2><span class="spacer"></span><button class="btn primary" id="add">+ Séance</button></div>
        <p class="muted small">Protocole proposé une à deux fois par jour. ${week} séance(s) ces 7 derniers jours.</p>
        <div class="grid2">
          <section class="card"><h3>Senteurs</h3>${prefTable(prefs.senteurs, 'Aucune senteur testée.')}</section>
          <section class="card"><h3>Goûts</h3>${prefTable(prefs.gouts, 'Aucun goût testé.')}</section>
        </div>
        <section class="card"><h3>Séances</h3>${list.length ? list.map(sensoryHTML).join('') : '<div class="empty">Aucune séance notée.</div>'}</section>
      </div>`;
    $('#add').onclick = () => openSensory();
    bindEntryButtons($('#main'));
  }

  /* ============================ CHANGEMENTS ============================ */
  const CHANGE_CHECKS = [
    ['annonce', 'Annoncé le plus tôt possible'],
    ['visuel', 'Visuel / emploi du temps / schéma préparé'],
    ['essentiel', 'Seulement l’essentiel : quoi, qui, où, quand'],
    ['timer', 'Timer prévu pour l’attente ou la transition'],
    ['siBesoin', 'Traitement « si besoin » anticipé (si situation anxiogène)'],
  ];
  const OUTCOMES = [['bien', 'Bien passé'], ['difficile', 'Difficile'], ['crise', 'Crise']];
  function openChange(entry) {
    const d = entry?.data || {};
    const body = `
      <label class="field"><span>Quel changement ?</span><input type="text" name="titre" value="${esc(d.titre)}" required placeholder="ex. Rendez-vous médecin, remplaçant, sortie…"></label>
      <div class="fields two">
        <label class="field"><span>Date</span><input type="date" name="date" value="${entry?.date || todayISO()}" required></label>
        <label class="field"><span>Heure</span><input type="time" name="heure" value="${esc(d.heure)}"></label>
      </div>
      <div class="fields two">
        <label class="field"><span>Avec qui</span><input type="text" name="qui" value="${esc(d.qui)}"></label>
        <label class="field"><span>Où</span><input type="text" name="ou" value="${esc(d.ou)}"></label>
      </div>
      <fieldset><legend>Préparation</legend>
        ${CHANGE_CHECKS.map(([k, l]) => `<label class="row" style="margin:6px 0"><input type="checkbox" name="${k}" ${d[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
      </fieldset>
      <div><span class="field-label">Comment ça s’est passé</span>${seg('bilan', OUTCOMES, d.bilan)}</div>
      <label class="field"><span>Notes</span><textarea name="notes" rows="2">${esc(d.notes)}</textarea></label>`;
    openModal(entry ? 'Changement' : 'Nouveau changement à préparer', body, {
      onSave: async form => {
        const { date, ...data } = readForm(form);
        if (!data.titre) { toast('Indique le changement'); return false; }
        await saveEntry({ id: entry?.id, kind: 'change', date, data });
        toast('Changement enregistré');
      },
      onDelete: entry && canDelete(entry) ? () => deleteEntry(entry.id) : null,
    });
  }
  function changeHTML(e) {
    const d = e.data, done = CHANGE_CHECKS.filter(([k]) => d[k]).length;
    return `<article class="entry">
      <div class="row"><b>${esc(d.titre)}</b>${d.bilan ? `<span class="tag ${d.bilan === 'bien' ? 'ok' : d.bilan === 'crise' ? 'crise' : 'warn'}">${label(OUTCOMES, d.bilan)}</span>` : ''}
        <span class="spacer"></span><button class="btn sm" data-edit="${e.id}">Ouvrir</button></div>
      <div class="entry-meta">${fmtDate(e.date)}${d.heure ? ' · ' + esc(d.heure) : ''}${d.qui ? ' · ' + esc(d.qui) : ''}${d.ou ? ' · ' + esc(d.ou) : ''}</div>
      <p class="kv">Préparation : ${done}/${CHANGE_CHECKS.length}${done < CHANGE_CHECKS.length ? ' — reste : ' + esc(CHANGE_CHECKS.filter(([k]) => !d[k]).map(([, l]) => l.toLowerCase()).join(' ; ')) : ' ✓'}</p>
    </article>`;
  }
  function viewChanges() {
    const all = byKind('change');
    const upcoming = all.filter(e => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
    const past = all.filter(e => e.date < todayISO());
    $('#main').innerHTML = `
      <div class="stack">
        <div class="row"><h2>Changements et situations nouvelles</h2><span class="spacer"></span><button class="btn primary" id="add">+ Changement</button></div>
        <p class="muted small">Rendre les événements prévisibles : informer tôt, montrer avec un visuel, phrases courtes, laisser le temps de comprendre.</p>
        <section class="card"><h3>À venir</h3>${upcoming.length ? upcoming.map(changeHTML).join('') : '<div class="empty">Aucun changement prévu.</div>'}</section>
        <section class="card"><h3>Passés</h3>${past.length ? past.map(changeHTML).join('') : '<div class="empty">—</div>'}</section>
      </div>`;
    $('#add').onclick = () => openChange();
    bindEntryButtons($('#main'));
  }

  /* =============================== ESSAIS =============================== */
  const Q3 = [['oui', 'Oui'], ['un_peu', 'Un peu'], ['non', 'Non']];
  function openTrial(entry) {
    const d = entry?.data || {};
    const active = byKind('trial').filter(t => !t.data.fin && t.id !== entry?.id);
    const body = `
      ${!entry && active.length ? `<div class="alert">Un essai est déjà en cours (${esc(active.map(t => t.data.titre).join(', '))}). Il est conseillé de tester <b>une modification à la fois</b> et de clore l’essai précédent d’abord.</div>` : ''}
      <label class="field"><span>Modification testée</span><input type="text" name="titre" value="${esc(d.titre)}" required placeholder="ex. Vibrations buccales avant le repas du soir"></label>
      <div class="fields two">
        <label class="field"><span>Début</span><input type="date" name="date" value="${entry?.date || todayISO()}" required></label>
        <label class="field"><span>Fin (laisser vide si en cours)</span><input type="date" name="fin" value="${esc(d.fin)}"></label>
      </div>
      <label class="field"><span>Détails / consigne</span><textarea name="details" rows="2">${esc(d.details)}</textarea></label>
      <label class="field"><span>Conclusion</span><textarea name="conclusion" rows="2" placeholder="À remplir en fin d’essai">${esc(d.conclusion)}</textarea></label>`;
    openModal(entry ? 'Essai' : 'Nouvel essai', body, {
      onSave: async form => {
        const { date, ...f } = readForm(form);
        if (!f.titre) { toast('Indique la modification testée'); return false; }
        await saveEntry({ id: entry?.id, kind: 'trial', date, data: { ...d, ...f } });
        toast('Essai enregistré');
      },
      onDelete: entry && canDelete(entry) ? () => deleteEntry(entry.id) : null,
    });
  }
  function openFollowUp(trial) {
    const body = `
      <p class="muted">${esc(trial.data.titre)}</p>
      <label class="field"><span>Date</span><input type="date" name="date" value="${todayISO()}"></label>
      <div><span class="field-label">${esc(PRENOM)} accepte-t-il la proposition ?</span>${seg('accepte', Q3, '')}</div>
      <div><span class="field-label">Paraît-il plus apaisé ?</span>${seg('apaise', Q3, '')}</div>
      <div><span class="field-label">Les recherches alimentaires ou signes de tension diminuent-ils ?</span>${seg('diminue', Q3, '')}</div>
      <label class="field"><span>Combien de temps l’effet semble-t-il durer ?</span><input type="text" name="duree" placeholder="ex. 45 min"></label>
      <label class="field"><span>Remarque</span><textarea name="note" rows="2"></textarea></label>`;
    openModal('Noter l’effet', body, {
      onSave: async form => {
        const f = readForm(form);
        f.by = S.user.id;
        const fresh = S.entries.find(e => e.id === trial.id) || trial;
        const suivis = [...(fresh.data.suivis || []), f].sort((a, b) => a.date.localeCompare(b.date));
        await saveEntry({ id: trial.id, kind: 'trial', date: fresh.date, data: { ...fresh.data, suivis } });
        toast('Suivi ajouté');
      },
    });
  }
  function trialHTML(e) {
    const d = e.data, s = d.suivis || [];
    const count = (k, v) => s.filter(x => x[k] === v).length;
    return `<article class="entry">
      <div class="row"><b>${esc(d.titre)}</b><span class="tag ${d.fin ? '' : 'ok'}">${d.fin ? 'Terminé' : 'En cours'}</span>
        <span class="spacer"></span>${d.fin ? '' : `<button class="btn primary sm" data-followup="${e.id}">+ Noter l’effet</button>`}<button class="btn sm" data-edit="${e.id}">Ouvrir</button></div>
      <div class="entry-meta">Du ${fmtDate(e.date)}${d.fin ? ' au ' + fmtDate(d.fin) : ''} · ${s.length} observation(s)</div>
      ${d.details ? `<p class="kv">${esc(d.details)}</p>` : ''}
      ${s.length ? `<p class="kv"><b>Accepte</b> ${count('accepte', 'oui')}/${s.length} · <b>Plus apaisé</b> ${count('apaise', 'oui')}/${s.length} · <b>Diminution</b> ${count('diminue', 'oui')}/${s.length}</p>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Accepte</th><th>Apaisé</th><th>Diminue</th><th>Durée</th><th>Remarque</th></tr></thead><tbody>
        ${s.map(x => `<tr><td>${fmtDate(x.date)}</td><td>${label(Q3, x.accepte)}</td><td>${label(Q3, x.apaise)}</td><td>${label(Q3, x.diminue)}</td><td>${esc(x.duree)}</td><td>${esc(x.note)}${x.by ? ` <span class="muted small">— ${esc(author(x.by))}</span>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
      ${d.conclusion ? `<p class="kv"><b>Conclusion :</b> ${esc(d.conclusion)}</p>` : ''}
    </article>`;
  }
  function viewTrials() {
    const all = byKind('trial');
    const active = all.filter(t => !t.data.fin);
    $('#main').innerHTML = `
      <div class="stack">
        <div class="row"><h2>Essais</h2><span class="spacer"></span><button class="btn primary" id="add">+ Nouvel essai</button></div>
        <p class="muted small">Tester une modification à la fois, et noter brièvement : accepte-t-il ? plus apaisé ? moins de recherches alimentaires ou de tension ? combien de temps dure l’effet ?</p>
        ${active.length > 1 ? '<div class="alert">Plusieurs essais sont en cours en même temps : difficile de savoir lequel agit.</div>' : ''}
        <section class="card">${all.length ? all.map(trialHTML).join('') : '<div class="empty">Aucun essai.</div>'}</section>
      </div>`;
    $('#add').onclick = () => openTrial();
    bindEntryButtons($('#main'));
  }

  /* =============================== BILAN =============================== */
  function computeBilan(from, to) {
    const inRange = e => e.date >= from && e.date <= to;
    const eps = byKind('episode').filter(inRange);
    const days = byKind('day').filter(inRange);
    const sens = byKind('sensory').filter(inRange);
    const changes = byKind('change').filter(inRange);
    const trials = byKind('trial').filter(t => t.date <= to && (!t.data.fin || t.data.fin >= from));
    const nbDays = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
    const byType = Object.fromEntries(EP_TYPES.map(([k]) => [k, eps.filter(e => e.data.type === k).length]));

    const tense = eps.filter(e => ['precrise', 'crise', 'douleur'].includes(e.data.type));
    const perDay = {};
    tense.forEach(e => { perDay[e.date] = (perDay[e.date] || 0) + 1; });

    const correl = DAY_FIELDS.filter(([k]) => k !== 'tension').map(([k, l, opts]) => ({
      label: l,
      rows: opts.map(([v, lv]) => {
        const ds = days.filter(d => d.data[k] === v);
        const total = ds.reduce((n, d) => n + (perDay[d.date] || 0), 0);
        return { label: lv, days: ds.length, avg: ds.length ? total / ds.length : null };
      }),
    }));

    const measureStats = {};
    eps.forEach(e => (e.data.mesures || []).forEach(m => {
      const s = measureStats[m] = measureStats[m] || { n: 0, ok: 0, rated: 0 };
      s.n++;
      if (e.data.effet && e.data.effet !== 'nsp') { s.rated++; if (['apaise', 'mieux'].includes(e.data.effet)) s.ok++; }
    }));

    const precrise = eps.filter(e => e.data.type === 'precrise');
    return {
      from, to, nbDays, eps, days, sens, changes, trials, byType, correl,
      measures: Object.entries(measureStats).sort((a, b) => b[1].n - a[1].n),
      avoided: precrise.filter(e => e.data.evitee === 'oui').length, precriseRated: precrise.filter(e => e.data.evitee).length,
      selfReport: eps.filter(e => e.data.signale === 'oui').length,
      avgTension: days.filter(d => d.data.tension).length ? days.reduce((n, d) => n + (+d.data.tension || 0), 0) / days.filter(d => d.data.tension).length : null,
      optifibre: days.filter(d => d.data.optifibre === 'oui').length,
    };
  }
  function bilanHTML(b, forPrint) {
    const avg = v => v == null ? '—' : v.toFixed(1).replace('.', ',');
    const prefs = preferences();
    return `
      <div class="stack">
        <div>
          <h2>Bilan de suivi — ${esc(PRENOM)}</h2>
          <p class="muted">Du ${fmtDate(b.from, true)} au ${fmtDate(b.to, true)} (${b.nbDays} jours) · ${b.days.length} fiche(s) du jour renseignée(s)</p>
        </div>
        <div class="stats">
          <div class="card"><div class="stat">${b.byType.crise}</div><div class="small muted">crises</div></div>
          <div class="card"><div class="stat">${b.byType.precrise}</div><div class="small muted">épisodes de pré-crise</div></div>
          <div class="card"><div class="stat">${b.precriseRated ? pct(b.avoided, b.precriseRated) + ' %' : '—'}</div><div class="small muted">pré-crises où la crise a été évitée</div></div>
          <div class="card"><div class="stat">${b.selfReport}</div><div class="small muted">fois où ${esc(PRENOM)} a signalé son mal-être</div></div>
          <div class="card"><div class="stat">${b.byType.douleur}</div><div class="small muted">douleurs suspectées</div></div>
          <div class="card"><div class="stat">${avg(b.avgTension)}</div><div class="small muted">tension moyenne (1 à 5)</div></div>
        </div>

        <section class="card">
          <h3>Liens possibles avec l’état du jour</h3>
          <p class="muted small">Nombre moyen d’épisodes de pré-crise, crise ou douleur par jour, selon ce qui a été noté dans la fiche du jour. À interpréter avec prudence quand il y a peu de jours.</p>
          <div class="table-wrap"><table><thead><tr><th>Critère</th><th>Valeur</th><th>Jours</th><th>Épisodes / jour</th></tr></thead><tbody>
          ${b.correl.map(c => c.rows.map((r, i) => `<tr>${i === 0 ? `<td rowspan="${c.rows.length}"><b>${esc(c.label)}</b></td>` : ''}<td>${esc(r.label)}</td><td>${r.days}</td><td>${avg(r.avg)}</td></tr>`).join('')).join('')}
          </tbody></table></div>
          <p class="small">OptiFibre donné ${b.optifibre} jour(s) sur ${b.days.length} renseigné(s).</p>
        </section>

        <section class="card">
          <h3>Mesures prises et effet</h3>
          ${b.measures.length ? `<div class="table-wrap"><table><thead><tr><th>Mesure</th><th>Utilisée</th><th>Effet noté</th><th>Apaisé ou mieux</th></tr></thead><tbody>
          ${b.measures.map(([m, s]) => `<tr><td>${esc(m)}</td><td>${s.n}</td><td>${s.rated}</td><td>${s.rated ? `<div class="row"><div class="bar" style="width:80px"><i style="width:${pct(s.ok, s.rated)}%"></i></div>${pct(s.ok, s.rated)} %</div>` : '—'}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">Aucune mesure notée.</div>'}
        </section>

        <section class="card">
          <h3>Épisodes par type</h3>
          <p>${EP_TYPES.map(([k, l]) => `${esc(l)} : <b>${b.byType[k]}</b>`).join(' · ')}</p>
        </section>

        <section class="card">
          <h3>Sensoriel</h3>
          <p>${b.sens.length} séance(s) sur la période (${avg(b.sens.length / b.nbDays)} par jour).</p>
          <p class="kv"><b>Senteurs appréciées :</b> ${esc(prefs.senteurs.filter(r => r.aime > r.refus).map(r => r.nom).join(', ') || '—')}</p>
          <p class="kv"><b>Goûts appréciés :</b> ${esc(prefs.gouts.filter(r => r.aime > r.refus).map(r => r.nom).join(', ') || '—')}</p>
          <p class="kv"><b>Refusés :</b> ${esc([...prefs.senteurs, ...prefs.gouts].filter(r => r.refus > r.aime).map(r => r.nom).join(', ') || '—')}</p>
        </section>

        ${b.trials.length ? `<section class="card"><h3>Essais</h3>${b.trials.map(trialHTML).join('')}</section>` : ''}
        ${b.changes.length ? `<section class="card"><h3>Changements / situations nouvelles</h3>${b.changes.map(changeHTML).join('')}</section>` : ''}

        <section class="card">
          <h3>Détail chronologique des épisodes</h3>
          ${b.eps.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Contexte</th><th>Signes</th><th>Mesures</th><th>Effet</th><th>Notes</th></tr></thead><tbody>
          ${[...b.eps].reverse().map(e => { const d = e.data; return `<tr>
            <td>${fmtDate(e.date)}${d.heure ? '<br>' + esc(d.heure) : ''}</td><td>${esc(label(EP_TYPES, d.type))}</td>
            <td>${esc([...(d.contexte || []), d.contexteTxt].filter(Boolean).join(', '))}</td><td>${esc((d.signes || []).join(', '))}</td>
            <td>${esc((d.mesures || []).join(', '))}</td><td>${esc(label(EFFECTS, d.effet))}${d.delai ? ` (${esc(d.delai)} min)` : ''}${d.evitee === 'oui' ? '<br>crise évitée' : ''}</td>
            <td>${esc(d.notes)}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<div class="empty">Aucun épisode sur la période.</div>'}
        </section>
        ${forPrint ? `<p class="small muted">Document généré le ${fmtDate(todayISO(), true)} à partir du carnet de suivi partagé.</p>` : ''}
      </div>`;
  }
  function viewBilan() {
    const b = computeBilan(S.bilanFrom, S.bilanTo);
    $('#main').innerHTML = `
      <div class="stack">
        <div class="card fields">
          <div class="row">
            ${[[7, '7 jours'], [30, '30 jours'], [90, '3 mois']].map(([n, l]) => `<button class="btn sm" data-range="${n}">${l}</button>`).join('')}
            <span class="spacer"></span>
            <button class="btn primary" id="print">Imprimer / PDF</button>
          </div>
          <div class="fields two">
            <label class="field"><span>Du</span><input type="date" id="bFrom" value="${S.bilanFrom}"></label>
            <label class="field"><span>Au</span><input type="date" id="bTo" value="${S.bilanTo}"></label>
          </div>
        </div>
        ${bilanHTML(b)}
      </div>`;
    $$('[data-range]').forEach(btn => btn.onclick = () => { S.bilanTo = todayISO(); S.bilanFrom = addDays(S.bilanTo, -(+btn.dataset.range - 1)); renderMain(); });
    $('#bFrom').onchange = e => { if (e.target.value) { S.bilanFrom = e.target.value; renderMain(); } };
    $('#bTo').onchange = e => { if (e.target.value) { S.bilanTo = e.target.value; renderMain(); } };
    $('#print').onclick = () => printHTML(bilanHTML(b, true));
    $$('#main [data-edit], #main [data-followup]').forEach(x => x.classList.add('no-print'));
    bindEntryButtons($('#main'));
  }
  function printHTML(html) {
    const area = $('#printArea');
    area.innerHTML = html;
    $$('button', area).forEach(b => b.remove());
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }

  /* ============================== RÉGLAGES ============================== */
  function listEditor(key, title, hint, values) {
    return `<section class="card">
      <h3>${title}</h3><p class="muted small">${hint}</p>
      <ul class="listedit">${values.map((v, i) => `<li><span>${esc(v)}</span><button class="btn ghost sm" data-ldel="${key}" data-i="${i}" aria-label="Retirer ${esc(v)}">✕</button></li>`).join('')}</ul>
      <form class="row" data-ladd="${key}"><input type="text" placeholder="Ajouter…" style="flex:1;min-width:160px" aria-label="Ajouter à la liste"><button class="btn sm" type="submit">Ajouter</button></form>
    </section>`;
  }
  function viewSettings() {
    const admin = isAdmin();
    $('#main').innerHTML = `
      <div class="stack">
        <h2>Réglages</h2>
        <section class="card">
          <h3>Prénom de l’enfant suivi</h3>
          <p class="muted small">Enregistré dans la base protégée, jamais dans le code du site.</p>
          <form class="row" id="prenomForm"><input type="text" value="${esc(S.settings.prenom || '')}" style="flex:1;min-width:160px" aria-label="Prénom"><button class="btn sm" type="submit">Enregistrer</button></form>
        </section>
        ${admin && Store.online ? `
        <section class="card">
          <h3>Demandes d’accès</h3>
          <p class="muted small">Une personne crée son compte depuis la page de connexion, puis apparaît ici. Rien n’est visible pour elle tant que tu n’as pas accepté.</p>
          ${S.requests.length ? S.requests.map(r => `<div class="entry row">
            <div style="flex:1;min-width:180px"><b>${esc(r.display_name)}</b><div class="entry-meta">${esc(r.email)}</div></div>
            <select data-reqrole="${r.user_id}" style="width:auto" aria-label="Rôle">${ROLES.map(([v, l]) => `<option value="${v}" ${v === 'famille' ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button class="btn primary sm" data-approve="${r.user_id}">Accepter</button>
            <button class="btn danger sm" data-refuse="${r.user_id}">Refuser</button></div>`).join('') : '<div class="empty">Aucune demande en attente.</div>'}
        </section>` : ''}
        <section class="card">
          <h3>Membres du carnet</h3>
          ${S.members.map(m => `<div class="entry row">
            <div style="flex:1;min-width:180px"><b>${esc(m.display_name)}</b>${m.user_id === S.user.id ? ' <span class="tag">moi</span>' : ''}<div class="entry-meta">${esc(label(ROLES, m.role))}</div></div>
            ${admin && m.user_id !== S.user.id && Store.online ? `
              <select data-role="${m.user_id}" style="width:auto" aria-label="Rôle de ${esc(m.display_name)}">${ROLES.map(([v, l]) => `<option value="${v}" ${v === m.role ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <button class="btn danger sm" data-remove="${m.user_id}">Retirer l’accès</button>` : ''}
          </div>`).join('')}
          ${Store.online ? `<form class="row" id="renameForm" style="margin-top:12px"><input type="text" value="${esc(S.member.display_name)}" style="flex:1;min-width:160px" aria-label="Mon nom affiché"><button class="btn sm" type="submit">Changer mon nom affiché</button></form>` : ''}
        </section>
        ${listEditor('signs', `Signes de pré-crise propres à ${esc(PRENOM)}`, 'Proposés en cases à cocher dans chaque épisode. À compléter au fil des observations.', signs())}
        ${listEditor('regul', 'Activités de régulation (TLA)', 'Panel réduit d’activités connues et apaisantes, qu’il peut choisir lui-même. Elles apparaissent aussi dans les mesures.', regul())}
        <section class="card">
          <h3>Imprimer le TLA</h3>
          <p class="muted small">Une planche avec « Ça ne va pas » et les activités de régulation ci-dessus, à découper ou plastifier. Tu peux remplacer les symboles par les pictogrammes habituels de ${esc(PRENOM)}.</p>
          <button class="btn" id="printTla">Imprimer la planche</button>
        </section>
        <section class="card">
          <h3>Sauvegarde</h3>
          <p class="muted small">Télécharge une copie complète du carnet (fichier JSON) à garder en lieu sûr.</p>
          <button class="btn" id="export">Télécharger une sauvegarde</button>
        </section>
      </div>`;

    $$('[data-ldel]').forEach(b => b.onclick = async () => {
      const key = b.dataset.ldel, list = [...(key === 'signs' ? signs() : regul())];
      list.splice(+b.dataset.i, 1);
      await saveSetting(key, list);
    });
    $$('[data-ladd]').forEach(f => f.onsubmit = async ev => {
      ev.preventDefault();
      const key = f.dataset.ladd, v = $('input', f).value.trim();
      if (!v) return;
      await saveSetting(key, uniq([...(key === 'signs' ? signs() : regul()), v]));
    });
    $$('[data-approve]').forEach(b => b.onclick = () => adminAction(() => Store.approve(b.dataset.approve, $(`[data-reqrole="${b.dataset.approve}"]`).value), 'Accès accordé'));
    $$('[data-refuse]').forEach(b => b.onclick = () => confirm('Refuser cette demande ?') && adminAction(() => Store.refuse(b.dataset.refuse), 'Demande refusée'));
    $$('[data-role]').forEach(s => s.onchange = () => adminAction(() => Store.setRole(s.dataset.role, s.value), 'Rôle modifié'));
    $$('[data-remove]').forEach(b => b.onclick = () => confirm('Retirer l’accès au carnet à cette personne ? Ses notes restent dans le carnet.') && adminAction(() => Store.removeMember(b.dataset.remove), 'Accès retiré'));
    $('#prenomForm').onsubmit = async ev => {
      ev.preventDefault();
      const v = $('input', ev.target).value.trim();
      if (!v) return;
      PRENOM = v;
      await saveSetting('prenom', v);
      renderShell(); S.tab = 'reglages';
    };
    if ($('#renameForm')) $('#renameForm').onsubmit = ev => {
      ev.preventDefault();
      const v = $('input', ev.target).value.trim();
      if (v) adminAction(() => Store.rename(S.user.id, v), 'Nom modifié');
    };
    $('#printTla').onclick = () => {
      const icons = ['🌙', '⏸️', '〰️', '🌸', '🎧', '⭐', '⭐', '⭐'];
      printHTML(`<h2 style="margin-bottom:8mm">TLA de ${esc(PRENOM)}</h2><div class="tla">
        <div class="alerte"><span>😣</span>Ça ne va pas</div>
        ${regul().map((r, i) => `<div><span>${icons[i] || '⭐'}</span>${esc(r)}</div>`).join('')}</div>`);
    };
    $('#export').onclick = () => {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), members: S.members, settings: S.settings, entries: S.entries }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `carnet-${PRENOM.toLowerCase()}-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }
  async function saveSetting(key, value) {
    try { await Store.saveSetting(key, value); S.settings[key] = value; renderMain(); }
    catch (err) { toast('Erreur : ' + err.message); }
  }
  async function adminAction(fn, okMsg) {
    try {
      await fn();
      [S.members, S.requests] = await Promise.all([Store.members(), isAdmin() ? Store.requests() : []]);
      S.member = S.members.find(m => m.user_id === S.user.id) || S.member;
      toast(okMsg);
      renderShell();
    } catch (err) { toast('Erreur : ' + err.message); }
  }

  start();
})();
