import { createAsciiField } from "./ascii-background.js?v=hero-contrast";
import { fileExtension, SETTINGS_LIMITS } from "./submission-rules.js";

const $ = (selector) => document.querySelector(selector);
const form = $("#submission-form");
const picker = $("#session-picker");
const success = $("#submission-success");
const encoder = new TextEncoder();
const UNSAFE_FILE_NAME = /[\u0000-\u001f\u007f/\\:*?"<>|]/;
const SESSION_ICONS = { morning: "☀", afternoon: "☾" };
// Sessions, challenges, accepted file types, and size limits come from the admin dashboard.
let settings;
let clockOffset = 0; // server time minus this device's time, so countdowns follow the server
let currentSession = null; // the session whose form is built
const files = new Map(); // chosen files by challenge ID: { name, size, content }
let submissionId = crypto.randomUUID();
let submitting = false;

const background = $('[data-ascii="background"]');
try {
  createAsciiField(background);
} catch (error) {
  background.hidden = true;
  console.warn("ASCII background unavailable:", error);
}

const size = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);
const kb = (value) => value * 1024;
const time = (value) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Algiers", hourCycle: "h23" }).format(new Date(value));
const clock = (value) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers", hourCycle: "h23" }).format(new Date(value));
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const serverNow = () => Date.now() + clockOffset;
const sessionByValue = (value) => settings?.sessions.find((session) => session.value === value);
// The server already decided `open`; the closing time is re-checked every second as time passes.
const isOpen = (session) => Boolean(session?.open && (!session.endsAt || serverNow() < Date.parse(session.endsAt)));
const card = (value) => form.querySelector(`.challenge-card[data-challenge="${value}"]`);

