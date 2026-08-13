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
  // Pollinations.ai – kein API-Key, keine Registrierung. Einfacher GET-
  // Request an https://text.pollinations.ai/<encodierter Prompt>, die
  // Antwort kommt als reiner Text zurück (kein JSON).
  //
  // Zu beachten: Der anonyme Zugang ist auf 1 Anfrage pro 15 Sekunden
  // begrenzt. Für diesen Ablauf (Frage -> Nutzer tippt -> Antwort) reicht
  // das normalerweise, aber wer sehr schnell antwortet, kann in seltenen
  // Fällen ein 429 auslösen – dafür greift automatisch der Fallback unten.
  // Pollinations filtert Inhalte nicht so streng wie ein "echter" Chat-
  // Anbieter; die Prompts unten schließen Politik/Kontroverses zwar aus,
  // eine Garantie für jede Antwort gibt es aber nicht – gelegentlich
  // stichprobenartig prüfen, was ausgegeben wird.
  // ---------------------------------------------------------------------
  const POLLINATIONS_BASE_URL = "https://text.pollinations.ai/";
  const REQUEST_TIMEOUT_MS = 15000;

  const FALLBACK_QUESTIONS = [
    "Wie schmeckt WD-40 auf einer Skala von 1 bis Maschinenöl?",
    "Wie viele Kilobyte passen in eine Kaffeetasse?",
    "Wenn ein Toaster traurig ist, welche Farbe hat sein Toast?",
    "Nenne eine Zahl, die nach Montag riecht.",
    "Wie oft muss man einen Algorithmus gießen, damit er wächst?",
    "Beschreibe das Geräusch, das eine Kartoffel beim Nachdenken macht.",
    "Wie viele Ecken hat ein rundes Gefühl?",
    "Was sagt eine Steckdose, wenn sie Geburtstag hat?"
  ];

  const FALLBACK_EVAL_TEXT =
    "Unser Prüf-Server hatte selbst gerade einen Roboter-Moment (Pollinations nicht erreichbar oder Limit erreicht) – wir werten das vorsichtshalber zu deinen Ungunsten. 🤖";

  let currentQuestion = "";
  let requestInFlight = false;

  function pickFallbackQuestion() {
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
  }

  // Manche Modelle umschließen kurze Antworten mit Anführungszeichen oder hängen
  // Zeilenumbrüche an – das entfernen wir rein kosmetisch.
  function cleanText(text) {
    return String(text || "")
      .trim()
      .replace(/^["„“]+|["“”]+$/g, "")
      .trim();
  }

  function guessVerdictClass(text) {
    const lower = text.toLowerCase();
    const mentionsHuman = lower.includes("mensch");
    const mentionsRobot = lower.includes("roboter");
    return mentionsHuman && !mentionsRobot ? "human" : "robot";
  }

  async function callPollinations(prompt) {
    const url = POLLINATIONS_BASE_URL + encodeURIComponent(prompt);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        // z.B. 429 = Rate-Limit (anonym: 1 Anfrage / 15s), 5xx = Serverfehler
        throw new Error("pollinations-http-" + response.status);
      }
      const text = await response.text();
      const cleaned = cleanText(text);
      if (!cleaned) throw new Error("pollinations-empty-response");
      return cleaned;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function generateQuestion() {
    try {
      const text = await callPollinations(
        "Stelle eine ganz kurze, lustige und verrückte Fangfrage (max. 1 Satz), um zu testen, ob der " +
          "Nutzer ein Roboter ist. Antworte ausschließlich auf Deutsch, ohne Anführungszeichen, ohne " +
          "zusätzlichen Text und ohne jegliche politischen oder anderweitig kontroversen Themen."
      );
      return { question: text, isFallback: false };
    } catch (err) {
      console.warn("Bot-Audit: Frage konnte nicht generiert werden, nutze Fallback.", err);
      return { question: pickFallbackQuestion(), isFallback: true };
    }
  }

  async function evaluateAnswer(question, answer) {
    try {
      const prompt =
        "Frage: " + question + ". Nutzer antwortet: " + answer + ". Bewerte in 2 humorvollen Sätzen, " +
        "ob das ein Roboter oder Mensch war. Antworte ausschließlich auf Deutsch, ohne Anführungszeichen " +
        "und ohne politische oder anderweitig kontroverse Themen.";
      const text = await callPollinations(prompt);
      return { text, isFallback: false };
    } catch (err) {
      console.warn("Bot-Audit: Antwort konnte nicht bewertet werden, nutze Fallback.", err);
      return { text: FALLBACK_EVAL_TEXT, isFallback: true };
    }
  }

  function renderResult(text) {
    const verdictClass = guessVerdictClass(text);
    resultEl.innerHTML = "";
    resultEl.className = "audit__result audit__result--" + verdictClass;

    const headline = document.createElement("p");
    headline.className = "audit__result-headline";
    headline.textContent = verdictClass === "robot" ? "🤖 Das Urteil der KI:" : "🧑 Das Urteil der KI:";

    const commentEl = document.createElement("p");
    commentEl.className = "audit__result-comment";
    commentEl.textContent = text;

    resultEl.append(headline, commentEl);
    resultEl.hidden = false;
  }

  async function startAudit() {
    questionEl.textContent = "KI generiert Fangfrage...";
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
    answerEl.disabled = true;
    submitBtn.disabled = true;
    form.hidden = true;
    questionEl.textContent = "Schaltkreise werden analysiert...";
    loaderEl.hidden = false;
    resultEl.hidden = true;

    const { text } = await evaluateAnswer(currentQuestion, answer);

    loaderEl.hidden = true;
    questionEl.textContent = currentQuestion;
    renderResult(text);
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
