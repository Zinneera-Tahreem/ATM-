// ==========================================
// NEXUS ATM OS - Supabase Account & Logs Manager
// Tables: public.user & public.account_log
// ==========================================

const SUPABASE_CONFIG = {
  url: 'https://hzftbwbhxoggqanrswfk.supabase.co',
  key: 'sb_publishable_AUIa6SY6OLyHOaJmO8rfng_nsXxBWuA'
};

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    } catch (e) {
      console.warn('Supabase client error:', e);
    }
  }
  return supabaseClient;
}

const APP_STATE = {
  users: [],
  activeUser: null,
  logs: [],
  balance: 0,
  totalCredit: 0,
  totalDebit: 0,
  currency: { symbol: '₹', rate: 1, code: 'INR' },
  isMasked: false,
  soundEnabled: true,
  cloudStatus: 'connecting'
};

// ==========================================
// Web Audio API Synthesizer (Realistic Tones)
// ==========================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playKeyTone(freq = 660, duration = 0.08) {
  if (!APP_STATE.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playSuccessChime() {
  if (!APP_STATE.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + (idx * 0.07));
      gain.gain.setValueAtTime(0.12, ctx.currentTime + (idx * 0.07));
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (idx * 0.07) + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + (idx * 0.07));
      osc.stop(ctx.currentTime + (idx * 0.07) + 0.25);
    });
  } catch (e) {}
}

function playCashDispenseSound() {
  if (!APP_STATE.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    for (let i = 0; i < 7; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140 + Math.random() * 40, ctx.currentTime + (i * 0.06));
      gain.gain.setValueAtTime(0.1, ctx.currentTime + (i * 0.06));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.06) + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + (i * 0.06));
      osc.stop(ctx.currentTime + (i * 0.06) + 0.04);
    }
  } catch (e) {}
}

// ==========================================
// Cloud Badge Indicator
// ==========================================
function updateCloudBadge(status, text) {
  APP_STATE.cloudStatus = status;
  const pill = document.getElementById('supabase-status-pill');
  const label = document.getElementById('supabase-status-label');
  if (pill && label) {
    pill.className = `supabase-status-pill ${status}`;
    label.textContent = text;
  }
}

