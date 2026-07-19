const apiBase = window.__AIRCARE_API_BASE__ || '';

/**
 * Reads the RO code from either URL format:
 * - Query param: ?ro_code=AIRCARE-219578 (this app's original design, and
 *   the format actually encoded in the 127 printed QR codes -- see
 *   artifacts/qr/index.csv in the backend repo)
 * - Path segment: /feedback/AIRCARE-219578 (kept as a fallback in case any
 *   QR pack is regenerated in path mode in the future)
 *
 * There is intentionally no other fallback: feedback can only be submitted
 * through an outlet QR URL.
 */
function resolveRoCode() {
  // Matched case-insensitively (a customer could hand-type or share a
  // lowercased URL), then normalized to uppercase before use -- QR codes
  // are stored as "AIRCARE-XXXXXX" and looked up with an exact match, so
  // an unnormalized lowercase code would match this regex but still fail
  // to resolve against the backend.
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('ro_code')?.trim();
  if (/^AIRCARE-[A-Za-z0-9]+$/i.test(fromQuery || '')) return fromQuery.toUpperCase();

  const pathMatch = window.location.pathname.match(/AIRCARE-[A-Za-z0-9]+/i);
  if (pathMatch) return pathMatch[0].toUpperCase();

  return null;
}

const roCode = resolveRoCode();

const outletTitle = document.getElementById('outletTitle');
const outletSubtitle = document.getElementById('outletSubtitle');
const availabilityPill = document.getElementById('availabilityPill');
const sessionStatus = document.getElementById('sessionStatus');
const toast = document.getElementById('toast');
const feedbackFlow = document.getElementById('feedbackFlow');
const mobilePanel = document.getElementById('mobilePanel');
const surveyPanel = document.getElementById('surveyPanel');
const acknowledgementPanel = document.getElementById('acknowledgementPanel');
const acknowledgementMessage = document.getElementById('acknowledgementMessage');
const acknowledgementOutlet = document.getElementById('acknowledgementOutlet');
const acknowledgementFeedbackId = document.getElementById('acknowledgementFeedbackId');
const submitAnotherButton = document.getElementById('submitAnotherButton');

const mobileForm = document.getElementById('mobileForm');
const feedbackForm = document.getElementById('feedbackForm');
const mobileNumberInput = document.getElementById('mobileNumber');
const commentInput = document.getElementById('comment');
const photoFileInput = document.getElementById('photoFile');
const photoHelp = document.getElementById('photoHelp');
const gpsLatInput = document.getElementById('gpsLat');
const gpsLngInput = document.getElementById('gpsLng');
const mobileSubmitButton = mobileForm.querySelector('button[type="submit"]');

let currentMobile = '';

function setStep(activeStep) {
  void activeStep;
}

function showMobileStep() {
  feedbackFlow.classList.remove('hidden');
  acknowledgementPanel.classList.add('hidden');
  mobilePanel.classList.remove('hidden');
  surveyPanel.classList.add('hidden');
  lockStep(feedbackForm);
  sessionStatus.textContent = 'Waiting for mobile number';
  outletSubtitle.textContent = `You are submitting feedback for ${outletTitle.textContent}.`;
  setStep('mobile');
}

function showSurveyStep() {
  mobilePanel.classList.add('hidden');
  surveyPanel.classList.remove('hidden');
  unlockStep(feedbackForm);
  sessionStatus.textContent = 'Ready to submit';
  outletSubtitle.textContent = 'Rate the service and submit your feedback.';
  setStep('survey');
}

function showAcknowledgementStep(feedbackId) {
  feedbackFlow.classList.add('hidden');
  acknowledgementPanel.classList.remove('hidden');
  acknowledgementOutlet.textContent = outletTitle.textContent;
  acknowledgementFeedbackId.textContent = `Feedback reference: ${feedbackId}`;
  acknowledgementMessage.textContent = 'Your feedback has been submitted successfully. Thank you for helping improve the free air service.';
  outletSubtitle.textContent = 'Submission complete. You may now close this page.';
  setStep('done');
}

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

