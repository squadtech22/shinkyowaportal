// Shown instantly while a page renders on the server (pages read MySQL on
// every request), so clicking a link always gives immediate feedback.
export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true"></span>
      <p>Loading...</p>
    </div>
  );
}