// ==========================================
// Toast Notification
// ==========================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  
  if (type === 'success') {
    toastIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`;
  } else if (type === 'error') {
    toastIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ==========================================
// Formatting Helper
// ==========================================
function formatCurrency(amount) {
  if (APP_STATE.isMasked) {
    return '••••••••';
  }
  const converted = amount * APP_STATE.currency.rate;
  return converted.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==========================================
// Load Data From Supabase (User & Account_Log)
// ==========================================
async function loadDataFromSupabase() {
  updateCloudBadge('syncing', 'Supabase: Fetching...');
  const sb = getSupabase();

  if (!sb) {
    updateCloudBadge('offline', 'Local Memory Mode');
    return;
  }

  try {
    // 1. Fetch all users from public.user table
    const { data: users, error: userErr } = await sb
      .from('user')
      .select('*')
      .order('id', { ascending: false });

    if (userErr) {
      console.warn('Error fetching users:', userErr);
      updateCloudBadge('offline', 'DB Read Error');
      return;
    }

    APP_STATE.users = users || [];

    if (APP_STATE.users.length > 0) {
      const savedUserId = localStorage.getItem('nexus_atm_active_userid');
      const matched = APP_STATE.users.find(u => String(u.id) === savedUserId);
      APP_STATE.activeUser = matched || APP_STATE.users[0];
    } else {
      APP_STATE.activeUser = null;
    }

    populateUserDropdown();
    renderUserHeaderAndCard();
    await fetchAndCalculateLogs();

    updateCloudBadge('connected', 'Supabase: Connected');
    setupRealtimeSubscriptions(sb);

  } catch (err) {
    console.warn('Supabase fetch exception:', err);
    updateCloudBadge('offline', 'Error');
  }
}

// Fetch logs for active user and compute totals
async function fetchAndCalculateLogs() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    let query = sb.from('account_log').select('*').order('tr_at', { ascending: false });

    // Filter by active user if user is selected
    if (APP_STATE.activeUser) {
      query = query.eq('userid', APP_STATE.activeUser.id);
    }

    const { data: logs, error: logErr } = await query;
    if (logErr) {
      console.warn('Error fetching account_log:', logErr);
      return;
    }

    APP_STATE.logs = logs || [];

    // Calculate total credit, debit, balance
    let credit = 0;
    let debit = 0;
    let creditCount = 0;
    let debitCount = 0;

    APP_STATE.logs.forEach(log => {
      const amt = Number(log.amount) || 0;
      if (log.type === 'credit') {
        credit += amt;
        creditCount++;
      } else if (log.type === 'debit') {
        debit += amt;
        debitCount++;
      }
    });

    APP_STATE.totalCredit = credit;
    APP_STATE.totalDebit = debit;
    APP_STATE.balance = credit - debit;

    const creditTag = document.getElementById('credit-count-tag');
    const debitTag = document.getElementById('debit-count-tag');
    const totalTxVal = document.getElementById('total-tx-count-val');

    if (creditTag) creditTag.textContent = `${creditCount} Credits`;
    if (debitTag) debitTag.textContent = `${debitCount} Debits`;
    if (totalTxVal) totalTxVal.textContent = `${APP_STATE.logs.length} Operations`;

    renderMetrics();
    renderTransactions(currentFilter);

  } catch (e) {
    console.warn('Error in fetchAndCalculateLogs:', e);
  }
}

// Populate the navbar user account dropdown
function populateUserDropdown() {
  const select = document.getElementById('user-account-select');
  if (!select) return;

  if (APP_STATE.users.length === 0) {
    select.innerHTML = '<option value="">No Accounts Yet</option>';
    return;
  }

  select.innerHTML = APP_STATE.users.map(u => {
    const isSelected = APP_STATE.activeUser && u.id === APP_STATE.activeUser.id;
    return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>
      ${u.name || 'Unnamed'} (Acc #${u.account_no})
    </option>`;
  }).join('');
}

// Update the active user banner and virtual 3D ATM card
function renderUserHeaderAndCard() {
  const user = APP_STATE.activeUser;
  
  const bannerName = document.getElementById('active-user-name');
  const bannerMeta = document.getElementById('active-user-meta');
  const bannerAvatar = document.getElementById('active-user-avatar');

  const cardHolder = document.getElementById('card-holder-name');
  const cardBranch = document.getElementById('card-branch-name');
  const cardLocationBadge = document.getElementById('card-location-badge');
  const cardUidBadge = document.getElementById('card-uid-badge');
  const cardNumberDisplay = document.getElementById('card-number-display');

  const creditLocInput = document.getElementById('credit-location-input');
  const debitLocInput = document.getElementById('debit-location-input');

  if (user) {
    const initial = (user.name || 'U').charAt(0).toUpperCase();
    if (bannerAvatar) bannerAvatar.textContent = initial;
    if (bannerName) bannerName.textContent = user.name || 'Unnamed Account';
    if (bannerMeta) bannerMeta.textContent = `Account No: #${user.account_no} • Branch: ${user.location || 'Main Kiosk'} • User ID: #${user.id}`;

    if (cardHolder) cardHolder.textContent = (user.name || 'UNNAMED').toUpperCase();
    if (cardBranch) cardBranch.textContent = (user.location || 'HQ').toUpperCase();
    if (cardLocationBadge) cardLocationBadge.textContent = (user.location || 'MAIN KIOSK').toUpperCase();
    if (cardUidBadge) cardUidBadge.textContent = `USER ID: #${user.id} • EMV 256-BIT`;

    // Format account number across 4 chunks
    const accStr = String(user.account_no);
    if (cardNumberDisplay) {
      if (accStr.length <= 4) {
        cardNumberDisplay.textContent = `•••• •••• •••• ${accStr.padStart(4, '0')}`;
      } else {
        const last4 = accStr.slice(-4);
        const first = accStr.slice(0, 4);
        cardNumberDisplay.textContent = `${first} •••• •••• ${last4}`;
      }
    }

    if (creditLocInput && user.location) creditLocInput.value = `${user.location} ATM Kiosk`;
    if (debitLocInput && user.location) debitLocInput.value = `${user.location} ATM Kiosk`;

  } else {
    if (bannerName) bannerName.textContent = 'No Account Selected';
    if (bannerMeta) bannerMeta.textContent = 'Click "Create Account" above to open a new bank account';
    if (cardHolder) cardHolder.textContent = 'NO ACCOUNT';
    if (cardBranch) cardBranch.textContent = 'NONE';
    if (cardNumberDisplay) cardNumberDisplay.textContent = '•••• •••• •••• 0000';
  }
}

