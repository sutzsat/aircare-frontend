const apiBase = window.__AIRCARE_API_BASE__ || '';

const loginPanel = document.getElementById('loginPanel');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');
const refreshButton = document.getElementById('refreshButton');
const scoreDateInput = document.getElementById('scoreDate');
const trendStartInput = document.getElementById('trendStart');
const trendEndInput = document.getElementById('trendEnd');
const scopeTitle = document.getElementById('scopeTitle');
const scopeSubtitle = document.getElementById('scopeSubtitle');
const roleChip = document.getElementById('roleChip');
const metricGrid = document.getElementById('metricGrid');
const trendChart = document.getElementById('trendChart');
const recommendationChart = document.getElementById('recommendationChart');
const issueChart = document.getElementById('issueChart');
const leaderboardTable = document.getElementById('leaderboardTable');
const rollupList = document.getElementById('rollupList');
const recentFeedback = document.getElementById('recentFeedback');
const toast = document.getElementById('toast');
const managePasswordButton = document.getElementById('managePasswordButton');
const manageUsersButton = document.getElementById('manageUsersButton');
const passwordModalOverlay = document.getElementById('passwordModalOverlay');
const passwordForm = document.getElementById('passwordForm');
const closePasswordModal = document.getElementById('closePasswordModal');
const userModalOverlay = document.getElementById('userModalOverlay');
const userModalTitle = document.getElementById('userModalTitle');
const createUserForm = document.getElementById('createUserForm');
const closeUserModal = document.getElementById('closeUserModal');
const newUserScopeId = document.getElementById('newUserScopeId');
const scopeIdField = document.getElementById('scopeIdField');
const existingUsersList = document.getElementById('existingUsersList');
const feedbackDetailOverlay = document.getElementById('feedbackDetailOverlay');
const feedbackDetailTitle = document.getElementById('feedbackDetailTitle');
const feedbackDetailBody = document.getElementById('feedbackDetailBody');
const closeFeedbackDetail = document.getElementById('closeFeedbackDetail');

let currentUserContext = null; // set after login -- { role, scope_type, scope_id }

const today = new Date().toISOString().slice(0, 10);
scoreDateInput.value = today;
trendEndInput.value = today;
trendStartInput.value = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

function getToken() {
  return window.localStorage.getItem('aircare_dashboard_token') || '';
}

function setToken(token) {
  window.localStorage.setItem('aircare_dashboard_token', token);
}

