export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status">
      <div
        className="w-8 h-8 border-2 border-[--accent] border-t-transparent rounded-full animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