// Render Top 3 Metric Cards (Balance, Credit, Debit)
function renderMetrics() {
  const balanceEl = document.getElementById('metric-balance-val');
  const creditEl = document.getElementById('metric-credit-val');
  const debitEl = document.getElementById('metric-debit-val');
  const currencySymbols = document.querySelectorAll('.currency-symbol-tag');

  currencySymbols.forEach(el => {
    el.textContent = APP_STATE.currency.symbol;
  });

  if (balanceEl) balanceEl.textContent = formatCurrency(APP_STATE.balance);
  if (creditEl) creditEl.textContent = formatCurrency(APP_STATE.totalCredit);
  if (debitEl) debitEl.textContent = formatCurrency(APP_STATE.totalDebit);
}

// ==========================================
// Render Transaction Ledger (account_log)
// ==========================================
let currentFilter = 'all';

function renderTransactions(filter = 'all') {
  currentFilter = filter;
  const tbody = document.getElementById('transactions-body');
  if (!tbody) return;

  const filtered = APP_STATE.logs.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px; color: var(--text-muted);">
          No ${filter === 'all' ? '' : filter} logs found for ${APP_STATE.activeUser ? APP_STATE.activeUser.name : 'this account'}.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(log => {
    const isCredit = log.type === 'credit';
    const sign = isCredit ? '+' : '-';
    const amountClass = isCredit ? 'credit' : 'debit';
    const badgeClass = isCredit ? 'credit' : 'debit';
    const formattedDate = new Date(log.tr_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const iconSvg = isCredit
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`;

    return `
      <tr class="tx-${log.type}">
        <td>
          <div class="tx-type-cell">
            <div class="tx-type-icon">${iconSvg}</div>
            <div>
              <span class="tx-title">Log #${log.log_id}</span>
              <span class="tx-id">${formattedDate}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary);">
            User #${log.userid || 'N/A'}
          </span>
        </td>
        <td>
          <span class="tx-badge ${badgeClass}">${(log.type || 'N/A').toUpperCase()}</span>
        </td>
        <td>
          <span class="tx-amount ${amountClass}">
            ${sign} ${APP_STATE.currency.symbol}${APP_STATE.isMasked ? '•••' : Number(log.amount).toLocaleString('en-IN')}
          </span>
        </td>
        <td>
          <span style="font-size: 0.82rem; color: var(--text-secondary);">
            ${log.location || 'Local Terminal'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="tx-action-btn" onclick="openReceiptFromLog(${log.log_id})">
            Receipt
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// Account Creation (public.user + optional log)
// ==========================================
async function handleCreateAccount(e) {
  e.preventDefault();

  const nameInput = document.getElementById('new-user-name');
  const accNoInput = document.getElementById('new-account-no');
  const locInput = document.getElementById('new-user-location');
  const initialCreditInput = document.getElementById('new-initial-credit');

  const name = nameInput.value.trim();
  const accountNo = parseInt(accNoInput.value, 10);
  const location = locInput.value.trim() || 'Main Kiosk';
  const initialCredit = parseInt(initialCreditInput.value, 10) || 0;

  if (!name) {
    showToast('Please enter an account holder name', 'error');
    return;
  }

  if (isNaN(accountNo) || accountNo <= 0) {
    showToast('Please enter a valid numeric account number', 'error');
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    showToast('Supabase client not connected', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-new-account');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account in Supabase...';
  }

  try {
    // 1. Insert into public.user
    const { data: newUser, error: uErr } = await sb
      .from('user')
      .insert([{
        name: name,
        account_no: accountNo,
        location: location
      }])
      .select()
      .single();

    if (uErr) {
      showToast(`Creation error: ${uErr.message}`, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create & Issue ATM Card';
      }
      return;
    }

    // 2. If initial credit > 0, insert credit into public.account_log
    if (initialCredit > 0) {
      await sb.from('account_log').insert([{
        userid: newUser.id,
        type: 'credit',
        amount: initialCredit,
        location: location
      }]);
    }

    showToast(`Account #${newUser.account_no} created successfully for ${newUser.name}!`, 'success');
    playSuccessChime();

    // Close modal
    closeCreateAccountModal();

    // Reset form
    document.getElementById('create-account-form').reset();

    // Set new user as active and reload
    localStorage.setItem('nexus_atm_active_userid', String(newUser.id));
    await loadDataFromSupabase();

  } catch (err) {
    console.error('Account creation error:', err);
    showToast('Error creating account', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create & Issue ATM Card';
    }
  }
}

// Generate random account number
function generateRandomAccountNumber() {
  const randAcc = Math.floor(100000 + Math.random() * 900000);
  const accInput = document.getElementById('new-account-no');
  if (accInput) accInput.value = randAcc;
  playKeyTone(800, 0.05);
}

// ==========================================
// Operations: Credit & Debit
// ==========================================
function triggerSlotAnimation(type) {
  const slot = document.getElementById('cash-slot');
  const slotText = document.getElementById('slot-status-text');
  if (slot && slotText) {
    slot.classList.add('active-slot');
    slotText.textContent = type === 'credit' ? 'ACCEPTING CASH BILLS...' : 'DISPENSING BANKNOTES...';
    slotText.style.color = type === 'credit' ? '#10b981' : '#f43f5e';

    setTimeout(() => {
      slot.classList.remove('active-slot');
      slotText.textContent = 'ATM CASSETTE READY';
      slotText.style.color = 'var(--text-muted)';
    }, 2000);
  }
}

async function processCredit() {
  if (!APP_STATE.activeUser) {
    showToast('Please select or create an account first!', 'error');
    openCreateAccountModal();
    return;
  }

  const input = document.getElementById('credit-amount-input');
  const locInput = document.getElementById('credit-location-input');
  const rawVal = parseInt(input.value, 10);
  const location = (locInput && locInput.value.trim()) || APP_STATE.activeUser.location || 'ATM Kiosk';

  if (isNaN(rawVal) || rawVal <= 0) {
    showToast('Please enter a valid deposit amount (e.g. 100, 500).', 'error');
    playKeyTone(300, 0.2);
    return;
  }

  const sb = getSupabase();
  if (!sb) return;

  const btn = document.getElementById('btn-submit-credit');
  if (btn) btn.disabled = true;

  try {
    const { data: newLog, error } = await sb
      .from('account_log')
      .insert([{
        userid: APP_STATE.activeUser.id,
        type: 'credit',
        amount: rawVal,
        location: location
      }])
      .select()
      .single();

    if (error) {
      showToast(`Credit failed: ${error.message}`, 'error');
      return;
    }

    input.value = '';
    triggerSlotAnimation('credit');
    playSuccessChime();
    showToast(`Successfully Credited ${APP_STATE.currency.symbol}${rawVal.toLocaleString('en-IN')} to Account #${APP_STATE.activeUser.account_no}!`, 'success');

    await fetchAndCalculateLogs();

    // Pulse Credit Card
    const creditCard = document.querySelector('.metric-card.credit-card');
    if (creditCard) {
      creditCard.style.transform = 'scale(1.03)';
      setTimeout(() => creditCard.style.transform = '', 350);
    }

    setTimeout(() => {
      openReceiptModal({
        id: `LOG-${newLog.log_id}`,
        type: 'credit',
        amount: rawVal,
        balanceAfter: APP_STATE.balance,
        user: APP_STATE.activeUser,
        date: new Date(newLog.tr_at).toLocaleString()
      });
    }, 500);

  } catch (e) {
    console.error('Credit error:', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function processDebit() {
  if (!APP_STATE.activeUser) {
    showToast('Please select or create an account first!', 'error');
    openCreateAccountModal();
    return;
  }

  const input = document.getElementById('debit-amount-input');
  const locInput = document.getElementById('debit-location-input');
  const rawVal = parseInt(input.value, 10);
  const location = (locInput && locInput.value.trim()) || APP_STATE.activeUser.location || 'ATM Kiosk';

  if (isNaN(rawVal) || rawVal <= 0) {
    showToast('Please enter a valid withdrawal amount.', 'error');
    playKeyTone(300, 0.2);
    return;
  }

  if (rawVal > APP_STATE.balance) {
    showToast(`Insufficient Balance! Current balance is ${APP_STATE.currency.symbol}${APP_STATE.balance.toLocaleString('en-IN')}`, 'error');
    playKeyTone(240, 0.25);
    return;
  }

  const sb = getSupabase();
  if (!sb) return;

  const btn = document.getElementById('btn-submit-debit');
  if (btn) btn.disabled = true;

  try {
    const { data: newLog, error } = await sb
      .from('account_log')
      .insert([{
        userid: APP_STATE.activeUser.id,
        type: 'debit',
        amount: rawVal,
        location: location
      }])
      .select()
      .single();

    if (error) {
      showToast(`Debit failed: ${error.message}`, 'error');
      return;
    }

    input.value = '';
    triggerSlotAnimation('debit');
    playCashDispenseSound();
    showToast(`Dispensed ${APP_STATE.currency.symbol}${rawVal.toLocaleString('en-IN')}. Please collect cash!`, 'success');

    await fetchAndCalculateLogs();

    // Pulse Debit Card
    const debitCard = document.querySelector('.metric-card.debit-card');
    if (debitCard) {
      debitCard.style.transform = 'scale(1.03)';
      setTimeout(() => debitCard.style.transform = '', 350);
    }

    setTimeout(() => {
      openReceiptModal({
        id: `LOG-${newLog.log_id}`,
        type: 'debit',
        amount: rawVal,
        balanceAfter: APP_STATE.balance,
        user: APP_STATE.activeUser,
        date: new Date(newLog.tr_at).toLocaleString()
      });
    }, 700);

  } catch (e) {
    console.error('Debit error:', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================
// Receipt Modal
// ==========================================
function openReceiptModal(info) {
  const modal = document.getElementById('receipt-modal');
  const icon = document.getElementById('modal-status-icon');
  const title = document.getElementById('modal-status-title');
  const date = document.getElementById('modal-status-date');
  const txIdEl = document.getElementById('modal-tx-id');
  const userNameEl = document.getElementById('modal-user-name');
  const userAccEl = document.getElementById('modal-user-acc');
  const typeEl = document.getElementById('modal-tx-type');
  const amountEl = document.getElementById('modal-tx-amount');
  const balEl = document.getElementById('modal-tx-balance');

  const isCredit = info.type === 'credit';

  if (icon) {
    icon.className = `receipt-status-icon ${isCredit ? 'success-credit' : 'success-debit'}`;
    icon.innerHTML = isCredit
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`;
  }

  if (title) title.textContent = isCredit ? 'Cash Credit Receipt' : 'Cash Debit Receipt';
  if (date) date.textContent = info.date;
  if (txIdEl) txIdEl.textContent = info.id;
  if (userNameEl) userNameEl.textContent = info.user ? info.user.name : 'Account Holder';
  if (userAccEl) userAccEl.textContent = info.user ? `•••• ${String(info.user.account_no).slice(-4)}` : '•••• 0000';
  if (typeEl) typeEl.textContent = isCredit ? 'CREDIT (+)' : 'DEBIT (-)';
  if (amountEl) {
    amountEl.textContent = `${isCredit ? '+' : '-'} ${APP_STATE.currency.symbol}${Number(info.amount).toLocaleString('en-IN')}`;
    amountEl.style.color = isCredit ? 'var(--credit-color)' : 'var(--debit-color)';
  }
  if (balEl) {
    balEl.textContent = `${APP_STATE.currency.symbol}${Number(info.balanceAfter).toLocaleString('en-IN')}`;
  }

  if (modal) modal.classList.add('active');
}

function openReceiptFromLog(logId) {
  const log = APP_STATE.logs.find(l => l.log_id === logId);
  if (!log) return;

  openReceiptModal({
    id: `LOG-${log.log_id}`,
    type: log.type,
    amount: log.amount,
    balanceAfter: APP_STATE.balance,
    user: APP_STATE.activeUser,
    date: new Date(log.tr_at).toLocaleString()
  });
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// Create Account Modal Controls
// ==========================================
function openCreateAccountModal() {
  const modal = document.getElementById('create-account-modal');
  if (modal) modal.classList.add('active');
  const accInput = document.getElementById('new-account-no');
  if (accInput && !accInput.value) {
    generateRandomAccountNumber();
  }
}

function closeCreateAccountModal() {
  const modal = document.getElementById('create-account-modal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// Cloud Modal Controls
// ==========================================
function openCloudModal() {
  const modal = document.getElementById('supabase-modal');
  if (modal) modal.classList.add('active');
}

function closeCloudModal() {
  const modal = document.getElementById('supabase-modal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// Real-time Postgres Changes Subscription
// ==========================================
function setupRealtimeSubscriptions(sb) {
  try {
    sb.channel('realtime-atm-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_log' }, async (payload) => {
        // Refresh logs & balances whenever an account log is added
        await fetchAndCalculateLogs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user' }, async (payload) => {
        // Refresh users when new user added
        const { data: users } = await sb.from('user').select('*').order('id', { ascending: false });
        if (users) {
          APP_STATE.users = users;
          populateUserDropdown();
        }
      })
      .subscribe();
  } catch (e) {
    console.warn('Realtime subscription error:', e);
  }
}

// ==========================================
// 3D Card Tilt Effect
// ==========================================
function initCard3DTilt() {
  const card = document.getElementById('atm-interactive-card');
  const cardWrapper = document.querySelector('.atm-card-wrapper');
  if (!card || !cardWrapper) return;

  cardWrapper.addEventListener('mousemove', (e) => {
    const rect = cardWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 14;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  cardWrapper.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });
}

// ==========================================
// DOM Ready Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initCard3DTilt();
  loadDataFromSupabase();

  // User Dropdown Change
  const userSelect = document.getElementById('user-account-select');
  if (userSelect) {
    userSelect.addEventListener('change', async (e) => {
      const selectedId = parseInt(e.target.value, 10);
      const user = APP_STATE.users.find(u => u.id === selectedId);
      if (user) {
        APP_STATE.activeUser = user;
        localStorage.setItem('nexus_atm_active_userid', String(user.id));
        renderUserHeaderAndCard();
        await fetchAndCalculateLogs();
        playKeyTone(750, 0.05);
        showToast(`Switched active account to ${user.name} (#${user.account_no})`, 'success');
      }
    });
  }

  // Create Account Buttons
  const openAccBtn1 = document.getElementById('btn-show-create-account');
  const openAccBtn2 = document.getElementById('btn-banner-new-acc');
  const closeAccBtn = document.getElementById('close-create-acc-btn');
  const cancelAccBtn = document.getElementById('cancel-create-acc-btn');
  const genAccBtn = document.getElementById('btn-gen-acc-no');
  const createForm = document.getElementById('create-account-form');

  if (openAccBtn1) openAccBtn1.addEventListener('click', openCreateAccountModal);
  if (openAccBtn2) openAccBtn2.addEventListener('click', openCreateAccountModal);
  if (closeAccBtn) closeAccBtn.addEventListener('click', closeCreateAccountModal);
  if (cancelAccBtn) cancelAccBtn.addEventListener('click', closeCreateAccountModal);
  if (genAccBtn) genAccBtn.addEventListener('click', generateRandomAccountNumber);
  if (createForm) createForm.addEventListener('submit', handleCreateAccount);

  // Tab switching: Credit vs Debit terminal
  const tabButtons = document.querySelectorAll('.terminal-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });

      const activePane = document.getElementById(`${targetTab}-pane`);
      if (activePane) activePane.classList.add('active');

      playKeyTone(700, 0.05);
    });
  });

  // Preset chips clicking (Credit)
  document.querySelectorAll('#credit-pane .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-amount');
      const input = document.getElementById('credit-amount-input');
      if (input) input.value = val;
      playKeyTone(800, 0.04);
    });
  });

  // Preset chips clicking (Debit)
  document.querySelectorAll('#debit-pane .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-amount');
      const input = document.getElementById('debit-amount-input');
      if (input) input.value = val;
      playKeyTone(750, 0.04);
    });
  });

  // Action submit handlers
  const creditBtn = document.getElementById('btn-submit-credit');
  if (creditBtn) creditBtn.addEventListener('click', processCredit);

  const debitBtn = document.getElementById('btn-submit-debit');
  if (debitBtn) debitBtn.addEventListener('click', processDebit);

  // History filters
  document.querySelectorAll('.history-filter-controls .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-filter-controls .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      renderTransactions(filter);
      playKeyTone(600, 0.04);
    });
  });

  // Privacy toggle (Hide/Show balance)
  const privacyBtn = document.getElementById('btn-toggle-privacy');
  if (privacyBtn) {
    privacyBtn.addEventListener('click', () => {
      APP_STATE.isMasked = !APP_STATE.isMasked;
      renderMetrics();
      renderTransactions(currentFilter);
      playKeyTone(500, 0.05);
      showToast(APP_STATE.isMasked ? 'Privacy Mode Enabled (Amounts Hidden)' : 'Privacy Mode Disabled', 'success');
    });
  }

  // Sound toggle button
  const soundBtn = document.getElementById('btn-toggle-sound');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      APP_STATE.soundEnabled = !APP_STATE.soundEnabled;
      soundBtn.innerHTML = APP_STATE.soundEnabled
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      showToast(APP_STATE.soundEnabled ? 'ATM Audio Feedback Enabled' : 'ATM Audio Feedback Muted', 'success');
    });
  }

  // Theme Toggle (Light / Dark)
  const currentTheme = localStorage.getItem('nexus_atm_theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  const themeIcon = document.getElementById('theme-icon');

  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    if (theme === 'dark') {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    } else {
      themeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      `;
    }
  }

  updateThemeIcon(currentTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = active === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('nexus_atm_theme', nextTheme);
      updateThemeIcon(nextTheme);
      playKeyTone(650, 0.05);
      showToast(nextTheme === 'light' ? 'Switched to White (Light) Theme' : 'Switched to Dark Theme', 'success');
    });
  }

  // Currency selector
  const currencySelect = document.getElementById('currency-selector');
  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'INR') {
        APP_STATE.currency = { symbol: '₹', rate: 1, code: 'INR' };
      } else if (val === 'USD') {
        APP_STATE.currency = { symbol: '$', rate: 0.012, code: 'USD' };
      } else if (val === 'EUR') {
        APP_STATE.currency = { symbol: '€', rate: 0.011, code: 'EUR' };
      } else if (val === 'GBP') {
        APP_STATE.currency = { symbol: '£', rate: 0.0095, code: 'GBP' };
      }
      renderMetrics();
      renderTransactions(currentFilter);
      playKeyTone(850, 0.05);
      showToast(`Currency set to ${val} (${APP_STATE.currency.symbol})`, 'success');
    });
  }

  // Supabase Pill click handler
  const cloudPill = document.getElementById('supabase-status-pill');
  if (cloudPill) cloudPill.addEventListener('click', openCloudModal);

  const cloudModalClose = document.getElementById('cloud-modal-close-btn');
  const cloudModalDone = document.getElementById('cloud-modal-done-btn');
  if (cloudModalClose) cloudModalClose.addEventListener('click', closeCloudModal);
  if (cloudModalDone) cloudModalDone.addEventListener('click', closeCloudModal);

  // Receipt Modal close
  const modalClose = document.getElementById('modal-close-btn');
  const modalDone = document.getElementById('modal-done-btn');
  const modal = document.getElementById('receipt-modal');

  if (modalClose) modalClose.addEventListener('click', closeReceiptModal);
  if (modalDone) modalDone.addEventListener('click', closeReceiptModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeReceiptModal();
    });
  }

  const printBtn = document.getElementById('modal-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
});
