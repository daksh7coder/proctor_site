


import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60*60);
  const [message, setMessage] = useState("Ready to begin your exam");
  const [error, setError] = useState("");

  const videoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // End the exam and clean up all active devices and fullscreen mode.
  const endExam = useCallback(async (reason = "Exam ended") => {
    setExamStarted(false);
    setMessage(reason);

    // Stop the camera stream.
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    // Stop the screen-sharing stream.
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    // Clear both video elements.
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    // Update the device indicators and clear any previous error.
    setCameraOn(false);
    setScreenOn(false);
    setError("");

    // Leave fullscreen mode.
    try {
      await window.proctor?.exitFullscreen?.();
    } catch (error) {
      console.error("Exit fullscreen error:", error);
    }
  }, []);

  // Exam timer: only update the countdown here.
  useEffect(() => {
    if (!examStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted]);

  // When the timer reaches zero, run the same full cleanup as End Exam.
  useEffect(() => {
    if (examStarted && timeLeft === 0) {
      void endExam("Exam timer completed");
    }
  }, [examStarted, timeLeft, endExam]);

  // Stop device streams when the component unmounts
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Attach camera stream after its preview element is rendered
  useEffect(() => {
    if (videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOn]);

  // Format timer as HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  };

  // Turn camera on or off
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
      console.error("Camera access error:", error);
      setError("Camera access failed. Check your camera permissions.");
    }
  }

  
  async function toggleScreen() {
    setError("");

    if (screenOn) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }

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

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play();
      }

      stream.getVideoTracks()[0]?.addEventListener(
        "ended",
        () => {
          screenStreamRef.current = null;

          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
          }

          setScreenOn(false);
          setMessage("Screen sharing stopped");
        },
        { once: true }
      );

      setScreenOn(true);
      setMessage("Screen sharing started");
    } catch (error) {
      console.error("Screen sharing error:", error);
      setError("Screen sharing was cancelled or permission was denied.");
    }
  }

  // Show exam rules
  async function showRules() {
    setError("");

    try {
      if (window.proctor?.showRules) {
        await window.proctor.showRules();
      } else {
        window.alert(
          "Exam Rules\n\n1. Keep your camera enabled when required.\n" +
            "2. Share the screen required for your exam.\n" +
            "3. Follow your exam administrator's instructions.\n" +
            "4. Ask for help if a technical problem occurs."
        );
      }
    } catch (error) {
      console.error("Exam rules error:", error);
      setError("Could not open the exam rules.");
    }
  }

  // Select the folder where screenshots will be saved
  async function selectFolder() {
    setError("");

    try {
      if (!window.proctor?.selectFolder) {
        throw new Error("Electron folder-selection API is unavailable.");
      }

      const result = await window.proctor.selectFolder();

      if (result.canceled) {
        setMessage("Folder selection cancelled");
        return;
      }

      if (result.filePaths?.length > 0) {
        setMessage("Screenshot folder selected");
      }
    } catch (error) {
      console.error("Folder selection error:", error);
      setError(error.message || "Folder selection failed.");
    }
  }

  // Capture and save a single screenshot
  const captureScreenshot = useCallback(
    async (type) => {
      const video =
        type === "camera"
          ? videoRef.current
          : screenVideoRef.current;

      if (
        !examStarted ||
        !video ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Could not create screenshot canvas.");
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/png");

        if (!window.proctor?.saveScreenshot) {
          throw new Error("Screenshot-saving API is unavailable.");
        }

        const result = await window.proctor.saveScreenshot({
          type,
          dataUrl,
        });

        if (!result?.success) {
          throw new Error("Screenshot was not saved.");
        }

        console.log(`${type} screenshot saved:`, result.filename);
      } catch (error) {
        console.error(`${type} screenshot failed:`, error);
        setError(`Could not save ${type} screenshot.`);
      }
    },
    [examStarted]
  );

  // Automatically capture both streams during the exam
  useEffect(() => {
    if (!examStarted) return;

    const captureBoth = () => {
      void captureScreenshot("camera");
      void captureScreenshot("screen");
    };

    const initialCapture = setTimeout(captureBoth, 1500);
    const interval = setInterval(captureBoth, 30000);

    return () => {
      clearTimeout(initialCapture);
      clearInterval(interval);
    };
  }, [examStarted, captureScreenshot]);

  // Start exam and enter fullscreen
  async function startExam() {
    if (!cameraOn || !screenOn) {
      setError("Please enable your camera and screen sharing first.");
      return;
    }

    try {
      if (!window.proctor?.enterFullscreen) {
        throw new Error("Fullscreen API is unavailable.");
      }

      await window.proctor.enterFullscreen();

      setError("");
      setTimeLeft(60*60);
      setExamStarted(true);
      setMessage("Exam in progress");
    } catch (error) {
      console.error("Fullscreen error:", error);
      setError("Could not enter fullscreen mode.");
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

            {/* Hidden video used to capture frames from the shared screen */}
            <video
              ref={screenVideoRef}
              autoPlay
              muted
              playsInline
              style={{ display: "none" }}
            />

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
                <button className="primary-button end-button" onClick={endExam}>
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
                  Choose screenshot folder →
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
