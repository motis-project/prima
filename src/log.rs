use tracing::subscriber::SetGlobalDefaultError;
use tracing_subscriber::fmt::format::FmtSpan;

pub fn setup_logging() -> Result<(), SetGlobalDefaultError> {
    let subscriber = tracing_subscriber::fmt()
        .compact()
        .with_thread_ids(true)
        .with_target(false)
        .with_span_events(FmtSpan::NEW | FmtSpan::CLOSE)
        .with_target(true)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
}