function remaining(endsAt) {
  const seconds = Math.max(0, Math.floor((Date.parse(endsAt) - serverNow()) / 1000));
  const pad = (value) => String(value).padStart(2, "0");
  const days = Math.floor(seconds / 86400);
  const rest = `${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return days ? `${days}d ${rest}` : rest;
}

function setStatus(message, error = false) {
  $("#form-status").textContent = message;
  $("#form-status").classList.toggle("error", error);
}

async function loadSettings({ quiet = false } = {}) {
  try {
    const response = await fetch("/api/submissions", { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    clockOffset = Date.parse(data.now) - Date.now();
    settings = data;
    $("#picker-status").textContent = "";
  } catch {
    if (!quiet) $("#picker-status").textContent = "We couldn’t load the sessions. Refresh the page to try again.";
    return;
  }
  renderPicker();
  route();
}

// ---------- Session picker ----------

function challengeSummary(challenge) {
  return challenge.type === "file" ? "1 file" : challenge.fields === 1 ? "1 text box" : `${challenge.fields} text boxes`;
}

function renderPicker() {
  $("#session-cards").replaceChildren(
    ...settings.sessions.map((session) => {
      const open = isOpen(session);
      const article = element("article", `session-card ${open ? "open" : "closed"}`);
      article.dataset.session = session.value;
      const header = element("header");
      header.append(element("h3", "", session.label), element("span", "session-icon", open ? SESSION_ICONS[session.value] ?? "●" : "🔒"));
      header.lastChild.setAttribute("aria-hidden", "true");
      const list = element("ul");
      list.append(...session.challenges.map((challenge) => {
        const item = element("li", "", challenge.label);
        item.append(element("small", "", challengeSummary(challenge)));
        return item;
      }));
      const timing = element("p", "session-time mono");
      article.append(header, list, timing);
      if (open) {
        const enter = element("button", "session-enter", "Enter session ");
        enter.type = "button";
        enter.append(element("span", "", "→"));
        enter.lastChild.setAttribute("aria-hidden", "true");
        enter.addEventListener("click", () => { location.hash = session.value; });
        article.append(enter);
      } else {
        article.append(element("p", "session-lock mono", "SESSION CLOSED"));
      }
      return article;
    }),
  );
  updateTimers();
}

// ---------- Session form ----------

function cardHeader(challenge, icon, hint) {
  const header = element("header");
  const title = element("div");
  const heading = element("h3", "", challenge.label);
  heading.id = `challenge-${challenge.value}`;
  title.append(heading, element("p", "", hint));
  header.append(element("span", "challenge-icon", icon), title, element("span", "challenge-state mono", "ANSWERED"));
  return header;
}

function textCard(challenge) {
  const article = element("article", "challenge-card text");
  article.dataset.challenge = challenge.value;
  const parts = element("div", "answer-parts");
  for (let index = 0; index < challenge.fields; index++) {
    const label = element("label", "answer-part", challenge.fields === 1 ? "Answer" : `Part ${index + 1}`);
    const input = element("input", "answer-input");
    input.maxLength = SETTINGS_LIMITS.textAnswer;
    input.autocomplete = "off";
    input.placeholder = challenge.fields === 1 ? "Your answer…" : `Part ${index + 1} of your answer…`;
    input.dataset.challenge = challenge.value;
    label.append(input);
    parts.append(label);
  }
  const hint = challenge.fields === 1 ? "Type your answer" : `Enter the ${challenge.fields} parts of your solution`;
  article.append(cardHeader(challenge, "Aa", hint), parts);
  return article;
}

function fileCard(challenge) {
  const article = element("article", "challenge-card file");
  article.dataset.challenge = challenge.value;
  const pick = element("label", "file-pick");
  const input = element("input");
  input.type = "file";
  input.accept = settings.extensions.map((extension) => `.${extension}`).join(",");
  input.dataset.challenge = challenge.value;
  input.setAttribute("aria-labelledby", `challenge-${challenge.value}`);
  input.addEventListener("change", () => {
    const [file] = input.files;
    input.value = "";
    if (file) chooseFile(challenge, file);
  });
  for (const type of ["dragenter", "dragover"]) pick.addEventListener(type, () => pick.classList.add("dragging"));
  for (const type of ["dragleave", "drop"]) pick.addEventListener(type, () => pick.classList.remove("dragging"));
  pick.append(input, element("span", "file-pick-icon", "⇪"), element("strong", "", "Choose file"), element("small", "", "or drop it here"));
  const status = element("p", "file-status");
  status.setAttribute("role", "alert");
  article.append(cardHeader(challenge, "</>", "Upload one code or text file"), pick, element("div", "file-chip"), status);
  return article;
}

function buildForm(session) {
  currentSession = session.value;
  files.clear();
  submissionId = crypto.randomUUID();
  setStatus("");
  $("#session-title").replaceChildren(document.createTextNode(`${session.label.toUpperCase().replace(/ SESSION$/, "")} `), element("em", "", "SESSION."));
  const hasFiles = session.challenges.some((challenge) => challenge.type === "file");
  $("#file-rules").hidden = !hasFiles;
  $("#file-rules").textContent = `File challenges accept one file each, up to ${size(kb(settings.maxFileKB))} (${size(kb(settings.maxTotalKB))} in total per submission): ${settings.extensions.map((extension) => `.${extension}`).join(" ")}`;
  $("#challenge-cards").replaceChildren(...session.challenges.map((challenge) => (challenge.type === "text" ? textCard(challenge) : fileCard(challenge))));
  updateSummary();
}

function show(view) {
  picker.hidden = view !== "picker";
  form.hidden = view !== "form";
  success.hidden = view !== "success";
  $("#panel-label").textContent = view === "picker" ? "SUBMISSIONS" : sessionByValue(currentSession)?.label.toUpperCase() ?? "SUBMISSIONS";
}

function route() {
  if (!settings) return;
  const session = sessionByValue(location.hash.slice(1));
  if (!session) {
    show("picker");
    return;
  }
  if (!isOpen(session) && currentSession !== session.value) {
    // A closed session can't be entered; stay on the picker and say why.
    history.replaceState(null, "", location.pathname);
    show("picker");
    $("#picker-status").textContent = `The ${session.label} is closed right now.`;
    return;
  }
  if (currentSession !== session.value) buildForm(session);
  if (success.hidden || location.hash.slice(1) !== currentSession) show("form");
  updateTimers();
}

// Going back to the session list keeps a session's unsent answers until the team returns to it.
addEventListener("hashchange", () => {
  $("#picker-status").textContent = "";
  route();
  const heading = form.hidden ? $("#picker-title") : $("#session-title");
  heading.focus({ preventScroll: true });
  $(".form-panel").scrollIntoView({ block: "start" });
});
$("#back-to-sessions").addEventListener("click", () => { location.hash = ""; });
$("#success-sessions").addEventListener("click", () => { location.hash = ""; });

// ---------- Countdowns and closing ----------

function updateTimers() {
  if (!settings) return;
  for (const session of settings.sessions) {
    const article = $(`.session-card[data-session="${session.value}"]`);
    if (!article) continue;
    const open = isOpen(session);
    if (open !== article.classList.contains("open")) { renderPicker(); return; }
    article.querySelector(".session-time").textContent = !open ? "" : session.endsAt
      ? `CLOSES AT ${clock(session.endsAt)} · ${remaining(session.endsAt)} LEFT` : "OPEN";
  }
  const session = sessionByValue(currentSession);
  if (!session) return;
  const open = isOpen(session);
  $("#session-countdown").hidden = !open || !session.endsAt;
  if (open && session.endsAt) $("#countdown-value").textContent = remaining(session.endsAt);
  $("#session-closed-banner").hidden = open;
  $("#submit-button").disabled = !open || submitting;
}
setInterval(updateTimers, 1000);
// Pick up sessions the organizers open or close while the page is open.
setInterval(() => loadSettings({ quiet: true }), 30000);

// ---------- Files ----------

// Source files are text; accept UTF-8, UTF-16 with a byte-order mark, and legacy Windows encodings.
function decode(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function chooseFile(challenge, file) {
  const status = card(challenge.value).querySelector(".file-status");
  const fail = (message) => { status.textContent = `${file.name}: ${message}`; };
  const maxFileBytes = kb(settings.maxFileKB);
  if (!settings.extensions.includes(fileExtension(file.name))) return fail("this file type isn’t accepted.");
  if (file.name.length > 120 || UNSAFE_FILE_NAME.test(file.name)) return fail("rename the file without special characters.");
  if (file.size > maxFileBytes * 2) return fail(`larger than ${size(maxFileBytes)}.`);
  let content;
  try {
    content = decode(await file.arrayBuffer());
  } catch {
    return fail("the file couldn’t be read.");
  }
  if (content.includes("\u0000")) return fail("looks like a binary file. Attach source code or a text file.");
  const bytes = encoder.encode(content).length;
  if (!bytes) return fail("the file is empty.");
  if (bytes > maxFileBytes) return fail(`larger than ${size(maxFileBytes)}.`);
  const others = [...files].filter(([value]) => value !== challenge.value).reduce((sum, [, chosen]) => sum + chosen.size, 0);
  if (others + bytes > kb(settings.maxTotalKB)) return fail(`your files would exceed ${size(kb(settings.maxTotalKB))} in total.`);
  status.textContent = "";
  files.set(challenge.value, { name: file.name, size: bytes, content });
  renderFile(challenge.value);
  answersChanged();
}

function renderFile(value) {
  const article = card(value);
  const chosen = files.get(value);
  const chip = article.querySelector(".file-chip");
  article.querySelector(".file-pick strong").textContent = chosen ? "Replace file" : "Choose file";
  if (!chosen) { chip.replaceChildren(); return; }
  const remove = element("button", "", "Remove");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove ${chosen.name}`);
  remove.addEventListener("click", () => {
    files.delete(value);
    renderFile(value);
    answersChanged();
    article.querySelector("input[type=file]").focus();
  });
  chip.replaceChildren(element("span", "file-ext", fileExtension(chosen.name)), element("span", "file-name", chosen.name), element("small", "", size(chosen.size)), remove);
}

