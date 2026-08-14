import { PageTitle } from '@/components/common/PageTitle';

export default function StaffPage() {
  return (
    <>
      <PageTitle title="Staff & Shifts" />

      <div className="main-header">
        <div>
          <h1>Staff &amp; Shifts</h1>
          <span className="subtle small">Who can do what — and where every taka went</span>
        </div>
      </div>

      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 12 }}>Coming Soon 🚧</h2>
        <p className="subtle small">
          Staff management, granular permissions, and shift tracking are currently in development.
        </p>
      </div>
    </>
  );
}