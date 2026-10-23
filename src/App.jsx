
import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [message, setMessage] = useState("Ready to begin your exam");
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Exam countdown timer
  useEffect(() => {
    if (!examStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          setExamStarted(false);
          setMessage("Exam timer completed");
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted]);

  // Stop camera and screen streams when the component unmounts
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Connect the camera stream to the video preview
  useEffect(() => {
    if (videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOn]);

  // Format seconds as HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  };

  // Turn the camera on or off
  async function toggleCamera() {
    setError("");

    if (cameraOn) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setCameraOn(false);
      setMessage("Camera turned off");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraOn(true);
      setMessage("Camera connected successfully");
    } catch (error) {
      console.error("Camera error:", error);
      setError(error.message || "Camera access failed. Check your camera permissions.");
    }
  }

  // Start or stop screen sharing
  async function toggleScreen() {
    setError("");

    if (screenOn) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenOn(false);
      setMessage("Screen sharing stopped");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        videoTrack.addEventListener(
          "ended",
          () => {
            screenStreamRef.current = null;
            setScreenOn(false);
            setMessage("Screen sharing stopped");
          },
          { once: true }
        );
      }

      setScreenOn(true);
      setMessage("Screen sharing started");
    } catch (error) {
      console.error("Screen sharing error:", error);
      setError(error.message || "Screen sharing failed.");
    }
  }

  // Display the exam rules
  async function showRules() {
    setError("");

    try {
      if (window.proctor?.showRules) {
        await window.proctor.showRules();
      } else {
        window.alert(
          "Exam Rules\n\n" +
            "1. Keep your camera enabled when required.\n" +
            "2. Share the screen required for your exam.\n" +
            "3. Follow your exam administrator's instructions.\n" +
            "4. Ask for help if a technical problem occurs."
        );
      }
    } catch (error) {
      console.error("Exam rules error:", error);
      setError(error.message || "Could not display exam rules.");
    }
  }

  // Open the native folder-selection dialog
  async function selectFolder() {
    setError("");

    try {
      if (!window.proctor?.selectFolder) {
        throw new Error("Electron folder-selection API is unavailable.");
      }

      const result = await window.proctor.selectFolder();

      if (!result || result.canceled) {
        setMessage("Folder selection cancelled");
        return;
      }

      if (result.filePaths?.length > 0) {
        setMessage("Folder selected: " + result.filePaths[0]);
      } else {
        setMessage("No folder was selected");
      }
    } catch (error) {
      console.error("Folder selection error:", error);
      setError(error.message || "Folder selection failed.");
    }
  }

  // Start the exam only after both device checks pass
  
  // Start the exam in fullscreen mode
  