// A file dropped outside a file area would otherwise open in the tab and discard the form.
for (const type of ["dragover", "drop"]) {
  window.addEventListener(type, (event) => {
    if (event.target.type !== "file" || event.target.disabled) event.preventDefault();
  });
}

// ---------- Answers ----------

function collectAnswers() {
  const session = sessionByValue(currentSession);
  if (!session) return [];
  return session.challenges.flatMap((challenge) => {
    if (challenge.type === "file") {
      const chosen = files.get(challenge.value);
      return chosen ? [{ challenge: challenge.value, file: { name: chosen.name, content: chosen.content } }] : [];
    }
    const parts = [...card(challenge.value).querySelectorAll(".answer-input")].map((input) => input.value.trim());
    return parts.some(Boolean) ? [{ challenge: challenge.value, parts }] : [];
  });
}

function answersChanged() {
  submissionId = crypto.randomUUID();
  setStatus("");
  updateSummary();
}

function updateSummary() {
  const session = sessionByValue(currentSession);
  if (!session) return;
  const answered = new Set(collectAnswers().map((answer) => answer.challenge));
  for (const article of form.querySelectorAll(".challenge-card")) article.classList.toggle("answered", answered.has(article.dataset.challenge));
  $("#answer-summary").textContent = `${answered.size} OF ${session.challenges.length} ANSWERED`;
}

