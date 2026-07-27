(() => {
  "use strict";

  const root = document.documentElement;
  const header = document.getElementById("site-header");
  const sections = [...document.querySelectorAll(".scene-section")];
  const visualLayers = [...document.querySelectorAll("[data-parallax]")];
  const particles = document.getElementById("speed-particles");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 901px)");
  const STOP_RATIO = 0.55;

  let latestScrollY = window.scrollY;
  let lastRenderedScrollY = latestScrollY;
  let rafId = 0;
  let pageVisible = !document.hidden;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeInOut = value => value * value * (3 - 2 * value);

  function buildParticles() {
    if (!particles || particles.children.length) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 20; index += 1) {
      const particle = document.createElement("i");
      particle.style.setProperty("--ray-angle", `${12 + ((index * 37) % 156)}deg`);
      particle.style.setProperty("--ray-distance", `${10 + ((index * 29) % 62)}vmax`);
      particle.style.setProperty("--particle-speed", String(0.32 + (index % 7) * 0.12));
      fragment.appendChild(particle);
    }
    particles.appendChild(fragment);
  }

  function sectionProgress(section, viewportHeight) {
    const travelDistance = Math.max(1, section.offsetHeight - viewportHeight);
    return clamp((latestScrollY - section.offsetTop) / travelDistance);
  }

  function renderDesktop(viewportHeight) {
    let activeScene = 0;
    let activeTravel = 0;
    const activationLine = latestScrollY + (header?.offsetHeight || 0) + 16;

    sections.forEach((section, index) => {
      const progress = sectionProgress(section, viewportHeight);
      const isLast = index === sections.length - 1;
      const travel = isLast ? 0 : easeInOut(clamp((progress - STOP_RATIO) / (1 - STOP_RATIO)));
      const isCurrent = activationLine >= section.offsetTop &&
        latestScrollY < section.offsetTop + section.offsetHeight;

      if (isCurrent) {
        activeScene = index;
        activeTravel = travel;
      }

      const isFuture = !isCurrent && activationLine < section.offsetTop;
      const approaching = isFuture && index === activeScene + 1 && activeTravel > 0;
      const approach = approaching ? activeTravel : 0;
      const sceneTravel = isFuture ? -(1 - approach) : travel;
      const scale = isFuture ? 0.84 + approach * 0.16 : 1 + travel * 0.18;
      const opacity = isFuture ? approach : 1 - travel * 0.96;
      const blur = isFuture ? (1 - approach) * 2.2 : Math.max(0, travel - 0.7) * 7;

      section.style.setProperty("--scene-travel", sceneTravel.toFixed(4));
      section.style.setProperty("--scene-scale", scale.toFixed(4));
      section.style.setProperty("--scene-opacity", opacity.toFixed(4));
      section.style.setProperty("--scene-blur", blur + "px");
      section.dataset.phase = approaching ? "approach" : (isFuture ? "waiting" : (travel === 0 ? "stop" : "travel"));
    });

    const velocity = clamp(Math.abs(latestScrollY - lastRenderedScrollY) / 58);
    root.style.setProperty("--motion-progress", (activeScene + activeTravel).toFixed(4));
    root.style.setProperty("--motion-velocity", activeTravel > 0 ? Math.max(0.18, velocity).toFixed(4) : "0");
    root.dataset.motionMode = "desktop-3d";
    window.__pikdroMotionAudit = {
      mode: "desktop-3d",
      activeScene,
      stopRatio: STOP_RATIO,
      travelProgress: Number(activeTravel.toFixed(4)),
      backgroundProgress: Number((activeScene + activeTravel).toFixed(4))
    };
  }

  function renderMobile(viewportHeight) {
    const viewportCenter = viewportHeight / 2;
    visualLayers.forEach(layer => {
      const rect = layer.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const normalized = clamp((center - viewportCenter) / viewportHeight, -1.2, 1.2);
      const depth = Number(layer.dataset.parallax || 0.5);
      const easedDistance = Math.sign(normalized) * Math.pow(Math.abs(normalized), 1.35);
      layer.style.setProperty("--parallax-y", (-easedDistance * depth * 48).toFixed(3));
    });

    root.style.setProperty("--mobile-far", (-latestScrollY * 0.012).toFixed(2));
    root.style.setProperty("--mobile-mid", (-latestScrollY * 0.024).toFixed(2));
    root.style.setProperty("--mobile-near", (latestScrollY * 0.038).toFixed(2));
    root.style.setProperty("--mobile-glow", (-latestScrollY * 0.008).toFixed(2));
    root.style.setProperty("--motion-progress", (latestScrollY / Math.max(1, viewportHeight)).toFixed(4));
    root.style.setProperty("--motion-velocity", "0");
    root.dataset.motionMode = "mobile-parallax";
    window.__pikdroMotionAudit = {
      mode: "mobile-parallax",
      stopRatio: STOP_RATIO,
      far: Number((-latestScrollY * 0.012).toFixed(2)),
      mid: Number((-latestScrollY * 0.024).toFixed(2)),
      near: Number((latestScrollY * 0.038).toFixed(2))
    };
  }

  function render() {
    rafId = 0;
    if (!pageVisible) return;

    const viewportHeight = window.innerHeight;
    header?.classList.toggle("is-scrolled", latestScrollY > 24);

    if (reducedMotion.matches) {
      sections.forEach(section => {
        section.style.setProperty("--scene-travel", "0");
        section.style.setProperty("--scene-scale", "1");
        section.style.setProperty("--scene-opacity", "1");
        section.style.setProperty("--scene-blur", "0px");
        section.dataset.phase = "stop";
      });
      root.style.setProperty("--motion-progress", "0");
      root.style.setProperty("--motion-velocity", "0");
      root.dataset.motionMode = "reduced";
      window.__pikdroMotionAudit = { mode: "reduced", stopRatio: STOP_RATIO };
    } else if (desktopQuery.matches) {
      renderDesktop(viewportHeight);
    } else {
      renderMobile(viewportHeight);
    }

    lastRenderedScrollY = latestScrollY;
  }

  function requestRender() {
    if (!pageVisible || rafId) return;
    rafId = window.requestAnimationFrame(render);
  }

  function onScroll() {
    latestScrollY = window.scrollY;
    requestRender();
  }

  function activateTab(tab, focus = false) {
    const tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const switcher = tab.closest("[data-tabs]");
    const panels = [...switcher.querySelectorAll('[role="tabpanel"]')];

    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute("aria-selected", selected ? "true" : "false");
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== tab.getAttribute("aria-controls");
    });
    if (focus) tab.focus();
  }

  document.querySelectorAll("[data-tabs]").forEach(switcher => {
    const tabs = [...switcher.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", event => {
        let nextIndex = index;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activateTab(tabs[nextIndex], true);
      });
    });
  });

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (!pageVisible && rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      latestScrollY = window.scrollY;
      requestRender();
    }
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", requestRender, { passive: true });
  desktopQuery.addEventListener?.("change", requestRender);
  reducedMotion.addEventListener?.("change", requestRender);

  buildParticles();
  render();
})();