async function startExam() {
  if (!cameraOn || !screenOn) {
    setError("Please enable your camera and screen sharing first.");
    return;
  }

  try {
    console.log("Proctor API:", window.proctor);

    if (!window.proctor?.enterFullscreen) {
      throw new Error("enterFullscreen API is missing");
    }

    await window.proctor.enterFullscreen();
    console.log("Fullscreen request sent");

    setError("");
    setTimeLeft(60 * 60);
    setExamStarted(true);
    setMessage("Exam in progress");
  } catch (error) {
    console.error("Fullscreen error:", error);
    setError("Could not enter fullscreen mode. Check the console.");
  }
}

  // End the exam and stop device streams
  async function endExam() {
    setExamStarted(false);
    setMessage("Exam ended");

    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    cameraStreamRef.current = null;
    screenStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
    setScreenOn(false);
    setError("");

    try {
      await window.proctor?.exitFullscreen?.();
    } catch (error) {
      console.error("Exit fullscreen error:", error);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">P</div>
          <div>
            <h2>ProctorLite</h2>
            <span>EXAM MONITORING</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <button className="nav-item active">
          <span>▦</span> Dashboard
        </button>

        <button className="nav-item" onClick={showRules}>
          <span>▤</span> Exam rules
        </button>

        <div className="sidebar-bottom">
          <div className="security-icon">✓</div>
          <strong>Privacy first</strong>
          <p>Your devices are accessed only after you grant permission.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR EXAM WORKSPACE</p>
            <h1>Exam dashboard</h1>
          </div>

          <div className="desktop-badge">
            <span className="status-dot" />
            Desktop application
          </div>
        </header>

        <section className="welcome-section">
          <div>
            <p className="eyebrow">WELCOME TO PROCTORLITE</p>
            <h2>Focus on your exam.</h2>
            <p className="welcome-description">
              Prepare your devices, review the rules, and start when you're ready.
            </p>
          </div>

          <div className="welcome-symbol">P</div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">EXAM STATUS</span>
            <strong>{examStarted ? "In progress" : "Not started"}</strong>
            <span className="stat-foot">
              <span className="status-dot" />
              {examStarted ? "Session active" : "Waiting to begin"}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-label">TIME REMAINING</span>
            <strong className="timer-value">{formatTime(timeLeft)}</strong>
            <span className="stat-foot">60-minute demo session</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">DEVICE CHECKS</span>
            <strong>{Number(cameraOn) + Number(screenOn)}/2</strong>
            <span className="stat-foot">Camera and screen sharing</span>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel device-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PRE-EXAM CHECKLIST</p>
                <h3>Device verification</h3>
              </div>

              <span className="check-count">
                {Number(cameraOn) + Number(screenOn)} of 2
              </span>
            </div>

            <div className="device-row">
              <div className="device-icon">◉</div>

              <div className="device-info">
                <strong>Camera</strong>
                <p>
                  {cameraOn
                    ? "Camera is connected"
                    : "Check your camera before starting"}
                </p>
              </div>

              <span className={`pill ${cameraOn ? "success" : ""}`}>
                {cameraOn ? "Connected" : "Not checked"}
              </span>

              <button className="secondary-button" onClick={toggleCamera}>
                {cameraOn ? "Turn off" : "Test camera"}
              </button>
            </div>

            {cameraOn && (
              <div className="camera-preview">
                <video ref={videoRef} autoPlay muted playsInline />
                <span>Live camera preview · Local preview only</span>
              </div>
            )}

            <div className="device-row">
              <div className="device-icon">▣</div>

              <div className="device-info">
                <strong>Screen sharing</strong>
                <p>
                  {screenOn
                    ? "Screen sharing is active"
                    : "Choose the screen or window to share"}
                </p>
              </div>

              <span className={`pill ${screenOn ? "success" : ""}`}>
                {screenOn ? "Sharing" : "Not checked"}
              </span>

              <button className="secondary-button" onClick={toggleScreen}>
                {screenOn ? "Stop sharing" : "Share screen"}
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="status-message">
              <span className="status-dot" />
              {message}
            </div>

            <div className="exam-actions">
              {!examStarted ? (
                <button
                  className="primary-button"
                  onClick={startExam}
                  disabled={timeLeft === 0}
                >
                  Start exam <span>→</span>
                </button>
              ) : (
                <button
                  className="primary-button end-button"
                  onClick={endExam}
                >
                  End exam
                </button>
              )}

              <button className="text-button" onClick={showRules}>
                Review exam rules
              </button>
            </div>
          </div>

          <div className="right-column">
            <div className="panel rules-panel">
              <p className="eyebrow">BEFORE YOU BEGIN</p>
              <h3>Exam guidelines</h3>

              <div className="rule-item">
                <span>01</span>
                <p>Keep your camera enabled when required by the exam.</p>
              </div>

              <div className="rule-item">
                <span>02</span>
                <p>Share the correct screen and avoid switching unnecessarily.</p>
              </div>

              <div className="rule-item">
                <span>03</span>
                <p>Follow your exam administrator's instructions.</p>
              </div>

              <button className="full-width-button" onClick={showRules}>
                Read all rules →
              </button>
            </div>

            <div className="panel help-panel">
              <div className="help-symbol">?</div>

              <div>
                <h3>Need technical help?</h3>
                <p>
                  If a device check fails, review your system permissions and
                  try again.
                </p>

                <button className="text-button" onClick={selectFolder}>
                  Test folder dialog →
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="app-footer">
          <span>ProctorLite · Development build</span>
          <span>Device permissions are controlled by you.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
