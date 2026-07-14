"use client";

import { useEffect, useState } from "react";
import { Wind, Check, Camera, X } from "lucide-react";
import { SmileyRating, RatingValue } from "@/components/SmileyRating";
import {
  ApiError,
  getBrowserLocation,
  getPublicConfig,
  registerMobile,
  requestEscalationOtp,
  requestSelfCheck,
  submitFeedback,
  requestPhotoUploadUrl,
  uploadPhotoToS3,
  validateRo,
  verifyEscalationOtp,
  verifySelfCheck,
} from "@/lib/api";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];

type Step = "loading" | "invalid" | "mobile" | "selfcheck" | "escalation" | "gps_escalation" | "rating" | "submitting" | "done" | "error";

type NpsValue = "YES" | "MAYBE" | "NO";

export function FeedbackFlow({ roCode }: { roCode: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [roName, setRoName] = useState("");
  const [mobile, setMobile] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // must stay empty -- a human never fills this
  const [escalationOtp, setEscalationOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  // The five feedback dimensions are captured as separate smiley-face
  // questions, not a single overall rating.
  const [availabilityRating, setAvailabilityRating] = useState<RatingValue | null>(null);
  const [functionalityRating, setFunctionalityRating] = useState<RatingValue | null>(null);
  const [promptnessRating, setPromptnessRating] = useState<RatingValue | null>(null);
  const [attendantBehaviourRating, setAttendantBehaviourRating] = useState<RatingValue | null>(null);
  const [overallExperienceRating, setOverallExperienceRating] = useState<RatingValue | null>(null);
  const [npsResponse, setNpsResponse] = useState<NpsValue | null>(null);

  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [selfCheckEnabled, setSelfCheckEnabled] = useState<boolean | null>(null);

  const allDimensionsAnswered =
    availabilityRating && functionalityRating && promptnessRating && attendantBehaviourRating && overallExperienceRating;

  useEffect(() => {
    Promise.all([validateRo(roCode), getPublicConfig().catch(() => null)])
      .then(([roRes, configRes]) => {
        if (!roRes.data.is_active) {
          setStep("invalid");
          return;
        }
        setRoName(roRes.data.ro_name);
        setSelfCheckEnabled(configRes?.data.self_check_enabled ?? false);
        setStep("mobile");
      })
      .catch(() => setStep("invalid"));
  }, [roCode]);

  async function loadSelfCheck() {
    setErrorMessage("");
    try {
      const res = await requestSelfCheck();
      setChallengeId(res.data.challenge_id);
      setConfirmed(false);
      setHoneypot("");
    } catch {
      setErrorMessage("Something went wrong. Check your connection and try again.");
    }
  }

  async function handleContinueToSelfCheck() {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setErrorMessage("Enter a valid 10-digit mobile number.");
      return;
    }
    setErrorMessage("");

    if (!selfCheckEnabled) {
      try {
        const res = await registerMobile(mobile, roCode);
        setSessionToken(res.data.feedback_session_token);
        setStep("rating");
      } catch (e) {
        setErrorMessage(e instanceof ApiError ? e.message : "Please try again.");
      }
      return;
    }

    setStep("selfcheck");
    await loadSelfCheck();
  }

  async function handleVerifySelfCheck() {
    if (!confirmed) {
      setErrorMessage("Please confirm the checkbox to continue.");
      return;
    }
    setErrorMessage("");
    try {
      const res = await verifySelfCheck(challengeId, confirmed, honeypot, mobile, roCode);
      if (res.data.requires_escalation) {
        setStep("escalation");
        await requestEscalationOtp(mobile);
      } else if (res.data.feedback_session_token) {
        setSessionToken(res.data.feedback_session_token);
        setStep("rating");
      }
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : "Please try again.");
      await loadSelfCheck();
    }
  }

  async function handleVerifyEscalation() {
    setErrorMessage("");
    try {
      const res = await verifyEscalationOtp(mobile, escalationOtp, roCode);
      setSessionToken(res.data.feedback_session_token);
      setStep("rating");
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : "Incorrect code. Try again.");
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoError("");
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Please choose a JPEG or PNG photo.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo must be under 5MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError("");
  }

  async function doSubmit(sessionTokenToUse: string) {
    let photoUrl: string | undefined;

    if (photoFile) {
      try {
        const presign = await requestPhotoUploadUrl(photoFile.type, sessionTokenToUse);
        await uploadPhotoToS3(photoFile, presign.data.upload_url, presign.data.upload_fields);
        photoUrl = presign.data.photo_url;
      } catch {
        setErrorMessage("Photo couldn't be uploaded, but your feedback will still be submitted.");
      }
    }

    const location = await getBrowserLocation();
    await submitFeedback(
      {
        ro_code: roCode,
        availability_rating: availabilityRating as RatingValue,
        functionality_rating: functionalityRating as RatingValue,
        promptness_rating: promptnessRating as RatingValue,
        attendant_behaviour_rating: attendantBehaviourRating as RatingValue,
        overall_experience_rating: overallExperienceRating as RatingValue,
        nps_response: npsResponse ?? undefined,
        comment: comment.trim() || undefined,
        photo_url: photoUrl,
        gps_lat: location?.lat,
        gps_lng: location?.lng,
      },
      sessionTokenToUse
    );
  }

  async function handleSubmit() {
    if (!allDimensionsAnswered) return;
    setStep("submitting");
    setErrorMessage("");
    try {
      await doSubmit(sessionToken);
      setStep("done");
    } catch (e) {
      if (e instanceof ApiError && e.code === "GPS_VERIFICATION_REQUIRED") {
        setStep("gps_escalation");
        try {
          await requestEscalationOtp(mobile);
        } catch {
          setErrorMessage("Could not send verification code. Please try again.");
        }
        return;
      }
      setErrorMessage(e instanceof ApiError ? e.message : "Submission failed. Please try again.");
      setStep("rating");
    }
  }

  async function handleVerifyGpsEscalation() {
    setErrorMessage("");
    setStep("submitting");
    try {
      const res = await verifyEscalationOtp(mobile, escalationOtp, roCode);
      await doSubmit(res.data.feedback_session_token);
      setStep("done");
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : "Verification failed. Try again.");
      setStep("gps_escalation");
    }
  }

  if (step === "loading") {
    return (
      <Shell>
        <p className="text-center text-[var(--color-muted)] mt-16">Loading outlet details…</p>
      </Shell>
    );
  }

  if (step === "invalid") {
    return (
      <Shell>
        <div className="text-center mt-16 px-6">
          <h1 className="font-[var(--font-display)] text-xl font-bold">
            This outlet is not currently part of the campaign
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            Please check with the retail outlet staff, or try again later.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="mb-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(253,244,237,0.96))] overflow-hidden">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide font-semibold text-[var(--color-orange)]">
              {roName || "IndianOil Retail Outlet"}
            </div>
            <h1 className="font-[var(--font-display)] text-xl font-bold mt-1 text-[var(--color-navy)]">
              How was the Free Air facility?
            </h1>
            <p className="text-sm mt-1 text-[var(--color-muted)]">
              Answer the 5 smiley questions below and share anything else that stood out.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {['1. Mobile', '2. OTP', '3. Smiley survey'].map((stepLabel, index) => (
              <span
                key={stepLabel}
                className={`px-3 py-2 rounded-full text-xs font-semibold border ${index === 2 ? 'bg-[var(--color-orange-soft)] text-[var(--color-orange)] border-[var(--color-orange-soft)]' : 'bg-white text-[var(--color-muted)] border-[var(--color-border)]'}`}
              >
                {stepLabel}
              </span>
            ))}
          </div>
        </Card>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)] text-sm px-3 py-2">
            {errorMessage}
          </div>
        )}

        {step === "mobile" && (
          <Card>
            <label className="text-sm font-medium block mb-1.5">Mobile Number</label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter 10-digit mobile number"
              inputMode="numeric"
              className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]"
            />
            <button
              onClick={handleContinueToSelfCheck}
              className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white bg-[var(--color-orange)]"
            >
              Continue
            </button>
          </Card>
        )}

        {step === "selfcheck" && (
          <Card>
            <div
              style={{ position: "absolute", left: "-9999px", opacity: 0 }}
              aria-hidden="true"
            >
              <label htmlFor="website">Leave this field empty</label>
              <input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--color-orange)]"
              />
              <span>I confirm this feedback is genuine.</span>
            </label>

            <button
              onClick={handleVerifySelfCheck}
              disabled={!confirmed}
              className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white bg-[var(--color-orange)] disabled:opacity-40"
            >
              Continue
            </button>
          </Card>
        )}

        {step === "escalation" && (
          <Card>
            <p className="text-sm text-[var(--color-muted)] mb-3">
              We sent a verification code via WhatsApp to your number. Enter it below.
            </p>
            <input
              value={escalationOtp}
              onChange={(e) => setEscalationOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]"
            />
            <button
              onClick={handleVerifyEscalation}
              disabled={!escalationOtp}
              className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white bg-[var(--color-orange)] disabled:opacity-40"
            >
              Verify &amp; Continue
            </button>
          </Card>
        )}

        {step === "gps_escalation" && (
          <Card>
            <p className="text-sm text-[var(--color-muted)] mb-3">
              Your location doesn&apos;t match this outlet. We sent a verification code via
              WhatsApp to confirm it&apos;s really you — your feedback is saved and will submit
              right after.
            </p>
            <input
              value={escalationOtp}
              onChange={(e) => setEscalationOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)]"
            />
            <button
              onClick={handleVerifyGpsEscalation}
              disabled={!escalationOtp}
              className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-white bg-[var(--color-orange)] disabled:opacity-40"
            >
              Verify &amp; Submit
            </button>
          </Card>
        )}

        {(step === "rating" || step === "submitting") && (
          <>
            <Card className="mb-4 space-y-5">
              <SmileyRating
                question="Availability of the Air Facility"
                value={availabilityRating}
                onChange={setAvailabilityRating}
              />
              <SmileyRating
                question="Functionality of Air Gauge & Equipment"
                value={functionalityRating}
                onChange={setFunctionalityRating}
              />
              <SmileyRating
                question="Promptness of Service"
                value={promptnessRating}
                onChange={setPromptnessRating}
              />
              <SmileyRating
                question="Attendant's Behaviour & Support"
                value={attendantBehaviourRating}
                onChange={setAttendantBehaviourRating}
              />
              <SmileyRating
                question="Overall Service Experience"
                value={overallExperienceRating}
                onChange={setOverallExperienceRating}
              />
            </Card>

            <Card className="mb-4">
              <div className="text-sm font-medium mb-2" style={{ color: "var(--color-navy)" }}>
                Would you recommend this Retail Outlet for Free Air Service to others?
              </div>
              <div className="flex gap-2">
                {(["YES", "MAYBE", "NO"] as NpsValue[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNpsResponse(opt)}
                    className="flex-1 rounded-lg py-2 text-xs font-semibold border transition"
                    style={{
                      borderColor: npsResponse === opt ? "var(--color-orange)" : "var(--color-border)",
                      backgroundColor: npsResponse === opt ? "var(--color-orange-soft)" : "transparent",
                      color: npsResponse === opt ? "var(--color-orange)" : "var(--color-muted)",
                    }}
                  >
                    {opt.charAt(0) + opt.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="mb-4">
              <label className="text-sm font-medium block mb-1.5">Tell us more (optional)</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="Share details about your experience…"
                className="w-full rounded-lg px-3 py-2 text-sm border border-[var(--color-border)] resize-none"
              />

              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                {photoPreviewUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreviewUrl}
                      alt="Selected photo preview"
                      className="w-16 h-16 rounded-lg object-cover border border-[var(--color-border)]"
                    />
                    <div className="flex-1 text-xs text-[var(--color-muted)]">
                      Photo attached
                    </div>
                    <button
                      onClick={clearPhoto}
                      className="p-1.5 rounded-full bg-[var(--color-bg)]"
                      aria-label="Remove photo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-muted)] cursor-pointer w-fit">
                    <Camera size={14} />
                    Add a photo (if equipment isn&apos;t working)
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
                {photoError && (
                  <p className="text-xs mt-1.5 text-[var(--color-danger)]">{photoError}</p>
                )}
              </div>
            </Card>

            <button
              disabled={!allDimensionsAnswered || step === "submitting"}
              onClick={handleSubmit}
              className="w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--color-orange)" }}
            >
              {step === "submitting" ? "Submitting…" : "Submit Feedback"}
            </button>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-10">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-[var(--color-success-soft)]">
              <Check className="text-[var(--color-success)]" size={28} />
            </div>
            <h2 className="font-[var(--font-display)] text-lg font-bold">Thank you!</h2>
            <p className="text-sm mt-2 text-[var(--color-muted)]">
              Your feedback for {roName} has been recorded.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "var(--color-navy)" }}>
        <div className="rounded-full p-1.5" style={{ backgroundColor: "var(--color-orange)" }}>
          <Wind className="text-white" size={16} />
        </div>
        <div>
          <div className="text-white text-sm font-bold leading-none font-[var(--font-display)]">
            AirCare Challenge
          </div>
          <div className="text-xs leading-none mt-0.5" style={{ color: "#B9C4DA" }}>
            IndianOil · Odisha
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 bg-[var(--color-card)] border border-[var(--color-border)] ${className}`}
    >
      {children}
    </div>
  );
}
