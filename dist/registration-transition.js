export function initRegistrationTransition(renderRoute) {
  let active = null;
  let renderedHash = location.hash;

  function applyRoute() {
    renderRoute();
    renderedHash = location.hash;
  }

  function start() {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) { applyRoute(); return; }
    canvas.className = "registration-waterfall";
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.phase = "cover";
    canvas.dataset.direction = location.hash === "#inscription" ? "enter" : "exit";
    document.body.append(canvas);

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
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
      applyRoute();
    }

    function finish() {
      cancelAnimationFrame(frame);
      canvas.remove();
      root.style.overflow = previousOverflow;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pagehide", finish);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      active = null;
    }

    function onVisibilityChange() {
      if (document.hidden) { navigate(); finish(); }
    }

    function draw(now) {
      started ??= now;
      const elapsed = (now - started) * 1.18;
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

    active = { finish };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pagehide", finish);
    document.addEventListener("visibilitychange", onVisibilityChange);
    frame = requestAnimationFrame(draw);
  }

  window.addEventListener("hashchange", () => {
    active?.finish();
    const crossingRegistration = (renderedHash === "#inscription") !== (location.hash === "#inscription");
    if (crossingRegistration && !document.hidden) start();
    else applyRoute();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute("download") || (link.target && link.target !== "_self") ||
        link.getAttribute("href").startsWith("#")) return;
    const destination = new URL(link.href);
    if (destination.origin !== location.origin || destination.pathname !== location.pathname ||
        destination.search !== location.search || location.hash !== "#inscription") return;
    event.preventDefault();
    location.hash = destination.hash || "#";
  });
}
