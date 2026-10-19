export default function Loading() {
  return (
    <main className="explorer-loading" aria-busy="true" aria-live="polite">
      <span className="sr-only">Интерактив цаг агаарын зураг ачаалж байна</span>
      <div className="explorer-loading__header">
        <span />
        <span />
      </div>
      <div className="explorer-loading__warning" />
      <div className="explorer-loading__body">
        <div className="explorer-loading__sidebar" />
        <div className="explorer-loading__map">
          <span>Газрын зургийг бэлтгэж байна…</span>
        </div>
      </div>
    </main>
  );
}
