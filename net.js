// Solscape online layer — Supabase adapter.
// Provides window.NET with the interface the game expects:
//   init(), flushSave(), pushPool(), pushBoard(), pushPresence(), tickPeers(dt,time), peers (Map), db (truthy when online)
// Uses: Supabase anonymous auth (one uid per browser), Postgres tables (backend/schema.sql),
// Realtime presence + broadcast for players and chat, postgres_changes for the shared pool.
window.NET = {
  db: null, sb: null, uid: null, chan: null, dirty: false, peers: new Map(), lastPresence: '',
  async init() {
    const cfg = window.SOLSCAPE_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { this.updateOnline(); return; }
    try {
      this.sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      let { data: { session } } = await this.sb.auth.getSession();
      if (!session) ({ data: { session } } = await this.sb.auth.signInAnonymously());
      if (!session) throw new Error('no session');
      this.uid = session.user.id; this.db = this.sb;
    } catch (e) { console.warn('Solscape: backend unavailable, running offline', e); this.updateOnline(); return; }

    // ---- cloud save
    try {
      const { data } = await this.sb.from('characters').select('data').eq('user_id', this.uid).maybeSingle();
      if (data && data.data) {
        const d = data.data; Object.assign(S, d);
        S.lv = Object.assign({}, DEFAULT.lv, d.lv || {}); S.xp = Object.assign({}, DEFAULT.xp, d.xp || {});
        buildPlayer(); ui(); log('Character loaded from the cloud.', 'sys');
      }
    } catch (e) { console.warn(e); }
    setInterval(() => this.flushSave(), 4000);

    // ---- shared reward pool
    try {
      const { data } = await this.sb.from('world').select('*').eq('id', 'pool').maybeSingle();
      if (data) { S.pool = +data.pool; S.treasury = +data.treasury; S.price = +data.price; }
      else await this.sb.from('world').insert({ id: 'pool', pool: S.pool, treasury: S.treasury, price: S.price });
      this.sb.channel('world-pool')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'world', filter: 'id=eq.pool' },
          p => { const d = p.new; S.pool = +d.pool; S.treasury = +d.treasury; S.price = +d.price; ui(); })
        .subscribe();
    } catch (e) { console.warn(e); }
    this.pushBoard();

    // ---- presence + chat
    document.getElementById('chatIn').style.display = 'block';
    this.chan = this.sb.channel('solscape-world', { config: { presence: { key: this.uid } } });
    this.chan
      .on('presence', { event: 'sync' }, () => {
        const state = this.chan.presenceState(); const seen = new Set();
        for (const key in state) { if (key === this.uid) continue; const st = state[key][state[key].length - 1]; seen.add(key); this.upsertPeer(key, st); }
        [...this.peers.keys()].forEach(k => { if (!seen.has(k)) this.removePeer(k); });
        this.updateOnline();
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (!payload || payload.from === this.uid) return;
        const p = this.peers.get(payload.from);
        log(`${(p && p.name) || 'Player'}: ${String(payload.text || '').slice(0, 140)}`);
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') { this.pushPresence(true); } });
    setInterval(() => this.pushPresence(), 200);
    this.updateOnline();
  },
  get room() { return this.chan ? { emit: (t, d) => this.chan.send({ type: 'broadcast', event: t, payload: Object.assign({ from: this.uid }, d) }) } : null; },
  updateOnline() {
    const n = 1 + this.peers.size; const el = document.getElementById('online');
    el.textContent = this.chan ? `● ${n} online` : '● offline'; el.style.color = this.chan ? 'var(--mint)' : 'var(--muted)';
  },
  async flushSave() {
    if (!this.dirty || !this.sb || !this.uid || this.saving) return;
    this.saving = true; this.dirty = false;
    try { await this.sb.from('characters').upsert({ user_id: this.uid, data: JSON.parse(JSON.stringify(S)), updated_at: new Date().toISOString() }); }
    catch (e) { this.dirty = true; }
    this.saving = false;
  },
  async pushPool() {
    if (!this.sb || this.pooling) return; this.pooling = true;
    try { await this.sb.from('world').update({ pool: S.pool, treasury: S.treasury, price: S.price, updated_at: new Date().toISOString() }).eq('id', 'pool'); } catch (e) {}
    this.pooling = false;
  },
  async pushBoard() {
    if (!this.sb || !this.uid) return;
    try { await this.sb.from('players').upsert({ user_id: this.uid, name: S.name, combat: combatLevel(), kills: S.kills, raids_w: S.raids.w, duels_w: S.duels.w, earned: Math.round(S.earned), updated_at: new Date().toISOString() }); } catch (e) {}
  },
  async leaderboard() {
    if (!this.sb) return [];
    const { data } = await this.sb.from('players').select('*').order('combat', { ascending: false }).limit(20);
    return (data || []).map(r => ({ name: r.name, combat: r.combat, kills: r.kills, raidsW: r.raids_w, duelsW: r.duels_w, earned: r.earned }));
  },
  pushPresence(force) {
    if (!this.chan) return;
    const st = { x: +player.x.toFixed(2), z: +player.z.toFixed(2), dir: +player.dir.toFixed(2), name: S.name, look: S.look || DEFAULT_LOOK, style: S.style, hp: S.hp, maxhp: S.maxhp, cl: combatLevel(), moving: !!(player.tx !== null || fightTarget || Object.keys(keys).some(k => keys[k])) };
    const key = JSON.stringify(st); if (!force && key === this.lastPresence) return; this.lastPresence = key;
    this.chan.track(st).catch(() => {});
  },
  upsertPeer(id, st) {
    if (!st || typeof st.x !== 'number') return;
    let e = this.peers.get(id); const lookKey = JSON.stringify([st.look, st.style]);
    if (!e) { e = { mesh: null, x: st.x, z: st.z, dir: st.dir || 0, name: 'Player', hp: 10, max: 10 }; this.peers.set(id, e); }
    if (e.lookKey !== lookKey) {
      if (e.mesh) scene.remove(e.mesh);
      const l = Object.assign({}, DEFAULT_LOOK, st.look || {}); const w = st.style === 'melee' ? 'sword' : st.style === 'ranged' ? 'bow' : 'staff';
      e.mesh = humanoid({ skin: LOOK.skin[l.skin] || LOOK.skin[1], hair: LOOK.hair[l.hair] || LOOK.hair[1], hairStyle: LOOK.hairStyle[l.hairStyle] || 'short', shirt: LOOK.shirt[l.shirt] || LOOK.shirt[0], cape: LOOK.cape[l.cape === undefined ? 0 : l.cape], weapon: w });
      scene.add(e.mesh); e.lookKey = lookKey;
    }
    e.tx = st.x; e.tz = st.z; e.tdir = st.dir || 0; e.name = String(st.name || 'Player').slice(0, 16); e.hp = st.hp || 10; e.max = st.maxhp || 10; e.lvl = st.cl; e.moving = !!st.moving;
  },
  removePeer(id) { const e = this.peers.get(id); if (!e) return; if (e.mesh) scene.remove(e.mesh); dropLabel(e); this.peers.delete(id); },
  tickPeers(dt, time) {
    this.peers.forEach(e => {
      if (!e.mesh) return; const k = Math.min(1, dt * 8);
      e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k; let dd = e.tdir - e.dir; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); e.dir += dd * k;
      place(e); e.mesh.rotation.y = e.dir; walkAnim(e.mesh, e.moving, time);
    });
  },
};