function showUnavailableOutlet(message, title = 'Invalid outlet QR code') {
  outletTitle.textContent = title;
  outletSubtitle.textContent = message;
  availabilityPill.textContent = 'Not available';
  availabilityPill.style.color = '#ffd0da';
  mobileNumberInput.disabled = true;
  mobileSubmitButton.disabled = true;
  lockStep(mobileForm);
  lockStep(feedbackForm);
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

// GPS is a hard requirement to submit -- once denied, the browser won't
// re-prompt from a page script no matter how many times getCurrentPosition
// is called again, so a customer who denies it (or whose browser blocks it
// by default) would otherwise hit "Enable location access and try again."
// forever with no way forward. This distinguishes that case to give
// actionable guidance instead of a dead-end retry loop.
async function getGeolocationPermissionState() {
  if (!navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}

async function loadOutlet() {
  if (!roCode) {
    showUnavailableOutlet('Please scan the QR code displayed at an AirCare outlet to submit feedback.');
    return;
  }

  outletTitle.textContent = 'Loading outlet details...';
  availabilityPill.textContent = 'Checking outlet';

  try {
    const data = await apiFetch(`/api/v1/ro/${encodeURIComponent(roCode)}/validate`);
    if (!data.data.is_active) {
      showUnavailableOutlet('This outlet is not currently accepting feedback.', data.data.ro_name);
      return;
    }

    outletTitle.textContent = data.data.ro_name;
    outletSubtitle.textContent = `You are submitting feedback for ${data.data.ro_name}.`;
    availabilityPill.textContent = data.data.is_active ? 'Outlet active' : 'Outlet inactive';
    availabilityPill.style.color = data.data.is_active ? '#baf3ea' : '#ffd0da';
  } catch (error) {
    showUnavailableOutlet('This QR code does not resolve to an active outlet.', 'Outlet not found');
    showToast(error.message, 'error');
  }
}

async function checkMobileEligibility(mobileNumber) {
  const params = new URLSearchParams({
    ro_code: roCode,
    mobile_number: mobileNumber,
  });

  return apiFetch(`/api/v1/feedback/eligibility?${params.toString()}`, {
    method: 'GET',
  });
}

mobileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const mobileNumber = mobileNumberInput.value.trim();
  if (!/^\d{10}$/.test(mobileNumber)) {
    showToast('Enter a valid 10-digit mobile number.', 'error');
    return;
  }

  mobileSubmitButton.disabled = true;
  mobileSubmitButton.textContent = 'Checking...';

  try {
    await checkMobileEligibility(mobileNumber);
    currentMobile = mobileNumber;
    showSurveyStep();
    showToast('Great. Please complete the feedback form.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    mobileSubmitButton.disabled = false;
    mobileSubmitButton.textContent = 'Continue';
  }
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
    const permissionState = await getGeolocationPermissionState();
    if (permissionState === 'denied') {
      showToast(
        'Location access is blocked for this site. Open your browser settings (tap the lock or "i" icon in the address bar), allow Location, then reload this page.',
        'error'
      );
    } else {
      showToast('Still waiting for your location. Please wait a moment and try again.', 'error');
      captureGpsInBackground();
    }
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
    currentMobile = '';
    if (photoHelp) {
      photoHelp.textContent = 'You can take a photo with camera or choose from gallery (max 5 MB).';
    }
    showAcknowledgementStep(data.data.feedback_id);
  } catch (error) {
    sessionStatus.textContent = 'Ready to submit';
    showToast(error.message, 'error');
  }
});

submitAnotherButton.addEventListener('click', () => {
  mobileForm.reset();
  feedbackForm.reset();
  currentMobile = '';
  if (photoHelp) {
    photoHelp.textContent = 'You can take a photo with camera or choose from gallery (max 5 MB).';
  }
  showMobileStep();
});

loadOutlet();
// Fired as early as possible (page load, not after the mobile-number step)
// so GPS has the whole time the customer spends on the form to resolve,
// rather than just the survey-filling window -- and so the permission
// prompt (if the browser shows one) appears before they've invested time
// filling anything in.
captureGpsInBackground();
