const apiBase = window.__AIRCARE_API_BASE__ || '';

/**
 * Reads the RO code from either URL format:
 * - Query param: ?ro_code=AIRCARE-219578 (this app's original design)
 * - Path segment: /feedback/AIRCARE-219578 (the format already baked into
 *   the 127 printed QR codes -- see qr-codes/README.md in the backend repo)
 *
 * Both are supported so the already-generated QR designs work without
 * needing to be regenerated/reprinted. Falls back to the query param if
 * both are somehow present; falls back to the hardcoded default only if
 * neither is found (e.g. viewing the page directly during testing).
 */
function resolveRoCode() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('ro_code');
  if (fromQuery) return fromQuery;

  const pathMatch = window.location.pathname.match(/AIRCARE-[A-Za-z0-9]+/);
  if (pathMatch) return pathMatch[0];

  return 'AIRCARE-219578';
}

const roCode = resolveRoCode();

const outletTitle = document.getElementById('outletTitle');
const outletSubtitle = document.getElementById('outletSubtitle');
const availabilityPill = document.getElementById('availabilityPill');
const sessionStatus = document.getElementById('sessionStatus');
const toast = document.getElementById('toast');

const mobileForm = document.getElementById('mobileForm');
const feedbackForm = document.getElementById('feedbackForm');
const mobileNumberInput = document.getElementById('mobileNumber');
const commentInput = document.getElementById('comment');
const photoFileInput = document.getElementById('photoFile');
const photoHelp = document.getElementById('photoHelp');
const gpsLatInput = document.getElementById('gpsLat');
const gpsLngInput = document.getElementById('gpsLng');

let currentMobile = '';

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  let body = options.body;
  if (body !== undefined && body !== null && typeof body !== 'string' && headers['Content-Type']?.includes('application/json')) {
    body = JSON.stringify(body);
  }

  // Defensive fix: if a JSON string was accidentally double-stringified, unwrap once.
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') {
          body = parsed;
        }
      } catch {
        // Keep the original body if this is not valid JSON.
      }
    }
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    body,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.detail?.error?.message ||
      payload?.error?.message ||
      (Array.isArray(payload?.detail) ? payload.detail.map((item) => item?.msg || item).join('; ') : payload?.detail) ||
      'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function unlockStep(stepElement) {
  stepElement.classList.remove('disabled');
}

function lockStep(stepElement) {
  stepElement.classList.add('disabled');
}

function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(`${apiBase}/api/v1/feedback/photo`, {
    method: 'POST',
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.detail?.error?.message ||
      payload?.error?.message ||
      payload?.message ||
      'Photo upload failed';
    throw new Error(message);
  }

  const photoUrl = payload?.data?.photo_url;
  if (!photoUrl) {
    throw new Error('Photo upload failed: no URL returned.');
  }

  return photoUrl;
}

function captureGpsInBackground() {
  if (!('geolocation' in navigator)) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      gpsLatInput.value = String(position.coords.latitude);
      gpsLngInput.value = String(position.coords.longitude);
    },
    () => {
      // Keep this silent; backend returns a clear message if GPS is unavailable.
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    }
  );
}

async function loadOutlet() {
  outletTitle.textContent = 'Loading outlet details...';
  availabilityPill.textContent = 'Checking outlet';

  try {
    const data = await apiFetch(`/api/v1/ro/${encodeURIComponent(roCode)}/validate`);
    outletTitle.textContent = data.data.ro_name;
    outletSubtitle.textContent = `You are submitting feedback for ${data.data.ro_name}.`;
    availabilityPill.textContent = data.data.is_active ? 'Outlet active' : 'Outlet inactive';
    availabilityPill.style.color = data.data.is_active ? '#baf3ea' : '#ffd0da';
  } catch (error) {
    outletTitle.textContent = 'Outlet not found';
    outletSubtitle.textContent = 'This QR code does not resolve to an active outlet.';
    availabilityPill.textContent = 'Not available';
    availabilityPill.style.color = '#ffd0da';
    showToast(error.message, 'error');
  }
}

mobileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const mobileNumber = mobileNumberInput.value.trim();
  if (!/^\d{10}$/.test(mobileNumber)) {
    showToast('Enter a valid 10-digit mobile number.', 'error');
    return;
  }

  currentMobile = mobileNumber;
  unlockStep(feedbackForm);
  sessionStatus.textContent = 'Ready to submit';
  captureGpsInBackground();
  showToast('Great. Please complete the feedback form.');
});

feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const airAvailabilityRating = feedbackForm.querySelector('input[name="airAvailabilityRating"]:checked')?.value;
  const airEquipmentRating = feedbackForm.querySelector('input[name="airEquipmentRating"]:checked')?.value;
  const airPromptnessRating = feedbackForm.querySelector('input[name="airPromptnessRating"]:checked')?.value;
  const airAttendantRating = feedbackForm.querySelector('input[name="airAttendantRating"]:checked')?.value;
  const airOverallRating = feedbackForm.querySelector('input[name="airOverallRating"]:checked')?.value;
  const recommendRating = feedbackForm.querySelector('input[name="recommendRating"]:checked')?.value;

  if (!airAvailabilityRating || !airEquipmentRating || !airPromptnessRating || !airAttendantRating || !airOverallRating || !recommendRating) {
    showToast('Answer all 5 free air service questions before submitting.', 'error');
    return;
  }

  const selectedPhoto = photoFileInput?.files?.[0] || null;

  const payload = {
    ro_code: roCode,
    mobile_number: currentMobile,
    service_type: 'AIR',
    rating: airOverallRating,
    air_availability_rating: airAvailabilityRating,
    air_equipment_rating: airEquipmentRating,
    air_promptness_rating: airPromptnessRating,
    air_attendant_rating: airAttendantRating,
    air_overall_rating: airOverallRating,
    recommend_rating: recommendRating,
    comment: commentInput.value.trim() || null,
    photo_url: null,
    gps_lat: gpsLatInput.value.trim() ? Number(gpsLatInput.value) : null,
    gps_lng: gpsLngInput.value.trim() ? Number(gpsLngInput.value) : null,
  };

  if (!currentMobile) {
    showToast('Enter mobile number before submitting feedback.', 'error');
    return;
  }

  if (payload.gps_lat === null || payload.gps_lng === null) {
    showToast('Enable location access and try again.', 'error');
    captureGpsInBackground();
    return;
  }

  try {
    if (selectedPhoto) {
      sessionStatus.textContent = 'Uploading photo...';
      payload.photo_url = await uploadPhoto(selectedPhoto);
      if (photoHelp) {
        photoHelp.textContent = 'Photo attached successfully.';
      }
    }

    sessionStatus.textContent = 'Submitting feedback...';
    const data = await apiFetch('/api/v1/feedback', {
      method: 'POST',
      body: compactPayload(payload),
    });

    sessionStatus.textContent = 'Submitted';
    showToast(`Thanks. Feedback ${data.data.feedback_id} saved successfully.`);
    feedbackForm.reset();
    if (photoHelp) {
      photoHelp.textContent = 'You can take a photo with camera or choose from gallery (max 5 MB).';
    }
  } catch (error) {
    sessionStatus.textContent = 'Ready to submit';
    showToast(error.message, 'error');
  }
});

loadOutlet();
