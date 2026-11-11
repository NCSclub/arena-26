// Starting values for the submission form. Organizers change the live values from the
// Submissions page of the admin dashboard; these apply until the first save.
//
// The event has two sessions. Each session has its own challenges, an open switch, and an
// optional closing time (ISO string). A challenge is { value, label, type, fields }:
// "text" challenges have `fields` numbered answer boxes, "file" challenges take one file.
export const SUBMISSION_SESSIONS = [
  { value: "morning", label: "Morning Session" },
  { value: "afternoon", label: "Afternoon Session" },
];

const text = (value, label, fields) => ({ value, label, type: "text", fields });
const file = (value, label) => ({ value, label, type: "file" });

export const DEFAULT_SUBMISSION_SETTINGS = {
  revision: 0,
  sessions: [
    {
      value: "morning", open: false, endsAt: null,
      challenges: [
        text("morning-hard-puzzle", "Hard Puzzle", 2),
        text("morning-medium-puzzle", "Medium Puzzle", 3),
        file("morning-hard-reverse", "Hard Reverse"),
        file("morning-easy-coding", "Easy Coding"),
        file("morning-hard-coding", "Hard Coding"),
      ],
    },
    {
      value: "afternoon", open: false, endsAt: null,
      challenges: [
        text("afternoon-easy-puzzle", "Easy Puzzle", 3),
        text("afternoon-medium-puzzle", "Medium Puzzle", 2),
        file("afternoon-medium-reverse", "Medium Reverse"),
        file("afternoon-easy-reverse", "Easy Reverse"),
        file("afternoon-medium-coding", "Medium Coding"),
      ],
    },
  ],
  // File types accepted by every file challenge.
  extensions: [
    "txt", "md", "py", "c", "h", "cpp", "cc", "cxx", "hpp", "java", "js", "mjs", "ts",
    "go", "rs", "cs", "kt", "rb", "php", "swift", "scala", "dart", "lua", "r", "jl",
    "hs", "ml", "pl", "sh", "sql", "pas", "asm", "s", "json", "csv", "in", "out",
  ],
  maxFileKB: 200,
  maxTotalKB: 500,
};

export const CHALLENGE_TYPES = { text: "Text boxes", file: "File upload" };

// Hard caps the dashboard cannot exceed. 2 MB of files keeps each upload under Vercel's 4.5 MB request limit.
export const SETTINGS_LIMITS = {
  challenges: 20, challengeLabel: 60, fields: 10, textAnswer: 500, extensions: 60, maxFileKB: 1024, maxTotalKB: 2048,
};

// Formats that are never source code; uploads must be readable text.
export const BINARY_EXTENSIONS = [
  "exe", "dll", "so", "dylib", "o", "obj", "class", "jar", "pyc", "bin", "zip", "rar", "7z", "gz", "tar",
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "mp3", "mp4",
];

export const fileExtension = (name) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();

// A session accepts answers when it is switched on, has challenges, and its closing time (if any) has not passed.
export const sessionIsOpen = (session, now = Date.now()) =>
  Boolean(session.open && session.challenges.length && (!session.endsAt || now < Date.parse(session.endsAt)));
