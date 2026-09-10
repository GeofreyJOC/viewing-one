/* chat-widget.js — Viewing.One landing-page assistant
   Self-contained. Injects its own styles + UI. Talks to /api/chat.
   Turnstile (if configured) gates session start; server enforces all limits. */
(function () {
  'use strict';
  if (window.__v1ChatLoaded) return;
  window.__v1ChatLoaded = true;

  var API = '/api/chat';
  var state = { token: null, open: false, busy: false, sending: false, siteKey: '', started: false, done: false };

  var CSS = ''
    + '#v1c-btn{position:fixed;right:20px;bottom:20px;z-index:99998;background:#c9a96e;color:#0d0d0d;border:none;border-radius:999px;padding:14px 20px;font:600 15px/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px}'
    + '#v1c-btn:hover{filter:brightness(1.05)}'
    + '#v1c-panel{position:fixed;right:20px;bottom:20px;z-index:99999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 40px);background:#141414;border:1px solid #2a2a2a;border-radius:16px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55);font-family:Inter,system-ui,sans-serif}'
    + '#v1c-panel.open{display:flex}'
    + '#v1c-head{background:#0d0d0d;border-bottom:1px solid #2a2a2a;padding:14px 16px;display:flex;align-items:center;gap:10px}'
    + '#v1c-head .t{color:#fff;font-weight:600;font-size:15px;flex:1}'
    + '#v1c-head .t small{display:block;color:#10b981;font-weight:500;font-size:11px;margin-top:2px}'
    + '#v1c-x{background:none;border:none;color:#888;font-size:22px;cursor:pointer;line-height:1;padding:0 4px}'
    + '#v1c-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}'
    + '.v1c-m{max-width:85%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}'
    + '.v1c-m.bot{background:#222;color:#e8e8e8;align-self:flex-start;border-bottom-left-radius:4px}'
    + '.v1c-m.user{background:#c9a96e;color:#0d0d0d;align-self:flex-end;border-bottom-right-radius:4px}'
    + '.v1c-m.sys{background:transparent;color:#777;font-size:12px;align-self:center;text-align:center}'
    + '#v1c-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 8px}'
    + '.v1c-chip{background:#1c1c1c;border:1px solid #333;color:#c9a96e;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer}'
    + '.v1c-chip:hover{border-color:#c9a96e}'
    + '#v1c-lead{display:none;flex-direction:column;gap:8px;padding:0 16px 12px}'
    + '#v1c-lead input{background:#1c1c1c;border:1px solid #333;color:#eee;border-radius:8px;padding:10px;font-size:13px;outline:none}'
    + '#v1c-lead button{background:#c9a96e;color:#0d0d0d;border:none;border-radius:8px;padding:10px;font-weight:600;cursor:pointer;font-size:13px}'
    + '#v1c-form{display:flex;gap:8px;padding:12px;border-top:1px solid #2a2a2a;background:#0f0f0f}'
    + '#v1c-in{flex:1;background:#1c1c1c;border:1px solid #333;color:#eee;border-radius:10px;padding:11px 12px;font-size:14px;outline:none;resize:none;max-height:90px;font-family:inherit}'
    + '#v1c-in:focus{border-color:#c9a96e}'
    + '#v1c-send{background:#c9a96e;color:#0d0d0d;border:none;border-radius:10px;width:42px;cursor:pointer;font-size:16px;font-weight:700}'
    + '#v1c-send:disabled{opacity:.4;cursor:default}'
    + '.v1c-typing{display:inline-flex;gap:3px}'
    + '.v1c-typing i{width:6px;height:6px;background:#888;border-radius:50%;animation:v1cb 1s infinite}'
    + '.v1c-typing i:nth-child(2){animation-delay:.15s}.v1c-typing i:nth-child(3){animation-delay:.3s}'
    + '@keyframes v1cb{0%,60%,100%{opacity:.3}30%{opacity:1}}'
    + '@media(max-width:420px){#v1c-panel{right:8px;left:8px;bottom:8px;width:auto}}';

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function build() {
    document.head.appendChild(el('style')).textContent = CSS;

    var btn = el('button', { id: 'v1c-btn' });
    btn.innerHTML = '💬 <span>Ask us</span>';
    btn.onclick = toggle;
    document.body.appendChild(btn);

    var panel = el('div', { id: 'v1c-panel' });
    var head = el('div', { id: 'v1c-head' });
    head.appendChild(el('div', { class: 't' })).innerHTML = 'Viewing.One Assistant<small>● Online — typically replies instantly</small>';
    var x = el('button', { id: 'v1c-x' }, '×');
    x.onclick = toggle;
    head.appendChild(x);

    var msgs = el('div', { id: 'v1c-msgs' });
    var chips = el('div', { id: 'v1c-chips' });
    ['Pricing?', 'How does it work?', 'Start free trial', 'Is it for me?']
      .forEach(function (q) { var c = el('div', { class: 'v1c-chip' }, q); c.onclick = function () { send(q); }; chips.appendChild(c); });

    var lead = el('div', { id: 'v1c-lead' });
    var li1 = el('input', { type: 'text', placeholder: 'Your name', id: 'v1c-lname' });
    var li2 = el('input', { type: 'email', placeholder: 'Your email', id: 'v1c-lemail' });
    var lbtn = el('button', null, 'Send to the team →');
    lbtn.onclick = submitLead;
    lead.appendChild(li1); lead.appendChild(li2); lead.appendChild(lbtn);

    var form = el('div', { id: 'v1c-form' });
    var inp = el('textarea', { id: 'v1c-in', rows: '1', placeholder: 'Ask about pricing, setup, anything…', maxlength: '1000' });
    var sendBtn = el('button', { id: 'v1c-send' }, '➤');
    sendBtn.onclick = function () { send(inp.value); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value); } });
    form.appendChild(inp); form.appendChild(sendBtn);

    panel.appendChild(head); panel.appendChild(msgs); panel.appendChild(chips); panel.appendChild(lead); panel.appendChild(form);
    document.body.appendChild(panel);

    // hidden honeypot for bots
    var hp = el('input', { type: 'text', name: 'website', id: 'v1c-hp', tabindex: '-1', autocomplete: 'off', style: 'position:absolute;left:-9999px' });
    panel.appendChild(hp);

    return { btn: btn, panel: panel, msgs: msgs, chips: chips, lead: lead, inp: inp, sendBtn: sendBtn, hp: hp };
  }

  var ui = build();
  var msgs = ui.msgs;

  function bubble(cls, text) {
    var m = el('div', { class: 'v1c-m ' + cls });
    m.textContent = text;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }
  function typing() {
    var m = el('div', { class: 'v1c-m bot' });
    m.innerHTML = '<span class="v1c-typing"><i></i><i></i><i></i></span>';
    msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function toggle() {
    state.open = !state.open;
    ui.panel.classList[state.open ? 'add' : 'remove']('open');
    ui.btn.style.display = state.open ? 'none' : 'flex';
    if (state.open) { ui.inp.focus(); if (!state.started) start(); }
  }

  function start() {
    state.started = true;
    fetch(API + '/config').then(function (r) { return r.json(); }).then(function (c) {
      state.siteKey = c.turnstileSiteKey || '';
      if (!c.enabled) { bubble('sys', 'Chat is offline right now — please use the contact page.'); ui.inp.disabled = true; return; }
      if (state.siteKey) ensureTurnstile(); else beginSession(null);
    }).catch(function () { bubble('sys', 'Chat unavailable — please try again later.'); });
  }

  function ensureTurnstile() {
    if (window.turnstile) { runTurnstile(); return; }
    var s = el('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: 'true', defer: 'true' });
    s.onload = runTurnstile;
    document.head.appendChild(s);
  }
  function runTurnstile() {
    var holder = el('div');
    ui.panel.appendChild(holder);
    try {
      window.turnstile.render(holder, {
        sitekey: state.siteKey, size: 'invisible',
        callback: function (tok) { beginSession(tok); },
        'error-callback': function () { bubble('sys', 'Verification failed. Please refresh.'); }
      });
      window.turnstile.execute(holder);
    } catch (e) { bubble('sys', 'Verification error. Please refresh.'); }
  }

  function beginSession(turnstileToken) {
    fetch(API + '/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: turnstileToken })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { bubble('sys', j.error || 'Could not start chat.'); return; }
      state.token = j.token;
      bubble('bot', j.greeting || 'Hi! How can I help with viewing.one?');
    }).catch(function () { bubble('sys', 'Could not start chat.'); });
  }

  function send(text) {
    text = (text || '').trim();
    if (!text || state.sending) return;
    if (!state.token) { bubble('sys', 'Still connecting… one moment.'); return; }
    state.sending = true; ui.sendBtn.disabled = true;
    bubble('user', text);
    ui.inp.value = '';
    var t = typing();
    fetch(API + '/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.token, message: text, hp: ui.hp.value })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (o) {
        t.remove();
        if (o.j.reauth) { state.token = null; state.started = false; start(); return; }
        if (o.j.reply) { bubble('bot', o.j.reply); }
        else { bubble('bot', o.j.error || 'Sorry, please try again.'); }
        if (o.j.done) { state.done = true; showLead(); }
      })
      .catch(function () { t.remove(); bubble('sys', 'Connection issue — please try again.'); })
      .then(function () { state.sending = false; ui.sendBtn.disabled = false; });
  }

  function showLead() { ui.lead.style.display = 'flex'; }

  function submitLead() {
    var name = document.getElementById('v1c-lname').value.trim();
    var email = document.getElementById('v1c-lemail').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { alert('Please enter a valid email.'); return; }
    fetch(API + '/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, hp: ui.hp.value, message: 'From chat widget' })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) { ui.lead.innerHTML = ''; ui.lead.appendChild(el('div', { class: 'v1c-m bot' }, "Thanks " + (name || '') + " — we've got your details and will be in touch shortly. 🎉")); }
      else alert(j.error || 'Please try again.');
    }).catch(function () { alert('Please try again.'); });
  }

  // expose a nudge after a while
  setTimeout(function () {
    if (!state.open && !sessionStorage.getItem('v1c_nudged')) {
      sessionStorage.setItem('v1c_nudged', '1');
      ui.btn.innerHTML = '💬 <span>Questions? Chat now</span>';
    }
  }, 12000);
})();
