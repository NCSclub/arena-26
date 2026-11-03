export function initRegistrationTransition() {
  let active = null;

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href="#inscription"]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute("download") || link.target === "_blank" ||
        location.hash === "#inscription") return;
    event.preventDefault();
    if (active) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) { location.hash = "inscription"; return; }
    canvas.className = "registration-waterfall";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.phase = "cover";
    document.body.append(canvas);

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const initialHash = location.hash;
    let navigated = false;
    let frame;
    let cells = [];
    let started;
    const coverAt = 720;
    const revealAt = 860;
    const endAt = 1580;

    function resize() {
      const size = innerWidth < 700 ? 16 : 24;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      const columns = Math.ceil(canvas.width / size);
      const rows = Math.ceil(canvas.height / size);
      const noise = (x, y) => {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };
      cells = [];
      for (let column = 0; column < columns; column++) {
        const delay = noise(column, 2) * 145 + Math.sin(column * .32) * 45;
        for (let row = 0; row < rows; row++) {
          cells.push({
            x: column * size, y: row * size, size,
            threshold: Math.min(640, 45 + (row / rows) * 455 + delay + noise(column, row) * 60),
            fragment: noise(column + 17, row) > .77,
          });
        }
      }
    }

    function navigate() {
      if (navigated) return;
      navigated = true;
      location.hash = "inscription";
    }

    function finish() {
      cancelAnimationFrame(frame);
      canvas.remove();
      root.style.overflow = previousOverflow;
      window.removeEventListener("resize", resize);
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("pagehide", finish);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      active = null;
    }

    function onHashChange() {
      if (location.hash !== (navigated ? "#inscription" : initialHash)) finish();
    }

    function onVisibilityChange() {
      if (document.hidden) { navigate(); finish(); }
    }

    function draw(now) {
      started ??= now;
      const elapsed = now - started;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#fff";
      if (elapsed >= coverAt) navigate();
      canvas.dataset.phase = elapsed < coverAt ? "cover" : elapsed < revealAt ? "covered" : "reveal";
      for (const cell of cells) {
        const arriving = elapsed >= cell.threshold;
        const leaving = elapsed - revealAt >= cell.threshold;
        const leadingFragment = cell.fragment && elapsed >= cell.threshold - 135 && elapsed < cell.threshold - 65;
        const trailingFragment = cell.fragment && elapsed - revealAt >= cell.threshold + 35 && elapsed - revealAt < cell.threshold + 75;
        if ((arriving && !leaving) || leadingFragment || trailingFragment)
          context.fillRect(cell.x, cell.y, cell.size, cell.size);
      }
      if (elapsed >= endAt) { finish(); return; }
      frame = requestAnimationFrame(draw);
    }

    active = canvas;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("pagehide", finish);
    document.addEventListener("visibilitychange", onVisibilityChange);
    frame = requestAnimationFrame(draw);
  });
}