form.addEventListener("input", (event) => {
  if (event.target.type === "file") return;
  event.target.setCustomValidity?.("");
  answersChanged();
});

function validate() {
  const team = form.elements.teamName;
  team.setCustomValidity(team.value.trim() ? "" : "Enter your team name.");
  if (!team.reportValidity()) return false;
  if (!collectAnswers().length) {
    setStatus("Answer at least one challenge before submitting.", true);
    form.querySelector(".challenge-card")?.scrollIntoView({ block: "center" });
    return false;
  }
  return true;
}

function submitLabel(text) {
  const arrow = element("span", "", "→");
  arrow.setAttribute("aria-hidden", "true");
  $("#submit-button").replaceChildren(`${text} `, arrow);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = sessionByValue(currentSession);
  if (submitting || !session || !validate()) return;
  if (!isOpen(session)) { setStatus(`The ${session.label} is closed. Answers can no longer be sent.`, true); return; }
  submitting = true;
  const button = $("#submit-button");
  button.disabled = true;
  button.textContent = "Sending…";
  setStatus("");
  const teamName = form.elements.teamName.value.trim();
  const answers = collectAnswers();
  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, website: form.elements.website.value, teamName, session: session.value, answers }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(
        result.error ||
          (response.status === 413 ? "Your files are too large to send." : "We couldn’t send your answers. Please try again."),
        true,
      );
      if (response.status === 410) loadSettings({ quiet: true });
      return;
    }
    showSuccess(result, teamName, session, answers);
  } catch {
    setStatus("We couldn’t reach the server. Check your connection and try again. Your answers are still here.", true);
  } finally {
    submitting = false;
    submitLabel("Submit solutions");
    updateTimers();
  }
});

function showSuccess(result, teamName, session, answers) {
  const label = (value) => session.challenges.find((challenge) => challenge.value === value)?.label ?? value;
  const describe = (answer) => answer.file ? `File: ${answer.file.name}`
    : answer.parts.length === 1 ? answer.parts[0]
      : answer.parts.map((part, index) => `Part ${index + 1}: ${part || "—"}`).join("\n");
  const rows = [
    ["Reference", result.id],
    ["Team", teamName],
    ["Session", session.label],
    ...(result.createdAt ? [["Received", `${time(result.createdAt)} (Algeria time)`]] : []),
    ...answers.map((answer) => [label(answer.challenge), describe(answer)]),
  ];
  $("#success-details").replaceChildren(
    ...rows.map(([term, description]) => {
      const row = element("div");
      row.append(element("dt", "", term), element("dd", "", description));
      return row;
    }),
  );
  // Clear the sent answers so they are not sent twice; the team name stays.
  buildForm(session);
  show("success");
  success.focus({ preventScroll: true });
  success.scrollIntoView({ block: "start" });
}

$("#submit-again").addEventListener("click", () => {
  show("form");
  updateTimers();
  form.querySelector(".challenge-card")?.scrollIntoView({ block: "center" });
});

loadSettings();
