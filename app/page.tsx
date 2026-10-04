import Link from "next/link";
import ResetButton from "./reset-button";

export default function Home() {
  return (
    <>
      <div className="hero-grid">
        <div>
          <h1>Check every profile against the client&apos;s stated preferences before it is sent.</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            About 1 in 4 profiles shared with clients is rejected for a reason the client had already given us. This prototype flags those
            profiles before they go out, and learns from each rejection so the same mistake is not repeated.
          </p>
        </div>
        <div className="kpi-big">
          <div className="n">24%</div>
          <div className="muted small">of 1,000 profiles shared in 30 days were rejected for a reason the client had already stated (case data).</div>
        </div>
      </div>

      <div className="card step" style={{ margin: "32px 0 16px" }}>
        <h3>Client workspace</h3>
        <p>
          Open a client, check shortlisted profiles against their stated preferences before sending, and log the client&apos;s reply when a
          shared profile is rejected. The system learns from each rejection, and the client record updates as you go.
        </p>
        <div className="row-gap">
          <Link className="btn primary" href="/workspace">Start walkthrough</Link>
          <ResetButton />
        </div>
      </div>

      <div className="card">
        <h3>About this prototype</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Four example clients are available. All profiles and results are synthetic and generated to match the figures in the case. The matching
          rules are deterministic; AI is used only to read free-text replies, and a person confirms every result before it is saved.
        </p>
      </div>
    </>
  );
}
