export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--color-navy)]">
          AirCare Challenge
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2">
          Scan the QR code at your nearest IndianOil retail outlet to share
          feedback on the Free Air facility.
        </p>
      </div>
    </main>
  );
}
