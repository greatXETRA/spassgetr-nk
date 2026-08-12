document.addEventListener("DOMContentLoaded", () => {
  const auditSection = document.getElementById("audit");
  const questionEl = document.getElementById("auditQuestion");
  const form = document.getElementById("auditForm");
  const answerEl = document.getElementById("auditAnswer");
  const submitBtn = document.getElementById("auditSubmit");
  const loaderEl = document.getElementById("auditLoader");
  const resultEl = document.getElementById("auditResult");

  if (!auditSection || !form) return; // Audit-Bereich nicht auf dieser Seite vorhanden

  // ---------------------------------------------------------------------
  // Gemini-Konfiguration
  //
  // ACHTUNG: Dieser Schlüssel liegt im Klartext im Browser-Quelltext und ist
  // für jede Person über die Entwicklertools (Netzwerk-Tab / Seitenquelltext)
  // einsehbar. Für eine Spaß-Unterseite ohne sensible Daten ist das
  // vertretbar, WENN du den Key in Google AI Studio unter
  // "API-Schlüssel einschränken" auf HTTP-Referrer = deine Domain
  // beschränkst und ein niedriges Tageskontingent setzt. Ohne diese
  // Einschränkung kann jede Person, die den Quelltext öffnet, deinen Key
  // benutzen und dein Kontingent bzw. Budget verbrauchen. Für alles
  // Ernsthaftere (echte Nutzerdaten, höheres Budget) gehört dieser Call
  // hinter einen kleinen Serverless-Proxy (z. B. Cloudflare Worker), der
  // den Key serverseitig hält.
  // ---------------------------------------------------------------------
  const API_KEY = "AQ.Ab8RN6KJyAgcV62PtOSerzlbY-uEbjWaJ4Tfm7mWTMg9JQPR7A";
  const GEMINI_MODEL = "gemini-3.6-flash"; // Stand Aug. 2026 – Google rotiert Modellnamen, ggf. auf ai.google.dev/gemini-api/docs/models prüfen
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const REQUEST_TIMEOUT_MS = 15000;

  const FALLBACK_QUESTIONS = [
    "Wie viele Kilobyte passen in eine Kaffeetasse?",
    "Wenn ein Toaster traurig ist, welche Farbe hat sein Toast?",
    "Nenne eine Zahl, die nach Montag riecht.",
    "Wie oft muss man einen Algorithmus gießen, damit er wächst?",
    "Beschreibe das Geräusch, das eine Kartoffel beim Nachdenken macht.",
    "Wie viele Ecken hat ein rundes Gefühl?",
    "Was sagt eine Steckdose, wenn sie Geburtstag hat?",
    "Wie schwer ist ein Gedanke, den man schon vergessen hat?"
  ];

  const FALLBACK_EVAL_COMMENT =
    "Unser Prüf-Server hatte selbst gerade einen Roboter-Moment (kein API-Key hinterlegt oder Limit erreicht) – wir werten das vorsichtshalber zu deinen Ungunsten. 🤖";

  const QUESTION_SYSTEM =
    "Du bist eine augenzwinkernde Sicherheitsprüfung auf einer deutschen Spaßgetränk-Website. " +
    "Du erfindest kurze, witzige Testfragen im Stil von Dad-Jokes bzw. Scherzfragen, mit denen scheinbar " +
    "geprüft wird, ob jemand ein Mensch oder ein Roboter ist. Antworte IMMER auf Deutsch. Vermeide strikt " +
    "Politik, Religion, Diskriminierendes, Vulgäres oder andere kontroverse Themen – halte alles freundlich, " +
    "harmlos und kurz (max. 20 Wörter). Antworte ausschließlich im vorgegebenen JSON-Format, ohne Markdown " +
    "oder zusätzlichen Text.";

  const QUESTION_SCHEMA = {
    type: "object",
    properties: { question: { type: "string" } },
    required: ["question"]
  };

  const EVAL_SYSTEM =
    "Du bist eine schelmische Prüf-KI auf einer deutschen Spaßgetränk-Website, die scherzhaft bewertet, ob " +
    "eine Antwort eher zu einem Roboter oder zu einem Menschen passt. Sei unterhaltsam, freundlich und nie " +
    "ernsthaft beleidigend. Antworte IMMER auf Deutsch, vermeide Politik, Religion oder andere kontroverse " +
    "Themen. Antworte ausschließlich im vorgegebenen JSON-Format, ohne Markdown oder zusätzlichen Text.";

  const EVAL_SCHEMA = {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["robot", "human"] },
      comment: { type: "string" }
    },
    required: ["verdict", "comment"]
  };

  let currentQuestion = "";
  let requestInFlight = false;

  function pickFallbackQuestion() {
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
  }

  function hasUsableKey() {
    return typeof API_KEY === "string" && API_KEY.trim() !== "" && API_KEY !== "AQ.Ab8RN6KJyAgcV62PtOSerzlbY-uEbjWaJ4Tfm7mWTMg9JQPR7A";
  }

  async function callGemini(systemText, userText, schema) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
          }
        })
      });

      if (!response.ok) {
        // z.B. 400 (ungültiger Key), 403 (Referrer-Sperre), 429 (Limit erreicht)
        throw new Error("gemini-http-" + response.status);
      }

      const data = await response.json();
      const raw =
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;

      if (!raw) throw new Error("gemini-empty-response");
      return JSON.parse(raw);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function generateQuestion() {
    if (!hasUsableKey()) {
      return { question: pickFallbackQuestion(), isFallback: true };
    }
    try {
      const result = await callGemini(
        QUESTION_SYSTEM,
        "Erfinde eine neue, kurze, witzige Testfrage (max. 20 Wörter), mit der du scherzhaft prüfst, ob der " +
          "Antwortende ein Mensch oder ein Roboter ist. Sei kreativ, jedes Mal anders.",
        QUESTION_SCHEMA
      );
      if (result && typeof result.question === "string" && result.question.trim()) {
        return { question: result.question.trim(), isFallback: false };
      }
      throw new Error("gemini-invalid-question-shape");
    } catch (err) {
      console.warn("Bot-Audit: Frage konnte nicht generiert werden, nutze Fallback.", err);
      return { question: pickFallbackQuestion(), isFallback: true };
    }
  }

  async function evaluateAnswer(question, answer) {
    if (!hasUsableKey()) {
      return { verdict: "robot", comment: FALLBACK_EVAL_COMMENT, isFallback: true };
    }
    try {
      const prompt =
        'Testfrage: "' + question + '"\n' +
        'Antwort des Nutzers: "' + answer + '"\n\n' +
        "Bewerte scherzhaft, ob diese Antwort eher zu einem Roboter oder zu einem Menschen passt, und gib " +
        "ein kurzes, witziges Urteil (max. 25 Wörter).";
      const result = await callGemini(EVAL_SYSTEM, prompt, EVAL_SCHEMA);
      if (result && (result.verdict === "robot" || result.verdict === "human")) {
        return { verdict: result.verdict, comment: String(result.comment || "").trim(), isFallback: false };
      }
      throw new Error("gemini-invalid-eval-shape");
    } catch (err) {
      console.warn("Bot-Audit: Antwort konnte nicht bewertet werden, nutze Fallback.", err);
      return { verdict: "robot", comment: FALLBACK_EVAL_COMMENT, isFallback: true };
    }
  }

  function renderResult(verdict, comment) {
    resultEl.innerHTML = "";
    resultEl.className = "audit__result audit__result--" + verdict;

    const headline = document.createElement("p");
    headline.className = "audit__result-headline";
    headline.textContent =
      verdict === "robot"
        ? "🤖 Bestätigt: Definitiv ein Roboter."
        : "🧑 Verdacht: Da steckt wohl doch ein Mensch dahinter!";

    const commentEl = document.createElement("p");
    commentEl.className = "audit__result-comment";
    commentEl.textContent = comment;

    resultEl.append(headline, commentEl);
    resultEl.hidden = false;
  }

  async function startAudit() {
    questionEl.textContent = "Frage wird generiert …";
    answerEl.disabled = true;
    submitBtn.disabled = true;
    resultEl.hidden = true;
    resultEl.textContent = "";

    const { question } = await generateQuestion();
    currentQuestion = question;
    questionEl.textContent = question;
    answerEl.disabled = false;
    submitBtn.disabled = false;
    answerEl.value = "";
    answerEl.focus();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (requestInFlight) return;

    const answer = answerEl.value.trim();
    if (!answer) {
      answerEl.focus();
      return;
    }

    requestInFlight = true;
    form.hidden = true;
    loaderEl.hidden = false;
    resultEl.hidden = true;

    const { verdict, comment } = await evaluateAnswer(currentQuestion, answer);

    loaderEl.hidden = true;
    renderResult(verdict, comment);
    requestInFlight = false;
  });

  document.addEventListener(
    "robot-detected",
    () => {
      auditSection.hidden = false;
      startAudit();
    },
    { once: true }
  );
});
