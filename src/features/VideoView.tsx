const base = import.meta.env.BASE_URL;

export function VideoView() {
  return (
    <section aria-labelledby="video-h">
      <h1 id="video-h">Demo video</h1>
      <p className="muted">
        A captioned, narrated walkthrough (about 90 seconds): the lifecycle simulation, the dashboard, one issue worked through the closed loop, and the learning view.
        All data is fictional.
      </p>
      <video
        controls
        preload="metadata"
        poster={`${base}media/poster.png`}
        src={`${base}media/quality-loop-demo.mp4`}
        style={{ width: '100%', maxWidth: 1100, borderRadius: 8 }}
        data-testid="demo-video"
      >
        Your browser does not support embedded video. <a href={`${base}media/quality-loop-demo.mp4`}>Download the demo video</a>.
      </video>
    </section>
  );
}