function clearToken() {
  window.localStorage.removeItem('aircare_dashboard_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail?.error?.message || payload?.error?.message || payload?.detail || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function setAuthenticated(isAuthenticated) {
  loginPanel.classList.toggle('hidden', isAuthenticated);
  appShell.classList.toggle('hidden', !isAuthenticated);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

function formatDateTime(value) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Escapes HTML special characters before interpolating into innerHTML.
 * Defense-in-depth: the backend already strips <tag> patterns from
 * customer comments on submission (schemas/feedback.py), but that regex
 * isn't a full HTML sanitizer, and this dashboard was rendering
 * customer-submitted comment text into innerHTML with zero escaping of
 * its own -- a single point of failure. This ensures a gap in one layer
 * doesn't become an actual XSS execution in the browser.
 */
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function renderMetrics(metrics) {
  const cards = [
    ['Total feedback', formatNumber(metrics.total_feedback)],
    ['Qualified outlets', formatNumber(metrics.qualified_outlets)],
    ['Average Happy Points', metrics.average_happy_points.toFixed(2)],
    ['Average satisfaction score', metrics.average_satisfaction_score.toFixed(2)],
    ['Reporting outlets', formatNumber(metrics.reporting_outlets)],
    ['Active outlets', formatNumber(metrics.active_outlets)],
    ['Valid feedback', formatNumber(metrics.valid_feedback)],
    ['Flagged feedback', formatNumber(metrics.flagged_feedback)],
  ];

  metricGrid.innerHTML = cards.map(([label, value]) => `
    <article class="metric-card">
      <p class="card-label">Snapshot</p>
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `).join('');
}

function renderRecommendationChart(split) {
  const total = split.yes + split.maybe + split.no || 1;
  const yesWidth = (split.yes / total) * 100;
  const maybeWidth = (split.maybe / total) * 100;
  const noWidth = (split.no / total) * 100;

  recommendationChart.innerHTML = `
    <div class="stack-bar">
      <div class="stack-segment-yes" style="width:${yesWidth}%"></div>
      <div class="stack-segment-maybe" style="width:${maybeWidth}%"></div>
      <div class="stack-segment-no" style="width:${noWidth}%"></div>
    </div>
    <div class="legend-row">
      <div class="legend-pill"><strong>${formatNumber(split.yes)}</strong><div class="muted">Yes</div></div>
      <div class="legend-pill"><strong>${formatNumber(split.maybe)}</strong><div class="muted">Maybe</div></div>
      <div class="legend-pill"><strong>${formatNumber(split.no)}</strong><div class="muted">No</div></div>
    </div>
  `;
}

function renderIssueChart(issueHotspots) {
  const entries = [
    ['Availability', issueHotspots.availability],
    ['Equipment', issueHotspots.equipment],
    ['Promptness', issueHotspots.promptness],
    ['Attendant', issueHotspots.attendant],
    ['Overall', issueHotspots.overall],
  ];
  const max = Math.max(1, ...entries.map(([, value]) => value));
  issueChart.innerHTML = entries.map(([label, value]) => `
    <div class="issue-row">
      <div>${label}</div>
      <div class="issue-track"><div class="issue-fill" style="width:${(value / max) * 100}%"></div></div>
      <strong>${formatNumber(value)}</strong>
    </div>
  `).join('');
}

function renderTrendChart(trendRows) {
  if (!trendRows.length) {
    trendChart.innerHTML = '<div class="muted">No trend data available for the selected range.</div>';
    return;
  }

  const width = 960;
  const height = 260;
  const padding = 28;
  const maxValue = Math.max(1, ...trendRows.map((row) => row.average_happy_points));
  const stepX = trendRows.length > 1 ? (width - padding * 2) / (trendRows.length - 1) : 0;

  const points = trendRows.map((row, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (row.average_happy_points / maxValue) * (height - padding * 2);
    return { ...row, x, y };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`;

  trendChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Happy points trend">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(210,96,26,0.34)"></stop>
          <stop offset="100%" stop-color="rgba(210,96,26,0.02)"></stop>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#trendFill)"></polygon>
      <polyline points="${polyline}" fill="none" stroke="#d2601a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#7a2e0a"></circle>`).join('')}
    </svg>
    <div class="legend-row">
      ${points.map((point) => `<div class="legend-pill"><strong>${point.average_happy_points.toFixed(1)}</strong><div class="muted">${point.score_date}</div></div>`).join('')}
    </div>
  `;
}

function renderLeaderboard(rows) {
  leaderboardTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Outlet</th>
          <th>District</th>
          <th>DO</th>
          <th>Happy Points</th>
          <th>Feedback</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><span class="rank-badge">${row.rank ?? 'NQ'}</span></td>
            <td>${escapeHtml(row.ro_name)}</td>
            <td>${escapeHtml(row.district)}</td>
            <td>${escapeHtml(row.divisional_office)}</td>
            <td>${row.weightage.toFixed(2)}</td>
            <td>${formatNumber(row.total_feedback)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderRollups(stateRollup, divisionalOffices) {
  const cards = [
    `<div class="rollup-card"><strong>${stateRollup.scope_name}</strong><div class="muted">${stateRollup.avg_weightage.toFixed(2)} avg points</div><div class="muted">${formatNumber(stateRollup.total_feedback)} feedback</div></div>`,
    ...divisionalOffices.map((item) => `<div class="rollup-card"><strong>${item.scope_name}</strong><div class="muted">${item.avg_weightage.toFixed(2)} avg points</div><div class="muted">${formatNumber(item.total_feedback)} feedback across ${item.ro_reporting_count}/${item.ro_count} outlets</div></div>`),
  ];
  rollupList.innerHTML = cards.join('');
}

function renderRecentFeedback(items) {
  if (!items.length) {
    recentFeedback.innerHTML = '<div class="muted">No individual feedback found for the selected date and scope.</div>';
    return;
  }

  recentFeedback.innerHTML = items.map((item) => {
    const statusClass = `status-${item.status.toLowerCase()}`;
    const commentPreview = item.comment ? escapeHtml(item.comment) : 'No comment provided.';
    return `
      <article class="feedback-item">
        <div class="feedback-topline">
          <div>
            <strong>${escapeHtml(item.ro_name)}</strong>
            <div class="muted">${escapeHtml(item.district)} • ${escapeHtml(item.divisional_office)}</div>
          </div>
          <button class="ghost-button inline-action" type="button" data-feedback-id="${item.feedback_id}">View details</button>
        </div>
        <div class="feedback-meta-row">
          <span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span>
          <span class="muted">${formatDateTime(item.submitted_at)}</span>
        </div>
        <div class="muted">Mobile: ${escapeHtml(item.mobile_number)} • Overall: ${escapeHtml(item.overall_rating)} • Recommend: ${escapeHtml(item.recommend_rating)}${item.has_photo ? ' • Photo attached' : ''}</div>
        <div>${commentPreview}</div>
      </article>
    `;
  }).join('');
}

function buildPhotoUrl(photoUrl) {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }
  return `${apiBase}${photoUrl}`;
}

function renderFeedbackDetail(item) {
  const detailRows = [
    ['Outlet', item.ro_name],
    ['District', item.district],
    ['Divisional office', item.divisional_office],
    ['Mobile number', item.mobile_number],
    ['Submitted at', formatDateTime(item.submitted_at)],
    ['Status', item.status],
    ['Flag reason', item.flag_reason || 'None'],
    ['Overall', item.overall_rating],
    ['Availability', item.availability_rating],
    ['Equipment', item.equipment_rating],
    ['Promptness', item.promptness_rating],
    ['Attendant behaviour', item.attendant_rating],
    ['Recommend', item.recommend_rating],
    ['GPS', item.gps_lat !== null && item.gps_lng !== null ? `${item.gps_lat}, ${item.gps_lng}` : 'Not captured'],
  ];

  const photoUrl = buildPhotoUrl(item.photo_url);
  feedbackDetailTitle.textContent = item.ro_name;
  feedbackDetailBody.innerHTML = `
    <div class="feedback-detail-grid">
      ${detailRows.map(([label, value]) => `
        <div class="detail-card">
          <span class="detail-label">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value ?? 'Not available')}</strong>
        </div>
      `).join('')}
    </div>
    <div class="feedback-detail-section">
      <span class="detail-label">Comment</span>
      <p>${escapeHtml(item.comment) || 'No comment provided.'}</p>
    </div>
    ${photoUrl ? `
      <div class="feedback-detail-section">
        <span class="detail-label">Photo evidence</span>
        <a class="ghost-button inline-action" href="${escapeHtml(photoUrl)}" target="_blank" rel="noreferrer">Open photo</a>
      </div>
    ` : ''}
  `;
  feedbackDetailOverlay.classList.remove('hidden');
}

async function openFeedbackDetail(feedbackId) {
  const response = await apiFetch(`/api/v1/dashboard/feedback/${encodeURIComponent(feedbackId)}`);
  renderFeedbackDetail(response.data);
}

async function loadDashboard() {
  const scoreDate = scoreDateInput.value;
  const trendStart = trendStartInput.value;
  const trendEnd = trendEndInput.value;

  const [me, overview, leaderboard, trend, rollups, recentFeedbackResponse] = await Promise.all([
    apiFetch('/api/v1/dashboard/me'),
    apiFetch(`/api/v1/dashboard/overview?score_date=${encodeURIComponent(scoreDate)}`),
    apiFetch(`/api/v1/dashboard/leaderboard?score_date=${encodeURIComponent(scoreDate)}&limit=10`),
    apiFetch(`/api/v1/dashboard/trend?start_date=${encodeURIComponent(trendStart)}&end_date=${encodeURIComponent(trendEnd)}`),
    apiFetch(`/api/v1/dashboard/rollups?score_date=${encodeURIComponent(scoreDate)}`),
    apiFetch(`/api/v1/dashboard/recent-feedback?score_date=${encodeURIComponent(scoreDate)}&limit=12`),
  ]);

  scopeTitle.textContent = me.data.scope_label;
  scopeSubtitle.textContent = `${me.data.role.replace('_', ' ')} access • Live view of air-service feedback and Happy Points.`;
  roleChip.textContent = `${me.data.role.replace('_', ' ')} • ${me.data.scope_type}`;
  currentUserContext = me.data;

  // Per the backend hierarchy (CREATABLE_ROLES_BY_CREATOR in admin.py):
  // only SUPER_ADMIN, STATE_ADMIN, and DO_ADMIN can create anyone at all.
  // District Admin and Field Officers (RO_USER) never see this button.
  const canManageUsers = ['SUPER_ADMIN', 'STATE_ADMIN', 'DO_ADMIN'].includes(me.data.role);
  manageUsersButton.classList.toggle('hidden', !canManageUsers);

  renderMetrics(overview.data.metrics);
  renderRecommendationChart(overview.data.recommendation_split);
  renderIssueChart(overview.data.issue_hotspots);
  renderTrendChart(trend.data.trend);
  renderLeaderboard(leaderboard.data.leaderboard);
  renderRollups(rollups.data.state, rollups.data.divisional_offices);
  renderRecentFeedback(recentFeedbackResponse.data.items);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    setToken(response.data.access_token);
    setAuthenticated(true);
    await loadDashboard();
    showToast('Dashboard login successful.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

refreshButton.addEventListener('click', async () => {
  try {
    await loadDashboard();
    showToast('Dashboard refreshed.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

logoutButton.addEventListener('click', () => {
  clearToken();
  setAuthenticated(false);
  showToast('Logged out.');
});

async function bootstrap() {
  if (!getToken()) {
    setAuthenticated(false);
    return;
  }

  try {
    setAuthenticated(true);
    await loadDashboard();
  } catch (error) {
    clearToken();
    setAuthenticated(false);
    showToast(error.message, 'error');
  }
}

bootstrap();
// ---- Change Password ----

managePasswordButton.addEventListener('click', () => {
  passwordForm.reset();
  passwordModalOverlay.classList.remove('hidden');
});

closePasswordModal.addEventListener('click', () => {
  passwordModalOverlay.classList.add('hidden');
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  try {
    await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    passwordModalOverlay.classList.add('hidden');
    showToast('Password updated successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ---- Manage Users (role-aware: State Head creates DO Heads, DO Head creates Field Officers) ----

async function populateScopeOptions() {
  if (!currentUserContext) return;

  if (currentUserContext.role === 'DO_ADMIN') {
    // DO Head creates a Field Officer -- outlet dropdown scoped to their
    // own DO only, reusing the already-scoped leaderboard data rather
    // than adding a new endpoint.
    userModalTitle.textContent = 'Add Field Officer';
    scopeIdField.querySelector('label') ?? null;
    scopeIdField.firstChild.textContent = 'Outlet (within your Divisional Office)';
    const leaderboard = await apiFetch('/api/v1/dashboard/leaderboard?limit=200');
    newUserScopeId.innerHTML = leaderboard.data.leaderboard
      .map((row) => `<option value="${row.ro_id}">${row.ro_name}</option>`)
      .join('');
  } else {
    // SUPER_ADMIN / STATE_ADMIN create a Divisional Head -- DO dropdown.
    userModalTitle.textContent = 'Add Divisional Head';
    scopeIdField.firstChild.textContent = 'Divisional Office';
    const rollups = await apiFetch('/api/v1/dashboard/rollups');
    newUserScopeId.innerHTML = rollups.data.divisional_offices
      .map((row) => `<option value="${row.scope_id}">${row.scope_name}</option>`)
      .join('');
  }
}

async function loadExistingUsers() {
  const response = await apiFetch('/api/v1/admin/users');
  const users = response.data.users;
  if (!users.length) {
    existingUsersList.innerHTML = '<div class="muted">No accounts created yet.</div>';
    return;
  }
  existingUsersList.innerHTML = `
    <h3>Existing accounts</h3>
    ${users.map((u) => `
      <div class="user-row">
        <strong>${escapeHtml(u.name)}</strong>
        <span class="muted">${escapeHtml(u.phone)} • ${escapeHtml(u.role.replace('_', ' '))}</span>
      </div>
    `).join('')}
  `;
}

manageUsersButton.addEventListener('click', async () => {
  try {
    await populateScopeOptions();
    await loadExistingUsers();
    userModalOverlay.classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

closeUserModal.addEventListener('click', () => {
  userModalOverlay.classList.add('hidden');
});

closeFeedbackDetail.addEventListener('click', () => {
  feedbackDetailOverlay.classList.add('hidden');
});

feedbackDetailOverlay.addEventListener('click', (event) => {
  if (event.target === feedbackDetailOverlay) {
    feedbackDetailOverlay.classList.add('hidden');
  }
});

recentFeedback.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-feedback-id]');
  if (!trigger) {
    return;
  }

  try {
    await openFeedbackDetail(trigger.dataset.feedbackId);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const phone = document.getElementById('newUserPhone').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const scopeId = parseInt(newUserScopeId.value, 10);

  const isDoHead = currentUserContext.role === 'DO_ADMIN';
  const payload = isDoHead
    ? { name, phone, password, role: 'RO_USER', scope_type: 'RO', scope_id: scopeId }
    : { name, phone, password, role: 'DO_ADMIN', scope_type: 'DO', scope_id: scopeId };

  try {
    await apiFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    showToast(`${isDoHead ? 'Field Officer' : 'Divisional Head'} account created. Share the default password securely -- they can change it after logging in.`);
    createUserForm.reset();
    await loadExistingUsers();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
