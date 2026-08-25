(() => {
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('backdrop');
  const openDrawerBtn = document.getElementById('openDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawer');
  const newConvoBtn = document.getElementById('newConvoBtn');
  const convoList = document.getElementById('convoList');
  const messagesEl = document.getElementById('messages');
  const emptyState = document.getElementById('emptyState');
  const composer = document.getElementById('composer');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const convoTitle = document.getElementById('convoTitle');
  const modelName = document.getElementById('modelName');
  const linkStatus = document.getElementById('linkStatus');
  const clockEl = document.getElementById('clock');
  const dateLine = document.getElementById('dateLine');

  let activeId = null;
  let sending = false;

  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

  function openDrawer() {
    if (isDesktop()) return;
    drawer.classList.add('open');
    backdrop.classList.add('show');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('show');
  }
  openDrawerBtn.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(d) {
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  }
  function tickClock() {
    const now = new Date();
    clockEl.textContent = fmtTime(now);
    dateLine.textContent = fmtDate(now);
  }
  tickClock();
  setInterval(tickClock, 15000);

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res;
  }

  async function refreshHealth() {
    try {
      const res = await api('/api/health');
      const data = await res.json();
      modelName.textContent = data.model || '—';
      if (data.ok) {
        linkStatus.textContent = 'ONLINE';
        linkStatus.className = 'readout-value status-ok';
      } else {
        linkStatus.textContent = 'OFFLINE';
        linkStatus.className = 'readout-value status-bad';
      }
    } catch {
      linkStatus.textContent = 'UNREACHABLE';
      linkStatus.className = 'readout-value status-bad';
    }
  }
  refreshHealth();
  setInterval(refreshHealth, 20000);

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  async function loadConvoList() {
    const res = await api('/api/conversations');
    const items = await res.json();
    convoList.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'convo-empty';
      empty.textContent = 'No conversations yet.';
      convoList.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'convo-item' + (item.id === activeId ? ' active' : '');
      row.innerHTML = `
        <div class="convo-title">${escapeHtml(item.title)}<span class="convo-meta">${relativeTime(item.updatedAt)}</span></div>
        <button class="convo-delete" aria-label="Delete conversation">&times;</button>
      `;
      row.querySelector('.convo-title').addEventListener('click', () => openConversation(item.id));
      row.querySelector('.convo-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        await api(`/api/conversations/${item.id}`, { method: 'DELETE' });
        if (activeId === item.id) {
          activeId = null;
          renderMessages([]);
          convoTitle.textContent = 'Just A Rather Very Intelligent System';
        }
        loadConvoList();
      });
      convoList.appendChild(row);
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderMessages(msgs) {
    messagesEl.innerHTML = '';
    if (!msgs.length) {
      messagesEl.appendChild(emptyState);
      return;
    }
    for (const m of msgs) {
      appendMessage(m.role, m.content);
    }
    scrollToBottom();
  }

  function appendMessage(role, content) {
    if (emptyState.parentNode) emptyState.remove();
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = content;
    messagesEl.appendChild(div);
    return div;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function openConversation(id) {
    activeId = id;
    closeDrawer();
    const res = await api(`/api/conversations/${id}`);
    const conv = await res.json();
    convoTitle.textContent = conv.title;
    renderMessages(conv.messages);
    await loadConvoList();
  }

  newConvoBtn.addEventListener('click', async () => {
    const res = await api('/api/conversations', { method: 'POST' });
    const conv = await res.json();
    await loadConvoList();
    await openConversation(conv.id);
    input.focus();
  });

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && isDesktop()) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  composer.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;

    if (!activeId) {
      const res = await api('/api/conversations', { method: 'POST' });
      const conv = await res.json();
      activeId = conv.id;
    }

    input.value = '';
    autosize();
    appendMessage('user', text);
    scrollToBottom();

    const assistantEl = appendMessage('assistant', '');
    assistantEl.classList.add('pending');
    scrollToBottom();

    sending = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (!res.body) {
        assistantEl.textContent = await res.text();
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          assistantEl.textContent = full;
          scrollToBottom();
        }
      }
    } catch (err) {
      assistantEl.textContent = `[Connection to JARVIS lost: ${err.message}]`;
    } finally {
      assistantEl.classList.remove('pending');
      sending = false;
      sendBtn.disabled = false;
      loadConvoList();
      refreshHealth();
    }
  });

  loadConvoList();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }
})();
