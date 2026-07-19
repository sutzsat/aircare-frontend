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
const leaderboardLimitInput = document.getElementById('leaderboardLimit');
const rollupList = document.getElementById('rollupList');
const recentFeedback = document.getElementById('recentFeedback');
const feedbackTable = document.getElementById('feedbackTable');
const feedbackStartDateInput = document.getElementById('feedbackStartDate');
const feedbackEndDateInput = document.getElementById('feedbackEndDate');
const feedbackStatusFilter = document.getElementById('feedbackStatusFilter');
const feedbackOutletFilter = document.getElementById('feedbackOutletFilter');
const applyFeedbackFiltersButton = document.getElementById('applyFeedbackFilters');
const resetFeedbackFiltersButton = document.getElementById('resetFeedbackFilters');
const feedbackPrevPageButton = document.getElementById('feedbackPrevPage');
const feedbackNextPageButton = document.getElementById('feedbackNextPage');
const feedbackPaginationSummary = document.getElementById('feedbackPaginationSummary');
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
const weeklyAirStarCard = document.getElementById('weeklyAirStarCard');
const specialRecognitionList = document.getElementById('specialRecognitionList');
const luckyDrawPanel = document.getElementById('luckyDrawPanel');
const luckyDrawWinnersList = document.getElementById('luckyDrawWinnersList');
const runLuckyDrawButton = document.getElementById('runLuckyDrawButton');
const luckyDrawModalOverlay = document.getElementById('luckyDrawModalOverlay');
const luckyDrawForm = document.getElementById('luckyDrawForm');
const luckyDrawFortnightInfo = document.getElementById('luckyDrawFortnightInfo');
const luckyDrawDoSelect = document.getElementById('luckyDrawDoSelect');
const closeLuckyDrawModal = document.getElementById('closeLuckyDrawModal');

let currentUserContext = null; // set after login -- { role, scope_type, scope_id }
let feedbackPage = 1;
let feedbackTotalPages = 0;
let feedbackPageSize = 10;

const today = new Date().toISOString().slice(0, 10);
// Default the reporting views to the last FULLY SCORED day, not the
// still-in-progress current day. Daily scoring runs once at 23:59 (see
// app/tasks/celery_app.py) -- Leaderboard, Rollups, and Trend all read
// from that pre-computed daily score, so defaulting to "today" means a
// State Head logging in at any point before midnight sees every one of
// those panels blank. Yesterday is always fully scored.
const defaultReportDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
scoreDateInput.value = defaultReportDate;
trendEndInput.value = defaultReportDate;
trendStartInput.value = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
feedbackStartDateInput.value = defaultReportDate;
feedbackEndDateInput.value = defaultReportDate;

// AirCare Challenge Phase-2 launch date -- anchors Weekly Air Star and
// Fortnightly Lucky Draw window calculations client-side. Must match
// CAMPAIGN_START_DATE in app/core/config.py on the backend.
const CAMPAIGN_START_DATE = '2026-07-16';

