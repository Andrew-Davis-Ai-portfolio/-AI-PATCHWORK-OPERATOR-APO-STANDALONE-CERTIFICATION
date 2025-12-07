// APO Patchwork Dojo — Level 1: Structured Prompting
// Client-side only · LocalStorage log · TTS support

(function () {
  const TTS = {
    synth: "speechSynthesis" in window ? window.speechSynthesis : null,
    supported:
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
    enabled: true,
    current: null,
  };

  const STORAGE_KEY = "apo_level1_attempts_v1";

  const TASKS = {
    "pricing-card": {
      title: "Simple Pricing Card (HTML/CSS)",
      brief:
        "Build a single pricing card component for a fictional product, using only HTML and CSS.",
      criteria: [
        "Includes a product name, price, short description, and a call-to-action button.",
        "Uses a dark background with a clear contrasting card.",
        "Button has a visible hover effect (color or shadow change).",
        "Layout looks good on mobile and desktop without horizontal scrolling.",
        "No external frameworks or libraries.",
      ],
    },
    "login-form": {
      title: "Login Form UI (HTML/CSS)",
      brief:
        "Create a centered login form interface using only HTML and CSS. Front-end only, no real authentication.",
      criteria: [
        "Includes email/username field, password field, and a sign-in button.",
        "Fields are grouped in a clean card with subtle shadow.",
        "Includes basic error-state styling (for example: red border on invalid input).",
        "Form is responsive and remains usable on small screens.",
        "No external frameworks or libraries.",
      ],
    },
    "faq-accordion": {
      title: "FAQ Accordion (HTML/CSS/JS)",
      brief:
        "Build a FAQ accordion section where clicking a question toggles its answer.",
      criteria: [
        "At least three FAQ items (question + answer).",
        "Only one answer is open at a time, or answers can toggle independently.",
        "Smooth open/close animation preferred, but not required.",
        "Uses separate files: index.html, style.css, and app.js.",
        "No external frameworks or libraries.",
      ],
    },
  };

  // DOM elements
  const sessionStateEl = document.getElementById("session-state");
  const btnTtsToggle = document.getElementById("btn-tts-toggle");

  const taskSelect = document.getElementById("task-select");
  const btnLoadTask = document.getElementById("btn-load-task");
  const btnPlayBrief = document.getElementById("btn-play-brief");
  const taskBriefEl = document.getElementById("task-brief");
  const taskCriteriaEl = document.getElementById("task-criteria");

  const promptInput = document.getElementById("prompt-input");
  const chkTech = document.getElementById("chk-tech");
  const chkFiles = document.getElementById("chk-files");
  const chkBehavior = document.getElementById("chk-behavior");
  const chkConstraints = document.getElementById("chk-constraints");
  const btnLockPrompt = document.getElementById("btn-lock-prompt");
  const promptStatusEl = document.getElementById("prompt-status");

  const resultNotesEl = document.getElementById("result-notes");
  const chkRuns = document.getElementById("chk-runs");
  const chkMatches = document.getElementById("chk-matches");
  const chkFilesClean = document.getElementById("chk-files-clean");
  const iterationSelect = document.getElementById("iteration-count");
  const reflectionEl = document.getElementById("reflection");
  const btnSubmitAttempt = document.getElementById("btn-submit-attempt");
  const attemptStatusEl = document.getElementById("attempt-status");
  const attemptListEl = document.getElementById("attempt-list");
  const btnCopyLog = document.getElementById("btn-copy-log");

  const state = {
    currentTaskId: null,
    promptLocked: false,
    attempts: [],
  };

  // --- TTS helpers ----------------------------------------------------------

  function speak(text) {
    if (!TTS.supported || !TTS.enabled || !text) return;
    try {
      if (TTS.current) {
        TTS.current.onend = null;
      }
      TTS.synth.cancel();
    } catch (_) {
      // ignore
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.volume = 1.0;
    TTS.current = u;
    try {
      TTS.synth.speak(u);
    } catch (_) {
      // ignore speech errors
    }
  }

  // --- Storage helpers ------------------------------------------------------

  function loadAttempts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.warn("APO: failed to parse attempts", err);
      return [];
    }
  }

  function saveAttempts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.attempts));
    } catch (err) {
      console.warn("APO: failed to save attempts", err);
    }
  }

  function renderAttempts() {
    const arr = state.attempts.slice().reverse();
    if (!arr.length) {
      attemptListEl.innerHTML =
        '<li class="apo-muted small">No attempts yet.</li>';
      return;
    }
    const items = arr
      .map((a) => {
        const time = new Date(a.timestamp).toLocaleString();
        const checks = [];
        if (a.checkRuns) checks.push("Runs");
        if (a.checkMatches) checks.push("Matches brief");
        if (a.checkFilesClean) checks.push("Files clean");
        const checksLabel = checks.length ? checks.join(" · ") : "No self-checks";
        return `
          <li>
            <strong>${TASKS[a.taskId]?.title || a.taskId}</strong>
            <div class="small apo-muted">${time}</div>
            <div class="small apo-muted">Iterations: ${a.iterations || "?"}</div>
            <div class="small">${checksLabel}</div>
            <div class="small apo-muted">${a.reflection || ""}</div>
          </li>
        `;
      })
      .join("");
    attemptListEl.innerHTML = items;
  }

  // --- UI helpers -----------------------------------------------------------

  function setSessionState(text) {
    sessionStateEl.textContent = text;
  }

  function setPromptStatus(text, tone) {
    promptStatusEl.textContent = text;
    promptStatusEl.classList.remove("good", "bad");
    if (tone === "good") promptStatusEl.classList.add("good");
    if (tone === "bad") promptStatusEl.classList.add("bad");
  }

  function setAttemptStatus(text, tone) {
    attemptStatusEl.textContent = text;
    attemptStatusEl.classList.remove("good", "bad");
    if (tone === "good") attemptStatusEl.classList.add("good");
    if (tone === "bad") attemptStatusEl.classList.add("bad");
  }

  function requireTaskSelected() {
    const id = taskSelect.value;
    if (!id || !TASKS[id]) {
      setAttemptStatus("Choose a scenario first. The work has to be anchored in something real.", "bad");
      return false;
    }
    return true;
  }

  // --- Event handlers -------------------------------------------------------

  btnTtsToggle.addEventListener("click", function () {
    if (!TTS.supported) {
      btnTtsToggle.textContent = "🔇 TTS not available";
      btnTtsToggle.disabled = true;
      return;
    }
    TTS.enabled = !TTS.enabled;
    btnTtsToggle.textContent = TTS.enabled ? "🔊 TTS: ON" : "🔇 TTS: OFF";
    btnTtsToggle.classList.toggle("ghost");
    if (!TTS.enabled && TTS.synth) {
      try {
        TTS.synth.cancel();
      } catch (_) {}
    }
  });

  btnLoadTask.addEventListener("click", function () {
    const id = taskSelect.value;
    if (!id || !TASKS[id]) {
      taskBriefEl.textContent =
        "Select a valid scenario. You cannot practice patchwork on a blank canvas.";
      taskCriteriaEl.innerHTML = "";
      btnPlayBrief.disabled = true;
      state.currentTaskId = null;
      return;
    }

    const task = TASKS[id];
    state.currentTaskId = id;

    taskBriefEl.textContent = task.brief;
    taskCriteriaEl.innerHTML = task.criteria
      .map((c) => `<li>${c}</li>`)
      .join("");

    btnPlayBrief.disabled = !TTS.supported;
    setSessionState("STATE: Task loaded · " + task.title);

    speak(
      "Level one scenario loaded. " +
        task.title +
        ". Here is your brief. " +
        task.brief
    );
  });

  btnPlayBrief.addEventListener("click", function () {
    if (!state.currentTaskId) return;
    const task = TASKS[state.currentTaskId];
    speak(task.brief + " Criteria: " + task.criteria.join("; "));
  });

  btnLockPrompt.addEventListener("click", function () {
    if (!state.currentTaskId || !TASKS[state.currentTaskId]) {
      setPromptStatus(
        "Select a scenario and load the brief before locking your prompt.",
        "bad"
      );
      speak(
        "You’re trying to lock a prompt without a scenario. Pick something real first."
      );
      return;
    }

    const text = (promptInput.value || "").trim();
    if (!text) {
      setPromptStatus("Write your prompt before locking it.", "bad");
      speak("Empty prompts don’t move systems. Write something first.");
      return;
    }

    const checks = [chkTech, chkFiles, chkBehavior, chkConstraints];
    const unchecked = checks.filter((c) => !c.checked);
    if (unchecked.length) {
      setPromptStatus(
        "You still have unchecked items. Confirm your prompt covers tech, files, behavior, and constraints.",
        "bad"
      );
      speak(
        "Slow down. Confirm you have tech stack, file separation, behavior, and constraints covered before you lock."
      );
      return;
    }

    // Lock prompt for this attempt
    promptInput.readOnly = true;
    btnLockPrompt.disabled = true;
    state.promptLocked = true;

    // Copy to clipboard (best effort)
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setPromptStatus(
          "Prompt locked and copied to clipboard. Use it with GPT, then come back to log your result.",
          "good"
        );
        speak(
          "Prompt locked. Take this to GPT, build the feature, then come back and record what actually happened."
        );
      })
      .catch(() => {
        setPromptStatus(
          "Prompt locked. Clipboard copy may have failed — copy manually if needed.",
          "good"
        );
        speak(
          "Prompt locked. If clipboard copy failed, select all and copy manually before you leave."
        );
      });

    setSessionState("STATE: Prompt locked · Implementation in progress");
  });

  btnSubmitAttempt.addEventListener("click", function () {
    if (!requireTaskSelected()) return;
    if (!state.promptLocked) {
      setAttemptStatus(
        "Lock your prompt first. The exercise is about the whole chain, not just the result.",
        "bad"
      );
      speak(
        "You’re trying to log an attempt without locking the prompt. Lock it first, then come back when you’ve tested your code."
      );
      return;
    }

    const notes = (resultNotesEl.value || "").trim();
    const reflection = (reflectionEl.value || "").trim();
    const iterations = iterationSelect.value || "";

    const attempt = {
      taskId: state.currentTaskId,
      notes: notes,
      checkRuns: !!chkRuns.checked,
      checkMatches: !!chkMatches.checked,
      checkFilesClean: !!chkFilesClean.checked,
      iterations: iterations,
      reflection: reflection,
      timestamp: Date.now(),
    };

    state.attempts.push(attempt);
    saveAttempts();
    renderAttempts();

    setAttemptStatus(
      "Attempt logged locally. This does not auto-certify you — it records how you actually worked.",
      "good"
    );
    speak(
      "Attempt recorded. This log is for you and your instructor, not for decoration."
    );

    // Soft reset (but keep prompt + locks for review)
    resultNotesEl.value = "";
    chkRuns.checked = false;
    chkMatches.checked = false;
    chkFilesClean.checked = false;
    iterationSelect.value = "";
    reflectionEl.value = "";
  });

  btnCopyLog.addEventListener("click", function () {
    if (!state.attempts.length) {
      setAttemptStatus(
        "No attempts to copy yet. Complete at least one full cycle.",
        "bad"
      );
      return;
    }

    const lines = state.attempts.map((a, idx) => {
      const time = new Date(a.timestamp).toISOString();
      const taskTitle = TASKS[a.taskId]?.title || a.taskId;
      return [
        `#${idx + 1} — ${taskTitle} (${time})`,
        `Runs: ${a.checkRuns} | Matches brief: ${a.checkMatches} | Files clean: ${a.checkFilesClean}`,
        `Iterations: ${a.iterations || "?"}`,
        `Reflection: ${a.reflection || "(none)"}`,
        `Notes: ${a.notes || "(none)"}`,
        "",
      ].join("\n");
    });

    const text = lines.join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setAttemptStatus(
          "Attempt log copied. Paste into email, a doc, or your portfolio as proof of process.",
          "good"
        );
        speak(
          "Log copied. This is your process transcript — not just your outcome."
        );
      })
      .catch(() => {
        setAttemptStatus(
          "Clipboard blocked. Select the log items manually if you want to save them.",
          "bad"
        );
      });
  });

  // --- Init -----------------------------------------------------------------

  state.attempts = loadAttempts();
  renderAttempts();

  if (!TTS.supported) {
    btnTtsToggle.textContent = "🔇 TTS not available";
    btnTtsToggle.disabled = true;
  }

  setPromptStatus("Prompt not locked yet.", null);
  setAttemptStatus("No attempts logged yet.", null);
})();