function daysBetween(isoA, isoB) {
  return Math.round((new Date(`${isoB}T00:00:00Z`) - new Date(`${isoA}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentWeekWindow(todayIso) {
  const elapsed = daysBetween(CAMPAIGN_START_DATE, todayIso);
  if (elapsed < 0) return null;
  const weekIndex = Math.floor(elapsed / 7);
  const start = addDaysIso(CAMPAIGN_START_DATE, weekIndex * 7);
  return { start, end: addDaysIso(start, 6) };
}

function currentFortnightWindow(todayIso) {
  const elapsed = daysBetween(CAMPAIGN_START_DATE, todayIso);
  if (elapsed < 0) return null;
  const fortnightNumber = Math.floor(elapsed / 14) + 1;
  const start = addDaysIso(CAMPAIGN_START_DATE, (fortnightNumber - 1) * 14);
  return { fortnightNumber, start, end: addDaysIso(start, 13) };
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

// Swaps a button's label for a spinner + status text and disables it while
// an async action is in flight, so every fetch has a visible loading state
// instead of the UI just sitting there until the response lands.
function setButtonLoading(button, isLoading, loadingLabel = 'Loading…') {
  if (!button) return;
  if (isLoading) {
    if (button.dataset.originalLabel === undefined) {
      button.dataset.originalLabel = button.innerHTML;
    }
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${loadingLabel}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel !== undefined) {
      button.innerHTML = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }
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

function getRefreshToken() {
  return window.localStorage.getItem('aircare_dashboard_refresh_token') || '';
}

function setRefreshToken(token) {
  window.localStorage.setItem('aircare_dashboard_refresh_token', token);
}

function clearRefreshToken() {
  window.localStorage.removeItem('aircare_dashboard_refresh_token');
}

async function rawFetch(path, options = {}) {
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

  return { response, payload };
}

// Concurrent 401s (e.g. the Promise.all in loadDashboard) share a single
// in-flight refresh call instead of each racing to hit /auth/refresh.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error('Session expired. Please log in again.');
      }
      const { response, payload } = await rawFetch('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        throw new Error(payload?.detail?.error?.message || 'Session expired. Please log in again.');
      }
      setToken(payload.data.access_token);
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function apiFetch(path, options = {}) {
  let { response, payload } = await rawFetch(path, options);

  if (response.status === 401 && getRefreshToken()) {
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      clearToken();
      clearRefreshToken();
      setAuthenticated(false);
      throw refreshError;
    }
    ({ response, payload } = await rawFetch(path, options));
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      clearRefreshToken();
      setAuthenticated(false);
    }
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

function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function renderMetrics(metrics, scoreDate) {
  // Labeled with the actual selected date, not a hardcoded "today" -- the
  // dashboard defaults to yesterday (see defaultReportDate above), so a
  // fixed "today" label would silently show yesterday's count under the
  // wrong name. Accurate for whatever date is picked, including if someone
  // manually selects today and it's genuinely still zero pre-scoring.
  const dateLabel = formatShortDate(scoreDate);
  const cards = [
    [`Feedback received (${dateLabel})`, formatNumber(metrics.total_feedback)],
    ['Total feedback (all-time)', formatNumber(metrics.cumulative_total_feedback)],
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
      ${points.map((point) => `<circle class="trend-point" cx="${point.x}" cy="${point.y}" r="5" fill="#7a2e0a"></circle>`).join('')}
      ${points.map((point) => `<circle class="trend-point-hit" cx="${point.x}" cy="${point.y}" r="16" data-date="${point.score_date}" data-value="${point.average_happy_points}"></circle>`).join('')}
    </svg>
    <div class="trend-tooltip" id="trendTooltip"></div>
  `;

  // Hover a point to see that day's value -- replaces the old always-visible
  // legend grid below the chart, which ate a lot of vertical space and made
  // panels next to/below it look sparse by comparison.
  const svgEl = trendChart.querySelector('.trend-svg');
  const tooltipEl = trendChart.querySelector('#trendTooltip');

  function positionTooltip(hit) {
    const cx = parseFloat(hit.getAttribute('cx'));
    const cy = parseFloat(hit.getAttribute('cy'));
    const rect = svgEl.getBoundingClientRect();
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    tooltipEl.style.left = `${cx * scaleX}px`;
    tooltipEl.style.top = `${cy * scaleY - 12}px`;
  }

  trendChart.querySelectorAll('.trend-point-hit').forEach((hit) => {
    hit.addEventListener('mouseenter', () => {
      tooltipEl.innerHTML = `<strong>${parseFloat(hit.dataset.value).toFixed(1)}</strong><div>${hit.dataset.date}</div>`;
      tooltipEl.classList.add('show');
      positionTooltip(hit);
    });
    hit.addEventListener('mousemove', () => positionTooltip(hit));
    hit.addEventListener('mouseleave', () => {
      tooltipEl.classList.remove('show');
    });
  });
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
        ${rows.map((row, index) => `
          <tr>
            <td><span class="rank-badge">${row.rank != null ? index + 1 : 'NQ'}</span></td>
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
    `<div class="rollup-card"><strong>${escapeHtml(stateRollup.scope_name)}</strong><div class="muted">${stateRollup.avg_weightage.toFixed(2)} avg points</div><div class="muted">${formatNumber(stateRollup.total_feedback)} feedback</div></div>`,
    ...divisionalOffices.map((item) => `<div class="rollup-card"><strong>${escapeHtml(item.scope_name)}</strong><div class="muted">${item.avg_weightage.toFixed(2)} avg points</div><div class="muted">${formatNumber(item.total_feedback)} feedback across ${item.ro_reporting_count}/${item.ro_count} outlets</div></div>`),
  ];
  rollupList.innerHTML = cards.join('');
}

function renderWeeklyAirStar(winner) {
  if (!weeklyAirStarCard) return;
  if (!winner) {
    weeklyAirStarCard.innerHTML = '<div class="muted">No qualifying outlet yet this week.</div>';
    return;
  }
  weeklyAirStarCard.innerHTML = `
    <div class="rollup-card">
      <strong>${escapeHtml(winner.ro_name)}</strong>
      <div class="muted">${winner.avg_weightage.toFixed(2)} avg Happy Points this week</div>
    </div>
  `;
}

function renderSpecialRecognition(categories) {
  if (!specialRecognitionList) return;
  if (!categories.length) {
    specialRecognitionList.innerHTML = '<div class="muted">No qualifying outlets for the campaign yet.</div>';
    return;
  }
  specialRecognitionList.innerHTML = categories.map((cat) => {
    const isRate = cat.metric_label.includes('rate');
    const value = isRate ? `${(cat.metric_value * 100).toFixed(1)}%` : cat.metric_value.toFixed(2);
    return `
      <div class="rollup-card">
        <strong>${escapeHtml(cat.category)}</strong>
        <div class="muted">${escapeHtml(cat.ro_name)}</div>
        <div class="muted">${escapeHtml(cat.metric_label.replace(/_/g, ' '))}: ${value}</div>
      </div>
    `;
  }).join('');
}

function renderLuckyDrawWinners(winners, doNameById) {
  if (!luckyDrawWinnersList) return;
  if (!winners.length) {
    luckyDrawWinnersList.innerHTML = '<div class="muted">No draws run yet.</div>';
    return;
  }
  luckyDrawWinnersList.innerHTML = winners.map((w) => {
    const doName = doNameById.get(w.do_id) || `DO ${w.do_id}`;
    return `
      <div class="rollup-card">
        <strong>Fortnight ${w.fortnight_number} • ${escapeHtml(doName)}</strong>
        <div class="muted">${escapeHtml(w.mobile_number_masked)} • ₹${formatNumber(w.reward_amount)}</div>
        <div class="muted">${w.fortnight_start} to ${w.fortnight_end}</div>
      </div>
    `;
  }).join('');
}

function renderRecentFeedback(items) {
  if (!recentFeedback) {
    return;
  }

  if (!items.length) {
    recentFeedback.innerHTML = '<div class="muted">No latest feedback found for the selected score date.</div>';
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

function populateFeedbackOutletFilter(outlets) {
  feedbackOutletFilter.innerHTML = `
    <option value="">All outlets</option>
    ${outlets.map((outlet) => `<option value="${outlet.ro_id}">${escapeHtml(outlet.ro_name)}</option>`).join('')}
  `;
}

function getFeedbackFilters() {
  return {
    startDate: feedbackStartDateInput.value || '',
    endDate: feedbackEndDateInput.value || '',
    status: feedbackStatusFilter.value || '',
    roId: feedbackOutletFilter.value || '',
  };
}

function renderFeedbackTable(items, pagination) {
  if (!items.length) {
    feedbackTable.innerHTML = '<div class="muted">No feedback records match the selected filters.</div>';
    feedbackPaginationSummary.textContent = '0 results';
    feedbackPrevPageButton.disabled = true;
    feedbackNextPageButton.disabled = true;
    return;
  }

  feedbackTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Submitted</th>
          <th>Outlet</th>
          <th>Status</th>
          <th>Overall</th>
          <th>Recommend</th>
          <th>Mobile</th>
          <th>Comment</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${escapeHtml(formatDateTime(item.submitted_at))}</td>
            <td>
              <strong>${escapeHtml(item.ro_name)}</strong>
              <div class="muted table-secondary">${escapeHtml(item.district)}</div>
            </td>
            <td><span class="status-badge status-${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></td>
            <td>${escapeHtml(item.overall_rating)}</td>
            <td>${escapeHtml(item.recommend_rating)}</td>
            <td>${escapeHtml(item.mobile_number)}</td>
            <td>${escapeHtml(item.comment || 'No comment provided.')}</td>
            <td><button class="ghost-button inline-action" type="button" data-feedback-id="${item.feedback_id}">View details</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const total = pagination.total || 0;
  const start = total ? (pagination.page - 1) * pagination.page_size + 1 : 0;
  const end = total ? Math.min(pagination.page * pagination.page_size, total) : 0;
  feedbackPaginationSummary.textContent = `Showing ${start}-${end} of ${formatNumber(total)} feedback records`;
  feedbackPrevPageButton.disabled = pagination.page <= 1;
  feedbackNextPageButton.disabled = pagination.total_pages === 0 || pagination.page >= pagination.total_pages;
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
  const canReview = item.status === 'UNDER_REVIEW' && currentUserContext && currentUserContext.role !== 'RO_USER';

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
    ${canReview ? `
      <div class="feedback-detail-section">
        <span class="detail-label">This feedback is flagged for review (anomalous volume vs trailing average)</span>
        <label>
          Reason (required to reject; optional to approve)
          <textarea id="reviewReasonInput" rows="2" placeholder="e.g. Suspicious volume pattern, confirmed with outlet staff"></textarea>
        </label>
        <div class="modal-actions">
          <button class="ghost-button" type="button" id="rejectFeedbackButton" data-feedback-id="${item.feedback_id}">Reject</button>
          <button class="primary-button" type="button" id="approveFeedbackButton" data-feedback-id="${item.feedback_id}">Approve</button>
        </div>
      </div>
    ` : ''}
  `;
  feedbackDetailOverlay.classList.remove('hidden');
}

async function openFeedbackDetail(feedbackId) {
  const response = await apiFetch(`/api/v1/dashboard/feedback/${encodeURIComponent(feedbackId)}`);
  renderFeedbackDetail(response.data);
}

async function loadFeedbackExplorer(page = 1) {
  const filters = getFeedbackFilters();
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(feedbackPageSize),
  });

  if (filters.startDate) params.set('start_date', filters.startDate);
  if (filters.endDate) params.set('end_date', filters.endDate);
  if (filters.status) params.set('status', filters.status);
  if (filters.roId) params.set('ro_id', filters.roId);

  const response = await apiFetch(`/api/v1/dashboard/feedback?${params.toString()}`);
  feedbackPage = response.pagination.page;
  feedbackTotalPages = response.pagination.total_pages;
  renderFeedbackTable(response.data.items, response.pagination);
}

async function loadAwards(scopeType, todayIso) {
  // Weekly Air Star / Special Recognition are state-wide rankings -- the
  // backend restricts them to STATE/DO scope (same as District Air
  // Champion), so District Admins and Field Officers see a plain message
  // rather than a failed request.
  const eligible = scopeType === 'STATE' || scopeType === 'DO';
  if (!eligible) {
    if (weeklyAirStarCard) weeklyAirStarCard.innerHTML = '<div class="muted">Not available for your role.</div>';
    if (specialRecognitionList) specialRecognitionList.innerHTML = '<div class="muted">Not available for your role.</div>';
    return;
  }

  const week = currentWeekWindow(todayIso);
  const [weeklyResponse, specialResponse] = await Promise.all([
    week
      ? apiFetch(`/api/v1/dashboard/weekly-air-star?week_start=${week.start}&week_end=${week.end}`)
      : Promise.resolve({ data: { winner: null } }),
    apiFetch(`/api/v1/dashboard/special-recognition?start_date=${CAMPAIGN_START_DATE}&end_date=${todayIso}`),
  ]);

  renderWeeklyAirStar(weeklyResponse.data.winner);
  renderSpecialRecognition(specialResponse.data.categories);
}

async function loadLuckyDrawPanel(role, doNameById) {
  if (!luckyDrawPanel) return;
  const canRunDraw = role === 'SUPER_ADMIN' || role === 'STATE_ADMIN';
  luckyDrawPanel.classList.toggle('hidden', !canRunDraw);
  if (!canRunDraw) return;

  const response = await apiFetch('/api/v1/admin/lucky-draw/winners');
  renderLuckyDrawWinners(response.data.winners, doNameById);
}

async function loadDashboard() {
  const scoreDate = scoreDateInput.value;
  const trendStart = trendStartInput.value;
  const trendEnd = trendEndInput.value;

  appShell.classList.add('is-loading');
  try {
    const [me, overview, leaderboard, trend, rollups, recentFeedbackResponse, feedbackOutletsResponse] = await Promise.all([
      apiFetch('/api/v1/dashboard/me'),
      apiFetch(`/api/v1/dashboard/overview?score_date=${encodeURIComponent(scoreDate)}`),
      apiFetch(`/api/v1/dashboard/leaderboard?score_date=${encodeURIComponent(scoreDate)}&limit=${encodeURIComponent(leaderboardLimitInput.value)}`),
      apiFetch(`/api/v1/dashboard/trend?start_date=${encodeURIComponent(trendStart)}&end_date=${encodeURIComponent(trendEnd)}`),
      apiFetch(`/api/v1/dashboard/rollups?score_date=${encodeURIComponent(scoreDate)}`),
      apiFetch(`/api/v1/dashboard/recent-feedback?score_date=${encodeURIComponent(scoreDate)}&limit=12`),
      apiFetch('/api/v1/dashboard/feedback-outlets'),
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

    renderMetrics(overview.data.metrics, scoreDate);
    renderRecommendationChart(overview.data.recommendation_split);
    renderIssueChart(overview.data.issue_hotspots);
    renderTrendChart(trend.data.trend);
    renderLeaderboard(leaderboard.data.leaderboard);
    renderRollups(rollups.data.state, rollups.data.divisional_offices);
    renderRecentFeedback(recentFeedbackResponse.data.items);
    populateFeedbackOutletFilter(feedbackOutletsResponse.data.outlets);
    await loadFeedbackExplorer(1);

    // Award panels are supplementary -- a hiccup here shouldn't block the
    // core dashboard (metrics/leaderboard/feedback) from having loaded fine.
    try {
      const doNameById = new Map(rollups.data.divisional_offices.map((row) => [row.scope_id, row.scope_name]));
      await loadAwards(me.data.scope_type, scoreDate || today);
      await loadLuckyDrawPanel(me.data.role, doNameById);
    } catch (error) {
      console.error('Failed to load award panels', error);
    }
  } finally {
    appShell.classList.remove('is-loading');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const signInButton = loginForm.querySelector('button[type=submit]');

  setButtonLoading(signInButton, true, 'Signing in…');
  try {
    const response = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    setToken(response.data.access_token);
    setRefreshToken(response.data.refresh_token);
    setAuthenticated(true);
    await loadDashboard();
    showToast('Dashboard login successful.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(signInButton, false);
  }
});

leaderboardLimitInput.addEventListener('change', async () => {
  leaderboardTable.classList.add('is-loading');
  try {
    const response = await apiFetch(
      `/api/v1/dashboard/leaderboard?score_date=${encodeURIComponent(scoreDateInput.value)}&limit=${encodeURIComponent(leaderboardLimitInput.value)}`,
    );
    renderLeaderboard(response.data.leaderboard);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    leaderboardTable.classList.remove('is-loading');
  }
});

refreshButton.addEventListener('click', async () => {
  setButtonLoading(refreshButton, true, 'Refreshing…');
  try {
    await loadDashboard();
    showToast('Dashboard refreshed.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(refreshButton, false);
  }
});

logoutButton.addEventListener('click', () => {
  const refreshToken = getRefreshToken();
  clearToken();
  clearRefreshToken();
  setAuthenticated(false);
  showToast('Logged out.');

  if (refreshToken) {
    // Best-effort server-side revocation; local session is already cleared
    // above regardless of whether this call succeeds.
    rawFetch('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }
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
  const submitButton = passwordForm.querySelector('button[type=submit]');

  setButtonLoading(submitButton, true, 'Updating…');
  try {
    await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    passwordModalOverlay.classList.add('hidden');
    showToast('Password updated successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

// ---- Manage Users (role-aware: State Head creates DO Heads, DO Head creates Field Officers) ----

async function populateScopeOptions() {
  if (!currentUserContext) return;

  if (currentUserContext.role === 'DO_ADMIN') {
    // DO Head creates a Field Officer -- outlet dropdown scoped to their
    // own DO. Uses feedback-outlets (filtered only by is_active) rather
    // than the leaderboard, which only lists outlets with a ranking row
    // for today and would otherwise hide any outlet that hasn't scored yet.
    userModalTitle.textContent = 'Add Field Officer';
    scopeIdField.firstChild.textContent = 'Outlet (within your Divisional Office)';
    const outlets = await apiFetch('/api/v1/dashboard/feedback-outlets');
    newUserScopeId.innerHTML = outlets.data.outlets
      .map((row) => `<option value="${row.ro_id}">${escapeHtml(row.ro_name)}</option>`)
      .join('');
  } else {
    // SUPER_ADMIN / STATE_ADMIN create a Divisional Head -- DO dropdown.
    userModalTitle.textContent = 'Add Divisional Head';
    scopeIdField.firstChild.textContent = 'Divisional Office';
    const rollups = await apiFetch('/api/v1/dashboard/rollups');
    newUserScopeId.innerHTML = rollups.data.divisional_offices
      .map((row) => `<option value="${row.scope_id}">${escapeHtml(row.scope_name)}</option>`)
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
  setButtonLoading(manageUsersButton, true, 'Loading…');
  try {
    await populateScopeOptions();
    await loadExistingUsers();
    userModalOverlay.classList.remove('hidden');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(manageUsersButton, false);
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

if (recentFeedback) {
  recentFeedback.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-feedback-id]');
    if (!trigger) {
      return;
    }

    setButtonLoading(trigger, true, 'Loading…');
    try {
      await openFeedbackDetail(trigger.dataset.feedbackId);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonLoading(trigger, false);
    }
  });
}

feedbackTable.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-feedback-id]');
  if (!trigger) {
    return;
  }

  setButtonLoading(trigger, true, 'Loading…');
  try {
    await openFeedbackDetail(trigger.dataset.feedbackId);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(trigger, false);
  }
});

applyFeedbackFiltersButton.addEventListener('click', async () => {
  setButtonLoading(applyFeedbackFiltersButton, true, 'Applying…');
  try {
    await loadFeedbackExplorer(1);
    showToast('Feedback filters applied.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(applyFeedbackFiltersButton, false);
  }
});

resetFeedbackFiltersButton.addEventListener('click', async () => {
  feedbackStartDateInput.value = scoreDateInput.value;
  feedbackEndDateInput.value = scoreDateInput.value;
  feedbackStatusFilter.value = '';
  feedbackOutletFilter.value = '';

  setButtonLoading(resetFeedbackFiltersButton, true, 'Resetting…');
  try {
    await loadFeedbackExplorer(1);
    showToast('Feedback filters reset.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(resetFeedbackFiltersButton, false);
  }
});

feedbackPrevPageButton.addEventListener('click', async () => {
  if (feedbackPage <= 1) return;
  setButtonLoading(feedbackPrevPageButton, true, 'Loading…');
  try {
    await loadFeedbackExplorer(feedbackPage - 1);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    // setButtonLoading(false) unconditionally clears .disabled -- re-apply
    // the pagination-driven state renderFeedbackTable already set, so a
    // page-1 "Previous" doesn't get incorrectly re-enabled.
    setButtonLoading(feedbackPrevPageButton, false);
    feedbackPrevPageButton.disabled = feedbackPage <= 1;
  }
});

feedbackNextPageButton.addEventListener('click', async () => {
  if (feedbackPage >= feedbackTotalPages) return;
  setButtonLoading(feedbackNextPageButton, true, 'Loading…');
  try {
    await loadFeedbackExplorer(feedbackPage + 1);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(feedbackNextPageButton, false);
    feedbackNextPageButton.disabled = feedbackTotalPages === 0 || feedbackPage >= feedbackTotalPages;
  }
});

// ---- Fortnightly Lucky Draw ----

if (runLuckyDrawButton) {
  runLuckyDrawButton.addEventListener('click', async () => {
    setButtonLoading(runLuckyDrawButton, true, 'Loading…');
    try {
      const window_ = currentFortnightWindow(scoreDateInput.value || today);
      luckyDrawFortnightInfo.textContent = window_
        ? `This will draw for Fortnight ${window_.fortnightNumber}: ${window_.start} to ${window_.end}.`
        : 'Campaign has not started yet.';

      const rollups = await apiFetch('/api/v1/dashboard/rollups');
      luckyDrawDoSelect.innerHTML = rollups.data.divisional_offices
        .map((row) => `<option value="${row.scope_id}">${escapeHtml(row.scope_name)}</option>`)
        .join('');

      luckyDrawModalOverlay.classList.remove('hidden');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonLoading(runLuckyDrawButton, false);
    }
  });

  closeLuckyDrawModal.addEventListener('click', () => {
    luckyDrawModalOverlay.classList.add('hidden');
  });

  luckyDrawForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const doId = parseInt(luckyDrawDoSelect.value, 10);
    const submitButton = luckyDrawForm.querySelector('button[type=submit]');

    setButtonLoading(submitButton, true, 'Drawing…');
    try {
      const response = await apiFetch('/api/v1/admin/lucky-draw/run', {
        method: 'POST',
        body: JSON.stringify({ do_id: doId }),
      });
      showToast(`Draw complete: ${response.data.winners.length} winner(s) selected for Fortnight ${response.data.fortnight_number}.`);
      luckyDrawModalOverlay.classList.add('hidden');
      await loadLuckyDrawPanel(currentUserContext.role);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

// ---- Flagged feedback review (approve/reject from the detail modal) ----

feedbackDetailBody.addEventListener('click', async (event) => {
  const approveTrigger = event.target.closest('#approveFeedbackButton');
  const rejectTrigger = event.target.closest('#rejectFeedbackButton');
  if (!approveTrigger && !rejectTrigger) {
    return;
  }

  const feedbackId = (approveTrigger || rejectTrigger).dataset.feedbackId;
  const decision = approveTrigger ? 'APPROVE' : 'REJECT';
  const reasonInput = document.getElementById('reviewReasonInput');
  const typedReason = reasonInput ? reasonInput.value.trim() : '';

  if (decision === 'REJECT' && !typedReason) {
    showToast('Enter a reason before rejecting this feedback.', 'error');
    reasonInput?.focus();
    return;
  }

  const reason = typedReason || 'Reviewed and approved by dashboard staff.';
  const trigger = approveTrigger || rejectTrigger;

  setButtonLoading(trigger, true, decision === 'APPROVE' ? 'Approving…' : 'Rejecting…');
  try {
    await apiFetch(`/api/v1/admin/feedback/${encodeURIComponent(feedbackId)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    });
    showToast(`Feedback ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
    feedbackDetailOverlay.classList.add('hidden');
    await loadFeedbackExplorer(feedbackPage);
  } catch (error) {
    showToast(error.message, 'error');
    setButtonLoading(trigger, false);
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
  const submitButton = createUserForm.querySelector('button[type=submit]');

  setButtonLoading(submitButton, true, 'Creating…');
  try {
    await apiFetch('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    showToast(`${isDoHead ? 'Field Officer' : 'Divisional Head'} account created. Share the default password securely -- they can change it after logging in.`);
    createUserForm.reset();
    await loadExistingUsers();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});
