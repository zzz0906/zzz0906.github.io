"use strict";

document.documentElement.classList.add("has-js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const svgNamespace = "http://www.w3.org/2000/svg";

const INK = "#14201e";
const SOFT = "#44524f";
const MUTED = "#57544b";
const LINE = "#b9b4a8";
const PAPER = "#f4efe4";
const TEAL = "#24c7b5";
const TEAL_DARK = "#055a52";
const ORANGE = "#ee8f43";
const ORANGE_DARK = "#894816";
const RED = "#e45e52";
const RED_DARK = "#9e2f2a";
const SERVING_COLOR = "#bd6d37";
const TRAINING_COLOR = "#3e88a6";
const PURPLE = "#6d4aa8";
const NAVY = "#1d4f6e";
const LAVENDER = "#a98fe0";
const ORANGE_DEEP = "#b05a1a";
/* Ink variants of the run colours: same hue, dark enough to read as type
 * (>= 4.5:1 on the figure surface). The stroke colours themselves sit near
 * 2:1 and are legible only as marks. */
const TEAL_INK = "#0e7568";
const ORANGE_INK = "#a3541a";
const ORANGE_DEEP_INK = "#6b3410";
const TRAINING_INK = "#2f6b85";
const PURPLE_INK = "#5d3f90";
const LAVENDER_INK = "#7b5cc0";
const RED_INK = "#b03327";

/* Charts that draw straight onto the page background (not onto a fig-shell
 * card) need their own light-safe palette. The page is light now, so these
 * replace the old dark-context ad hoc hex values inline in initZeroStrip,
 * initRoadmap and initFrontierChart. MUTED/TEAL_DARK/ORANGE_DARK above are
 * tuned to sit on --bg-card-deep (#ece5d8, WCAG AA, >=4.5:1); INK_FAINT is
 * tuned the same way for the lighter --bg page surface. */
const INK_FAINT = "#4b514f";
const LINE_FAINT = "#e3ddd0";
const TRACK = "#e8e2d5";
const LOOP_STILL_MS = 5000;

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text) element.textContent = text;
  return element;
}

/* ---------------------------------------------------------------------------
 * Shared figure primitives.
 * The site has no @keyframes and no rAF loop: motion is a class toggle over a
 * timer chain, and every timer is gated on reducedMotion (the global CSS block
 * only neuters durations, it cannot stop a timer).
 * ------------------------------------------------------------------------- */

const sequences = new Set();

function createSequence(root, { stepMs = 620, onStep } = {}) {
  const steps = () => [...root.querySelectorAll("[data-step]")];
  const total = steps().reduce((count, node) => Math.max(count, Number(node.dataset.step) + 1), 0);
  let timers = [];
  let loopTimer = null;
  let loopEnabled = false;
  let suspended = false;

  const clear = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
    if (loopTimer !== null) window.clearTimeout(loopTimer);
    loopTimer = null;
  };

  // data-until marks a state the sequence REPLACES (the chunked launches the
  // collapse deletes): it is drawn as a sibling and retired, never overprinted.
  const mark = (index) => {
    steps().forEach((node) => {
      const step = Number(node.dataset.step);
      const until = node.dataset.until;
      node.classList.toggle("is-active", step <= index);
      node.classList.toggle("is-playing", step === index);
      node.classList.toggle("is-gone", until !== undefined && index >= Number(until));
    });
    if (onStep) onStep(index);
  };

  const finish = () => {
    clear();
    mark(total - 1);
    steps().forEach((node) => node.classList.remove("is-playing"));
    root.dataset.seq = "done";
  };

  const completeNaturally = () => {
    timers = [];
    mark(total - 1);
    steps().forEach((node) => node.classList.remove("is-playing"));
    root.dataset.seq = "done";
    if (loopEnabled && !suspended && !reducedMotion.matches) {
      loopTimer = window.setTimeout(play, LOOP_STILL_MS);
    }
  };

  const stop = () => {
    clear();
    if (root.dataset.seq === "playing") root.dataset.seq = "idle";
  };

  const suspend = () => {
    suspended = true;
    clear();
  };

  const resumeVisibility = () => {
    suspended = false;
    if (loopEnabled && !reducedMotion.matches) play();
  };

  const play = () => {
    clear();
    if (reducedMotion.matches) return finish();
    if (!total) return;
    root.dataset.seq = "playing";
    steps().forEach((node) => node.classList.remove("is-active", "is-playing"));
    for (let index = 0; index < total; index += 1) {
      timers.push(window.setTimeout(() => mark(index), index * stepMs));
    }
    const revealDuration = (total - 1) * stepMs + 600;
    timers.push(window.setTimeout(completeNaturally, revealDuration));
    return undefined;
  };

  const sequence = {
    play,
    stop,
    finish,
    suspend,
    resumeVisibility,
    setLoopEnabled: (enabled) => {
      loopEnabled = Boolean(enabled);
      if (!loopEnabled && loopTimer !== null) {
        window.clearTimeout(loopTimer);
        loopTimer = null;
      }
    },
  };
  sequences.add(sequence);
  return sequence;
}

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) sequences.forEach((sequence) => sequence.finish());
});

// Printing is a final-state medium. Never capture a half-drawn connector or a
// future step at reduced opacity.
window.addEventListener("beforeprint", () => {
  sequences.forEach((sequence) => sequence.finish());
});

function whenInView(element, onChange, { threshold = 0.12 } = {}) {
  let intersecting = false;
  const report = () => onChange(intersecting && !document.hidden);
  const handleVisibility = () => report();
  document.addEventListener("visibilitychange", handleVisibility);
  if (!("IntersectionObserver" in window)) {
    intersecting = true;
    report();
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        intersecting = entry.isIntersecting;
        report();
      });
    },
    { threshold },
  );
  observer.observe(element);
  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

/* A figure's tablist is wired by initAccessibleTabs. Authored labels always
 * read complete; motion teaches the order. Looping figures rest on the fully
 * assembled frame for five seconds before repeating. Reduced-motion readers
 * always receive the finished figure. */
function bindFigure(figureId, panelSequences) {
  const figure = document.getElementById(figureId);
  if (!figure) return;
  let seen = false;
  let activeSequence = null;
  const autoplayMode = figure.dataset.autoplay || "none";
  const autoplayEnabled = autoplayMode === "once" || autoplayMode === "loop";
  const loopEnabled = autoplayMode === "loop";

  const selectedSequence = () => {
    const tab = figure.querySelector("[role='tab'][aria-selected='true']");
    const panelId = tab ? tab.getAttribute("aria-controls") : Object.keys(panelSequences)[0];
    return panelSequences[panelId];
  };

  const configureSelected = () => {
    const sequence = selectedSequence();
    sequence?.setLoopEnabled?.(loopEnabled);
    return sequence;
  };

  figure.addEventListener("tabchange", (event) => {
    if (!seen) return;
    const { panel, selected } = event.detail;
    const sequence = panel ? panelSequences[panel.id] : null;
    if (!sequence) return;
    if (selected) sequence.finish();
    else sequence.stop();
  });

  whenInView(figure, (visible) => {
    if (!visible) {
      if (autoplayMode === "once") activeSequence?.finish?.();
      else activeSequence?.suspend?.();
      return;
    }
    activeSequence = configureSelected();
    if (!seen) {
      seen = true;
      if (autoplayEnabled && !reducedMotion.matches) activeSequence?.play();
      else activeSequence?.finish();
      return;
    }
    activeSequence?.resumeVisibility?.();
  });
}

function layerOf(id) {
  const svg = document.getElementById(id);
  if (!svg) return null;
  const layer = svg.querySelector("[data-js-layer]");
  if (!layer) return null;
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  return layer;
}

function rect(x, y, width, height, attributes = {}) {
  return svgElement("rect", { x, y, width, height, fill: PAPER, stroke: LINE, "stroke-width": 1, ...attributes });
}

function wire(d, attributes = {}) {
  // pathLength normalises the draw-on transition; it also rescales stroke-dasharray,
  // so a schematic dashed connector must not carry it.
  const base = { d, fill: "none", stroke: LINE, "stroke-width": 1.2 };
  if ("data-draw" in attributes) base.pathLength = 1;
  return svgElement("path", { ...base, ...attributes });
}

function label(x, y, text, attributes = {}) {
  return svgElement("text", { x, y, fill: MUTED, "font-size": 10, ...attributes }, text);
}

/* Wrap text from its rendered SVG width instead of guessing from character
 * counts. This keeps labels inside their boxes when copy or fonts change. */
function fitTextInBox(parent, box, text, attributes = {}, options = {}) {
  const padding = options.padding ?? 12;
  const verticalPadding = options.verticalPadding ?? 4;
  const minFontSize = options.minFontSize ?? 8;
  let fontSize = Number(attributes["font-size"] ?? 10);
  const lineHeightRatio = options.lineHeightRatio ?? 1.25;
  const maxWidth = box.w - 2 * padding;
  const element = svgElement("text", {
    x: attributes["text-anchor"] === "middle" ? box.x + box.w / 2 : box.x + padding,
    fill: MUTED,
    ...attributes,
  });
  parent.appendChild(element);

  const words = text.trim().split(/\s+/);
  let lines = [];
  let lineHeight = fontSize * lineHeightRatio;
  let maxLines = Math.max(1, Math.floor((box.h - 2 * verticalPadding) / lineHeight));

  const measureLines = () => {
    const measured = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      element.textContent = candidate;
      if (line && element.getComputedTextLength() > maxWidth) {
        measured.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) measured.push(line);
    return measured;
  };

  element.setAttribute("font-size", String(fontSize));
  lines = measureLines();
  while (lines.length > maxLines && fontSize > minFontSize) {
    fontSize -= 0.5;
    lineHeight = fontSize * lineHeightRatio;
    maxLines = Math.max(1, Math.floor((box.h - 2 * verticalPadding) / lineHeight));
    element.setAttribute("font-size", String(fontSize));
    lines = measureLines();
  }

  element.textContent = "";
  const textHeight = lines.length * lineHeight;
  const firstBaseline = box.y + (box.h - textHeight) / 2 + fontSize;
  lines.forEach((line, index) => {
    element.appendChild(svgElement("tspan", {
      x: element.getAttribute("x"),
      y: firstBaseline + index * lineHeight,
    }, line));
  });
  return element;
}

/* --- Release hero and model-wide numerical alignment ---------------------- */

function createSingleStorySequence(svg, group) {
  let revealFrame = null;
  let completionTimer = null;
  let loopTimer = null;
  let loopEnabled = false;
  let suspended = false;
  const revealNodes = [...group.querySelectorAll(
    ".kernel-story-motion, .kernel-story-path, .kernel-story-arrowhead, .kernel-story-dashed-path",
  )];
  const revealDuration = Math.max(0, ...revealNodes.map((node) => {
    const delay = Number.parseFloat(node.style.getPropertyValue("--story-delay")) || 0;
    if (node.classList.contains("kernel-story-arrowhead")) return delay + 921;
    return delay + (node.classList.contains("kernel-story-path") ? 920 : 680);
  }));

  const clearRevealFrame = () => {
    if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
    revealFrame = null;
    if (completionTimer !== null) window.clearTimeout(completionTimer);
    completionTimer = null;
    if (loopTimer !== null) window.clearTimeout(loopTimer);
    loopTimer = null;
  };
  const expose = () => {
    group.style.opacity = "1";
    group.style.visibility = "visible";
    group.style.pointerEvents = "auto";
    group.setAttribute("aria-hidden", "false");
  };
  const finish = () => {
    clearRevealFrame();
    group.classList.remove("is-resetting");
    revealNodes.forEach((node) => node.style.removeProperty("transition"));
    expose();
    group.classList.add("is-active");
    svg.dataset.seq = "done";
  };
  const stop = () => {
    clearRevealFrame();
    group.classList.remove("is-active", "is-resetting");
    revealNodes.forEach((node) => node.style.removeProperty("transition"));
    group.style.opacity = "0";
    group.style.visibility = "hidden";
    group.style.pointerEvents = "none";
    group.setAttribute("aria-hidden", "true");
    svg.dataset.seq = "idle";
  };
  const play = () => {
    if (reducedMotion.matches) return finish();
    clearRevealFrame();
    group.classList.add("is-resetting");
    group.classList.remove("is-active");
    revealNodes.forEach((node) => node.style.setProperty("transition", "none", "important"));
    expose();
    svg.dataset.seq = "playing";
    // Remove transitions while committing the reset, then restore them for a
    // fresh active-state transition. Two frames make that boundary observable
    // to the renderer when the automatic loop restarts from an assembled pane.
    revealNodes.at(-1)?.getBoundingClientRect();
    revealFrame = window.requestAnimationFrame(() => {
      group.classList.remove("is-resetting");
      revealNodes.forEach((node) => node.style.removeProperty("transition"));
      revealNodes.at(-1)?.getBoundingClientRect();
      revealFrame = window.requestAnimationFrame(() => {
        group.classList.add("is-active");
        revealFrame = null;
        completionTimer = window.setTimeout(() => {
          svg.dataset.seq = "done";
          completionTimer = null;
          if (loopEnabled && !suspended && !reducedMotion.matches) {
            loopTimer = window.setTimeout(play, LOOP_STILL_MS);
          }
        }, revealDuration);
      });
    });
    return undefined;
  };

  stop();
  const sequence = {
    play,
    stop,
    finish,
    suspend: () => {
      suspended = true;
      clearRevealFrame();
    },
    resumeVisibility: () => {
      suspended = false;
      if (loopEnabled && !reducedMotion.matches) play();
    },
    setLoopEnabled: (enabled) => {
      loopEnabled = Boolean(enabled);
      if (!loopEnabled && loopTimer !== null) {
        window.clearTimeout(loopTimer);
        loopTimer = null;
      }
    },
  };
  sequences.add(sequence);
  return sequence;
}

function stretchRevealDelays(root, {
  selector,
  property,
  targetSpan,
  maximumScale = 3.5,
}) {
  const animated = [...root.querySelectorAll(selector)];
  const delays = animated.map((node) =>
    Number.parseFloat(node.style.getPropertyValue(property)) || 0);
  const maximumDelay = Math.max(0, ...delays);
  if (!maximumDelay) return 1;
  const delayScale = Math.min(maximumScale, Math.max(1, targetSpan / maximumDelay));
  if (delayScale <= 1) return 1;
  animated.forEach((node, index) => {
    node.style.setProperty(property, `${Math.round(delays[index] * delayScale)}ms`);
  });
  return delayScale;
}

function drawKernelStory(storySlug, specification) {
  const alignedKey = specification.alignedKey || "exact";
  const stateDefinitions = [
    ...(specification.drawMismatch ? [{
      key: "mismatch",
      className: "kernel-story-mismatch",
      title: "MISMATCH",
      color: RED_DARK,
      tint: "rgba(228, 94, 82, 0.035)",
      draw: specification.drawMismatch,
      mismatchLanes: !specification.singleMismatch,
    }] : []),
    {
      key: alignedKey,
      className: "kernel-story-aligned",
      title: specification.alignedTitle || "BITWISE IDENTICAL",
      color: specification.alignedColor || TEAL_DARK,
      tint: specification.alignedTint || "rgba(36, 199, 181, 0.045)",
      draw: specification.drawAligned,
    },
    ...(specification.additionalStates || []).map((state, index) => ({
      key: state.key || `additional-${index + 1}`,
      className: state.className || `kernel-story-additional-${index + 1}`,
      title: state.title,
      color: state.color || TEAL_DARK,
      tint: state.tint || "rgba(36, 199, 181, 0.045)",
      draw: state.draw,
    })),
  ];

  const paneHeading = (parent, title, color, tint) => {
    const viewBoxHeight = parent.ownerSVGElement?.viewBox?.baseVal?.height || 540;
    parent.appendChild(svgElement("rect", {
      x: 0, y: 0, width: 960, height: viewBoxHeight, fill: tint,
    }));
    parent.appendChild(label(480, 32, title, {
      class: "kernel-story-state-title",
      fill: color, "font-size": specification.sectionOne ? 14 : 12, "font-weight": 800,
      "letter-spacing": 1.35, "text-anchor": "middle",
    }));
    parent.appendChild(svgElement("line", {
      x1: 32, y1: 56, x2: 928, y2: 56, stroke: color,
      "stroke-width": 1, opacity: 0.34,
    }));
  };

  const intervalMs = specification.intervalMs || 5000;
  const targetRevealSpan = Math.min(intervalMs * 0.55, intervalMs - 2500);
  const controllers = {};
  stateDefinitions.forEach((state) => {
    const svgId = `${storySlug}-${state.key}-svg`;
    const svg = document.getElementById(svgId);
    const layer = layerOf(svgId);
    if (!svg || !layer) return;
    if (specification.sectionOne) svg.classList.add("shared-operation-story");

    const group = svgElement("g", {
      class: `kernel-story-pane ${state.className}`,
    });
    layer.appendChild(group);
    paneHeading(group, state.title, state.color, state.tint);

    if (state.mismatchLanes) {
      group.appendChild(label(250, 88, specification.mismatchLeftLabel || "TRAINING FORWARD", {
        fill: specification.mismatchLeftColor || TRAINING_COLOR,
        "font-size": specification.sectionOne ? 12.5 : 10, "font-weight": 800,
        "letter-spacing": 1, "text-anchor": "middle",
      }));
      group.appendChild(label(710, 88, specification.mismatchRightLabel || "INFERENCE FORWARD", {
        fill: specification.mismatchRightColor || SERVING_COLOR,
        "font-size": specification.sectionOne ? 12.5 : 10, "font-weight": 800,
        "letter-spacing": 1, "text-anchor": "middle",
      }));
      group.appendChild(svgElement("line", {
        x1: 480, y1: specification.sectionOne ? 138 : 72,
        x2: 480, y2: 468, stroke: LINE_FAINT, "stroke-width": 1,
      }));
    }
    state.draw(group);

    // Authored delays preserve causal order. Normalize only short stories so
    // each standalone animation remains readable before it settles.
    const delayScale = stretchRevealDelays(group, {
      selector: ".kernel-story-motion, .kernel-story-path, .kernel-story-arrowhead, .kernel-story-dashed-path",
      property: "--story-delay",
      targetSpan: targetRevealSpan,
    });
    if (delayScale > 1) group.dataset.revealScale = delayScale.toFixed(2);
    controllers[state.key] = createSingleStorySequence(svg, group);
  });

  return controllers;
}

function drawKernelStories() {
  const train = TRAINING_COLOR;
  const infer = SERVING_COLOR;
  const trainPale = "#c8dde6";
  const inferPale = "#ead0bd";
  const SECTION_ONE_TYPE = Object.freeze({
    state: 14,
    lane: 12.5,
    claim: 12.5,
    note: 10.5,
    micro: 9,
  });
  const isSectionOneStory = (parent) =>
    Boolean(parent?.ownerSVGElement?.classList.contains("shared-operation-story"));
  const storyAttributes = (parent, attributes = {}, defaultTier = "note") => {
    const { storyTier = defaultTier, ...svgAttributes } = attributes;
    if (!isSectionOneStory(parent)) return svgAttributes;
    const requested = Number(svgAttributes["font-size"] || 9);
    return {
      ...svgAttributes,
      "font-size": Math.max(requested, SECTION_ONE_TYPE[storyTier] || SECTION_ONE_TYPE.note),
    };
  };
  const storyText = (parent, x, y, text, color = MUTED, attributes = {}) => {
    parent.appendChild(label(x, y, text, {
      fill: color, "font-size": 9, "text-anchor": "middle",
      ...storyAttributes(parent, attributes),
    }));
  };
  const motion = (node, delay = 0) => {
    node.setAttribute("class", `${node.getAttribute("class") || ""} kernel-story-motion`.trim());
    node.style.setProperty("--story-delay", `${delay}ms`);
    return node;
  };
  const motionText = (parent, x, y, text, color, delay = 0, attributes = {}) => {
    parent.appendChild(motion(label(x, y, text, {
      fill: color, "font-size": 9, "text-anchor": "middle",
      ...storyAttributes(parent, attributes),
    }), delay));
  };
  const storyArrow = (parent, d, color, delay = 0, width = 1.8) => {
    const path = wire(d, { stroke: color, "stroke-width": width, pathLength: 1 });
    path.setAttribute("class", "kernel-story-path");
    path.style.setProperty("--story-delay", `${delay}ms`);
    parent.appendChild(path);
  };
  const addMatrixGlyph = (parent, cx, cy, rows, columns, color, options = {}) => {
    const cellWidth = options.cellWidth || 14;
    const cellHeight = options.cellHeight || 13;
    const gap = options.gap ?? 3;
    const width = columns * cellWidth + (columns - 1) * gap;
    const height = rows * cellHeight + (rows - 1) * gap;
    const left = cx - width / 2;
    const top = cy - height / 2;
    const labels = options.labels || [];
    const highlighted = new Set(options.highlighted || []);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const delay = (options.delay || 0) + index * 24;
        const x = left + column * (cellWidth + gap);
        const y = top + row * (cellHeight + gap);
        parent.appendChild(motion(svgElement("rect", {
          x, y, width: cellWidth, height: cellHeight, rx: 1.8,
          fill: highlighted.has(index) ? color : PAPER,
          stroke: color, "stroke-width": 1,
        }), delay));
        if (labels[index] !== undefined) {
          motionText(parent, x + cellWidth / 2, y + cellHeight / 2, labels[index],
            highlighted.has(index) ? "#fffdf7" : color, delay,
            {
              "font-size": options.labelSize || 8, "font-weight": 800,
              "dominant-baseline": "middle", storyTier: "micro",
            });
        }
      }
    }
    return {
      left, top, right: left + width, bottom: top + height, width, height, cx, cy,
      ports: {
        left: { x: left, y: cy }, right: { x: left + width, y: cy },
        top: { x: cx, y: top }, bottom: { x: cx, y: top + height },
      },
    };
  };
  const addCastBadge = (parent, x, y, color, delay = 0) => {
    const sectionOne = isSectionOneStory(parent);
    const width = sectionOne ? 48 : 42;
    const height = sectionOne ? 22 : 20;
    const badge = svgElement("g");
    badge.appendChild(svgElement("rect", {
      x: x - width / 2, y: y - height / 2, width, height, rx: height / 2,
      fill: color, stroke: color, "stroke-width": 1,
    }));
    badge.appendChild(label(x, y, "BF16", {
      fill: "#fffdf7", "font-size": sectionOne ? SECTION_ONE_TYPE.micro : 8.2,
      "font-weight": 850, "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(badge, delay));
    return {
      left: x - width / 2, right: x + width / 2,
      top: y - height / 2, bottom: y + height / 2, cx: x, cy: y,
      ports: {
        left: { x: x - width / 2, y }, right: { x: x + width / 2, y },
        top: { x, y: y - height / 2 }, bottom: { x, y: y + height / 2 },
      },
    };
  };
  const addResultValue = (parent, cx, cy, color, options = {}) => {
    const kind = options.kind || "scalar";
    const delay = options.delay || 0;
    const group = svgElement("g", { "aria-hidden": "true" });
    if (kind === "scalar") {
      group.appendChild(svgElement("line", {
        x1: cx - 27, y1: cy, x2: cx - 9, y2: cy,
        stroke: color, "stroke-width": 1.5,
      }));
      group.appendChild(svgElement("circle", {
        cx, cy, r: 8, fill: PAPER, stroke: color, "stroke-width": 1.7,
      }));
      group.appendChild(svgElement("line", {
        x1: cx + 9, y1: cy, x2: cx + 27, y2: cy,
        stroke: color, "stroke-width": 1.5,
      }));
    } else if (kind === "pair") {
      group.appendChild(svgElement("line", {
        x1: cx - 19, y1: cy, x2: cx + 19, y2: cy,
        stroke: color, "stroke-width": 1.5,
      }));
      [-15, 15].forEach((offset) => group.appendChild(svgElement("circle", {
        cx: cx + offset, cy, r: 7, fill: PAPER, stroke: color, "stroke-width": 1.6,
      })));
    } else {
      group.appendChild(svgElement("rect", {
        x: cx - 47, y: cy - 10, width: 94, height: 20, rx: 10,
        fill: PAPER, stroke: color, "stroke-width": 1.45,
      }));
      [-30, -20, -10, 0, 10, 20, 30].forEach((offset) =>
        group.appendChild(svgElement("line", {
          x1: cx + offset, y1: cy - 4, x2: cx + offset, y2: cy + 4,
          stroke: color, "stroke-width": 1.2,
        })));
    }
    parent.appendChild(motion(group, delay));
    const bounds = kind === "scalar"
      ? { left: cx - 27, right: cx + 27, top: cy - 8, bottom: cy + 8 }
      : kind === "pair"
        ? { left: cx - 22, right: cx + 22, top: cy - 7, bottom: cy + 7 }
        : { left: cx - 47, right: cx + 47, top: cy - 10, bottom: cy + 10 };
    return {
      ...bounds, cx, cy,
      ports: {
        left: { x: bounds.left, y: cy }, right: { x: bounds.right, y: cy },
        top: { x: cx, y: bounds.top }, bottom: { x: cx, y: bounds.bottom },
      },
    };
  };
  const addByteStrip = (parent, cx, cy, color, highlightIndex = -1, delay = 0) => {
    if (isSectionOneStory(parent)) {
      throw new Error("Synthetic byte strips are not allowed in Section 01 stories");
    }
    const count = 12;
    const width = 8;
    const gap = 2.5;
    const start = cx - (count * width + (count - 1) * gap) / 2;
    for (let index = 0; index < count; index += 1) {
      parent.appendChild(motion(svgElement("rect", {
        x: start + index * (width + gap), y: cy - 7, width, height: 14, rx: 1,
        fill: index === highlightIndex ? color : PAPER,
        stroke: color, "stroke-width": index === highlightIndex ? 1.5 : 0.8,
      }), delay + index * 22));
    }
  };
  const addBitWord = (parent, cx, cy, color, count, differenceIndex, differenceValue, delay = 0) => {
    if (isSectionOneStory(parent)) {
      throw new Error("Synthetic bit words are not allowed in Section 01 stories");
    }
    const width = count > 16 ? 4.6 : 7;
    const gap = count > 16 ? 1.3 : 2;
    const start = cx - (count * width + (count - 1) * gap) / 2;
    for (let index = 0; index < count; index += 1) {
      const differs = index === differenceIndex;
      const filled = differs ? differenceValue === 1 : (index % 5 === 1 || index % 7 === 3);
      parent.appendChild(motion(svgElement("rect", {
        x: start + index * (width + gap), y: cy - 6, width, height: 12, rx: 0.8,
        fill: filled ? (differs ? RED_DARK : color) : PAPER,
        stroke: differs ? RED_DARK : color,
        "stroke-width": differs ? 1.35 : 0.65,
        opacity: differs ? 1 : (filled ? 0.34 : 0.68),
      }), delay + index * 12));
    }
    if (differenceIndex >= 0) {
      const bitX = start + differenceIndex * (width + gap) + width / 2;
      parent.appendChild(motion(svgElement("line", {
        x1: bitX, y1: cy + 7, x2: bitX, y2: cy + 13,
        stroke: RED_DARK, "stroke-width": 1,
      }), delay + count * 12));
      motionText(parent, bitX, cy + 23, String(differenceValue), RED_DARK, delay + count * 12, {
        "font-size": 7.6, "font-weight": 850,
      });
    }
    const right = start + count * width + (count - 1) * gap;
    return {
      left: start, right, top: cy - 6, bottom: cy + (differenceIndex >= 0 ? 23 : 6), cx, cy,
      ports: {
        left: { x: start, y: cy }, right: { x: right, y: cy },
        top: { x: cx, y: cy - 6 }, bottom: { x: cx, y: cy + 6 },
      },
    };
  };
  const addCallerPair = (parent, x, y, targetX, targetY, delay = 0) => {
    [[y - 15, train, "TRAIN"], [y + 15, infer, "SERVE"]].forEach(([callerY, color, copy], index) => {
      const callerDelay = delay + index * 55;
      parent.appendChild(motion(svgElement("circle", { cx: x, cy: callerY, r: 6, fill: color }), callerDelay));
      motionText(parent, x - 18, callerY + 3, copy, color, callerDelay, {
        "font-size": 7.8, "font-weight": 800, "text-anchor": "end", storyTier: "micro",
      });
      storyArrow(parent, `M ${x + 8} ${callerY} C ${x + 36} ${callerY} ${targetX - 34} ${targetY} ${targetX - 12} ${targetY}`,
        color, delay + 70 + index * 55, 1.4);
    });
  };
  const addDifferenceMarker = (parent, x, y, delay = 0, size = 24) => {
    parent.appendChild(motion(svgElement("circle", {
      cx: x, cy: y - 4, r: size * 0.72, fill: PAPER,
    }), delay));
    motionText(parent, x, y, "≠", RED_DARK, delay, { "font-size": size, "font-weight": 850 });
  };
  const addRopeBox = (parent, cx, cy, width, copy, color, delay = 0) => {
    const group = svgElement("g");
    group.appendChild(svgElement("rect", {
      x: cx - width / 2, y: cy - 21, width, height: 42, rx: 5,
      fill: PAPER, stroke: color, "stroke-width": 1.4,
    }));
    group.appendChild(label(cx, cy + 4, copy, {
      fill: color, "font-size": 10.5, "font-weight": 820, "text-anchor": "middle",
    }));
    parent.appendChild(motion(group, delay));
  };

  const rope = drawKernelStory("rope", {
    sectionOne: true,
    drawMismatch: (parent) => {
      storyText(parent, 480, 108, "QWEN3-30B-A3B · BF16 TABLE VALUES BY POSITION", RED_DARK, {
        "font-size": 8.8, "font-weight": 850, storyTier: "claim",
      });
      addRopeBox(parent, 250, 150, 236, "COMPLETE FP32 TABLE ON CPU", train, 0);
      addRopeBox(parent, 622, 150, 190, "INVERSE FREQUENCIES ON CPU", infer, 0);
      storyArrow(parent, "M 720 150 H 746", infer, 130, 1.4);
      addRopeBox(parent, 824, 150, 148, "TABLE ON GPU", infer, 200);
      storyArrow(parent, "M 250 173 C 250 200 268 214 292 226", train, 300, 1.35);
      // Keep this sweep in the corridor above the forked 593 cells.
      storyArrow(parent, "M 824 173 C 700 182 470 182 392 214", infer, 340, 1.35);

      const ropeCell = (cx, cy, copy, cellColor, delay, options = {}) => {
        const height = options.height || 26;
        const group = svgElement("g");
        group.appendChild(svgElement("rect", {
          x: cx - 23, y: cy - height / 2, width: 46, height, rx: 3,
          fill: options.fill || PAPER, stroke: cellColor,
          "stroke-width": options.strokeWidth || 1.1,
        }));
        if (copy) {
          group.appendChild(label(cx, cy, copy, {
            fill: cellColor, "font-size": 9.4, "font-weight": 820,
            "text-anchor": "middle", "dominant-baseline": "middle",
          }));
        }
        parent.appendChild(motion(group, delay));
      };
      [["…", 322], ["590", 372], ["591", 422], ["592", 472]].forEach(([copy, x], index) => {
        ropeCell(x, 240, copy, INK_FAINT, 420 + index * 60);
      });
      storyText(parent, 397, 290, "IDENTICAL IN BOTH ENGINES", INK_FAINT, {
        "font-size": 8.4, "font-weight": 800,
      });
      storyArrow(parent, "M 497 230 C 508 224 512 220 519 216", train, 700, 1.2);
      storyArrow(parent, "M 497 250 C 508 256 512 260 519 264", infer, 730, 1.2);
      ropeCell(546, 212, "593", train, 800, { fill: trainPale, strokeWidth: 1.7, height: 24 });
      ropeCell(596, 212, "…", train, 860, { height: 24 });
      ropeCell(546, 268, "593", infer, 830, { fill: inferPale, strokeWidth: 1.7, height: 24 });
      ropeCell(596, 268, "…", infer, 890, { height: 24 });
      addDifferenceMarker(parent, 642, 240, 980, 18);
      motionText(parent, 664, 244, "FIRST DIFFERENCE · POSITION 593", RED_DARK, 1040, {
        "font-size": 8.6, "font-weight": 850, "text-anchor": "start",
      });

      storyArrow(parent, "M 250 173 V 310", train, 1100, 1.35);
      // Drop clear of the difference caption before returning to the shared box.
      storyArrow(parent, "M 862 171 V 288 C 862 302 820 310 794 310", infer, 1140, 1.35);
      const sharedRotation = svgElement("g");
      sharedRotation.appendChild(svgElement("rect", {
        x: 166, y: 310, width: 628, height: 94, rx: 8,
        fill: PAPER, stroke: MUTED, "stroke-width": 1.5,
      }));
      sharedRotation.appendChild(label(480, 340, "SAME ROTATION", {
        fill: INK, "font-size": 12, "font-weight": 850, "text-anchor": "middle",
      }));
      sharedRotation.appendChild(label(480, 374, "IDENTICAL BF16 MULTIPLY AND ADD SEQUENCE", {
        fill: MUTED, "font-size": 10.5, "font-weight": 780, "text-anchor": "middle",
      }));
      parent.appendChild(motion(sharedRotation, 1220));
      storyArrow(parent, "M 250 404 V 452", train, 1350, 1.45);
      storyArrow(parent, "M 710 404 V 452", infer, 1390, 1.45);
      addResultValue(parent, 250, 459, train, { kind: "pair", delay: 1480 });
      addResultValue(parent, 710, 459, infer, { kind: "pair", delay: 1480 });
      storyText(parent, 250, 498, "BF16 q′ PAIR", train, { "font-size": 8.5, "font-weight": 800 });
      storyText(parent, 710, 498, "BF16 q′ PAIR", infer, { "font-size": 8.5, "font-weight": 800 });
      addDifferenceMarker(parent, 480, 465, 1600, 24);
      motionText(parent, 480, 526, "FIRST MISMATCHED LOGPROB · THE NEXT DECODED TOKEN", RED_DARK, 1720, {
        "font-size": 8.8, "font-weight": 850,
      });
    },
  });

  const addExplicitNormTree = (parent, cx, leafY, color) => {
    const leaves = Array.from({ length: 8 }, (_value, index) => cx - 112 + index * 32);
    leaves.forEach((x, index) => {
      const leaf = svgElement("g");
      leaf.appendChild(svgElement("rect", { x: x - 12, y: leafY - 12, width: 24, height: 24, rx: 2, fill: PAPER, stroke: color, "stroke-width": 1 }));
      leaf.appendChild(label(x, leafY, "x²", {
        fill: color, "font-size": 9, "font-weight": 800, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(leaf, 430 + index * 35));
    });
    let nodes = leaves.map((x) => ({ x, y: leafY }));
    [leafY + 54, leafY + 102, leafY + 146].forEach((nextY, level) => {
      const next = [];
      for (let index = 0; index < nodes.length; index += 2) {
        const targetX = (nodes[index].x + nodes[index + 1].x) / 2;
        storyArrow(parent, `M ${nodes[index].x} ${nodes[index].y + 13} L ${targetX} ${nextY - 10}`, color, 650 + level * 220 + index * 32, 1.1);
        storyArrow(parent, `M ${nodes[index + 1].x} ${nodes[index + 1].y + 13} L ${targetX} ${nextY - 10}`, color, 680 + level * 220 + index * 32, 1.1);
        const sum = svgElement("g");
        sum.appendChild(svgElement("circle", { cx: targetX, cy: nextY, r: level === 2 ? 12 : 9, fill: level === 2 ? color : PAPER, stroke: color, "stroke-width": 1.1 }));
        sum.appendChild(label(targetX, nextY, "+", {
          fill: level === 2 ? "#fffdf7" : color, "font-size": 9, "font-weight": 850,
          "text-anchor": "middle", "dominant-baseline": "middle",
        }));
        parent.appendChild(motion(sum, 760 + level * 220 + index * 30));
        next.push({ x: targetX, y: nextY });
      }
      nodes = next;
    });
    return nodes[0];
  };
  const norm = drawKernelStory("norm", {
    sectionOne: true,
    drawAligned: (parent) => {
      // The repair is a left-to-right pipeline; center its full footprint,
      // including the output row, rather than centering only the reduction tree.
      const flow = svgElement("g", { transform: "translate(-52 0)" });
      parent.appendChild(flow);
      parent = flow;
      storyText(parent, 190, 108, "PRE-SUMMED BF16 x", train, { "font-size": 9.5, "font-weight": 850 });
      addMatrixGlyph(parent, 190, 145, 1, 6, train, { cellWidth: 18, cellHeight: 16, gap: 3 });
      storyText(parent, 770, 108, "h + r", infer, { "font-size": 9.5, "font-weight": 850 });
      addMatrixGlyph(parent, 720, 137, 1, 4, infer, { cellWidth: 15, cellHeight: 12, gap: 3 });
      addMatrixGlyph(parent, 720, 165, 1, 4, infer, { cellWidth: 15, cellHeight: 12, gap: 3, delay: 60 });
      const plus = svgElement("g");
      plus.appendChild(svgElement("circle", { cx: 784, cy: 151, r: 14, fill: infer }));
      plus.appendChild(label(784, 156, "+", { fill: "#fffdf7", "font-size": 11, "font-weight": 850, "text-anchor": "middle" }));
      parent.appendChild(motion(plus, 140));
      addCastBadge(parent, 832, 151, infer, 220);
      storyArrow(parent, "M 798 151 H 808", infer, 220, 1.6);
      storyArrow(parent, "M 252 145 C 300 154 326 174 336 216", train, 260, 1.6);
      storyArrow(parent, "M 832 162 V 176 C 720 176 620 190 524 216", infer, 260, 1.6);
      storyText(parent, 430, 202, "BF16 x", TEAL_DARK, { "font-size": 9.5, "font-weight": 850 });
      addMatrixGlyph(parent, 430, 225, 1, 8, TEAL_DARK, { cellWidth: 20, cellHeight: 18, gap: 4, delay: 330 });
      storyText(parent, 430, 260, "FP32 SQUARES · FIXED REDUCTION ORDER · 8 VALUES SHOWN", TEAL_DARK, {
        "font-size": 8.4, "font-weight": 800, storyTier: "claim",
      });
      const root = addExplicitNormTree(parent, 430, 282, TEAL_DARK);
      storyArrow(parent, `M ${root.x + 14} ${root.y} H 542`, TEAL_DARK, 1400, 1.8);
      const mean = svgElement("g");
      mean.appendChild(svgElement("rect", { x: 544, y: root.y - 18, width: 52, height: 36, rx: 18, fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.3 }));
      mean.appendChild(label(570, root.y, "(Σ/d)+ε", {
        fill: TEAL_DARK, "font-size": 9, "font-weight": 850, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(mean, 1460));
      storyArrow(parent, `M 598 ${root.y} H 624`, TEAL_DARK, 1530, 1.5);
      const rsqrt = svgElement("g");
      rsqrt.appendChild(svgElement("circle", { cx: 646, cy: root.y, r: 20, fill: TEAL_DARK, stroke: TEAL_DARK, "stroke-width": 1.3 }));
      rsqrt.appendChild(label(646, root.y, "rsqrt", {
        fill: "#fffdf7", "font-size": 9, "font-weight": 850, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(rsqrt, 1580));
      storyArrow(parent, `M 668 ${root.y} H 675`, TEAL_DARK, 1640, 1.5);
      const multiply = svgElement("g");
      multiply.appendChild(svgElement("rect", { x: 676, y: root.y - 21, width: 96, height: 42, rx: 21, fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.3 }));
      multiply.appendChild(label(724, root.y, "× x × scale", {
        fill: TEAL_DARK, "font-size": 9, "font-weight": 850, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(multiply, 1700));
      storyArrow(parent, `M 526 225 C 646 246 744 322 724 ${root.y - 20}`, TEAL_DARK, 760, 1.25);
      storyArrow(parent, `M 774 ${root.y} H 783`, TEAL_DARK, 1780, 1.4);
      addCastBadge(parent, 808, root.y, TEAL_DARK, 1840);
      storyArrow(parent, `M 833 ${root.y} H 847`, TEAL_DARK, 1880, 1.4);
      addResultValue(parent, 888, root.y, TEAL_DARK, { kind: "vector", delay: 1920 });
      storyText(parent, 888, root.y + 34, "BF16 OUTPUT ROW", TEAL_DARK, { "font-size": 8.4, "font-weight": 850 });
    },
  });

  const addBatchShape = (parent, cx, cy, color, rows, labelText, delay = 0) => {
    const highlighted = Array.from({ length: 4 }, (_value, column) => (rows - 1) * 4 + column);
    addMatrixGlyph(parent, cx, cy, rows, 4, color, {
      cellWidth: 16, cellHeight: rows === 1 ? 18 : 11, gap: 3, delay, highlighted,
    });
    storyText(parent, cx, cy + (rows === 1 ? 32 : 52), labelText, color, { "font-size": 8.2, "font-weight": 800 });
  };
  const addFixedKOrder = (parent) => {
    storyText(parent, 480, 244, "SAME K ORDER · ONE FP32 ACCUMULATOR", TEAL_DARK, {
      "font-size": 8.9, "font-weight": 850, "letter-spacing": 0.35, storyTier: "claim",
    });
    const slabXs = [330, 390, 450, 510, 570, 630];
    const slabLabels = ["0–63", "64–127", "128–191", "192–255", "…", "[K−64,K)"];
    slabXs.forEach((x, index) => {
      const cellDelay = 360 + index * 70;
      parent.appendChild(motion(svgElement("rect", {
        x: x - 25, y: 270, width: 50, height: 34, rx: 3,
        fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.1,
      }), cellDelay));
      motionText(parent, x, 291, slabLabels[index], TEAL_DARK, cellDelay, {
        "font-size": 7, "font-weight": 800, storyTier: "micro",
      });
    });
    const accXs = slabXs;
    const initial = svgElement("g");
    initial.appendChild(svgElement("circle", { cx: 270, cy: 364, r: 14, fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.2 }));
    initial.appendChild(label(270, 364, "a₀", {
      fill: TEAL_DARK, "font-size": 9, "font-weight": 850, "text-anchor": "middle",
      "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(initial, 560));
    storyArrow(parent, "M 286 364 H 314", TEAL_DARK, 610, 1.6);
    accXs.forEach((x, index) => {
      storyArrow(parent, `M ${slabXs[index]} 306 V 348`, TEAL_DARK, 600 + index * 80, 1.1);
      const acc = svgElement("g");
      acc.appendChild(svgElement("circle", {
        cx: x, cy: 364, r: 14, fill: index === accXs.length - 1 ? TEAL_DARK : PAPER,
        stroke: TEAL_DARK, "stroke-width": 1.2,
      }));
      acc.appendChild(label(x, 364, `a${index + 1}`, {
        fill: index === accXs.length - 1 ? "#fffdf7" : TEAL_DARK,
        "font-size": 9, "font-weight": 850, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(acc, 690 + index * 90));
      if (index < accXs.length - 1) storyArrow(parent, `M ${x + 16} 364 H ${accXs[index + 1] - 16}`, TEAL_DARK, 760 + index * 90, 1.7);
    });
    storyText(parent, 480, 405, "START AT ZERO · ADD EACH K SLAB INTO ONE FP32 ACCUMULATOR", TEAL_DARK, {
      "font-size": 8.5, "font-weight": 800,
    });
    storyArrow(parent, "M 646 364 H 698", TEAL_DARK, 1260, 1.7);
    addCastBadge(parent, 721, 364, TEAL_DARK, 1320);
    storyArrow(parent, "M 746 364 H 793", TEAL_DARK, 1380, 1.5);
    addResultValue(parent, 820, 364, TEAL_DARK, { kind: "scalar", delay: 1440 });
    storyText(parent, 820, 395, "ONE BF16 OUTPUT", TEAL_DARK, { "font-size": 8.5, "font-weight": 850 });
  };
  const gemm = drawKernelStory("gemm", {
    sectionOne: true,
    drawAligned: (parent) => {
      storyText(parent, 150, 106, "TRAIN · MANY ROWS", train, {
        "font-size": 9.5, "font-weight": 850, storyTier: "lane",
      });
      addBatchShape(parent, 150, 164, train, 5, "ONE PACKED ROW");
      storyText(parent, 810, 106, "SERVE · ONE ROW", infer, {
        "font-size": 9.5, "font-weight": 850, storyTier: "lane",
      });
      addBatchShape(parent, 810, 164, infer, 1, "ONE DECODE ROW");
      storyArrow(parent, "M 188 170 C 250 180 278 198 286 220 V 280 C 298 290 316 298 330 298", train, 120, 1.5);
      storyArrow(parent, "M 772 170 C 710 180 682 198 674 220 V 280 C 662 290 644 298 630 298", infer, 120, 1.5);
      const fixedOrder = svgElement("g", { transform: "translate(0 28)" });
      parent.appendChild(fixedOrder);
      addFixedKOrder(fixedOrder);
    },
  });
  delete gemm.mismatch;

  const addSwiNode = (parent, cx, cy, width, text, color, delay = 0, filled = false) => {
    const height = 44;
    const group = svgElement("g");
    group.appendChild(svgElement("rect", {
      x: cx - width / 2, y: cy - height / 2, width, height, rx: height / 2,
      fill: filled ? color : PAPER, stroke: color, "stroke-width": 1.7,
    }));
    group.appendChild(label(cx, cy, text, {
      fill: filled ? "#fffdf7" : color,
      "font-size": 10.5, "font-weight": 850,
      "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(group, delay));
    return {
      left: cx - width / 2, right: cx + width / 2,
      top: cy - height / 2, bottom: cy + height / 2, cx, cy,
      ports: {
        left: { x: cx - width / 2, y: cy }, right: { x: cx + width / 2, y: cy },
        top: { x: cx, y: cy - height / 2 }, bottom: { x: cx, y: cy + height / 2 },
      },
    };
  };
  const addSwiIntermediate = (parent, cx, cy, color, rounded, delay = 0) => {
    const group = svgElement("g");
    group.appendChild(svgElement("circle", {
      cx, cy, r: 24, fill: rounded ? color : PAPER,
      stroke: color, "stroke-width": 1.7,
    }));
    group.appendChild(label(cx, cy, rounded ? "BF16" : "FP32", {
      fill: rounded ? "#fffdf7" : color,
      "font-size": 9.5, "font-weight": 850,
      "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(group, delay));
  };
  const addSwiGluProgram = (parent, cx, color, intermediateRound, title, delay = 0) => {
    const gateX = cx - 120;
    const upX = cx + 72;
    const intermediateX = cx - 28;
    const multiplyX = cx + 72;
    const castX = cx + 146;
    storyText(parent, cx, 120, title, color, {
      "font-weight": 850, "letter-spacing": 0.45, storyTier: "lane",
    });
    storyText(parent, cx, 146, "y = SiLU(gate) × up", color, {
      "font-size": 10.5, "font-weight": 700,
    });

    storyText(parent, gateX, 169, "gate · BF16", color, { "font-weight": 800 });
    addResultValue(parent, gateX, 194, color, { kind: "vector", delay });
    storyText(parent, upX, 169, "up · BF16", color, { "font-weight": 800 });
    addResultValue(parent, upX, 194, color, { kind: "vector", delay: delay + 90 });

    storyArrow(parent, `M ${gateX} 207 V 238`, color, delay + 170, 1.8);
    addSwiNode(parent, gateX, 267, 120, "SiLU · FP32", color, delay + 270);
    storyArrow(parent, `M ${gateX + 61} 267 H ${intermediateX - 26}`, color, delay + 390, 1.8);
    addSwiIntermediate(parent, intermediateX, 267, color, intermediateRound, delay + 500);
    storyText(parent, intermediateX + 8, 311, intermediateRound ? "ROUND ①" : "NO ROUND", color, {
      "font-size": 9.5, "font-weight": 800, "text-anchor": "end",
    });

    storyArrow(parent, `M ${intermediateX + 17} 284 C ${intermediateX + 30} 323 ${multiplyX - 42} 334 ${multiplyX - 28} 357`,
      color, delay + 620, 1.8);
    storyArrow(parent, `M ${upX} 207 V 330`, color, delay + 690, 1.8);
    addSwiNode(parent, multiplyX, 361, 54, "×", color, delay + 800, true);
    storyArrow(parent, `M ${multiplyX + 28} 361 H ${castX - 25}`, color, delay + 920, 1.9);
    addCastBadge(parent, castX, 361, color, delay + 1040);
    const finalRoundLabelX = castX + (cx < 480 ? 50 : -70);
    storyText(parent, finalRoundLabelX, 401, intermediateRound ? "ROUND ②" : "ONE BF16 CAST", color, {
      "font-size": 9.5, "font-weight": 800,
      "text-anchor": cx < 480 ? "start" : "end",
    });

    storyArrow(parent, `M ${castX} 374 V 418 C ${castX} 435 ${multiplyX} 435 ${multiplyX} 451`,
      color, delay + 1160, 1.8);
    addResultValue(parent, multiplyX, 462, color, { kind: "vector", delay: delay + 1280 });
    storyText(parent, multiplyX, 501, "y · BF16", color, { "font-weight": 850 });
  };
  const addStoryChip = (parent, cx, cy, width, text, color, delay = 0, options = {}) => {
    const height = options.height || 30;
    const filled = options.filled || false;
    const sectionOne = isSectionOneStory(parent);
    const fontSize = sectionOne
      ? Math.max(options.fontSize || 9.3, 10)
      : options.fontSize || 9.3;
    const group = svgElement("g");
    group.appendChild(svgElement("rect", {
      x: cx - width / 2, y: cy - height / 2, width, height, rx: options.rx || 6,
      fill: filled ? color : PAPER, stroke: color, "stroke-width": options.strokeWidth || 1.25,
      opacity: options.opacity || 1,
    }));
    const centered = options.baseline === undefined;
    group.appendChild(label(cx, centered ? cy : cy + options.baseline, text, {
      fill: filled ? "#fffdf7" : color,
      "font-size": fontSize,
      "font-weight": options.fontWeight || 820,
      "letter-spacing": options.letterSpacing || 0.25,
      "text-anchor": "middle",
      ...(centered ? { "dominant-baseline": "middle" } : {}),
    }));
    parent.appendChild(motion(group, delay));
    return {
      left: cx - width / 2, right: cx + width / 2,
      top: cy - height / 2, bottom: cy + height / 2, cx, cy,
      ports: {
        left: { x: cx - width / 2, y: cy }, right: { x: cx + width / 2, y: cy },
        top: { x: cx, y: cy - height / 2 }, bottom: { x: cx, y: cy + height / 2 },
      },
    };
  };

  const addPairwiseTree = (parent, leafXs, leafY, color, delay = 0, options = {}) => {
    const levelGap = options.levelGap || 30;
    const nodeRadius = options.nodeRadius || 4;
    const identityIndices = new Set(options.identityIndices || []);
    let nodes = leafXs.map((x, index) => {
      parent.appendChild(motion(svgElement("circle", {
        cx: x, cy: leafY, r: nodeRadius,
        fill: identityIndices.has(index) ? PAPER : color,
        stroke: color, "stroke-width": 1,
      }), delay + index * 32));
      return { x, y: leafY };
    });
    let level = 0;
    while (nodes.length > 1) {
      const next = [];
      const nextY = leafY + (level + 1) * levelGap;
      for (let index = 0; index < nodes.length; index += 2) {
        const leftNode = nodes[index];
        const rightNode = nodes[index + 1];
        const targetX = (leftNode.x + rightNode.x) / 2;
        storyArrow(parent, `M ${leftNode.x} ${leftNode.y + nodeRadius + 1} L ${targetX} ${nextY - nodeRadius - 1}`,
          color, delay + 170 + level * 180 + index * 20, 0.9);
        storyArrow(parent, `M ${rightNode.x} ${rightNode.y + nodeRadius + 1} L ${targetX} ${nextY - nodeRadius - 1}`,
          color, delay + 200 + level * 180 + index * 20, 0.9);
        parent.appendChild(motion(svgElement("circle", {
          cx: targetX, cy: nextY, r: nodeRadius,
          fill: nodes.length === 2 ? color : PAPER,
          stroke: color, "stroke-width": 1,
        }), delay + 280 + level * 180 + index * 20));
        next.push({ x: targetX, y: nextY });
      }
      nodes = next;
      level += 1;
    }
    return nodes[0];
  };

  const addHeadLogitWindow = (parent, cx, color, blocksPerGroup, delay = 0) => {
    const count = 8;
    const blockWidth = 27;
    const gap = 5;
    const start = cx - (count * blockWidth + (count - 1) * gap) / 2;
    const selectedBlock = 4;
    for (let index = 0; index < count; index += 1) {
      parent.appendChild(motion(svgElement("rect", {
        x: start + index * (blockWidth + gap), y: 174,
        width: blockWidth, height: 48, rx: 2,
        fill: index === selectedBlock ? color : PAPER,
        stroke: color, "stroke-width": index === selectedBlock ? 1.5 : 0.9,
        opacity: index === selectedBlock ? 0.82 : 1,
      }), delay + index * 38));
    }
    motionText(parent, start + selectedBlock * (blockWidth + gap) + blockWidth / 2, 166,
      "SELECTED LOGIT zᵧ", color, delay + 360, { "font-size": 8.5, "font-weight": 850 });

    const recordXs = [];
    const groups = count / blocksPerGroup;
    for (let groupIndex = 0; groupIndex < groups; groupIndex += 1) {
      const left = start + groupIndex * blocksPerGroup * (blockWidth + gap) - 3;
      const right = start + (groupIndex * blocksPerGroup + blocksPerGroup - 1) * (blockWidth + gap) + blockWidth + 3;
      const groupCenter = (left + right) / 2;
      parent.appendChild(motion(svgElement("path", {
        d: `M ${left} 229 V 238 H ${right} V 229`,
        fill: "none", stroke: color, "stroke-width": 1.25,
      }), delay + 420 + groupIndex * 70));
      storyArrow(parent, `M ${groupCenter} 240 V 261`, color, delay + 500 + groupIndex * 70, 1.1);
      addStoryChip(parent, groupCenter, 276, 54, "(m, l)", color,
        delay + 610 + groupIndex * 70, { height: 24, fontSize: 8.4, rx: 12 });
      recordXs.push(groupCenter);
    }
    return recordXs;
  };

  const addHeadGroupingLane = (parent, cx, color, blocksPerGroup) => {
    const width = blocksPerGroup * 64;
    storyText(parent, cx, 128, `${width} LOGITS / GROUP`, color, {
      "font-size": 9.6, "font-weight": 850, "letter-spacing": 0.35,
    });
    const recordXs = addHeadLogitWindow(parent, cx, color, blocksPerGroup, 80);
    const root = addPairwiseTree(parent, recordXs, 316, color, 900, {
      levelGap: blocksPerGroup === 4 ? 42 : 32,
      nodeRadius: 4.2,
    });
    const lseY = 397;
    if (root.y < lseY - 18) storyArrow(parent, `M ${root.x} ${root.y + 6} V ${lseY - 17}`, color, 1510, 1.3);
    addStoryChip(parent, cx, lseY, 126, "LOG-SUM-EXP", color, 1660, { height: 28, filled: true });
    storyArrow(parent, `M ${cx} ${lseY + 16} V 429`, color, 1800, 1.5);
    motionText(parent, cx, 445, "log p(y) = zᵧ − LOG-SUM-EXP", color, 1910, {
      "font-size": 8.8, "font-weight": 850,
    });
    addResultValue(parent, cx, 480, color, { kind: "scalar", delay: 2080 });
    motionText(parent, cx, 511, "FP32 log p(y)", color, 2290, {
      "font-size": 8.5, "font-weight": 820,
    });
  };

  const addHeadExactProgram = (parent) => {
    storyText(parent, 170, 92, "XORL · MANY ROWS", train, {
      "font-size": 10.2, "font-weight": 850, "letter-spacing": 0.7, storyTier: "lane",
    });
    storyText(parent, 790, 92, "SGLANG · ONE ROW", infer, {
      "font-size": 10.2, "font-weight": 850, "letter-spacing": 0.7, storyTier: "lane",
    });
    [112, 151, 190, 229].forEach((x, index) => {
      parent.appendChild(motion(svgElement("rect", {
        x, y: 112, width: 31, height: 34, rx: 2,
        fill: PAPER, stroke: train, "stroke-width": 1,
      }), index * 45));
    });
    motionText(parent, 171, 162, "FP32 GEMM ACCUMULATORS", train, 240, {
      "font-size": 8.7, "font-weight": 820,
    });
    motionText(parent, 171, 184, "SELECTED zᵧ · LOG-SUM-EXP · LOG p(y)", train, 300, {
      "font-size": 8.2, "font-weight": 760,
    });

    for (let index = 0; index < 8; index += 1) {
      parent.appendChild(motion(svgElement("rect", {
        x: 675 + index * 28, y: 116, width: 22, height: 26, rx: 1.5,
        fill: index === 4 ? infer : PAPER,
        stroke: infer, "stroke-width": 1,
        opacity: index === 4 ? 0.82 : 1,
      }), index * 40));
    }
    motionText(parent, 784, 162, "FULL FP32 LOGITS", infer, 340, {
      "font-size": 8.7, "font-weight": 820,
    });
    motionText(parent, 784, 184, "STORE LOGITS · SAMPLE TOKEN y", infer, 400, {
      "font-size": 8.2, "font-weight": 760,
    });

    storyArrow(parent, "M 248 132 C 325 132 362 166 419 166", train, 440, 1.5);
    storyArrow(parent, "M 666 132 C 604 132 578 166 541 166", infer, 500, 1.5);
    addStoryChip(parent, 480, 166, 184, "SAME FP32 LOGITS", TEAL_DARK, 650, {
      height: 32, filled: true, fontSize: 9.8,
    });
    storyArrow(parent, "M 480 183 V 437", TEAL_DARK, 2140, 1.05);

    storyText(parent, 250, 214, "ONE 256-LOGIT GROUP", TEAL_DARK, {
      "font-size": 9.5, "font-weight": 850, "letter-spacing": 0.5,
    });
    const blockStart = 184;
    for (let index = 0; index < 4; index += 1) {
      parent.appendChild(motion(svgElement("rect", {
        x: blockStart + index * 36, y: 229, width: 30, height: 34, rx: 2,
        fill: index === 2 ? TEAL_DARK : PAPER,
        stroke: TEAL_DARK, "stroke-width": 1,
        opacity: index === 2 ? 0.78 : 1,
      }), 760 + index * 50));
    }
    motionText(parent, 250, 280, "m = max(z)", TEAL_DARK, 940, {
      "font-size": 8.8, "font-weight": 820,
    });
    motionText(parent, 250, 299, "FIXED FP32 SUM OF exp(z − m)", TEAL_DARK, 1010, {
      "font-size": 8.4, "font-weight": 800,
    });
    const localLeaves = Array.from({ length: 8 }, (_value, index) => 176 + index * 21);
    const localRoot = addPairwiseTree(parent, localLeaves, 319, TEAL_DARK, 1120, {
      levelGap: 22, nodeRadius: 3.2,
    });
    storyArrow(parent, `M ${localRoot.x} ${localRoot.y + 5} V 399`, TEAL_DARK, 1840, 1.2);
    addStoryChip(parent, 250, 414, 74, "(m, l)", TEAL_DARK, 1950, {
      height: 26, filled: true, rx: 13,
    });

    storyText(parent, 704, 214, "SAME GROUP-SUMMARY REDUCTION", TEAL_DARK, {
      "font-size": 9.5, "font-weight": 850, "letter-spacing": 0.45,
    });
    const globalLeaves = Array.from({ length: 16 }, (_value, index) => 584 + index * 16);
    const globalRoot = addPairwiseTree(parent, globalLeaves, 250, TEAL_DARK, 980, {
      levelGap: 27, nodeRadius: 3,
      identityIndices: [15],
    });
    motionText(parent, 810, 374, "REDUCE WITH THE SAME ORDER", TEAL_DARK, 1900, {
      "font-size": 8.7, "font-weight": 830,
    });
    storyArrow(parent, `M ${globalRoot.x} ${globalRoot.y + 5} V 399`, TEAL_DARK, 1960, 1.25);
    addStoryChip(parent, 704, 414, 126, "LOG-SUM-EXP", TEAL_DARK, 2070, {
      height: 26, filled: true, rx: 13,
    });
    storyArrow(parent, "M 666 414 C 610 414 588 454 540 454", TEAL_DARK, 2180, 1.25);
    addStoryChip(parent, 480, 454, 300, "log p(y) = zᵧ − LOG-SUM-EXP", TEAL_DARK, 2290, {
      height: 32, filled: true, fontSize: 8.8,
    });
    storyArrow(parent, "M 480 471 V 489", TEAL_DARK, 2370, 1.4);
    addResultValue(parent, 480, 498, TEAL_DARK, { kind: "scalar", delay: 2420 });
    motionText(parent, 480, 526, "FP32 log p(y)", TEAL_DARK, 2650, {
      "font-size": 8.6, "font-weight": 830,
    });
  };

  const ensureQwenArrowMarker = (parent) => {
    const svg = parent.ownerSVGElement;
    const markerId = svg.id + "-qwen-arrow";
    if (svg.querySelector("#" + markerId)) return markerId;
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = svgElement("defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    const marker = svgElement("marker", {
      id: markerId,
      viewBox: "0 0 8 8",
      refX: 7,
      refY: 4,
      markerWidth: 6,
      markerHeight: 6,
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    marker.appendChild(svgElement("path", {
      d: "M 0 0 L 8 4 L 0 8 Z",
      fill: "context-stroke",
    }));
    defs.appendChild(marker);
    return markerId;
  };

  const qwenArrow = (parent, d, color, delay = 0, width = 1.5) => {
    const markerId = ensureQwenArrowMarker(parent);
    const path = wire(d, {
      stroke: color,
      "stroke-width": width,
      pathLength: 1,
    });
    path.setAttribute("class", "kernel-story-path");
    path.style.setProperty("--story-delay", delay + "ms");
    parent.appendChild(path);

    // A full-size marker can consume an entire connector when two nodes are
    // only a few pixels apart, leaving what looks like a detached triangle.
    // Keep those short boundary-to-boundary links as plain directed rails;
    // the surrounding vertical/horizontal ordering already supplies direction.
    if (path.getTotalLength() < 14) return;

    // SVG markers are not clipped by a path's dash-offset reveal. Keeping the
    // marker on the drawing path therefore paints the arrowhead before the
    // line reaches it. A coincident terminal layer appears only after the
    // draw-on transition completes; its stroke simply overlays the finished
    // line while its marker supplies the correctly timed arrowhead.
    const arrowhead = wire(d, {
      stroke: color,
      "stroke-width": width,
      "marker-end": "url(#" + markerId + ")",
      "aria-hidden": "true",
    });
    arrowhead.setAttribute("class", "kernel-story-arrowhead");
    arrowhead.style.setProperty("--story-delay", delay + "ms");
    parent.appendChild(arrowhead);
  };

  const addQwenCellRow = (parent, cx, cy, values, color, delay = 0, options = {}) => {
    const width = options.width || 28;
    const height = options.height || 24;
    const gap = options.gap ?? 6;
    const start = cx - (values.length * width + (values.length - 1) * gap) / 2;
    const filled = new Set(options.filled || []);
    const muted = new Set(options.muted || []);
    const centers = [];
    values.forEach((value, index) => {
      const group = svgElement("g");
      const x = start + index * (width + gap);
      group.appendChild(svgElement("rect", {
        x,
        y: cy - height / 2,
        width,
        height,
        rx: options.rx || 3,
        fill: filled.has(index) ? color : PAPER,
        stroke: color,
        "stroke-width": index === options.focus ? 2 : 1,
        opacity: muted.has(index) ? 0.38 : 1,
      }));
      if (value !== "") {
        group.appendChild(label(x + width / 2, cy, value, {
          fill: filled.has(index) ? "#fffdf7" : color,
          "font-size": options.fontSize || 9.2,
          "font-weight": 820,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
        }));
      }
      parent.appendChild(motion(group, delay + index * (options.stagger || 45)));
      centers.push(x + width / 2);
    });
    return centers;
  };

  const addQwenStateGlyph = (parent, cx, cy, color, text, delay = 0, options = {}) => {
    const group = svgElement("g");
    const cell = options.cell || 9;
    const gap = 2;
    const size = 3 * cell + 2 * gap;
    const left = cx - size / 2;
    const top = cy - size / 2;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const index = row * 3 + column;
        group.appendChild(svgElement("rect", {
          x: left + column * (cell + gap),
          y: top + row * (cell + gap),
          width: cell,
          height: cell,
          rx: 1.2,
          fill: index === options.hot ? RED : color,
          "fill-opacity": index === options.hot ? 0.85 : 0.16 + ((index * 3) % 5) * 0.12,
          stroke: index === options.hot ? RED_DARK : color,
          "stroke-width": index === options.hot ? 1.3 : 0.7,
        }));
      }
    }
    group.appendChild(label(cx, cy + size / 2 + 17, text, {
      fill: color,
      "font-size": 9.4,
      "font-weight": 850,
      "text-anchor": "middle",
    }));
    parent.appendChild(motion(group, delay));
    return { left, right: left + size, top, bottom: top + size, cx, cy };
  };

  const addCausalTriangle = (parent, cx, cy, color, delay = 0, options = {}) => {
    const rows = options.rows || 6;
    const cell = options.cell || 14;
    const gap = options.gap ?? 3;
    const size = rows * cell + (rows - 1) * gap;
    const left = cx - size / 2;
    const top = cy - size / 2;
    for (let row = 0; row < rows; row += 1) {
      const rowGroup = svgElement("g");
      for (let column = 0; column < rows; column += 1) {
        const active = column <= row;
        rowGroup.appendChild(svgElement("rect", {
          x: left + column * (cell + gap),
          y: top + row * (cell + gap),
          width: cell,
          height: cell,
          rx: 1.5,
          fill: active ? color : PAPER,
          "fill-opacity": active ? (row === options.highlightRow ? 0.74 : 0.18 + row * 0.055) : 0.42,
          stroke: active ? color : LINE,
          "stroke-opacity": active ? 1 : 0.48,
          "stroke-width": row === options.highlightRow && active ? 1.4 : 0.7,
        }));
      }
      parent.appendChild(motion(rowGroup, delay + row * 75));
    }
    if (options.maskLabel) {
      motionText(parent, left + size - 4, top + 12, "−∞", color, delay + rows * 75, {
        "font-size": 9.5,
        "font-weight": 850,
        "text-anchor": "end",
      });
    }
    return { left, right: left + size, top, bottom: top + size };
  };

  const addRouterKProgram = (parent, cx, color, mode, delay = 0) => {
    const leafXs = Array.from({ length: 8 }, (_value, index) => cx - 126 + index * 36);
    leafXs.forEach((x, index) => {
      const group = svgElement("g");
      group.appendChild(svgElement("circle", {
        cx: x,
        cy: 126,
        r: 9,
        fill: PAPER,
        stroke: color,
        "stroke-width": 1,
      }));
      group.appendChild(label(x, 129.5, String(index), {
        fill: color,
        "font-size": 9.1,
        "font-weight": 800,
        "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 35));
    });
    if (mode === "tree") {
      return addPairwiseTree(parent, leafXs, 146, color, delay + 220, {
        levelGap: 20,
        nodeRadius: 4.5,
      });
    }
    let previous = null;
    leafXs.forEach((x, index) => {
      const nodeX = x;
      const nodeY = 194;
      storyArrow(parent, "M " + x + " 137 V " + (nodeY - 9), color, delay + 210 + index * 50, 0.9);
      if (previous) {
        storyArrow(parent, "M " + (previous.x + 8) + " " + nodeY + " H " + (nodeX - 9), color,
          delay + 280 + index * 55, 1.15);
      }
      const group = svgElement("g");
      group.appendChild(svgElement("circle", {
        cx: nodeX,
        cy: nodeY,
        r: 8,
        fill: index === leafXs.length - 1 ? color : PAPER,
        stroke: color,
        "stroke-width": 1,
      }));
      group.appendChild(label(nodeX, nodeY + 3.5, index ? "+" : "a", {
        fill: index === leafXs.length - 1 ? "#fffdf7" : color,
        "font-size": 9,
        "font-weight": 850,
        "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + 300 + index * 55));
      previous = { x: nodeX, y: nodeY };
    });
    return previous;
  };

  const addScoreCutoff = (parent, cx, cy, color, swap, delay = 0) => {
    const group = svgElement("g");
    const bottom = cy + 35;
    const heights = swap ? [38, 54] : [54, 38];
    const labels = ["eₐ", "eᵦ"];
    heights.forEach((height, index) => {
      const selected = height > 45;
      const x = cx - 37 + index * 50;
      group.appendChild(svgElement("rect", {
        x,
        y: bottom - height,
        width: 24,
        height,
        rx: 2,
        fill: selected ? color : PAPER,
        "fill-opacity": selected ? 0.78 : 1,
        stroke: color,
        "stroke-width": 1.2,
      }));
      group.appendChild(label(x + 12, bottom + 16, labels[index], {
        fill: color,
        "font-size": 9.4,
        "font-weight": 820,
        "text-anchor": "middle",
      }));
    });
    group.appendChild(svgElement("line", {
      x1: cx - 50,
      y1: bottom - 46,
      x2: cx + 50,
      y2: bottom - 46,
      stroke: RED_DARK,
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
    }));
    group.appendChild(label(cx, bottom - 60, "TOP-8 CUTOFF", {
      fill: color,
      "font-size": 9.3,
      "font-weight": 850,
      "letter-spacing": 0.45,
      "text-anchor": "middle",
    }));
    parent.appendChild(motion(group, delay));
  };

  const addSelectedDenominator = (parent, cx, color, mode, delay = 0) => {
    const values = ["p₀", "p₁", "p₂", "p₃", "p₄", "p₅", "p₆", "p₇"];
    const leafXs = addQwenCellRow(parent, cx, 338, values, color, delay, {
      width: 28,
      height: 24,
      gap: 7,
      fontSize: 9,
    });
    if (mode === "tree") {
      return addPairwiseTree(parent, leafXs, 356, color, delay + 250, {
        levelGap: 18,
        nodeRadius: 4.2,
      });
    }
    let previous = null;
    leafXs.forEach((x, index) => {
      const nodeY = 406;
      storyArrow(parent, "M " + x + " 350 V " + (nodeY - 7), color, delay + 220 + index * 45, 0.85);
      if (previous) {
        storyArrow(parent, "M " + (previous.x + 6) + " " + nodeY + " H " + (x - 7), color,
          delay + 300 + index * 50, 1);
      }
      const group = svgElement("g");
      group.appendChild(svgElement("circle", {
        cx: x,
        cy: nodeY,
        r: 6,
        fill: index === leafXs.length - 1 ? color : PAPER,
        stroke: color,
        "stroke-width": 1,
      }));
      group.appendChild(label(x, nodeY + 3, index ? "+" : "a", {
        fill: index === leafXs.length - 1 ? "#fffdf7" : color,
        "font-size": 8,
        "font-weight": 850,
        "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + 330 + index * 50));
      previous = { x, y: nodeY };
    });
    return previous;
  };

  const addRankRow = (parent, cx, cy, color, delay = 0, reverse = false) => {
    const ranks = Array.from({ length: 8 }, (_value, index) => reverse ? 7 - index : index);
    return addQwenCellRow(parent, cx, cy, ranks.map((rank) => "p" + rank), color, delay, {
      width: 31,
      height: 26,
      gap: 7,
      fontSize: 9.2,
    });
  };

  const addBf16CombineTree = (parent, cx, color, delay = 0, options = {}) => {
    const leafY = options.leafY || 142;
    const firstLevelGap = options.firstLevelGap || 68;
    const levelGap = options.levelGap || 62;
    const leafXs = addRankRow(parent, cx, leafY, color, delay);
    if (typeof options.onLeaves === "function") options.onLeaves(leafXs, leafY - 13);
    let nodes = leafXs.map((x) => ({ x, y: leafY + 13 }));
    let level = 0;
    while (nodes.length > 1) {
      const next = [];
      const y = leafY + firstLevelGap + level * levelGap;
      for (let index = 0; index < nodes.length; index += 2) {
        const leftNode = nodes[index];
        const rightNode = nodes[index + 1];
        const x = (leftNode.x + rightNode.x) / 2;
        storyArrow(parent, "M " + leftNode.x + " " + leftNode.y + " L " + x + " " + (y - 13), color,
          delay + 260 + level * 220 + index * 30, 1);
        storyArrow(parent, "M " + rightNode.x + " " + rightNode.y + " L " + x + " " + (y - 13), color,
          delay + 300 + level * 220 + index * 30, 1);
        const group = svgElement("g");
        group.appendChild(svgElement("circle", {
          cx: x,
          cy: y,
          r: 12,
          fill: level === 2 ? color : PAPER,
          stroke: color,
          "stroke-width": 1.2,
        }));
        group.appendChild(label(x, y + 4, "+", {
          fill: level === 2 ? "#fffdf7" : color,
          "font-size": 11,
          "font-weight": 850,
          "text-anchor": "middle",
        }));
        parent.appendChild(motion(group, delay + 390 + level * 220 + index * 30));
        next.push({ x, y: y + 13 });
      }
      nodes = next;
      level += 1;
    }
    return nodes[0];
  };

  const addBf16OrderedFold = (parent, cx, cy, color, delay = 0, options = {}) => {
    const step = options.step || 39;
    const start = cx - 3.5 * step;
    const ranks = [7, 6, 5, 4, 3, 2, 1, 0];
    ranks.forEach((rank, index) => {
      const x = start + index * step;
      const group = svgElement("g");
      group.appendChild(svgElement("circle", {
        cx: x,
        cy,
        r: 11,
        fill: index === 7 ? color : PAPER,
        stroke: color,
        "stroke-width": 1.15,
      }));
      group.appendChild(label(x, cy, index ? "+" + rank : "p7", {
        fill: index === 7 ? "#fffdf7" : color,
        "font-size": index ? 8.2 : 9,
        "font-weight": 850,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 110));
      if (index) {
        const previousX = x - step;
        storyArrow(parent, "M " + (previousX + 13) + " " + cy + " H " + (x - 13), color,
          delay + index * 110 - 55, 1.25);
        parent.appendChild(motion(svgElement("line", {
          x1: x - step / 2,
          y1: cy - 9,
          x2: x - step / 2,
          y2: cy + 9,
          stroke: color,
          "stroke-width": 2,
        }), delay + index * 110 + 20));
      }
    });
    return { x: start + 7 * step, y: cy };
  };

  const addQwenRouterMismatch = (parent) => {
    storyText(parent, 250, 82, "TRAINING", train, {
      "font-size": 10, "font-weight": 800, "letter-spacing": 1,
    });
    storyText(parent, 710, 82, "SERVING", infer, {
      "font-size": 10, "font-weight": 800, "letter-spacing": 1,
    });
    storyText(parent, 480, 108, "1 · GATE PROJECTION", RED_DARK, {
      "font-size": 10.5, "font-weight": 850, "letter-spacing": 0.8,
    });
    storyText(parent, 250, 109, "K PRODUCTS · ORDER A", train, {
      "font-size": 8.8, "font-weight": 820, "letter-spacing": 0.35,
    });
    storyText(parent, 710, 109, "K PRODUCTS · ORDER B", infer, {
      "font-size": 8.8, "font-weight": 820, "letter-spacing": 0.35,
    });
    const trainRoot = addRouterKProgram(parent, 250, train, "tree", 40);
    const serveRoot = addRouterKProgram(parent, 710, infer, "chain", 40);
    // The reduction roots do not share the same x coordinate: the tree ends
    // at lane center, while the ordered fold ends at its last accumulator.
    // Route each result around the cutoff label and into the selected bar.
    qwenArrow(parent,
      "M " + trainRoot.x + " " + (trainRoot.y + 6) + " C 220 212 200 225 200 246 L 213 268",
      train, 980, 1.2);
    qwenArrow(parent,
      "M " + serveRoot.x + " " + (serveRoot.y + 8) + " C 810 220 760 222 760 246 L 747 268",
      infer, 980, 1.2);
    addScoreCutoff(parent, 250, 260, train, false, 1120);
    addScoreCutoff(parent, 710, 260, infer, true, 1120);
    addDifferenceMarker(parent, 480, 270, 1500, 22);

    storyText(parent, 480, 314, "2 · ADD THE SAME EIGHT SELECTED PROBABILITIES", RED_DARK, {
      "font-size": 9.8, "font-weight": 850, "letter-spacing": 0.55,
    });
    const trainDenom = addSelectedDenominator(parent, 250, train, "tree", 1620);
    const serveDenom = addSelectedDenominator(parent, 710, infer, "chain", 1620);
    [trainDenom, serveDenom].forEach((root, index) => {
      const cx = index ? 710 : 250;
      const color = index ? infer : train;
      if (index) {
        qwenArrow(parent,
          "M " + root.x + " " + (root.y + 7) + " C 810 420 774 437 743 437",
          color, 2520, 1.15);
      } else {
        qwenArrow(parent, "M " + root.x + " " + (root.y + 7) + " V 424.5", color, 2520, 1.15);
      }
      addStoryChip(parent, cx, 437, 66, "÷ denom", color, 2600, {
        height: 25, fontSize: 8.8, rx: 13,
      });
      qwenArrow(parent, "M " + cx + " 449.5 V 458", color, 2680, 1.1);
      addCastBadge(parent, cx, 468, color, 2740);
      addBitWord(parent, cx, 486, color, 16, 9, index, 2860);
      motionText(parent, cx, 528, "SCHEMATIC BF16 ROUTING WEIGHT", color, 3070, {
        "font-size": 9.2, "font-weight": 850,
      });
    });
    addDifferenceMarker(parent, 480, 490, 3040, 22);
  };

  const addQwenRouterExact = (parent) => {
    addCallerPair(parent, 72, 140, 116, 140, 20);
    addQwenCellRow(parent, 165, 140, ["x₀", "x₁", "…", "xK"], TEAL_DARK, 130, {
      width: 27, height: 25, gap: 5, fontSize: 8.7,
    });
    qwenArrow(parent, "M 226.5 140 H 259", TEAL_DARK, 360, 1.35);
    addMatrixGlyph(parent, 288, 140, 4, 6, TEAL_DARK, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay: 430,
    });
    qwenArrow(parent, "M 317 140 H 352", TEAL_DARK, 740, 1.35);
    addStoryChip(parent, 390, 140, 76, "FIXED K", TEAL_DARK, 820, {
      height: 32, filled: true, fontSize: 9.4, rx: 16,
    });
    qwenArrow(parent, "M 428 140 H 481", TEAL_DARK, 1040, 1.35);
    addMatrixGlyph(parent, 516, 140, 4, 8, TEAL_DARK, {
      cellWidth: 7, cellHeight: 7, gap: 2, delay: 1120,
      highlighted: [5, 9, 13, 18, 20, 23, 27, 30],
    });
    qwenArrow(parent, "M 551 140 H 571", TEAL_DARK, 1560, 1.35);
    addStoryChip(parent, 615, 140, 88, "SOFTMAX", TEAL_DARK, 1620, {
      height: 32, filled: true, fontSize: 9.2, rx: 16,
    });
    qwenArrow(parent, "M 659 140 H 675", TEAL_DARK, 1760, 1.35);
    addQwenCellRow(parent, 797, 140,
      ["e₀", "e₁", "e₂", "e₃", "e₄", "e₅", "e₆", "e₇"], TEAL_DARK, 1640, {
        width: 27, height: 25, gap: 4, fontSize: 8.6, filled: [0, 1, 2, 3, 4, 5, 6, 7],
      });
    motionText(parent, 165, 205, "BF16 HIDDEN ROW", TEAL_DARK, 480, {
      "font-size": 9, "font-weight": 830,
    });
    motionText(parent, 288, 205, "GATE WEIGHTS", TEAL_DARK, 720, {
      "font-size": 9, "font-weight": 830,
    });
    motionText(parent, 516, 205, "256 FP32 SCORES", TEAL_DARK, 1480, {
      "font-size": 9, "font-weight": 830,
    });
    motionText(parent, 615, 205, "FP32 SOFTMAX", TEAL_DARK, 1840, {
      "font-size": 9, "font-weight": 830,
    });
    motionText(parent, 797, 205, "SELECT TOP 8 PROBABILITIES", TEAL_DARK, 1940, {
      "font-size": 9, "font-weight": 830,
    });

    parent.appendChild(motion(svgElement("line", {
      x1: 80, y1: 242, x2: 880, y2: 242,
      stroke: LINE_FAINT, "stroke-width": 1,
    }), 1980));
    motionText(parent, 480, 274, "FP32 p₀…p₇ · LEFT-TO-RIGHT DENOMINATOR", TEAL_DARK, 2030, {
      "font-size": 10, "font-weight": 850, "letter-spacing": 0.5,
    });
    qwenArrow(parent, "M 919 140 C 919 218 850 234 620 242", TEAL_DARK, 1990, 1.15);
    const denominator = addSelectedDenominator(parent, 480, TEAL_DARK, "chain", 2100);
    qwenArrow(parent, "M " + (denominator.x + 6) + " " + denominator.y + " H 654", TEAL_DARK, 2950, 1.3);
    addStoryChip(parent, 690, 406, 72, "÷ denom", TEAL_DARK, 3030, {
      height: 28, fontSize: 9, rx: 14,
    });
    qwenArrow(parent, "M 726 406 H 759", TEAL_DARK, 3150, 1.3);
    addCastBadge(parent, 780, 406, TEAL_DARK, 3230);
    qwenArrow(parent, "M 801 406 C 842 406 842 478 789 478", TEAL_DARK, 3340, 1.2);
    addQwenCellRow(parent, 480, 478,
      ["{id₀,w₀}", "{id₁,w₁}", "{id₂,w₂}", "{id₃,w₃}", "{id₄,w₄}", "{id₅,w₅}", "{id₆,w₆}", "{id₇,w₇}"],
      TEAL_DARK, 3450, {
        width: 72, height: 29, gap: 6, fontSize: 8.4,
      });
    motionText(parent, 480, 523, "8 EXPERT IDS + 8 BF16 WEIGHTS", TEAL_DARK, 3940, {
      "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.45,
    });
  };
  const addQwenExpertMismatchLane = (parent, cx, color, servingProgram, delay = 0) => {
    addQwenCellRow(parent, cx - 116, 164, ["a₀", "a₁", "…", "aK"], color, delay, {
      width: 25, height: 24, gap: 5, fontSize: 8.7,
    });
    addMatrixGlyph(parent, cx - 24, 164, 4, 4, color, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay: delay + 170,
    });
    qwenArrow(parent, "M " + (cx - 58.5) + " 164 H " + (cx - 43), color, delay + 300, 1.1);
    qwenArrow(parent, "M " + (cx - 5) + " 164 H " + (cx + 35), color, delay + 430, 1.25);
    addStoryChip(parent, cx + 76, 180, 82, "FP32 ΣK", color, delay + 520, {
      height: 32, filled: true, fontSize: 9.4, rx: 16,
    });
    addStoryChip(parent, cx + 160, 126, 72, "wᵢ · BF16", color, delay + 560, {
      height: 26, fontSize: 8.8, rx: 13,
    });
    motionText(parent, cx - 116, 214, "ACTIVATION a", color, delay + 380, {
      "font-size": 9, "font-weight": 830,
    });
    motionText(parent, cx - 24, 214, "Wdown", color, delay + 460, {
      "font-size": 9, "font-weight": 830,
    });

    if (servingProgram) {
      qwenArrow(parent, "M " + (cx + 76) + " 196 V 235", color, delay + 720, 1.35);
      qwenArrow(parent,
        "M " + (cx + 160) + " 140 C " + (cx + 160) + " 205 " + (cx + 140) + " 250 " + (cx + 115) + " 250",
        color, delay + 760, 1.2);
      addStoryChip(parent, cx + 76, 250, 78, "FP32 × wᵢ", color, delay + 860, {
        height: 30, filled: true, fontSize: 9.2, rx: 15,
      });
      qwenArrow(parent, "M " + (cx + 76) + " 265 V 300", color, delay + 1000, 1.3);
      addCastBadge(parent, cx + 76, 310, color, delay + 1090);
    } else {
      qwenArrow(parent, "M " + (cx + 76) + " 196 V 235", color, delay + 720, 1.35);
      addCastBadge(parent, cx + 76, 245, color, delay + 810);
      qwenArrow(parent, "M " + (cx + 76) + " 255 V 293.5", color, delay + 930, 1.3);
      qwenArrow(parent,
        "M " + (cx + 160) + " 140 C " + (cx + 160) + " 245 " + (cx + 140) + " 308 " + (cx + 111) + " 308",
        color, delay + 970, 1.15);
      addStoryChip(parent, cx + 76, 308, 70, "× wᵢ", color, delay + 1060, {
        height: 29, filled: true, fontSize: 9.5, rx: 15,
      });
      qwenArrow(parent, "M " + (cx + 76) + " 322.5 V 346", color, delay + 1180, 1.2);
      addCastBadge(parent, cx + 76, 356, color, delay + 1260);
    }

    addBitWord(parent, cx + 76, 394, color, 16, 10, servingProgram ? 1 : 0, delay + 1420);
    addStoryChip(parent, cx - 88, 442, 122, "σ(h·w_g) × uᵣ", color, delay + 1640, {
      height: 30, fontSize: 8.8, rx: 15,
    });
    const plus = svgElement("g");
    plus.appendChild(svgElement("circle", {
      cx: cx + 76, cy: 442, r: 15, fill: color,
    }));
    plus.appendChild(label(cx + 76, 447, "+", {
      fill: "#fffdf7", "font-size": 14, "font-weight": 850, "text-anchor": "middle",
    }));
    parent.appendChild(motion(plus, delay + 1760));
    qwenArrow(parent, "M " + (cx + 76) + " 400 V 427", color, delay + 1580, 1.2);
    qwenArrow(parent, "M " + (cx - 27) + " 442 H " + (cx + 61), color, delay + 1700, 1.2);
    qwenArrow(parent, "M " + (cx + 76) + " 457 V 478", color, delay + 1880, 1.2);
    addBitWord(parent, cx + 76, 484, color, 16, 10, servingProgram ? 1 : 0, delay + 1970);
    motionText(parent, cx + 76, 528, "SCHEMATIC BF16 PARTIAL OUTPUT", color, delay + 2180, {
      "font-size": 9.5, "font-weight": 850,
    });
  };

  const addQwenExpertExact = (parent) => {
    addCallerPair(parent, 70, 144, 110, 144, 0);
    addQwenCellRow(parent, 158, 144, ["h₀", "h₁", "…", "hK"], TEAL_DARK, 120, {
      width: 26, height: 24, gap: 5, fontSize: 8.7,
    });
    qwenArrow(parent, "M 217.5 144 H 254", TEAL_DARK, 360, 1.3);
    addMatrixGlyph(parent, 278, 144, 4, 5, TEAL_DARK, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay: 430,
    });
    qwenArrow(parent, "M 302 144 H 343", TEAL_DARK, 700, 1.3);
    addStoryChip(parent, 382, 144, 78, "SiLU ×", TEAL_DARK, 780, {
      height: 32, filled: true, fontSize: 9.4, rx: 16,
    });
    qwenArrow(parent, "M 421 144 H 466", TEAL_DARK, 920, 1.3);
    addStoryChip(parent, 507, 144, 82, "FP32 ΣK", TEAL_DARK, 1010, {
      height: 32, filled: true, fontSize: 9.3, rx: 16,
    });
    addStoryChip(parent, 616, 91, 72, "wᵢ · BF16", TEAL_DARK, 1080, {
      height: 26, fontSize: 8.8, rx: 13,
    });
    qwenArrow(parent, "M 616 104 V 129", TEAL_DARK, 1190, 1.2);
    qwenArrow(parent, "M 548 144 H 578", TEAL_DARK, 1260, 1.2);
    addStoryChip(parent, 616, 144, 76, "FP32 × wᵢ", TEAL_DARK, 1340, {
      height: 30, filled: true, fontSize: 9.1, rx: 15,
    });
    qwenArrow(parent, "M 654 144 H 677", TEAL_DARK, 1460, 1.2);
    addCastBadge(parent, 698, 144, TEAL_DARK, 1540);
    motionText(parent, 382, 204, "SAME SGLANG EXPERT KERNELS", TEAL_DARK, 1650, {
      "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.45,
    });

    qwenArrow(parent, "M 158 156 C 158 244 218 286 246 312", TEAL_DARK, 1680, 1.25);
    addMatrixGlyph(parent, 270, 312, 4, 5, TEAL_DARK, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay: 1770,
    });
    qwenArrow(parent, "M 294 312 H 328", TEAL_DARK, 2000, 1.2);
    addStoryChip(parent, 362, 312, 68, "SiLU ×", TEAL_DARK, 2070, {
      height: 31, fontSize: 9.2, rx: 15,
    });
    qwenArrow(parent, "M 396 312 H 413", TEAL_DARK, 2180, 1.2);
    addCastBadge(parent, 434, 312, TEAL_DARK, 2240);
    qwenArrow(parent, "M 455 312 H 472", TEAL_DARK, 2320, 1.2);
    addStoryChip(parent, 515, 312, 86, "FIXED-K DOWN", TEAL_DARK, 2400, {
      height: 32, filled: true, fontSize: 8.9, rx: 16,
    });
    qwenArrow(parent, "M 558 312 H 578", TEAL_DARK, 2510, 1.2);
    addStoryChip(parent, 620, 312, 84, "RANK OUTPUT", TEAL_DARK, 2580, {
      height: 32, filled: true, fontSize: 8.8, rx: 16,
    });
    addStoryChip(parent, 620, 255, 78, "σ(h·w_g)", TEAL_DARK, 2460, {
      height: 28, fontSize: 9.1, rx: 14,
    });
    motionText(parent, 430, 380, "SHARD THE SHARED EXPERT THE SAME WAY", TEAL_DARK, 2700, {
      "font-size": 9.2, "font-weight": 850, "letter-spacing": 0.35,
    });

    qwenArrow(parent, "M 662 312 H 676", TEAL_DARK, 2730, 1.3);
    qwenArrow(parent, "M 620 269 C 640 276 666 286 693 295", TEAL_DARK, 2760, 1.1);
    qwenArrow(parent, "M 719 144 C 764 184 774 245 770 295", TEAL_DARK, 2680, 1.3);
    addStoryChip(parent, 770, 312, 188, "ADD ROUTED + SHARED PARTIALS", TEAL_DARK, 2790, {
      height: 34, filled: true, fontSize: 9.3, rx: 17,
    });
    qwenArrow(parent, "M 770 329 C 770 372 808 374 808 404", TEAL_DARK, 2910, 1.3);
    addCastBadge(parent, 808, 414, TEAL_DARK, 3020);
    qwenArrow(parent, "M 808 424 V 458", TEAL_DARK, 3080, 1.2);
    addBitWord(parent, 808, 464, TEAL_DARK, 16, -1, 0, 3160);
    motionText(parent, 808, 501, "SCHEMATIC BF16 PARTIAL OUTPUT", TEAL_DARK, 3400, {
      "font-size": 9.7, "font-weight": 850,
    });
  };

  const addQwenCombineMismatch = (parent) => {
    storyText(parent, 250, 112, "BF16 p₀…p₇", train, {
      "font-size": 9.6, "font-weight": 850, "letter-spacing": 0.45,
    });
    storyText(parent, 710, 112, "BF16 p₀…p₇", infer, {
      "font-size": 9.6, "font-weight": 850, "letter-spacing": 0.45,
    });
    const treeRoot = addBf16CombineTree(parent, 250, train, 40);
    const servingRanks = addRankRow(parent, 710, 142, infer, 40, false);
    const servingFoldStart = 710 - 3.5 * 34;
    qwenArrow(parent,
      "M " + servingRanks[7] + " 155 V 188 C " + servingRanks[7] + " 226 640 222 " + servingFoldStart + " 247",
      infer, 420, 1.1);
    motionText(parent, 680, 213, "READ p7 → … → p0", infer, 520, {
      "font-size": 9.2, "font-weight": 850, "text-anchor": "end",
    });
    const chainRoot = addBf16OrderedFold(parent, 710, 258, infer, 720, { step: 34 });
    motionText(parent, 158, 382, "ROUND TO BF16 AFTER EACH ADD", train, 1540, {
      "font-size": 9.3, "font-weight": 850,
    });
    motionText(parent, 710, 305, "p7 → p6 → … → p0", infer, 1580, {
      "font-size": 9.3, "font-weight": 850,
    });
    motionText(parent, 710, 330, "ROUND TO BF16 AFTER EACH ADD", infer, 1630, {
      "font-size": 9.3, "font-weight": 850,
    });
    qwenArrow(parent, "M " + treeRoot.x + " " + treeRoot.y + " V 431", train, 1680, 1.25);
    qwenArrow(parent, "M " + chainRoot.x + " " + (chainRoot.y + 11) + " V 360 C " + chainRoot.x + " 400 710 400 710 431",
      infer, 1680, 1.25);
    addBitWord(parent, 250, 437, train, 16, 11, 0, 1820);
    addBitWord(parent, 710, 437, infer, 16, 11, 1, 1820);
    addDifferenceMarker(parent, 480, 441, 2040, 24);
    motionText(parent, 250, 477, "SCHEMATIC BF16 OUTPUT", train, 2160, {
      "font-size": 9.5, "font-weight": 850,
    });
    motionText(parent, 710, 477, "SCHEMATIC BF16 OUTPUT", infer, 2160, {
      "font-size": 9.5, "font-weight": 850,
    });
  };

  const addCanonicalMoeCombineTree = (parent) => {
    storyText(parent, 480, 92, "EIGHT BF16 RANK OUTPUTS", TEAL_DARK, {
      "font-size": 10.2, "font-weight": 850, "letter-spacing": 0.55,
    });
    addCallerPair(parent, 150, 142, 312, 142, 40);
    addStoryChip(parent, 480, 142, 360, "EXCHANGE THE OUTPUTS WITHOUT ADDING", TEAL_DARK, 300, {
      height: 34, fontSize: 9.6, rx: 17,
    });
    qwenArrow(parent, "M 480 159 V 169", TEAL_DARK, 500, 1.3);
    addStoryChip(parent, 480, 181, 220, "LOGICAL RANK ORDER", TEAL_DARK, 560, {
      height: 24, filled: true, fontSize: 9.2, rx: 12,
    });
    qwenArrow(parent, "M 480 193 V 201", TEAL_DARK, 720, 1.2);
    parent.appendChild(motion(svgElement("line", {
      x1: 332, y1: 201, x2: 628, y2: 201,
      stroke: TEAL_DARK, "stroke-width": 1.1,
    }), 760));
    const root = addBf16CombineTree(parent, 480, TEAL_DARK, 620, {
      leafY: 218, firstLevelGap: 58, levelGap: 52,
      onLeaves: (leafXs, leafTop) => leafXs.forEach((x, index) => {
        parent.appendChild(motion(svgElement("line", {
          x1: x, y1: 201, x2: x, y2: leafTop,
          stroke: TEAL_DARK, "stroke-width": 1,
        }), 790 + index * 20));
      }),
    });
    motionText(parent, 718, 246, "EVERY ADD ROUNDS IN FP64", TEAL_DARK, 1080, {
      "font-size": 8.8, "font-weight": 850, "letter-spacing": 0.25,
    });
    [276, 328, 380].forEach((y, index) => {
      const levelRightEdges = [606, 568, 492];
      parent.appendChild(motion(svgElement("line", {
        x1: levelRightEdges[index], y1: y, x2: 696, y2: y,
        stroke: TEAL_DARK, "stroke-width": 1,
      }), 1140 + index * 260));
      addStoryChip(parent, 724, y, 54, "FP64", TEAL_DARK, 1180 + index * 260, {
        height: 22, fontSize: 8.7, rx: 11,
      });
    });
    motionText(parent, 292, 410, "3 LEVELS · ADJACENT PAIRS", TEAL_DARK, 1600, {
      "font-size": 9.6, "font-weight": 850, "letter-spacing": 0.4,
    });
    qwenArrow(parent, "M " + root.x + " " + root.y + " V 452", TEAL_DARK, 1700, 1.35);
    addResultValue(parent, 480, 462, TEAL_DARK, { kind: "vector", delay: 1820 });
    motionText(parent, 480, 505, "ONE BF16 COMBINED OUTPUT", TEAL_DARK, 2040, {
      "font-size": 9.6, "font-weight": 850,
    });
  };

  const moeCombine = drawKernelStory("moe-combine", {
    alignedKey: "tree",
    intervalMs: 9000,
    drawAligned: addCanonicalMoeCombineTree,
  });

  const addGdnMismatch = (parent) => {
    const trainRows = addQwenCellRow(parent, 250, 132,
      ["0", "1", "2", "…", "60", "61", "62", "63"], train, 30, {
        width: 27, height: 25, gap: 6, fontSize: 9.2,
      });
    const recurrentRows = addQwenCellRow(parent, 710, 132,
      ["0", "1", "2", "…", "60", "61", "62", "63"], infer, 30, {
        width: 27, height: 25, gap: 6, fontSize: 9.2,
      });
    const trainBoundary = addQwenStateGlyph(parent, 104, 246, train, "H BOUNDARY", 430);
    const triangle = addCausalTriangle(parent, 262, 246, train, 940, {
      rows: 6, cell: 14, gap: 3,
    });
    qwenArrow(parent, `M ${trainRows[3]} 146 C 250 180 262 184 262 ${triangle.top}`,
      train, 540, 1.2);
    qwenArrow(parent, `M ${trainBoundary.right} 246 H ${triangle.left}`, train, 620, 1.2);
    motionText(parent, 382, 252, "64-ROW CHUNK", train, 1010, {
      "font-size": 10.2, "font-weight": 850,
    });
    motionText(parent, 382, 278, "EXP → MASK", train, 1160, {
      "font-size": 9.3, "font-weight": 850,
    });
    qwenArrow(parent, `M 262 ${triangle.bottom} V 341`, train, 2000, 1.25);
    addStoryChip(parent, 262, 357, 190, "CHUNK SOLVE / UPDATE", train, 2920, {
      height: 32, filled: true, fontSize: 9.7, rx: 16,
    });
    qwenArrow(parent, "M 262 373 C 262 420 330 420 350 446.5", train, 3600, 1.2);

    const stateXs = [548, 626, 704, 782, 866];
    const stateLabels = ["H₀", "H₁", "H₂", "…", "H₆₃"];
    stateXs.forEach((x, index) => {
      addQwenStateGlyph(parent, x, 247, infer, stateLabels[index], 470 + index * 130, {
        cell: 8,
      });
      if (index) {
        qwenArrow(parent, `M ${stateXs[index - 1] + 14} 247 H ${x - 14}`, infer,
          540 + index * 130, 1.1);
      }
    });
    qwenArrow(parent,
      `M ${recurrentRows[3]} 146 V 205 C ${recurrentRows[3]} 220 ${stateXs[2]} 221 ${stateXs[2]} 233`,
      infer, 740, 1.15);
    motionText(parent, 710, 330, "Hₜ = exp(gₜ)Hₜ₋₁ + kₜδₜᵀ", infer, 1180, {
      "font-size": 10.3, "font-weight": 850,
    });
    motionText(parent, 710, 354, "MASK → EXP", infer, 1250, {
      "font-size": 9.3, "font-weight": 850,
    });
    qwenArrow(parent, "M 880 247 H 900 V 388 C 900 425 650 420 610 446.5", infer, 1430, 1.2);

    addQwenStateGlyph(parent, 350, 462, train, "CHUNK H₆₄ · FP32", 4550, { hot: 7 });
    addQwenStateGlyph(parent, 610, 462, infer, "RECURRENT H₆₄ · FP32", 4550, { hot: 5 });
    addDifferenceMarker(parent, 480, 466, 5000, 25);
  };

  const addGdnOracle = (parent) => {
    storyText(parent, 250, 88, "TRAIN + PREFILL · 64 ROWS", train, {
      "font-size": 10.5, "font-weight": 850, "letter-spacing": 0.65,
    });
    storyText(parent, 710, 88, "DECODE · RECOMPUTE ROWS 0…p", infer, {
      "font-size": 10.5, "font-weight": 850, "letter-spacing": 0.65,
    });
    const trainRows = addQwenCellRow(parent, 250, 128,
      ["0", "1", "2", "…", "60", "61", "62", "63"], train, 60, {
        width: 28, height: 25, gap: 6, fontSize: 9.2,
        filled: [0, 1, 2, 3, 4, 5, 6, 7],
      });
    const rescanRows = addQwenCellRow(parent, 710, 128,
      ["0", "1", "2", "…", "p", "…", "62", "63"], infer, 60, {
        width: 28, height: 25, gap: 6, fontSize: 9.2,
        filled: [0, 1, 2, 3, 4], focus: 4, muted: [5, 6, 7],
      });
    qwenArrow(parent, `M ${trainRows[3]} 140.5 C ${trainRows[3]} 168 418 166 430 175`, train, 470, 1.2);
    qwenArrow(parent, `M ${rescanRows[4]} 140.5 C ${rescanRows[4]} 168 542 166 530 175`, infer, 470, 1.2);
    addStoryChip(parent, 480, 193, 300, "SAME ORDER WITHIN THE 64-ROW CHUNK", TEAL_DARK, 610, {
      height: 36, filled: true, fontSize: 10.4, rx: 18,
    });

    const boundary = addQwenStateGlyph(parent, 72, 306, TEAL_DARK, "H BOUNDARY · FP32", 820);
    const normalized = addMatrixGlyph(parent, 214, 306, 2, 4, TEAL_DARK, {
      cellWidth: 17, cellHeight: 14, gap: 4, delay: 930,
      highlighted: [0, 4],
    });
    const interactions = addCausalTriangle(parent, 372, 306, TEAL_DARK, 1150, {
      rows: 5, cell: 13, gap: 3, maskLabel: true,
    });
    const solve = addCausalTriangle(parent, 540, 306, TEAL_DARK, 1510, {
      rows: 5, cell: 13, gap: 3, highlightRow: 4,
    });
    const outputCalculation = addMatrixGlyph(parent, 694, 306, 3, 3, TEAL_DARK, {
      cellWidth: 15, cellHeight: 14, gap: 4, delay: 1840,
      highlighted: [6, 7, 8],
    });
    const output = addResultValue(parent, 848, 306, TEAL_DARK, { kind: "vector", delay: 2220 });
    qwenArrow(parent, `M ${boundary.right} 306 H ${normalized.left}`, TEAL_DARK, 900, 1.2);
    qwenArrow(parent, `M ${normalized.right} 306 H ${interactions.left}`, TEAL_DARK, 1080, 1.2);
    qwenArrow(parent, `M ${interactions.right} 306 H ${solve.left}`, TEAL_DARK, 1430, 1.2);
    qwenArrow(parent, `M ${solve.right} 306 H ${outputCalculation.left}`, TEAL_DARK, 1780, 1.2);
    qwenArrow(parent, `M ${outputCalculation.right} 306 H ${output.left}`, TEAL_DARK, 2110, 1.2);
    motionText(parent, 210, 390, "NORMALIZE + CAUSAL CONV · FP32 β,g", TEAL_DARK, 1110, {
      "font-size": 9.2, "font-weight": 850,
    });
    motionText(parent, 372, 390, "MASK → EXP", TEAL_DARK, 1500, {
      "font-size": 9.7, "font-weight": 850,
    });
    motionText(parent, 540, 390, "ROWS 0…p · TRAINING ORDER", TEAL_DARK, 1810, {
      "font-size": 9.7, "font-weight": 850,
    });
    motionText(parent, 694, 390, "OUTPUT CALCULATION", TEAL_DARK, 2110, {
      "font-size": 9.7, "font-weight": 850,
    });
    motionText(parent, 882, 350, "oₚ · BF16", TEAL_DARK, 2380, {
      "font-size": 9.8, "font-weight": 850,
    });

    qwenArrow(parent,
      `M ${output.cx} ${output.bottom} V 414 C ${output.cx} 442 700 466 635 466`,
      TEAL_DARK, 2520, 1.25);
    addStoryChip(parent, 480, 466, 310, "TRAIN oₚ = RECOMPUTED oₚ", TEAL_DARK, 2700, {
      height: 36, filled: true, fontSize: 10.2, rx: 18,
    });
    motionText(parent, 480, 510, "IDENTICAL BF16 OUTPUT BYTES", TEAL_DARK, 2920, {
      "font-size": 9.8, "font-weight": 850,
    });
  };

  const addGdnCacheBank = (parent, options = {}) => {
    const columns = ["0", "1", "2", "…", "p", "…", "62", "63"];
    const rows = [
      "NORMALIZED q / k",
      "GATE PREFIX · RERUN",
      "CAUSAL INTERACTIONS",
      "SOLVE OUTPUT",
      "STATE-UPDATE INPUTS",
    ];
    const left = options.left || 230;
    const top = options.top || 143;
    const cellWidth = 36;
    const cellHeight = 24;
    const gapX = 7;
    const gapY = 12;
    const centers = columns.map((_value, index) => left + cellWidth / 2 + index * (cellWidth + gapX));
    columns.forEach((value, index) => {
      motionText(parent, centers[index], top - 17, value, TEAL_DARK, 260 + index * 35, {
        "font-size": 9.2, "font-weight": 850,
      });
    });
    rows.forEach((row, rowIndex) => {
      const y = top + rowIndex * (cellHeight + gapY);
      motionText(parent, left - 17, y + cellHeight / 2 + 3.5, row, TEAL_DARK, 350 + rowIndex * 60, {
        "font-size": 9.2, "font-weight": 820, "text-anchor": "end",
      });
      columns.forEach((_value, columnIndex) => {
        const current = columnIndex === 4;
        const cached = columnIndex < 4;
        const future = columnIndex > 4;
        const bandRow = rowIndex === 2 || rowIndex === 4;
        const recomputedRow = rowIndex === 1;
        const group = svgElement("g", {
          class: `gdn-cache-cell ${current ? "is-new" : cached ? "is-cached" : "is-future"}`,
        });
        group.appendChild(svgElement("rect", {
          x: left + columnIndex * (cellWidth + gapX), y,
          width: cellWidth, height: cellHeight, rx: 3,
          fill: recomputedRow ? PAPER : current ? TEAL_DARK : cached ? TEAL_DARK : PAPER,
          "fill-opacity": recomputedRow ? 1 : current ? 1 : cached ? (bandRow ? 0.25 : 0.12) : 0.36,
          stroke: TEAL_DARK,
          "stroke-width": current ? 2 : 1,
          "stroke-dasharray": recomputedRow || (bandRow && cached) ? "3 2" : "none",
          opacity: future ? 0.32 : 1,
        }));
        parent.appendChild(motion(group,
          current ? 1120 + rowIndex * 190 : 430 + rowIndex * 60 + columnIndex * 20));
      });
    });
    return {
      centers,
      top,
      bottom: top + rows.length * cellHeight + (rows.length - 1) * gapY,
      right: left + columns.length * cellWidth + (columns.length - 1) * gapX,
      rowCenters: rows.map((_row, index) => top + index * (cellHeight + gapY) + cellHeight / 2),
    };
  };

  const addGdnFullOutputGrid = (parent, cx, cy, delay = 0) => {
    const count = 64;
    const cellWidth = 5;
    const gap = 1.4;
    const width = count * cellWidth + (count - 1) * gap;
    const left = cx - width / 2;
    const current = 39;
    const group = svgElement("g", { "aria-hidden": "true" });
    for (let index = 0; index < count; index += 1) {
      group.appendChild(svgElement("rect", {
        x: left + index * (cellWidth + gap), y: cy - 8,
        width: cellWidth, height: 16, rx: 1,
        fill: index === current ? TEAL_DARK : PAPER,
        stroke: TEAL_DARK,
        "stroke-width": index === current ? 1.4 : 0.6,
        "fill-opacity": index === current ? 1 : 0.62,
      }));
    }
    parent.appendChild(motion(group, delay));
    motionText(parent, left, cy + 28, "0", TEAL_DARK, delay + 120, {
      "font-size": 9, "font-weight": 820, "text-anchor": "middle",
    });
    motionText(parent, left + current * (cellWidth + gap) + cellWidth / 2, cy + 28, "p", TEAL_DARK,
      delay + 120, { "font-size": 9, "font-weight": 850 });
    motionText(parent, left + width, cy + 28, "63", TEAL_DARK, delay + 120, {
      "font-size": 9, "font-weight": 820, "text-anchor": "middle",
    });
    return { left, right: left + width, currentX: left + current * (cellWidth + gap) + cellWidth / 2 };
  };

  const addGdnCachedRow = (parent) => {
    storyText(parent, 480, 72, "CUDA GRAPH DECODE · ONE NEW TOKEN", TEAL_DARK, {
      "font-size": 10.5, "font-weight": 850, "letter-spacing": 0.7,
    });
    addStoryChip(parent, 300, 108, 176, "CURRENT SCHEDULER SLOT", TEAL_DARK, 80, {
      height: 30, fontSize: 8.8, rx: 15,
    });
    addStoryChip(parent, 660, 108, 202, "CURRENT ROW", TEAL_DARK, 100, {
      height: 30, fontSize: 8.8, rx: 15,
    });
    const frame = svgElement("g");
    frame.appendChild(svgElement("rect", {
      x: 222, y: 148, width: 354, height: 239, rx: 6,
      fill: "none", stroke: TEAL_DARK, "stroke-width": 1.1, "stroke-dasharray": "5 4",
    }));
    parent.appendChild(motion(frame, 180));
    motionText(parent, 399, 164, "64 ROWS AT A FIXED ADDRESS", TEAL_DARK, 220, {
      "font-size": 9.2, "font-weight": 850, "letter-spacing": 0.35,
    });
    const bank = addGdnCacheBank(parent, { top: 204 });
    const boundary = addQwenStateGlyph(parent, 74, 270, TEAL_DARK, "H BOUNDARY · FP32", 340);
    qwenArrow(parent, "M 300 123 V 148", TEAL_DARK, 330, 1.1);
    qwenArrow(parent,
      `M 660 123 H 604 V 180 C 604 192 ${bank.centers[4]} 192 ${bank.centers[4]} ${bank.top}`,
      TEAL_DARK, 360, 1.1);
    qwenArrow(parent,
      `M ${boundary.right} ${boundary.cy} H 220 V ${bank.rowCenters[4]} H 230`,
      TEAL_DARK, 1880, 1.15);
    motionText(parent, 720, 235, "IF p = 63 · STORE NEXT BOUNDARY", TEAL_DARK, 3480, {
      "font-size": 9.2, "font-weight": 850,
    });
    const nextBoundary = addQwenStateGlyph(parent, 866, 270, TEAL_DARK, "NEXT H BOUNDARY", 3820, { hot: 7 });
    qwenArrow(parent,
      `M ${bank.centers[4]} ${bank.bottom} C ${bank.centers[4]} 398 600 398 600 360 V 270 H ${nextBoundary.left}`,
      TEAL_DARK, 3550, 1.2);

    motionText(parent, 480, 412, "SAME FIXED 64-ROW OUTPUT CALCULATION", TEAL_DARK, 2220, {
      "font-size": 10, "font-weight": 850, "letter-spacing": 0.45,
    });
    const outputGrid = addGdnFullOutputGrid(parent, 480, 438, 2400);
    qwenArrow(parent,
      `M ${bank.centers[4]} ${bank.bottom} V 398 C ${bank.centers[4]} 416 ${outputGrid.currentX} 416 ${outputGrid.currentX} 430`,
      TEAL_DARK, 2150, 1.2);
    qwenArrow(parent,
      `M ${boundary.left} ${boundary.cy} H 28 V 438 H ${outputGrid.left}`,
      TEAL_DARK, 2260, 1.05);

    addStoryChip(parent, 480, 500, 220, "SAME oₚ AS FULL RESCAN", TEAL_DARK, 2920, {
      height: 34, filled: true, fontSize: 9.4, rx: 17,
    });
    motionText(parent, 480, 535,
      "PREFILL FILLS THE CACHE · EAGER RESCAN REFRESHES IT · GRAPH REPLAY ADDS ONE ROW",
      TEAL_DARK, 3140, {
        "font-size": 8.7, "font-weight": 850, "letter-spacing": 0.15,
    });
  };

  const gdn = drawKernelStory("gdn", {
    alignedKey: "recompute",
    intervalMs: 10000,
    mismatchLeftLabel: "XORL TRAIN · 64-ROW CHUNK",
    mismatchRightLabel: "SGLANG DECODE · ONE TOKEN AT A TIME",
    drawMismatch: addGdnMismatch,
    drawAligned: addGdnOracle,
    additionalStates: [{
      key: "cached",
      className: "kernel-story-aligned kernel-story-gdn-cached",
      title: "CUDA GRAPH DECODE WITH FIXED STORAGE",
      draw: addGdnCachedRow,
    }],
  });

  const addKernelGlyph = (parent, cx, cy, width, color, copy, delay = 0, filled = false) => {
    const half = width / 2;
    const height = 42;
    const group = svgElement("g");
    group.appendChild(svgElement("path", {
      d: `M ${cx - half + 12} ${cy - height / 2} H ${cx + half - 12} L ${cx + half} ${cy} L ${cx + half - 12} ${cy + height / 2} H ${cx - half + 12} L ${cx - half} ${cy} Z`,
      fill: filled ? color : PAPER, stroke: color, "stroke-width": 1.4,
    }));
    group.appendChild(label(cx, cy, copy, {
      fill: filled ? "#fffdf7" : color,
      "font-size": isSectionOneStory(parent) ? 9.5 : 7.8, "font-weight": 850,
      "letter-spacing": 0.25, "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(group, delay));
    return {
      left: cx - half, right: cx + half, top: cy - height / 2, bottom: cy + height / 2,
      cx, cy,
      ports: {
        left: { x: cx - half, y: cy }, right: { x: cx + half, y: cy },
        top: { x: cx, y: cy - height / 2 }, bottom: { x: cx, y: cy + height / 2 },
      },
    };
  };
  const addLoraMismatchTrain = (parent) => {
    const color = train;
    storyText(parent, 250, 122, "W·x + scale·B(Ax)", color, { "font-size": 11, "font-weight": 850 });
    addMatrixGlyph(parent, 78, 176, 4, 5, color, { cellWidth: 9, cellHeight: 8, gap: 2 });
    storyText(parent, 78, 208, "W", color, { "font-size": 9.5, "font-weight": 850 });
    addMatrixGlyph(parent, 78, 320, 1, 5, color, { cellWidth: 10, cellHeight: 10, gap: 2 });
    storyText(parent, 78, 348, "x", color, { "font-size": 9.5, "font-weight": 850 });
    storyArrow(parent, "M 106 176 C 130 176 140 184 150 190", color, 120, 1.4);
    storyArrow(parent, "M 106 320 C 136 300 136 226 150 202", color, 150, 1.4);
    addKernelGlyph(parent, 190, 192, 80, color, "BASE GEMM", 220);
    storyArrow(parent, "M 232 192 H 247", color, 300, 1.5);
    addCastBadge(parent, 270, 192, color, 360);

    storyText(parent, 205, 228, "A", color, { "font-size": 9.2, "font-weight": 850 });
    addMatrixGlyph(parent, 205, 250, 2, 5, color, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 160 });
    storyText(parent, 340, 222, "B", color, { "font-size": 9.2, "font-weight": 850 });
    addMatrixGlyph(parent, 340, 250, 4, 2, color, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 220 });
    storyArrow(parent, "M 106 320 H 168", color, 250, 1.35);
    storyArrow(parent, "M 205 260 V 298", color, 300, 1.2);
    addKernelGlyph(parent, 205, 320, 70, color, "LORA A", 380);
    storyArrow(parent, "M 242 320 H 254", color, 450, 1.4);
    addCastBadge(parent, 277, 320, color, 510);
    storyText(parent, 277, 350, "A STORE", color, { "font-size": 7.8, "font-weight": 850 });
    storyArrow(parent, "M 300 320 H 303", color, 560, 1.3);
    storyArrow(parent, "M 340 270 V 298", color, 570, 1.2);
    addKernelGlyph(parent, 340, 320, 72, color, "LORA B", 640);
    motionText(parent, 385, 300, "× scale", color, 680, {
      "font-size": 8.4, "font-weight": 850, storyTier: "micro",
    });
    storyArrow(parent, "M 378 320 H 383", color, 710, 1.4);
    addCastBadge(parent, 406, 320, color, 770);
    storyText(parent, 392, 350, "B DELTA ROUND", color, {
      "font-size": 7.4, "font-weight": 850, "text-anchor": "end",
    });

    const plus = svgElement("g");
    plus.appendChild(svgElement("circle", { cx: 414, cy: 238, r: 18, fill: color }));
    plus.appendChild(label(414, 243, "+", { fill: "#fffdf7", "font-size": 13, "font-weight": 850, "text-anchor": "middle" }));
    parent.appendChild(motion(plus, 840));
    storyArrow(parent, "M 293 192 C 350 192 370 222 394 232", color, 700, 1.5);
    storyArrow(parent, "M 414 309 V 258", color, 820, 1.5);
    storyArrow(parent, "M 432 238 C 454 278 454 350 430 374 C 390 400 312 406 250 416", color, 900, 1.8);
    addResultValue(parent, 250, 432, color, { kind: "scalar", delay: 940 });
    storyText(parent, 250, 468, "ONE BF16 OUTPUT", color, { "font-size": 8.4, "font-weight": 850 });
  };
  const addLoraMismatchServe = (parent) => {
    const color = infer;
    storyText(parent, 710, 122, "[W + scale·B@A]·x", color, { "font-size": 11, "font-weight": 850 });
    addMatrixGlyph(parent, 548, 190, 4, 5, color, { cellWidth: 10, cellHeight: 9, gap: 2 });
    storyText(parent, 548, 226, "W · FP32", color, { "font-size": 8.5, "font-weight": 850 });
    addMatrixGlyph(parent, 630, 178, 4, 2, color, { cellWidth: 9, cellHeight: 9, gap: 2, delay: 80 });
    addMatrixGlyph(parent, 676, 178, 2, 5, color, { cellWidth: 9, cellHeight: 9, gap: 2, delay: 140 });
    storyText(parent, 653, 222, "scale·B @ A", color, { "font-size": 8.5, "font-weight": 850 });
    storyArrow(parent, "M 578 190 C 610 246 666 246 716 218", color, 220, 1.4);
    storyArrow(parent, "M 676 190 C 690 190 704 194 716 198", color, 270, 1.4);
    const fold = svgElement("g");
    fold.appendChild(svgElement("circle", { cx: 736, cy: 204, r: 20, fill: PAPER, stroke: color, "stroke-width": 1.4 }));
    fold.appendChild(label(736, 204, "+FP32", {
      fill: color, "font-size": 9, "font-weight": 850, "text-anchor": "middle",
      "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(fold, 350));
    storyArrow(parent, "M 758 204 H 782", color, 450, 1.5);
    addCastBadge(parent, 805, 204, color, 520);
    storyArrow(parent, "M 828 204 H 842", color, 600, 1.5);
    addMatrixGlyph(parent, 878, 204, 4, 5, color, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 650 });
    storyText(parent, 878, 238, "W′ · BF16", color, { "font-size": 8.4, "font-weight": 850 });
    addMatrixGlyph(parent, 638, 328, 1, 5, color, { cellWidth: 11, cellHeight: 10, gap: 2, delay: 700 });
    storyText(parent, 638, 354, "x", color, { "font-size": 9, "font-weight": 850 });
    storyArrow(parent, "M 908 222 C 928 238 928 270 906 282 C 876 298 832 302 796 308", color, 760, 1.5);
    storyArrow(parent, "M 675 328 H 736", color, 790, 1.5);
    addKernelGlyph(parent, 784, 328, 92, color, "DENSE GEMM", 860);
    storyArrow(parent, "M 832 328 C 854 350 816 388 710 416", color, 960, 1.8);
    addResultValue(parent, 710, 432, color, { kind: "scalar", delay: 1040 });
    storyText(parent, 710, 468, "ONE BF16 OUTPUT", color, { "font-size": 8.4, "font-weight": 850 });
  };
  const addMergedWeightApproach = (parent) => {
    storyText(parent, 250, 98, "MERGE LORA INTO THE BASE WEIGHT", TEAL_DARK, {
      "font-size": 10, "font-weight": 850, "letter-spacing": 0.55, storyTier: "lane",
    });
    addMatrixGlyph(parent, 78, 184, 4, 5, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2 });
    storyText(parent, 78, 216, "W → FP32", TEAL_DARK, { "font-size": 8.2, "font-weight": 850 });
    storyText(parent, 190, 126, "A AND B", TEAL_DARK, { "font-size": 8.2, "font-weight": 850 });
    addMatrixGlyph(parent, 160, 154, 2, 5, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 80 });
    addMatrixGlyph(parent, 220, 154, 4, 2, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 130 });
    storyArrow(parent, "M 160 165 C 160 180 176 188 184 194", TEAL_DARK, 190, 1.2);
    storyArrow(parent, "M 220 174 C 220 184 216 188 212 194", TEAL_DARK, 220, 1.2);
    addKernelGlyph(parent, 200, 212, 100, TEAL_DARK, "scale · BA · FP32", 280);
    storyArrow(parent, "M 106 184 C 138 184 168 176 184 176 C 224 176 256 182 284 190", TEAL_DARK, 260, 1.4);
    storyArrow(parent, "M 252 212 C 264 212 276 204 284 196", TEAL_DARK, 320, 1.3);
    const fold = svgElement("g");
    fold.appendChild(svgElement("circle", { cx: 304, cy: 190, r: 20, fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.4 }));
    fold.appendChild(label(304, 190, "+FP32", {
      fill: TEAL_DARK, "font-size": 9, "font-weight": 850, "text-anchor": "middle",
      "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(fold, 380));
    storyArrow(parent, "M 326 190 H 346", TEAL_DARK, 430, 1.5);
    addCastBadge(parent, 369, 190, TEAL_DARK, 500);
    storyArrow(parent, "M 392 190 H 404", TEAL_DARK, 570, 1.4);
    addMatrixGlyph(parent, 440, 190, 4, 5, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 630 });
    storyText(parent, 440, 224, "W′ · BF16", TEAL_DARK, { "font-size": 8.2, "font-weight": 850 });
    addCallerPair(parent, 92, 326, 210, 326, 720);
    storyArrow(parent, "M 470 190 V 254 C 438 280 358 300 304 310", TEAL_DARK, 760, 1.5);
    addKernelGlyph(parent, 250, 326, 112, TEAL_DARK, "FORWARD WITH W′", 860, true);
    storyArrow(parent, "M 308 326 H 390", TEAL_DARK, 980, 1.8);
    addResultValue(parent, 418, 326, TEAL_DARK, { kind: "scalar", delay: 1060 });
    storyText(parent, 418, 355, "BF16 y ELEMENT", TEAL_DARK, { "font-size": 8.4, "font-weight": 850 });
  };
  const addSharedSglangApproach = (parent) => {
    storyText(parent, 710, 98, "CALL THE SGLANG LORA KERNEL", TEAL_DARK, {
      "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.42, storyTier: "lane",
    });
    addCallerPair(parent, 528, 150, 606, 206, 0);
    const input = svgElement("g");
    input.appendChild(svgElement("circle", { cx: 610, cy: 206, r: 18, fill: PAPER, stroke: TEAL_DARK, "stroke-width": 1.3 }));
    input.appendChild(label(610, 206, "x", {
      fill: TEAL_DARK, "font-size": 10, "font-weight": 850, "text-anchor": "middle",
      "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(input, 150));

    addMatrixGlyph(parent, 555, 292, 4, 5, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 120 });
    storyText(parent, 555, 326, "BASE WEIGHT", TEAL_DARK, { "font-size": 7.8, "font-weight": 850 });
    storyArrow(parent, "M 583 292 H 605", TEAL_DARK, 220, 1.4);
    storyArrow(parent, "M 602 224 C 604 248 620 260 632 272", TEAL_DARK, 190, 1.3);
    addKernelGlyph(parent, 650, 292, 86, TEAL_DARK, "BASE FORWARD", 280);

    storyText(parent, 738, 126, "A", TEAL_DARK, { "font-size": 8.2, "font-weight": 850 });
    addMatrixGlyph(parent, 738, 154, 2, 5, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 80 });
    storyText(parent, 850, 126, "B", TEAL_DARK, { "font-size": 8.2, "font-weight": 850 });
    addMatrixGlyph(parent, 850, 154, 4, 2, TEAL_DARK, { cellWidth: 9, cellHeight: 8, gap: 2, delay: 120 });
    storyArrow(parent, "M 738 165 V 193", TEAL_DARK, 210, 1.2);
    storyArrow(parent, "M 850 174 V 193", TEAL_DARK, 230, 1.2);
    addCastBadge(parent, 738, 205, TEAL_DARK, 260);
    addCastBadge(parent, 850, 205, TEAL_DARK, 280);
    storyArrow(parent, "M 625 218 C 658 232 690 250 702 268", TEAL_DARK, 260, 1.3);
    storyArrow(parent, "M 738 217 V 253", TEAL_DARK, 320, 1.3);
    addKernelGlyph(parent, 738, 275, 76, TEAL_DARK, "LORA A", 400);
    storyArrow(parent, "M 738 297 V 310", TEAL_DARK, 470, 1.4);
    addCastBadge(parent, 738, 322, TEAL_DARK, 530);
    storyText(parent, 738, 350, "BF16 INTERMEDIATE", TEAL_DARK, { "font-size": 7.8, "font-weight": 850 });
    storyArrow(parent, "M 761 322 H 793", TEAL_DARK, 600, 1.4);
    storyArrow(parent, "M 850 217 V 300 C 850 310 844 314 838 316", TEAL_DARK, 360, 1.3);
    addKernelGlyph(parent, 835, 337, 80, TEAL_DARK, "LORA B", 650);
    storyArrow(parent, "M 835 359 V 378", TEAL_DARK, 720, 1.5);
    addCastBadge(parent, 835, 390, TEAL_DARK, 780);
    storyText(parent, 812, 416, "BF16 LORA OUTPUT", TEAL_DARK, {
      "font-size": 7.4, "font-weight": 850, "text-anchor": "end",
    });

    storyArrow(parent, "M 650 313 V 402 C 650 430 720 445 757 445", TEAL_DARK, 700, 1.4);
    storyArrow(parent, "M 835 402 V 412 C 835 418 844 421 851 424", TEAL_DARK, 840, 1.5);
    addKernelGlyph(parent, 825, 445, 136, TEAL_DARK, "ADD TO BASE", 900, true);
    storyArrow(parent, "M 825 467 V 484", TEAL_DARK, 980, 1.6);
    addResultValue(parent, 825, 492, TEAL_DARK, { kind: "scalar", delay: 1040 });
    storyText(parent, 825, 522, "BF16 y ELEMENT", TEAL_DARK, { "font-size": 8.4, "font-weight": 850 });
  };
  const addGlmIndexStrip = (parent, cx, cy, color, keys, delay = 0, options = {}) =>
    addQwenCellRow(parent, cx, cy, keys, color, delay, {
      width: options.width || 42,
      height: options.height || 28,
      gap: options.gap ?? 7,
      fontSize: options.fontSize || 9.2,
      filled: options.filled || [],
      muted: options.muted || [],
    });

  const addGlmScoreSlice = (parent, cx, cy, color, selected, delay = 0, options = {}) => {
    const heights = options.heights || [26, 39, 51, 46, 49, 31];
    const labels = options.labels || ["k2", "k4", "k7", "k9", "k11", "k14"];
    const selectedSet = new Set(selected);
    const barWidth = options.barWidth || 22;
    const gap = options.gap || 13;
    const total = heights.length * barWidth + (heights.length - 1) * gap;
    const start = cx - total / 2;
    heights.forEach((height, index) => {
      const group = svgElement("g");
      const x = start + index * (barWidth + gap);
      group.appendChild(svgElement("rect", {
        x, y: cy - height, width: barWidth, height, rx: 2.5,
        fill: selectedSet.has(index) ? color : PAPER,
        "fill-opacity": selectedSet.has(index) ? 0.76 : 1,
        stroke: color, "stroke-width": selectedSet.has(index) ? 1.45 : 0.9,
      }));
      group.appendChild(label(x + barWidth / 2, cy + 17, labels[index], {
        fill: color, "font-size": 8.7, "font-weight": 820, "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 75));
    });
    const cutoffHeight = options.cutoffHeight || 44;
    parent.appendChild(motion(svgElement("line", {
      x1: start - 8, y1: cy - cutoffHeight, x2: start + total + 8, y2: cy - cutoffHeight,
      stroke: RED_DARK, "stroke-width": 1, "stroke-dasharray": "4 4",
    }), delay + 520));
    motionText(parent, cx, cy - 57, options.title || "TOP-K BOUNDARY", color, delay + 560, {
      "font-size": 9.1, "font-weight": 850, "letter-spacing": 0.45,
    });
  };

  const addGlmKvMemory = (parent, cx, cy, color, paged, delay = 0, options = {}) => {
    const keys = options.keys || ["k2", "k7", "k11", "k15", "k19", "k23"];
    if (!paged) {
      return addQwenCellRow(parent, cx, cy, keys, color, delay, {
        width: 42, height: 30, gap: 5, fontSize: 9,
        filled: options.filled || [0, 1, 2],
      });
    }
    const physical = ["p3", "p0", "p5", "p1", "p4", "p2"];
    const logical = ["k15", "k2", "k23", "k7", "k19", "k11"];
    const centers = addQwenCellRow(parent, cx, cy, physical, color, delay, {
      width: 42, height: 30, gap: 5, fontSize: 8.8,
      filled: [1, 3, 5],
    });
    centers.forEach((x, index) => {
      motionText(parent, x, cy + 29, logical[index], color, delay + 430 + index * 45, {
        "font-size": 8.2, "font-weight": 800,
      });
    });
    return centers;
  };

  const addGlmFp8Tile = (parent, cx, cy, color, labelText, delay = 0, options = {}) => {
    const matrix = addMatrixGlyph(parent, cx - 20, cy, options.rows || 3, options.columns || 4, color, {
      cellWidth: options.cellWidth || 10,
      cellHeight: options.cellHeight || 10,
      gap: 2,
      delay,
      highlighted: options.highlighted || [2, 5, 9],
    });
    const scaleWidth = options.scaleWidth || 58;
    addStoryChip(parent, cx + 48, cy, scaleWidth, options.scale || "s · FP32", color, delay + 240, {
      height: 28, fontSize: 8.5, rx: 14,
    });
    motionText(parent, cx, matrix.bottom + 22, labelText, color, delay + 330, {
      "font-size": 8.8, "font-weight": 840,
    });
    return {
      ...matrix,
      scaleLeft: cx + 48 - scaleWidth / 2,
      scaleRight: cx + 48 + scaleWidth / 2,
    };
  };

  const addGlmDashedArrow = (parent, d, color, delay = 0, width = 1.2) => {
    const path = wire(d, {
      stroke: color, "stroke-width": width, "stroke-dasharray": "5 4",
    });
    path.setAttribute("class", "kernel-story-dashed-path");
    path.style.setProperty("--story-delay", `${delay}ms`);
    parent.appendChild(path);
  };

  const glmSelector = drawKernelStory("glm-selector", {
    intervalMs: 9000,
    drawAligned: (parent) => {
      addCallerPair(parent, 66, 126, 104, 126, 20);
      const queryRow = addQwenCellRow(parent, 159, 92, ["q0", "q1", "…", "qD"], TEAL_DARK, 120, {
        width: 27, height: 24, gap: 5, fontSize: 8.7,
      });
      const hiddenRow = addQwenCellRow(parent, 159, 164, ["h0", "h1", "…", "hK"], TEAL_DARK, 170, {
        width: 27, height: 24, gap: 5, fontSize: 8.7,
      });
      qwenArrow(parent, `M 92 126 C 92 108 94 96 ${queryRow[0] - 13.5} 92`, TEAL_DARK, 310, 1.0);
      qwenArrow(parent, `M 92 126 C 92 144 94 160 ${hiddenRow[0] - 13.5} 164`, TEAL_DARK, 340, 1.0);
      const queryProjection = addMatrixGlyph(parent, 246, 92, 3, 4, TEAL_DARK, {
        cellWidth: 8, cellHeight: 8, gap: 2, delay: 470,
      });
      const stackedProjection = addMatrixGlyph(parent, 246, 164, 5, 4, TEAL_DARK, {
        cellWidth: 8, cellHeight: 8, gap: 2, delay: 470,
        highlighted: [8, 9, 10, 11],
      });
      qwenArrow(parent, `M ${queryRow.at(-1) + 13.5} 92 H ${queryProjection.left}`, TEAL_DARK, 400, 1.2);
      qwenArrow(parent, `M ${hiddenRow.at(-1) + 13.5} 164 H ${stackedProjection.left}`, TEAL_DARK, 430, 1.2);
      motionText(parent, 246, 70, "QUERY PROJECTION", TEAL_DARK, 760, {
        "font-size": 8.9, "font-weight": 850,
      });
      motionText(parent, 246, 214, "STACKED KEY + HEAD-GATE PROJECTION", TEAL_DARK, 820, {
        "font-size": 8.9, "font-weight": 850,
      });
      qwenArrow(parent, `M ${queryProjection.right} 92 H 296`, TEAL_DARK, 820, 1.2);
      addStoryChip(parent, 350, 92, 108, "RoPE → BF16", TEAL_DARK, 900, {
        height: 32, filled: true, fontSize: 9, rx: 16,
      });
      qwenArrow(parent, "M 404 92 H 432", TEAL_DARK, 1080, 1.15);
      const queryTile = addGlmFp8Tile(parent, 475, 92, TEAL_DARK, "FP8 QUERY + SCALE", 1160, {
        rows: 2, columns: 4, scale: "QUERY SCALE", scaleWidth: 72,
      });
      qwenArrow(parent, `M ${stackedProjection.right} 158 H 296`, TEAL_DARK, 900, 1.15);
      addStoryChip(parent, 350, 158, 108, "LN + RoPE", TEAL_DARK, 1020, {
        height: 32, filled: true, fontSize: 9, rx: 16,
      });
      qwenArrow(parent, "M 404 158 H 432", TEAL_DARK, 1180, 1.15);
      const keyTile = addGlmFp8Tile(parent, 475, 158, TEAL_DARK, "FP8 KEY + SCALE", 1260, {
        rows: 2, columns: 4, scale: "KEY SCALE", scaleWidth: 72,
      });
      qwenArrow(parent, `M ${stackedProjection.right} 174 C 342 184 490 184 586 172`, TEAL_DARK, 1320, 1.05);
      const headGate = addStoryChip(parent, 650, 172, 128, "FP32 HEAD GATE", TEAL_DARK, 1460, {
        height: 32, fontSize: 8.7, rx: 16,
      });
      qwenArrow(parent, `M ${queryTile.scaleRight} 92 C 630 92 682 112 729 132`, TEAL_DARK, 1600, 1.05);
      qwenArrow(parent, `M ${headGate.right} 172 C 724 165 729 153 729 144`, TEAL_DARK, 1660, 1.05);
      const scaledGate = addStoryChip(parent, 812, 136, 166, "SCALED FP32 HEAD GATE", TEAL_DARK, 1740, {
        height: 34, filled: true, fontSize: 8.8, rx: 17,
      });
      const matchedOperands = addStoryChip(parent, 480, 238, 330, "MATCHING FP8 OPERANDS + FP32 GATES", TEAL_DARK, 1940, {
        height: 32, filled: true, fontSize: 9.2, rx: 16,
      });
      qwenArrow(parent,
        `M ${queryTile.scaleRight} 92 H 568 V 204 C 568 216 470 216 420 ${matchedOperands.top}`,
        TEAL_DARK, 1810, 1.05);
      qwenArrow(parent,
        `M ${keyTile.scaleRight} 158 H 582 V 210 C 582 220 540 220 500 ${matchedOperands.top}`,
        TEAL_DARK, 1840, 1.05);
      qwenArrow(parent, `M ${scaledGate.cx} ${scaledGate.bottom} C 810 198 700 216 580 ${matchedOperands.top}`, TEAL_DARK, 1880, 1.05);

      storyText(parent, 250, 278, "TRAIN · REBUILT PREFILL + DECODE ROWS", train, {
        "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.4,
      });
      storyText(parent, 710, 278, "SERVE · 64-ROW PAGES", infer, {
        "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.4,
      });
      addGlmKvMemory(parent, 250, 315, train, false, 2240, { filled: [0, 1, 2] });
      addGlmKvMemory(parent, 710, 315, infer, true, 2240);
      motionText(parent, 182, 294, "PREFILL", train, 2440, {
        "font-size": 8.1, "font-weight": 850,
      });
      motionText(parent, 318, 294, "DECODE", train, 2440, {
        "font-size": 8.1, "font-weight": 850,
      });
      parent.appendChild(motion(svgElement("line", {
        x1: 250, y1: 294, x2: 250, y2: 337,
        stroke: train, "stroke-width": 1, "stroke-dasharray": "3 3",
      }), 2460));
      qwenArrow(parent, "M 380 254 C 420 286 420 342 345 370", TEAL_DARK, 2300, 1.05);
      qwenArrow(parent, "M 580 254 C 540 286 540 342 615 370", TEAL_DARK, 2300, 1.05);
      qwenArrow(parent, "M 250 330 V 365", train, 2740, 1.15);
      qwenArrow(parent, "M 710 350 V 365", infer, 2740, 1.15);
      addStoryChip(parent, 250, 382, 190, "SCORE CONTIGUOUS ROWS", train, 2820, {
        height: 34, filled: true, fontSize: 9, rx: 17,
      });
      addStoryChip(parent, 710, 382, 190, "SCORE PAGED ROWS", infer, 2820, {
        height: 34, filled: true, fontSize: 9, rx: 17,
      });
      qwenArrow(parent, "M 250 399 C 270 412 356 412 405 421", train, 3040, 1.15);
      qwenArrow(parent, "M 710 399 C 690 412 604 412 555 421", infer, 3040, 1.15);
      addStoryChip(parent, 480, 438, 330, "SAME LEGAL HISTORY · LOWER POSITION WINS TIES", TEAL_DARK, 3180, {
        height: 34, filled: true, fontSize: 9.4, rx: 17,
      });
      qwenArrow(parent, "M 480 455 V 477", TEAL_DARK, 3380, 1.2);
      addGlmIndexStrip(parent, 480, 492, TEAL_DARK, ["k2", "k7", "k11", "…"], 3480, {
        filled: [0, 1, 2], width: 54, height: 30,
      });
      motionText(parent, 480, 518, "RETURN POSITIONS IN ASCENDING ORDER", TEAL_DARK, 3840, {
        "font-size": 9.3, "font-weight": 850, "letter-spacing": 0.35,
      });
    },
  });

  const addGlmContributionRow = (parent, cx, cy, color, delay = 0, options = {}) => {
    const width = options.width || 18;
    const gap = options.gap || 4;
    const start = cx - (16 * width + 15 * gap) / 2;
    const centers = [];
    for (let index = 0; index < 16; index += 1) {
      const group = svgElement("g");
      const x = start + index * (width + gap);
      group.appendChild(svgElement("rect", {
        x, y: cy - 11, width, height: 22, rx: 2,
        fill: options.highlight && index < 4 ? color : PAPER,
        "fill-opacity": options.highlight && index < 4 ? 0.72 : 1,
        stroke: color, "stroke-width": 0.9,
      }));
      group.appendChild(label(x + width / 2, cy, String(index), {
        fill: options.highlight && index < 4 ? "#fffdf7" : color,
        "font-size": 7.6, "font-weight": 820, "text-anchor": "middle",
        "dominant-baseline": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 40));
      centers.push(x + width / 2);
    }
    motionText(parent, cx, cy + 33, "c0 … c15 · BF16", color, delay + 720, {
      "font-size": 9.1, "font-weight": 850,
    });
    return centers;
  };

  const addLiteralBf16Word = (parent, cx, cy, color, bits, hex, delay = 0) => {
    const cellWidth = 9.5;
    const gap = 1.2;
    const start = cx - (16 * cellWidth + 15 * gap) / 2;
    const group = svgElement("g");
    bits.split("").forEach((bit, index) => {
      const differs = index === 15;
      group.appendChild(svgElement("rect", {
        x: start + index * (cellWidth + gap), y: cy - 10, width: cellWidth, height: 20, rx: 1.2,
        fill: bit === "1" ? color : PAPER, "fill-opacity": bit === "1" ? 0.78 : 1,
        stroke: differs ? RED_DARK : color, "stroke-width": differs ? 1.45 : 0.75,
      }));
      group.appendChild(label(start + index * (cellWidth + gap) + cellWidth / 2, cy, bit, {
        fill: bit === "1" ? "#fffdf7" : color, "font-size": 7.2,
        "font-weight": 850, "text-anchor": "middle", "dominant-baseline": "middle",
      }));
    });
    group.appendChild(label(cx, cy + 32, hex, {
      fill: color, "font-size": 9.1, "font-weight": 850, "text-anchor": "middle",
    }));
    parent.appendChild(motion(group, delay));
  };

  const addGlmFourValueFold = (parent, cx, color, aligned, delay = 0) => {
    const values = ["1", "2⁻⁸", "2⁻⁸", "0"];
    const xs = addQwenCellRow(parent, cx, 226, values, color, delay, {
      width: 60, height: 30, gap: 12, fontSize: 9.1,
    });
    motionText(parent, cx, 190, "c0…c3 SHOWN · c4…c15 = 0", color, delay + 360, {
      "font-size": 9, "font-weight": 850,
    });
    const pairLabels = aligned ? ["R(c0+c1)", "R(c2+c3)"] : ["R(c0+c3)", "R(c1+c2)"];
    const pairXs = [cx - 76, cx + 76];
    pairXs.forEach((x, index) => {
      addStoryChip(parent, x, 310, 128, pairLabels[index], color, delay + 520 + index * 80, {
        height: 34, filled: true, fontSize: 9.1, rx: 17,
      });
    });
    const pairs = aligned ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
    pairs.forEach((pair, pairIndex) => {
      pair.forEach((sourceIndex, edgeIndex) => {
        qwenArrow(parent,
          `M ${xs[sourceIndex]} 242 C ${xs[sourceIndex]} 270 ${pairXs[pairIndex] + (edgeIndex ? 18 : -18)} 274 ${pairXs[pairIndex]} 292`,
          color, delay + 420 + pairIndex * 80 + edgeIndex * 35, 1);
      });
    });
    qwenArrow(parent, `M ${pairXs[0]} 328 C ${pairXs[0]} 353 ${cx - 18} 354 ${cx} 370`, color, delay + 830, 1.1);
    qwenArrow(parent, `M ${pairXs[1]} 328 C ${pairXs[1]} 353 ${cx + 18} 354 ${cx} 370`, color, delay + 880, 1.1);
    addStoryChip(parent, cx, 389, 112, "R(a + b)", color, delay + 980, {
      height: 35, filled: true, fontSize: 9.4, rx: 17,
    });
    motionText(parent, cx, 430, aligned ? "1.0000000" : "1.0078125", color, delay + 1190, {
      "font-size": 10.5, "font-weight": 850,
    });
    addLiteralBf16Word(parent, cx, 464, color,
      aligned ? "0011111110000000" : "0011111110000001",
      aligned ? "0x3f80" : "0x3f81", delay + 1290);
    motionText(parent, cx, 525, "BF16 AFTER EACH +", color, delay + 1530, {
      "font-size": 9.2, "font-weight": 850,
    });
  };

  const addGlmAdjacentTree16 = (parent, cx, leafY, color, delay = 0, options = {}) => {
    const span = options.span || 560;
    const leafXs = Array.from({ length: 16 }, (_value, index) => cx - span / 2 + index * (span / 15));
    let nodes = leafXs.map((x, index) => {
      const group = svgElement("g");
      group.appendChild(svgElement("rect", {
        x: x - 9, y: leafY - 11, width: 18, height: 22, rx: 2,
        fill: PAPER, stroke: color, "stroke-width": 0.9,
      }));
      group.appendChild(label(x, leafY + 3, String(index), {
        fill: color, "font-size": 7.8, "font-weight": 820, "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 35));
      return { x, y: leafY + 12 };
    });
    for (let level = 0; level < 4; level += 1) {
      const next = [];
      const nextY = leafY + 43 + level * 48;
      for (let index = 0; index < nodes.length; index += 2) {
        const x = (nodes[index].x + nodes[index + 1].x) / 2;
        qwenArrow(parent, `M ${nodes[index].x} ${nodes[index].y} L ${x} ${nextY - 11}`,
          color, delay + 650 + level * 410 + index * 22, 0.85);
        qwenArrow(parent, `M ${nodes[index + 1].x} ${nodes[index + 1].y} L ${x} ${nextY - 11}`,
          color, delay + 690 + level * 410 + index * 22, 0.85);
        const group = svgElement("g");
        group.appendChild(svgElement("circle", {
          cx: x, cy: nextY, r: 9,
          fill: level === 3 ? color : PAPER, stroke: color, "stroke-width": 1.1,
        }));
        group.appendChild(label(x, nextY + 3.8, "+", {
          fill: level === 3 ? "#fffdf7" : color,
          "font-size": 10, "font-weight": 850, "text-anchor": "middle",
        }));
        parent.appendChild(motion(group, delay + 790 + level * 410 + index * 22));
        next.push({ x, y: nextY + 10 });
      }
      motionText(parent, cx + span / 2 + 30, nextY + 3, "BF16", color,
        delay + 850 + level * 410, { "font-size": 8.4, "font-weight": 850, "text-anchor": "start" });
      nodes = next;
    }
    return nodes[0];
  };

  const glmCombine = null;

  /* --- DSV4 · four-stream mHC mixing -------------------------------------- */

  const addDsvStreamStack = (parent, cx, cy, color, delay = 0, options = {}) => {
    const width = options.width || 112;
    const height = options.height || 18;
    const gap = options.gap ?? 7;
    const labels = options.labels || ["s0", "s1", "s2", "s3"];
    const centers = [];
    labels.forEach((copy, index) => {
      const y = cy + (index - (labels.length - 1) / 2) * (height + gap);
      const group = svgElement("g");
      group.appendChild(svgElement("rect", {
        x: cx - width / 2,
        y: y - height / 2,
        width,
        height,
        rx: height / 2,
        fill: index === options.filled ? color : PAPER,
        "fill-opacity": index === options.filled ? 0.78 : 1,
        stroke: color,
        "stroke-width": index === options.focus ? 1.7 : 1,
      }));
      group.appendChild(label(cx, y + 3.5, copy, {
        fill: index === options.filled ? "#fffdf7" : color,
        "font-size": 8.7,
        "font-weight": 830,
        "text-anchor": "middle",
      }));
      parent.appendChild(motion(group, delay + index * 70));
      centers.push({ x: cx, y });
    });
    const totalHeight = labels.length * height + (labels.length - 1) * gap;
    return {
      left: cx - width / 2,
      right: cx + width / 2,
      top: cy - totalHeight / 2,
      bottom: cy + totalHeight / 2,
      centers,
    };
  };

  const addDsvMixMatrix = (parent, cx, cy, copy, color, delay = 0, options = {}) => {
    const rows = options.rows || 4;
    const columns = options.columns || 4;
    const matrix = addMatrixGlyph(parent, cx, cy, rows, columns, color, {
      cellWidth: options.cellWidth || 9,
      cellHeight: options.cellHeight || 9,
      gap: 2,
      delay,
      highlighted: options.highlighted || [0, 5, 10, 15],
    });
    if (copy) {
      motionText(parent, cx, matrix.bottom + 19, copy, color, delay + 430, {
        "font-size": 8.7,
        "font-weight": 850,
        "letter-spacing": 0.35,
      });
    }
    return matrix;
  };

  const dsv4Mhc = drawKernelStory("dsv4-mhc", {
    intervalMs: 9000,
    drawAligned: (parent) => {
      const inputStreams = addDsvStreamStack(parent, 165, 128, TEAL_DARK, 180, { width: 90 });
      const inputBus = svgElement("g");
      inputBus.appendChild(svgElement("line", {
        x1: 230, y1: inputStreams.centers[0].y, x2: 230,
        y2: inputStreams.centers.at(-1).y, stroke: TEAL_DARK, "stroke-width": 1.1,
      }));
      inputStreams.centers.forEach(({ y }) => inputBus.appendChild(svgElement("line", {
        x1: inputStreams.right, y1: y, x2: 230, y2: y,
        stroke: TEAL_DARK, "stroke-width": 1,
      })));
      parent.appendChild(motion(inputBus, 480));
      qwenArrow(parent, "M 230 128 H 265", TEAL_DARK, 600, 1.35);
      addDsvMixMatrix(parent, 286, 128, "PRE-MIX + RMSNORM", TEAL_DARK, 600, {
        rows: 1, columns: 4, highlighted: [0, 1, 2, 3],
      });
      qwenArrow(parent, "M 307 128 H 357", TEAL_DARK, 1040, 1.35);
      addStoryChip(parent, 431, 128, 148, "ATTENTION / MoE", TEAL_DARK, 1130, {
        height: 42, filled: true, fontSize: 9.4, rx: 9,
      });
      qwenArrow(parent, "M 505 128 H 539", TEAL_DARK, 1340, 1.35);
      addDsvMixMatrix(parent, 560, 128, "", TEAL_DARK, 1430, {
        highlighted: [0, 1, 5, 6, 10, 11, 14, 15],
      });
      addDsvMixMatrix(parent, 620, 128, "", TEAL_DARK, 1510, {
        rows: 4, columns: 1, highlighted: [0, 1, 2, 3],
      });
      motionText(parent, 590, 179, "POST-MIX MATRIX + WEIGHTS", TEAL_DARK, 1870, {
        "font-size": 8.5, "font-weight": 850, "letter-spacing": 0.3,
      });
      const outputStreams = addDsvStreamStack(parent, 704, 128, TEAL_DARK, 2050, {
        width: 90, labels: ["s′0", "s′1", "s′2", "s′3"],
      });
      qwenArrow(parent, "M 625 128 H 642", TEAL_DARK, 1900, 1.35);
      const outputBus = svgElement("g");
      outputBus.appendChild(svgElement("line", {
        x1: 642, y1: outputStreams.centers[0].y, x2: 642,
        y2: outputStreams.centers.at(-1).y, stroke: TEAL_DARK, "stroke-width": 1.1,
      }));
      outputStreams.centers.forEach(({ y }) => outputBus.appendChild(svgElement("line", {
        x1: 642, y1: y, x2: outputStreams.left, y2: y,
        stroke: TEAL_DARK, "stroke-width": 1,
      })));
      parent.appendChild(motion(outputBus, 1980));
      const nextBus = svgElement("g");
      nextBus.appendChild(svgElement("line", {
        x1: 768, y1: outputStreams.centers[0].y, x2: 768,
        y2: outputStreams.centers.at(-1).y, stroke: TEAL_DARK, "stroke-width": 1.1,
      }));
      outputStreams.centers.forEach(({ y }) => nextBus.appendChild(svgElement("line", {
        x1: outputStreams.right, y1: y, x2: 768, y2: y,
        stroke: TEAL_DARK, "stroke-width": 1,
      })));
      parent.appendChild(motion(nextBus, 2320));
      qwenArrow(parent, "M 768 128 H 795", TEAL_DARK, 2380, 1.35);
      addStoryChip(parent, 853, 128, 116, "NEXT BLOCK", TEAL_DARK, 2470, {
        height: 34, fontSize: 9, rx: 17,
      });

      motionText(parent, 480, 244,
        "BOTH ENGINES RUN THIS SGLANG FORWARD; XORL IMPLEMENTS ITS BACKWARD",
        TEAL_DARK, 2580, {
          "font-size": 9.2, "font-weight": 850, "letter-spacing": 0.25,
        });
    },
  });

  /* --- DSV4 · C0 / C4 / C128 compressed sparse attention ----------------- */

  const addDsvFp8Badge = (parent, cx, cy, color, delay = 0) => {
    const badge = svgElement("g");
    badge.appendChild(svgElement("rect", {
      x: cx - 23, y: cy - 11, width: 46, height: 22, rx: 11, fill: color,
    }));
    badge.appendChild(label(cx, cy, "FP8", {
      fill: "#fffdf7", "font-size": 8.6, "font-weight": 850,
      "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(badge, delay));
    return { left: cx - 23, right: cx + 23, top: cy - 11, bottom: cy + 11, cx, cy };
  };

  const addDsvTileGauge = (parent, cx, cy, color, filledWidth, delay = 0) => {
    parent.appendChild(motion(svgElement("rect", {
      x: cx - 75, y: cy - 4.5, width: 150, height: 9, rx: 4.5,
      fill: TRACK, stroke: color, "stroke-width": 0.8,
    }), delay));
    parent.appendChild(motion(svgElement("rect", {
      x: cx - 75, y: cy - 4.5, width: filledWidth, height: 9, rx: 4.5,
      fill: color, opacity: 0.72,
    }), delay + 60));
  };

  const dsv4Attention = drawKernelStory("dsv4-attention", {
    intervalMs: 11000,
    drawAligned: (parent) => {
      storyText(parent, 480, 80, "C4 / C128 COMPRESSED-ATTENTION LAYERS", TEAL_DARK, {
        "font-size": 9.2, "font-weight": 850, "letter-spacing": 0.4,
      });

      motionText(parent, 250, 106, "STATE AFTER TOKEN t", TEAL_DARK, 100, {
        "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.5,
      });
      motionText(parent, 250, 122, "SEEDED BY THE SAME SGLANG PREFILL KERNELS", TEAL_DARK, 160, {
        "font-size": 7.8, "font-weight": 800, "letter-spacing": 0.3,
      });
      addStoryChip(parent, 480, 112, 158, "DECODE TOKEN t+1", TEAL_DARK, 900, {
        height: 34, filled: true, fontSize: 9.2, rx: 17,
      });
      motionText(parent, 712, 106, "STATE AFTER TOKEN t+1", TEAL_DARK, 1500, {
        "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.5,
      });
      motionText(parent, 712, 122, "CARRIED INTO THE NEXT DECODE STEP", TEAL_DARK, 1560, {
        "font-size": 7.8, "font-weight": 800, "letter-spacing": 0.3,
      });

      // The raw window: the paged cache simply advances by one token.
      motionText(parent, 250, 158, "RECENT-TOKEN PAGED CACHE · RAW 128-TOKEN WINDOW", TEAL_DARK, 240, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 250, 186, ["…", "t₋₂", "t₋₁", "t"], TEAL_DARK, 300, {
        width: 36, height: 26, gap: 4, fontSize: 8.8, focus: 3,
      });
      qwenArrow(parent, "M 346 186 H 614", TEAL_DARK, 1050, 1.2);
      motionText(parent, 480, 172, "WINDOW ADVANCES ONE TOKEN", TEAL_DARK, 1110, {
        "font-size": 8.2, "font-weight": 800,
      });
      addQwenCellRow(parent, 712, 186, ["…", "t₋₁", "t", "t+1"], TEAL_DARK, 1650, {
        width: 36, height: 26, gap: 4, fontSize: 8.8, filled: [3],
      });

      // The FP32 accumulators: token t+1 completes the pending C4 group.
      motionText(parent, 250, 246, "FP32 COMPRESSOR STATE", TEAL_DARK, 380, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 250, 274, ["", "", "", ""], TEAL_DARK, 440, {
        width: 26, height: 22, gap: 4, filled: [0, 1, 2],
      });
      motionText(parent, 250, 304, "PARTIAL C4 GROUP · 3 OF 4 TOKENS", TEAL_DARK, 500, {
        "font-size": 7.8, "font-weight": 800,
      });
      addDsvTileGauge(parent, 250, 322, TEAL_DARK, 92, 560);
      motionText(parent, 250, 344, "PARTIAL C128 TILE", TEAL_DARK, 600, {
        "font-size": 7.8, "font-weight": 800,
      });
      qwenArrow(parent, "M 346 282 H 614", TEAL_DARK, 1150, 1.2);
      motionText(parent, 480, 268, "POOL TOKEN t+1 WITH FP32 WEIGHTS", TEAL_DARK, 1210, {
        "font-size": 8.2, "font-weight": 800,
      });
      motionText(parent, 712, 246, "THE FOUR-TOKEN GROUP COMPLETES", TEAL_DARK, 1780, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 668, 274, ["", "", "", ""], TEAL_DARK, 1840, {
        width: 26, height: 22, gap: 4, filled: [0, 1, 2, 3],
      });
      qwenArrow(parent, "M 730 274 H 756", TEAL_DARK, 2040, 1.1);
      addDsvFp8Badge(parent, 786, 274, TEAL_DARK, 2140);
      motionText(parent, 676, 304, "POOL · NORMALIZE · ROPE → STORE FP8", TEAL_DARK, 2200, {
        "font-size": 7.8, "font-weight": 800,
      });
      addDsvTileGauge(parent, 712, 322, TEAL_DARK, 96, 2260);
      motionText(parent, 712, 344, "C128 TILE STILL FILLING", TEAL_DARK, 2300, {
        "font-size": 7.8, "font-weight": 800,
      });

      // The FP8 cache: the finished summary lands at the serving boundary.
      motionText(parent, 250, 380, "C4 + C128 FP8 CACHE · COMPLETED SUMMARIES", TEAL_DARK, 640, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 250, 408, ["c0", "c1", "…", "c8"], TEAL_DARK, 700, {
        width: 36, height: 24, gap: 4, fontSize: 8.6,
      });
      addQwenCellRow(parent, 250, 440, ["C0", "C1"], TEAL_DARK, 780, {
        width: 48, height: 24, gap: 6, fontSize: 8.6,
      });
      motionText(parent, 250, 474, "C4 · ONE OVERLAPPING SUMMARY EVERY 4 TOKENS", TEAL_DARK, 830, {
        "font-size": 7.6, "font-weight": 800,
      });
      motionText(parent, 250, 488, "C128 · ONE PER COMPLETED 128-TOKEN TILE", TEAL_DARK, 860, {
        "font-size": 7.6, "font-weight": 800,
      });
      qwenArrow(parent, "M 346 424 H 614", TEAL_DARK, 1250, 1.2);
      motionText(parent, 480, 410, "COMPLETED ROWS CARRY FORWARD UNCHANGED", TEAL_DARK, 1310, {
        "font-size": 8.2, "font-weight": 800,
      });
      qwenArrow(parent, "M 786 285 C 800 322 788 360 774 392", TEAL_DARK, 2420, 1.2);
      addQwenCellRow(parent, 712, 408, ["c0", "…", "c8", "c9"], TEAL_DARK, 2560, {
        width: 36, height: 24, gap: 4, fontSize: 8.6, filled: [3], focus: 3,
      });
      addQwenCellRow(parent, 712, 440, ["C0", "C1"], TEAL_DARK, 2620, {
        width: 48, height: 24, gap: 6, fontSize: 8.6,
      });
      motionText(parent, 712, 474, "APPENDED AT THE SAME BOUNDARY AS SERVING", TEAL_DARK, 2700, {
        "font-size": 8.2, "font-weight": 850,
      });
      motionText(parent, 712, 488, "READ BY LATER QUERIES", TEAL_DARK, 2760, {
        "font-size": 7.6, "font-weight": 800,
      });

      motionText(parent, 480, 520, "TRAINING REPLAYS THE SAME PREFILL SEED AND DECODE STATE TRANSITIONS", TEAL_DARK, 3040, {
        "font-size": 8.9, "font-weight": 850, "letter-spacing": 0.25,
      });
    },
  });

  /* --- DSV4 · packed MXFP4 experts with LoRA ------------------------------ */

  const addDsvPackedTile = (parent, cx, cy, color, delay = 0, options = {}) => {
    const rows = options.rows || 4;
    const columns = options.columns || 4;
    const cellWidth = options.cellWidth || 16;
    const cellHeight = options.cellHeight || 10;
    const gap = 2.5;
    const width = columns * cellWidth + (columns - 1) * gap;
    const height = rows * cellHeight + (rows - 1) * gap;
    const left = cx - width / 2;
    const top = cy - height / 2;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = left + column * (cellWidth + gap);
        const y = top + row * (cellHeight + gap);
        const cell = svgElement("g");
        cell.appendChild(svgElement("rect", {
          x, y, width: cellWidth, height: cellHeight, rx: 1.6,
          fill: PAPER, stroke: color, "stroke-width": 1,
        }));
        // Two 4-bit values share each cell; the seam stays because the
        // weights are never widened to BF16.
        cell.appendChild(svgElement("line", {
          x1: x + cellWidth / 2, y1: y + 1.8, x2: x + cellWidth / 2,
          y2: y + cellHeight - 1.8, stroke: color, "stroke-width": 0.9, opacity: 0.5,
        }));
        parent.appendChild(motion(cell, delay + (row * columns + column) * 18));
      }
    }
    return {
      left, right: left + width, top, bottom: top + height, cx, cy,
      ports: {
        left: { x: left, y: cy }, right: { x: left + width, y: cy },
        top: { x: cx, y: top }, bottom: { x: cx, y: top + height },
      },
    };
  };

  const addDsvLoraPair = (parent, cx, cy, color, delay = 0) => {
    addMatrixGlyph(parent, cx - 22, cy + 3, 2, 3, color, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay,
    });
    addMatrixGlyph(parent, cx + 22, cy, 3, 2, color, {
      cellWidth: 8, cellHeight: 8, gap: 2, delay: delay + 80,
    });
    return { left: cx - 37, right: cx + 31, cx, cy };
  };

  const addDsvOpNode = (parent, cx, cy, color, copy, delay = 0, radius = 13) => {
    const node = svgElement("g");
    node.appendChild(svgElement("circle", { cx, cy, r: radius, fill: color }));
    node.appendChild(label(cx, cy, copy, {
      fill: "#fffdf7", "font-size": copy.length > 1 ? 9.5 : 13, "font-weight": 850,
      "text-anchor": "middle", "dominant-baseline": "middle",
    }));
    parent.appendChild(motion(node, delay));
    return {
      left: cx - radius, right: cx + radius, top: cy - radius, bottom: cy + radius, cx, cy,
    };
  };

  const dsv4Experts = drawKernelStory("dsv4-experts", {
    intervalMs: 10000,
    drawAligned: (parent) => {
      storyText(parent, 480, 80,
        "MARLIN CAN RETURN DIFFERENT BITS AT DIFFERENT ROW COUNTS · BOTH ENGINES RUN THE SAME CHUNKS",
        TEAL_DARK, { "font-size": 9.2, "font-weight": 850, "letter-spacing": 0.4 });

      // Gate/up: BF16 LoRA joins after the packed projection.
      // The notes sit above the row so the LoRA branch below has a clear lane.
      motionText(parent, 88, 94, "ROUTED ROWS · BF16", TEAL_DARK, 60, {
        "font-size": 8.2, "font-weight": 850,
      });
      motionText(parent, 88, 106, "SERVING CHUNK SIZE", TEAL_DARK, 150, {
        "font-size": 7.6, "font-weight": 800,
      });
      motionText(parent, 88, 117, "EVEN ONE UNPADDED DECODE ROW", TEAL_DARK, 170, {
        "font-size": 7.6, "font-weight": 800,
      });
      addQwenCellRow(parent, 88, 134, ["", "", "", ""], TEAL_DARK, 100, {
        width: 17, height: 22, gap: 3,
      });
      qwenArrow(parent, "M 130 134 H 156", TEAL_DARK, 260, 1.25);
      motionText(parent, 210, 102, "GATE/UP · PACKED MXFP4", TEAL_DARK, 320, {
        "font-size": 8.2, "font-weight": 850,
      });
      const gateTile = addDsvPackedTile(parent, 210, 134, TEAL_DARK, 380);
      motionText(parent, 210, 172, "STAYS PACKED", TEAL_DARK, 450, {
        "font-size": 7.6, "font-weight": 800,
      });
      qwenArrow(parent, `M ${gateTile.right + 2} 134 H 270`, TEAL_DARK, 540, 1.25);
      addKernelGlyph(parent, 324, 134, 104, TEAL_DARK, "MARLIN GEMM", 620);
      qwenArrow(parent, "M 376 134 H 404", TEAL_DARK, 740, 1.25);
      motionText(parent, 421, 106, "ADD BF16 LORA", TEAL_DARK, 1120, {
        "font-size": 8.2, "font-weight": 850,
      });
      addDsvOpNode(parent, 421, 134, TEAL_DARK, "+", 1120);
      qwenArrow(parent, "M 88 145 V 194 C 88 208 106 216 128 218", TEAL_DARK, 820, 1.1);
      addDsvLoraPair(parent, 176, 218, TEAL_DARK, 900);
      motionText(parent, 176, 196, "BF16 LORA A·B", TEAL_DARK, 970, {
        "font-size": 8.2, "font-weight": 850,
      });
      qwenArrow(parent, "M 210 218 C 320 218 396 182 414 150", TEAL_DARK, 1030, 1.1);
      qwenArrow(parent, "M 434 134 H 460", TEAL_DARK, 1200, 1.25);
      addStoryChip(parent, 532, 134, 138, "CLAMP + SwiGLU", TEAL_DARK, 1290, {
        height: 36, fontSize: 9.2, rx: 18,
      });
      motionText(parent, 532, 166, "KEPT FROM SERVING", TEAL_DARK, 1350, {
        "font-size": 7.6, "font-weight": 800,
      });
      qwenArrow(parent, "M 601 134 H 626", TEAL_DARK, 1440, 1.25);
      motionText(parent, 662, 106, "h · BF16", TEAL_DARK, 1520, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 662, 134, ["", "", "", ""], TEAL_DARK, 1540, {
        width: 17, height: 22, gap: 3,
      });

      // Down projection: one routing weight multiplies each path before
      // the single rounded add.
      qwenArrow(parent, "M 662 147 C 662 214 420 224 260 232 C 130 238 66 262 66 296", TEAL_DARK, 1650, 1.2);
      parent.appendChild(motion(svgElement("circle", { cx: 66, cy: 300, r: 3.4, fill: TEAL_DARK }), 1780));
      qwenArrow(parent, "M 66 304 C 66 292 96 300 116 300", TEAL_DARK, 1820, 1.1);
      qwenArrow(parent, "M 66 304 C 66 330 100 364 136 364", TEAL_DARK, 1860, 1.1);
      motionText(parent, 262, 268, "PACKED BASE DOWN × w", TEAL_DARK, 1900, {
        "font-size": 8.4, "font-weight": 850,
      });
      const downTile = addDsvPackedTile(parent, 155, 300, TEAL_DARK, 1900);
      qwenArrow(parent, `M ${downTile.right + 2} 300 H 216`, TEAL_DARK, 2040, 1.2);
      addKernelGlyph(parent, 270, 300, 100, TEAL_DARK, "MARLIN GEMM", 2100);
      qwenArrow(parent, "M 320 300 H 350", TEAL_DARK, 2220, 1.2);
      addDsvOpNode(parent, 372, 300, TEAL_DARK, "×w", 2300, 14);
      addDsvLoraPair(parent, 176, 364, TEAL_DARK, 1980);
      motionText(parent, 200, 396, "BF16 LORA DELTA × w", TEAL_DARK, 2050, {
        "font-size": 8.4, "font-weight": 850,
      });
      qwenArrow(parent, "M 210 364 H 350", TEAL_DARK, 2160, 1.2);
      addDsvOpNode(parent, 372, 364, TEAL_DARK, "×w", 2380, 14);
      qwenArrow(parent, "M 386 300 C 416 300 432 314 444 322", TEAL_DARK, 2460, 1.2);
      qwenArrow(parent, "M 386 364 C 416 364 432 350 444 342", TEAL_DARK, 2500, 1.2);
      addDsvOpNode(parent, 460, 332, TEAL_DARK, "+", 2580);
      qwenArrow(parent, "M 474 332 H 500", TEAL_DARK, 2660, 1.25);
      addCastBadge(parent, 525, 332, TEAL_DARK, 2740);
      motionText(parent, 525, 364, "THE SUM ROUNDS ONCE", TEAL_DARK, 2800, {
        "font-size": 8.2, "font-weight": 850,
      });

      // The finished row is one of six routed slots per token.
      qwenArrow(parent, "M 546 332 H 612", TEAL_DARK, 2880, 1.25);
      motionText(parent, 700, 268, "SIX ROUTED SLOTS PER TOKEN", TEAL_DARK, 2960, {
        "font-size": 8.2, "font-weight": 850,
      });
      addQwenCellRow(parent, 700, 332, ["1", "2", "3", "4", "5", "6"], TEAL_DARK, 3020, {
        width: 24, height: 26, gap: 4, fontSize: 8.6, filled: [2],
      });
      motionText(parent, 700, 364, "SUMMED IN RETURNED ORDER", TEAL_DARK, 3140, {
        "font-size": 8.2, "font-weight": 850,
      });
      qwenArrow(parent, "M 786 332 H 812", TEAL_DARK, 3220, 1.25);
      addResultValue(parent, 838, 332, TEAL_DARK, { kind: "vector", delay: 3300 });
      motionText(parent, 838, 372, "OUT · BF16", TEAL_DARK, 3360, {
        "font-size": 8.2, "font-weight": 850,
      });
    },
  });

  return {
    rope, norm, gemm, moeCombine, gdn, glmSelector, glmCombine,
    dsv4Mhc, dsv4Attention, dsv4Experts,
  };
}

function drawContractMap() {
  const layer = layerOf("contract-map-svg");
  if (!layer) return;
  const centered = (parent, x, y, copy, color = MUTED, attributes = {}) => {
    parent.appendChild(label(x, y, copy, {
      fill: color, "font-size": 10, "font-weight": 760,
      "text-anchor": "middle", ...attributes,
    }));
  };
  const chip = (parent, box, copy, options = {}) => {
    const stroke = options.stroke || LINE;
    const fill = options.fill || "#fffdf7";
    parent.appendChild(svgElement("rect", {
      x: box.x, y: box.y, width: box.w, height: box.h,
      rx: options.rx ?? Math.min(16, box.h / 2), fill, stroke,
      "stroke-width": options.strokeWidth || 1.35,
    }));
    fitTextInBox(parent, box, copy, {
      fill: options.textColor || stroke,
      "font-size": options.fontSize || 9,
      "font-weight": options.fontWeight || 820,
      "letter-spacing": options.letterSpacing || 0.2,
      "text-anchor": "middle",
    }, {
      padding: options.padding ?? 10,
      verticalPadding: options.verticalPadding ?? 5,
      minFontSize: options.minFontSize || 9,
      lineHeightRatio: options.lineHeightRatio || 1.18,
    });
    return {
      left: box.x, right: box.x + box.w, top: box.y, bottom: box.y + box.h,
      cx: box.x + box.w / 2, cy: box.y + box.h / 2,
    };
  };
  const arrow = (parent, d, tipX, tipY, direction, color = SOFT, options = {}) => {
    parent.appendChild(wire(d, {
      stroke: color, "stroke-width": options.width || 1.45,
      ...(options.dashed ? { "stroke-dasharray": "5 4" } : {}),
    }));
    const size = options.headSize || 6;
    const points = {
      right: `${tipX},${tipY} ${tipX - size},${tipY - size * 0.62} ${tipX - size},${tipY + size * 0.62}`,
      left: `${tipX},${tipY} ${tipX + size},${tipY - size * 0.62} ${tipX + size},${tipY + size * 0.62}`,
      down: `${tipX},${tipY} ${tipX - size * 0.62},${tipY - size} ${tipX + size * 0.62},${tipY - size}`,
      up: `${tipX},${tipY} ${tipX - size * 0.62},${tipY + size} ${tipX + size * 0.62},${tipY + size}`,
    };
    parent.appendChild(svgElement("polygon", { points: points[direction], fill: color }));
  };
  const byteStrip = (parent, x, y, color, changed = false) => {
    const count = 8;
    const width = 9;
    const gap = 3;
    for (let index = 0; index < count; index += 1) {
      parent.appendChild(svgElement("rect", {
        x: x + index * (width + gap), y, width, height: 12, rx: 2,
        fill: changed && index === 5 ? color : "#fffdf7",
        stroke: color, "stroke-width": 1,
      }));
    }
  };
  const operation = (parent, cx, cy, copy) => {
    parent.appendChild(svgElement("rect", {
      x: cx - 18, y: cy - 11, width: 36, height: 22, rx: 6,
      fill: "#fffdf7", stroke: LINE, "stroke-width": 1.1,
    }));
    centered(parent, cx, cy + 0.5, copy, SOFT, {
      "font-size": 9, "font-weight": 820, "dominant-baseline": "middle",
    });
  };
  const stage = (index) => {
    const group = svgElement("g", { "data-step": index });
    layer.appendChild(group);
    return group;
  };

  centered(layer, 480, 29, "START AT THE OUTPUT · TRACE BACKWARD TO THE FIRST DIFFERENCE", INK, {
    "font-size": 12.5, "font-weight": 850, "letter-spacing": 0.7,
  });
  layer.appendChild(svgElement("line", {
    x1: 32, y1: 50, x2: 928, y2: 50, stroke: LINE_FAINT, "stroke-width": 1,
  }));

  // 0 · Establish the end-to-end invariant across all three forward paths.
  {
    const group = stage(0);
    group.appendChild(svgElement("rect", {
      x: 32, y: 62, width: 896, height: 128, rx: 18,
      fill: "rgba(255,253,247,0.54)", stroke: LINE_FAINT, "stroke-width": 1,
    }));
    chip(group, { x: 46, y: 88, w: 112, h: 76 }, "SAME INPUTS + WEIGHTS", {
      stroke: INK, textColor: INK, fontSize: 9.8, rx: 12,
    });
    centered(group, 430, 80, "FORWARD OPERATIONS", SOFT, {
      "font-size": 9.2, "font-weight": 820, "letter-spacing": 0.5,
    });
    centered(group, 690, 80, "FP32 SELECTED-TOKEN LOGPROB BYTES", SOFT, {
      "font-size": 9.2, "font-weight": 820, "letter-spacing": 0.35,
    });

    const rows = [96, 126, 156];
    const colors = [TRAINING_COLOR, SERVING_COLOR, SERVING_COLOR];
    const names = ["XORL SCORE", "SGLANG PREFILL", "SGLANG DECODE"];
    const resultNames = ["qₜ", "sᵖₜ", "sᵈₜ"];
    const operationXs = [335, 405, 475, 545];
    rows.forEach((y, rowIndex) => {
      const color = colors[rowIndex];
      arrow(group, `M 158 126 C 190 126 188 ${y} 214 ${y}`, 214, y, "right", color, { width: 1.25, headSize: 5 });
      centered(group, 222, y + 3, names[rowIndex], color, {
        "font-size": 9.1, "font-weight": 850, "text-anchor": "start",
      });
      arrow(group, `M 304 ${y} H 317`, 317, y, "right", color, { width: 1.15, headSize: 4 });
      operationXs.forEach((x, index) => {
        operation(group, x, y, `op${index + 1}`);
        if (index < operationXs.length - 1) {
          arrow(group, `M ${x + 19} ${y} H ${operationXs[index + 1] - 19}`, operationXs[index + 1] - 19, y, "right", color, { width: 1.05, headSize: 4 });
        }
      });
      arrow(group, `M 564 ${y} H 598`, 598, y, "right", color, { width: 1.15, headSize: 5 });
      centered(group, 613, y + 3, resultNames[rowIndex], color, {
        "font-size": 9.4, "font-weight": 850,
      });
      // The diagram teaches a three-way comparison, not a claim that any
      // particular pair of forwards necessarily agrees before the repair.
      byteStrip(group, 628, y - 6, color, rowIndex === 1);
    });

    const mismatch = svgElement("g", { "data-step": 0, "data-until": 3 });
    mismatch.appendChild(svgElement("path", {
      d: "M 734 87 H 744 V 165 H 734", fill: "none", stroke: RED_DARK, "stroke-width": 1.5,
    }));
    mismatch.appendChild(svgElement("circle", { cx: 772, cy: 126, r: 17, fill: "#f8e3dc" }));
    centered(mismatch, 772, 127, "≠", RED_DARK, {
      "font-size": 18, "font-weight": 900, "dominant-baseline": "middle",
    });
    centered(mismatch, 846, 121, "OUTPUT BYTES", RED_DARK, {
      "font-size": 9.8, "font-weight": 850,
    });
    centered(mismatch, 846, 137, "DIFFER", RED_DARK, {
      "font-size": 9.8, "font-weight": 850,
    });
    group.appendChild(mismatch);
  }

  // 1 · The output difference tells us where to look, not what to assume.
  {
    const group = stage(1);
    const trace = svgElement("g", { "data-step": 1, "data-until": 3 });
    trace.appendChild(svgElement("rect", {
      x: 450, y: 82, width: 50, height: 88, rx: 10,
      fill: "rgba(228,94,82,0.08)", stroke: RED_DARK, "stroke-width": 1.45,
    }));
    arrow(trace, "M 772 143 V 198 H 475 V 170", 475, 170, "up", RED_DARK, { width: 1.55 });
    centered(trace, 637, 191, "WALK BACKWARD", RED_DARK, {
      "font-size": 9.6, "font-weight": 850, "letter-spacing": 0.45,
    });
    centered(trace, 475, 218, "FIRST DIFFERING OPERATION", RED_DARK, {
      "font-size": 9.7, "font-weight": 850, "letter-spacing": 0.35,
    });
    group.appendChild(trace);
  }

  // 2 · Expand the first differing operation into the four surfaces that can
  // decide its output bytes. These are intentionally generic; the exhaustive
  // operation inventory belongs in the reference table at the end.
  {
    const group = stage(2);
    arrow(group, "M 450 170 C 426 184 426 218 450 232", 450, 232, "down", RED_DARK, {
      width: 1.35, headSize: 5,
    });
    group.appendChild(svgElement("rect", {
      x: 32, y: 232, width: 896, height: 140, rx: 18,
      fill: "rgba(255,253,247,0.7)", stroke: RED_DARK, "stroke-width": 1.15,
    }));
    centered(group, 480, 255, "RECORD THE OPERATION'S COMPLETE NUMERICAL PROGRAM", RED_DARK, {
      "font-size": 10.5, "font-weight": 850, "letter-spacing": 0.45,
    });
    [256, 480, 704].forEach((x) => group.appendChild(svgElement("line", {
      x1: x, y1: 270, x2: x, y2: 354, stroke: LINE_FAINT, "stroke-width": 1,
    })));

    // Exact input bytes and constants.
    byteStrip(group, 90, 289, RED_DARK, false);
    centered(group, 144, 322, "INPUT BYTES", RED_DARK, { "font-size": 9.5, "font-weight": 850 });
    centered(group, 144, 338, "+ CONSTANTS", RED_DARK, { "font-size": 9.5, "font-weight": 850 });

    // Precision and rounding points.
    chip(group, { x: 303, y: 282, w: 52, h: 26 }, "FP32", {
      stroke: RED_DARK, textColor: RED_DARK, fontSize: 9.2, padding: 4, rx: 13,
    });
    arrow(group, "M 355 295 H 378", 378, 295, "right", RED_DARK, { width: 1.2, headSize: 5 });
    chip(group, { x: 378, y: 282, w: 58, h: 26 }, "BF16", {
      stroke: RED_DARK, fill: RED_DARK, textColor: "#fffdf7", fontSize: 9.2, padding: 4, rx: 13,
    });
    centered(group, 368, 329, "PRECISION +", RED_DARK, { "font-size": 9.5, "font-weight": 850 });
    centered(group, 368, 345, "ROUNDING POINTS", RED_DARK, { "font-size": 9.5, "font-weight": 850 });

    // Full reduction order.
    const leaves = [550, 578, 606, 634];
    leaves.forEach((x) => group.appendChild(svgElement("circle", { cx: x, cy: 282, r: 4, fill: RED_DARK })));
    [[550, 578, 564], [606, 634, 620]].forEach(([left, right, target]) => {
      group.appendChild(wire(`M ${left} 287 L ${target} 304 L ${right} 287`, { stroke: RED_DARK, "stroke-width": 1.2 }));
      group.appendChild(svgElement("circle", { cx: target, cy: 304, r: 4, fill: "#fffdf7", stroke: RED_DARK, "stroke-width": 1.2 }));
    });
    group.appendChild(wire("M 564 309 L 592 322 L 620 309", { stroke: RED_DARK, "stroke-width": 1.2 }));
    group.appendChild(svgElement("circle", { cx: 592, cy: 322, r: 5, fill: RED_DARK }));
    centered(group, 592, 342, "GROUPING + COMPLETE", RED_DARK, { "font-size": 9.3, "font-weight": 850 });
    centered(group, 592, 357, "ADDITION ORDER", RED_DARK, { "font-size": 9.3, "font-weight": 850 });

    // State/value identity and logical order.
    const physical = [["c", 754], ["a", 796], ["b", 838]];
    const logical = [["a", 754], ["b", 796], ["c", 838]];
    physical.forEach(([copy, x], index) => {
      group.appendChild(svgElement("rect", { x: x - 14, y: 278, width: 28, height: 22, rx: 5, fill: "#fffdf7", stroke: SOFT, "stroke-width": 1 }));
      centered(group, x, 289, copy, SOFT, { "font-size": 9, "dominant-baseline": "middle" });
      const target = logical.find(([logicalCopy]) => logicalCopy === copy)[1];
      group.appendChild(wire(`M ${x} 301 C ${x} 310 ${target} 310 ${target} 318`, { stroke: RED_DARK, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    });
    logical.forEach(([copy, x]) => {
      group.appendChild(svgElement("rect", { x: x - 14, y: 318, width: 28, height: 22, rx: 5, fill: "#fffdf7", stroke: RED_DARK, "stroke-width": 1.1 }));
      centered(group, x, 329, copy, RED_DARK, { "font-size": 9, "dominant-baseline": "middle" });
    });
    centered(group, 796, 347, "STATE / VALUE IDENTITY", RED_DARK, {
      "font-size": 9.1, "font-weight": 850,
    });
    centered(group, 796, 361, "+ LOGICAL ORDER", RED_DARK, {
      "font-size": 9.1, "font-weight": 850,
    });
  }

  // 3 · Shrink the failure, align it, and pass the production-shape gate.
  {
    const group = stage(3);
    arrow(group, "M 167 373 V 390", 167, 390, "down", RED_DARK, { width: 1.35, headSize: 5 });
    group.appendChild(svgElement("rect", {
      x: 42, y: 390, width: 250, height: 50, rx: 16,
      fill: "#fffdf7", stroke: RED_DARK, "stroke-width": 1.35,
    }));
    centered(group, 167, 408, "MINIMIZE THE MISMATCH", RED_DARK, {
      "font-size": 9.8, "font-weight": 850,
    });
    centered(group, 167, 427, "one row · one reduction · one state update", RED_DARK, {
      "font-size": 9, "font-weight": 760,
    });
    chip(group, { x: 348, y: 390, w: 214, h: 50 }, "ALIGN THE CALCULATION", {
      stroke: TEAL_DARK, textColor: TEAL_DARK, fontSize: 10, rx: 16,
    });
    chip(group, { x: 628, y: 390, w: 278, h: 50 }, "BYTE-EQUAL AT PRODUCTION SHAPE", {
      stroke: TEAL_DARK, fill: TEAL_DARK, textColor: "#fffdf7", fontSize: 10, rx: 16,
    });
    arrow(group, "M 292 415 H 347", 347, 415, "right", RED_DARK, { width: 1.55 });
    arrow(group, "M 562 415 H 627", 627, 415, "right", TEAL_DARK, { width: 1.55 });
  }

  // 4 · Implementation changes remain conditional: every candidate change
  // loops through the same byte comparison before it is admitted.
  {
    const group = stage(4);
    group.appendChild(wire("M 767 440 V 459 C 767 472 700 472 680 478 H 330", {
      stroke: TEAL_DARK, "stroke-width": 1.35,
    }));
    [360, 520, 680].forEach((x) => group.appendChild(svgElement("line", {
      x1: x, y1: 478, x2: x, y2: 486, stroke: TEAL_DARK, "stroke-width": 1.2,
    })));
    centered(group, 520, 470, "ONLY AFTER EQUALITY · TEST A CHANGE AND COMPARE AGAIN", TEAL_DARK, {
      "font-size": 9.4, "font-weight": 850, "letter-spacing": 0.35,
    });
    chip(group, { x: 300, y: 486, w: 120, h: 30 }, "SCHEDULING", {
      stroke: TEAL_DARK, textColor: TEAL_DARK, fontSize: 9.2, rx: 15,
    });
    chip(group, { x: 460, y: 486, w: 120, h: 30 }, "STORAGE LAYOUT", {
      stroke: TEAL_DARK, textColor: TEAL_DARK, fontSize: 9, rx: 15,
    });
    chip(group, { x: 620, y: 486, w: 120, h: 30 }, "TRANSPORT", {
      stroke: TEAL_DARK, textColor: TEAL_DARK, fontSize: 9.2, rx: 15,
    });
    arrow(group, "M 740 501 H 934 V 415 H 907", 907, 415, "left", TEAL_DARK, {
      width: 1.25, dashed: true,
    });
    group.appendChild(label(835, 480, "REVERIFY OUTPUT + STATE BYTES", {
      fill: TEAL_DARK, "font-size": 9, "font-weight": 850,
      "letter-spacing": 0.35, "text-anchor": "middle",
    }));
  }
}

/* --- 03 · figure 5, the MoE expert kernel -----------------------------------
 * Hybrid of proposal Alt A (one physical SGLang slab + strided weight view)
 * and Alt C (equality boundary: SGLang forward pinned, Quack backward free).
 * ------------------------------------------------------------------------- */

function drawMoeForward() {
  const layer = layerOf("moe-svg-forward");
  if (!layer) return;

  // Alt A: two callers into one wide serving-kernel slab; strided view on weights.
  const sampler = { x: 48, y: 40, w: 200, h: 48 };
  const trainer = { x: 712, y: 40, w: 200, h: 48 };
  const slab = { x: 120, y: 132, w: 720, h: 88 };
  const mem = { x: 120, y: 268, w: 720, h: 44 };
  const view = { x: 264, y: 260, w: 288, h: 60 };

  layer.appendChild(rect(sampler.x, sampler.y, sampler.w, sampler.h, { stroke: TEAL_DARK, "data-step": 0 }));
  layer.appendChild(svgElement("text", {
    x: sampler.x + 16, y: sampler.y + 22, fill: INK, "font-size": 12, "font-weight": 700, "data-step": 0,
  }, "serving"));
  layer.appendChild(svgElement("text", {
    x: sampler.x + 16, y: sampler.y + 38, fill: SOFT, "font-size": 10, "data-step": 0,
  }, "decode · expert compute"));

  layer.appendChild(rect(trainer.x, trainer.y, trainer.w, trainer.h, { stroke: TEAL_DARK, "data-step": 0 }));
  layer.appendChild(svgElement("text", {
    x: trainer.x + 16, y: trainer.y + 22, fill: INK, "font-size": 12, "font-weight": 700, "data-step": 0,
  }, "training"));
  layer.appendChild(svgElement("text", {
    x: trainer.x + 16, y: trainer.y + 38, fill: SOFT, "font-size": 10, "data-step": 0,
  }, "MoeExpertsFn.forward"));

  layer.appendChild(wire(
    `M ${sampler.x + sampler.w / 2} ${sampler.y + sampler.h} V 120 H 480`,
    { stroke: TEAL_DARK, "stroke-width": 1.5, "data-draw": "", "data-step": 1 },
  ));
  layer.appendChild(wire(
    `M ${trainer.x + trainer.w / 2} ${trainer.y + trainer.h} V 120 H 480`,
    { stroke: TEAL_DARK, "stroke-width": 1.5, "data-draw": "", "data-step": 1 },
  ));
  layer.appendChild(svgElement("circle", { cx: 480, cy: 120, r: 4, fill: TEAL_DARK, "data-step": 1 }));

  layer.appendChild(rect(slab.x, slab.y, slab.w, slab.h, {
    fill: "#dff4ef", stroke: TEAL_DARK, "stroke-width": 2, "data-step": 1,
  }));
  layer.appendChild(svgElement("text", {
    x: 480, y: slab.y + 34, "text-anchor": "middle", fill: TEAL_DARK,
    "font-size": 14, "font-weight": 800, "data-step": 1,
  }, "SGLang fused_experts_impl"));
  layer.appendChild(svgElement("text", {
    x: 480, y: slab.y + 56, "text-anchor": "middle", fill: SOFT, "font-size": 11, "data-step": 1,
  }, "one Triton launch and one reduction tree for both callers"));
  layer.appendChild(svgElement("text", {
    x: slab.x + 20, y: slab.y + 76, fill: TEAL_DARK, "font-size": 10, "data-step": 1,
  }, "serving kernel called by SGLang and XoRL"));

  layer.appendChild(rect(mem.x, mem.y, mem.w, mem.h, {
    fill: PAPER, stroke: LINE, "data-step": 2,
  }));
  for (let index = 1; index < 10; index += 1) {
    const x = mem.x + (mem.w * index) / 10;
    layer.appendChild(svgElement("line", {
      x1: x, y1: mem.y, x2: x, y2: mem.y + mem.h, stroke: LINE, "stroke-width": 1, "data-step": 2,
    }));
  }
  layer.appendChild(rect(view.x, view.y, view.w, view.h, {
    fill: "none", stroke: ORANGE_DARK, "stroke-width": 2, "data-step": 2,
  }));
  layer.appendChild(wire(`M 480 ${slab.y + slab.h} V ${view.y}`, {
    stroke: ORANGE_DARK, "stroke-width": 1.4, "data-draw": "", "data-step": 2,
  }));
}

function drawMoeBackward() {
  const layer = layerOf("moe-svg-backward");
  if (!layer) return;

  // Alt C: equality boundary. Teal band (SGLang fwd) vs red band (Quack bwd).
  const pin = { x: 80, y: 48, w: 800, h: 150 };
  const free = { x: 80, y: 248, w: 800, h: 72 };

  layer.appendChild(rect(pin.x, pin.y, pin.w, pin.h, {
    fill: "rgba(36, 199, 181, 0.10)", stroke: TEAL_DARK, "stroke-width": 1.6, "data-step": 0,
  }));
  layer.appendChild(svgElement("text", {
    x: pin.x + 20, y: pin.y + 28, fill: TEAL_DARK, "font-size": 11, "font-weight": 700, "data-step": 0,
  }, "shared expert forward output"));
  layer.appendChild(rect(pin.x + 40, pin.y + 48, pin.w - 80, 72, {
    fill: "#dff4ef", stroke: TEAL_DARK, "stroke-width": 1.8, "data-step": 0,
  }));
  layer.appendChild(svgElement("text", {
    x: 480, y: pin.y + 78, "text-anchor": "middle", fill: TEAL_DARK,
    "font-size": 13, "font-weight": 800, "data-step": 0,
  }, "forward: SGLang fused_experts_impl"));
  layer.appendChild(svgElement("text", {
    x: 480, y: pin.y + 100, "text-anchor": "middle", fill: SOFT, "font-size": 11, "data-step": 0,
  }, "same serving program for SGLang and XoRL"));

  layer.appendChild(svgElement("line", {
    x1: 80, y1: 220, x2: 880, y2: 220,
    stroke: RED_DARK, "stroke-width": 1.5, "stroke-dasharray": "6 4", "data-step": 1,
  }));
  layer.appendChild(svgElement("text", {
    x: 480, y: 212, "text-anchor": "middle", fill: RED_DARK,
    "font-size": 11, "font-weight": 700, "data-step": 1,
  }, "forward output boundary"));

  layer.appendChild(rect(free.x, free.y, free.w, free.h, {
    fill: "rgba(228, 94, 82, 0.08)", stroke: RED_DARK, "stroke-width": 1.4,
    "stroke-dasharray": "5 4", "data-step": 1,
  }));
  layer.appendChild(svgElement("text", {
    x: 480, y: free.y + 30, "text-anchor": "middle", fill: RED_DARK,
    "font-size": 13, "font-weight": 800, "data-step": 1,
  }, "backward: Quack grouped-GEMM"));
  layer.appendChild(svgElement("text", {
    x: 480, y: free.y + 52, "text-anchor": "middle", fill: RED_DARK, "font-size": 11, "data-step": 1,
  }, "trainer gradient implementation"));

  layer.appendChild(svgElement("text", {
    x: 480, y: 348, "text-anchor": "middle", fill: RED_DARK,
    "font-size": 12, "font-weight": 700, "data-step": 2,
  }, "Quack backward computes trainer gradients"));
}

/* --- 04 · Gated DeltaNet ---------------------------------------------------
 * One panel expands the attention path. The second follows the first-divergence
 * investigation from a broad layer boundary to the launch parameters that
 * moved the q/k normalization bits.
 * ------------------------------------------------------------------------- */

function drawGdnPath() {
  const layer = layerOf("gdn-svg-path");
  if (!layer) return;

  const fa4 = [
    { x: 80, w: 210, text: "q, k, v" },
    { x: 375, w: 210, text: "fused attention" },
    { x: 670, w: 210, text: "output" },
  ];
  fa4.forEach((item, index) => {
    layer.appendChild(rect(item.x, 48, item.w, 54, {
      fill: index === 1 ? "#dff4ef" : PAPER,
      stroke: index === 1 ? TEAL_DARK : LINE,
      "stroke-width": index === 1 ? 1.8 : 1,
      "data-step": index,
    }));
    layer.appendChild(svgElement("text", {
      x: item.x + item.w / 2, y: 80, "text-anchor": "middle", fill: index === 1 ? TEAL_DARK : INK,
      "font-size": 12, "font-weight": 700, "data-step": index,
    }, item.text));
    if (index < fa4.length - 1) {
      layer.appendChild(wire(`M ${item.x + item.w} 75 H ${fa4[index + 1].x}`, {
        stroke: TEAL_DARK, "stroke-width": 1.5, "data-draw": "", "data-step": index + 1,
      }));
    }
  });

  const stages = [
    { x: 28, w: 112, text: "q / k / v", shape: "project" },
    { x: 170, w: 118, text: "convolution", shape: "conv" },
    { x: 318, w: 118, text: "q/k L2 norm", shape: "norm" },
    { x: 466, w: 118, text: "state scan", shape: "state" },
    { x: 614, w: 118, text: "gated norm", shape: "gate" },
    { x: 762, w: 168, text: "output projection", shape: "project" },
  ];
  stages.forEach((item, index) => {
    const y = 198;
    const h = 76;
    const attrs = { stroke: index === 2 || index === 3 ? ORANGE_DARK : LINE, "stroke-width": 1.5, "data-step": index };
    if (item.shape === "norm") {
      layer.appendChild(svgElement("ellipse", {
        cx: item.x + item.w / 2, cy: y + h / 2, rx: item.w / 2, ry: h / 2,
        fill: "rgba(238, 143, 67, 0.08)", ...attrs,
      }));
    } else if (item.shape === "state") {
      layer.appendChild(svgElement("path", {
        d: `M ${item.x + item.w / 2} ${y} L ${item.x + item.w} ${y + h / 2} L ${item.x + item.w / 2} ${y + h} L ${item.x} ${y + h / 2} Z`,
        fill: "rgba(238, 143, 67, 0.10)", ...attrs,
      }));
    } else if (item.shape === "gate") {
      layer.appendChild(svgElement("path", {
        d: `M ${item.x + 18} ${y} H ${item.x + item.w - 18} L ${item.x + item.w} ${y + h / 2} L ${item.x + item.w - 18} ${y + h} H ${item.x + 18} L ${item.x} ${y + h / 2} Z`,
        fill: PAPER, ...attrs,
      }));
    } else {
      layer.appendChild(rect(item.x, y, item.w, h, {
        fill: PAPER, ...attrs, rx: item.shape === "conv" ? 12 : 0,
      }));
      if (item.shape === "conv") {
        [1, 2, 3].forEach((bar) => layer.appendChild(svgElement("line", {
          x1: item.x + 16 + bar * 20, y1: y + 12, x2: item.x + 16 + bar * 20, y2: y + h - 12,
          stroke: ORANGE_DARK, opacity: 0.45, "data-step": index,
        })));
      }
    }
    fitTextInBox(layer, { x: item.x, y, w: item.w, h }, item.text, {
      "text-anchor": "middle", fill: index === 2 || index === 3 ? ORANGE_DARK : INK,
      "font-size": 10.5, "font-weight": 750, "data-step": index,
    }, { padding: 12 });
    if (index < stages.length - 1) {
      layer.appendChild(wire(`M ${item.x + item.w} ${y + h / 2} H ${stages[index + 1].x - 7}`, {
        stroke: ORANGE_DARK, "stroke-width": 1.3, "data-draw": "", "data-step": index + 1,
      }));
    }
  });

  layer.appendChild(wire("M 525 274 V 342 H 448 V 236 H 459", {
    stroke: ORANGE_DARK, "stroke-width": 1.7, "stroke-dasharray": "6 4", "data-step": 6,
  }));
  layer.appendChild(svgElement("text", {
    x: 390, y: 365, "text-anchor": "middle", fill: ORANGE_DARK,
    "font-size": 11, "font-weight": 700, "data-step": 6,
  }, "recurrent state returns on the next decode token"));
}

function drawGdnBoundary() {
  const layer = layerOf("gdn-svg-boundary");
  if (!layer) return;

  const rows = [
    { y: 48, x: 70, w: 820, title: "1 · layer output differs", detail: "mixer output differs", tone: RED_DARK },
    { y: 118, x: 120, w: 720, title: "2 · capture inside the mixer", detail: "capture intermediate tensors", tone: ORANGE_DARK },
    { y: 188, x: 170, w: 620, title: "3 · convolution and projections agree", detail: "q/k/v inputs are still identical", tone: ORANGE_DARK },
    { y: 258, x: 220, w: 520, title: "4 · normalized q and k differ first", detail: "3 q values + 2 k values in BF16", tone: ORANGE_DARK },
    { y: 328, x: 270, w: 420, title: "5 · normalization launch differs", detail: "trainer autotune vs sampler fixed launch", tone: RED_DARK },
    { y: 398, x: 320, w: 320, title: "6 · pin the launch", detail: "BT 16 · 8 warps · 3 stages", tone: TEAL_DARK },
  ];

  rows.forEach((item, index) => {
    layer.appendChild(rect(item.x, item.y, item.w, 54, {
      fill: index === rows.length - 1 ? "rgba(36, 199, 181, 0.10)" : "none",
      stroke: item.tone, "stroke-width": index === rows.length - 1 ? 2 : 1.3, "data-step": index,
    }));
    layer.appendChild(svgElement("text", {
      x: item.x + 16, y: item.y + 22, fill: item.tone,
      "font-size": 11.5, "font-weight": 800, "data-step": index,
    }, item.title));
    layer.appendChild(svgElement("text", {
      x: item.x + 16, y: item.y + 41, fill: SOFT, "font-size": 10, "data-step": index,
    }, item.detail));
    if (index < rows.length - 1) {
      layer.appendChild(wire(`M 480 ${item.y + 54} V ${rows[index + 1].y}`, {
        stroke: item.tone, "stroke-width": 1.4, "data-draw": "", "data-step": index + 1,
      }));
    }
  });
}

function drawGdnState() {
  const layer = layerOf("gdn-svg-state");
  if (!layer) return;
  const rows = [
    { y: 52, tone: RED_DARK, active: 1, cache: "cache Sₜ", note: "one recurrent update", cost: "1 scan row / token" },
    {
      y: 210, tone: TEAL_DARK, active: 46, cache: "cache S at boundary",
      note: "recompute active prefix 1–64 · exact chunk replay", cost: "≈32 scan rows / token, averaged",
    },
    {
      y: 368, tone: ORANGE_DARK, active: 46, cache: "cache row intermediates",
      note: "compute row 46 · refresh full chunk at boundary", cost: "1 new row + fixed reductions",
    },
  ];
  rows.forEach((row, rowIndex) => {
    const startX = 250;
    const tokenW = 9;
    for (let token = 0; token < 64; token += 1) {
      layer.appendChild(rect(startX + token * tokenW, row.y, tokenW - 1, 34, {
        fill: token < row.active ? row.tone : "none",
        stroke: token % 8 === 0 ? row.tone : LINE,
        "stroke-width": token % 8 === 0 ? 1 : 0.45,
        opacity: token < row.active ? 0.76 : 0.55,
        "data-step": rowIndex,
      }));
    }
    layer.appendChild(rect(24, row.y - 4, 188, 42, {
      fill: "none", stroke: row.tone, "stroke-width": 1.2, "data-step": rowIndex,
    }));
    fitTextInBox(layer, { x: 24, y: row.y - 4, w: 188, h: 42 }, row.cache, {
      "text-anchor": "middle", fill: row.tone, "font-size": 10.5, "font-weight": 700, "data-step": rowIndex,
    }, { padding: 12 });
    layer.appendChild(wire(`M 212 ${row.y + 17} H 242`, {
      stroke: row.tone, "stroke-width": 1.4, "data-draw": "", "data-step": rowIndex,
    }));
    layer.appendChild(label(250, row.y + 57, row.note, {
      fill: row.tone, "font-size": 10.5, "font-weight": 700, "data-step": rowIndex,
    }));
    layer.appendChild(label(936, row.y + 21, row.cost, {
      "text-anchor": "end", fill: SOFT, "font-size": 10, "data-step": rowIndex,
    }));
  });
}

/* --- 02 · which numerical decision was actually load-bearing ----------------
 * Three exact paths on one log K3 axis: what each measured with the decision left
 * to a compiler or an autotuner, and what it measured once written down. Every
 * pair comes from the run that gated that path, so the arms differ by model
 * and are labelled that way rather than merged into a single series.
 * ------------------------------------------------------------------------- */

function drawMismatchScale() {
  const layer = layerOf("mismatch-scale-svg");
  if (!layer) return;
  const facts = window.K3_FACTS;
  if (!facts) return;

  // Every value is read from the generated facts, so the figure cannot drift
  // from the snapshot that gated the exact path it describes.
  const qkNorm = facts.gdn.rootCauses.find((cause) => cause.id === "gdn_qk_l2norm");
  const rotary = facts.roadmap.toZero;
  const rows = [
    {
      label: "trunk projections bypass wrappers", arm: "Qwen3.5-35B-A3B live gate",
      before: facts.qwen35_35b.negativeControl.behavior_k3,
      after: facts.qwen35_35b.liveGate.behavior_k3, afterText: "0.0",
    },
    {
      label: "recurrent q/k normalization uses autotuning", arm: "Qwen3.5-0.8B dense",
      before: qkNorm.k3_before, after: qkNorm.k3_after, afterText: qkNorm.k3_after.toExponential(1),
    },
    {
      label: "rotary table builds on GPU", arm: "Qwen3 dense",
      before: rotary[rotary.length - 2].k3, after: rotary[rotary.length - 1].k3, afterText: "0.0",
    },
  ];

  const left = 330;
  const right = 872;
  const top = 62;
  const decades = [-3, -6, -9, -12];
  const toX = (value) => left + ((Math.log10(value) + 12.5) * (right - left)) / 9.8;

  decades.forEach((exponent) => {
    const x = toX(10 ** exponent);
    layer.appendChild(svgElement("line", {
      x1: x, y1: top - 14, x2: x, y2: 356, stroke: LINE_FAINT, "stroke-width": 1, "data-step": 0,
    }));
    layer.appendChild(label(x, 374, `1e${exponent}`, {
      "text-anchor": "middle", fill: SOFT, "font-size": 9.5, "data-step": 0,
    }));
  });

  // Exact zero has no place on a log axis, so it gets its own band to the left
  // of the smallest decade, clear of the row labels.
  const zeroX = left - 42;
  layer.appendChild(rect(zeroX - 18, top - 14, 36, 370, {
    fill: "rgba(36, 199, 181, 0.12)", stroke: TEAL, "stroke-width": 0.6, "stroke-dasharray": "4 4", "data-step": 0,
  }));
  layer.appendChild(label(zeroX, 374, "0", {
    "text-anchor": "middle", fill: TEAL_DARK, "font-size": 9.5, "font-weight": 700, "data-step": 0,
  }));

  rows.forEach((row, index) => {
    const y = top + index * 74;
    const beforeX = toX(row.before);
    const afterX = row.after > 0 ? toX(row.after) : zeroX;

    layer.appendChild(label(250, y + 4, row.label, {
      "text-anchor": "end", fill: INK, "font-size": 11.5, "font-weight": 700, "data-step": index,
    }));
    layer.appendChild(label(250, y + 21, row.arm, {
      "text-anchor": "end", fill: SOFT, "font-size": 9.5, "data-step": index,
    }));

    layer.appendChild(wire(`M ${beforeX} ${y + 6} H ${afterX + 12}`, {
      stroke: LINE, "stroke-width": 1.2, "stroke-dasharray": "3 3", "data-step": index,
    }));
    layer.appendChild(svgElement("circle", {
      cx: beforeX, cy: y + 6, r: 6, fill: RED, stroke: RED_DARK, "stroke-width": 1.2, "data-step": index,
    }));
    layer.appendChild(svgElement("circle", {
      cx: afterX, cy: y + 6, r: 6, fill: TEAL, stroke: TEAL_DARK, "stroke-width": 1.2, "data-step": index,
    }));
    layer.appendChild(label(beforeX, y - 8, row.before.toExponential(2), {
      "text-anchor": "middle", fill: RED_DARK, "font-size": 10, "font-weight": 700, "data-step": index,
    }));
    layer.appendChild(label(afterX, y + 26, row.afterText, {
      "text-anchor": "middle", fill: TEAL_DARK, "font-size": 10, "font-weight": 700, "data-step": index,
    }));
  });
}

function drawK3Control() {
  const layer = layerOf("k3-svg-control");
  if (!layer) return;
  layer.appendChild(label(480, 66, "SAME QWEN3.5 HARNESS · ONE TRUNK-PROJECTION SWITCH", {
    fill: INK, "font-size": 11, "font-weight": 800, "letter-spacing": 0.9,
    "text-anchor": "middle", "data-step": 0,
  }));
  layer.appendChild(wire("M 240 88 H 720", { stroke: LINE, "stroke-width": 2, "data-draw": "", "data-step": 0 }));
  layer.appendChild(svgElement("circle", { cx: 365, cy: 88, r: 10, fill: RED_DARK, "data-step": 0 }));
  layer.appendChild(svgElement("circle", { cx: 595, cy: 88, r: 10, fill: TEAL_DARK, "data-step": 1 }));
  layer.appendChild(label(365, 114, "0 / 280 wrapped", { fill: RED_DARK, "font-size": 9.5, "font-weight": 800, "text-anchor": "middle", "data-step": 0 }));
  layer.appendChild(label(595, 114, "280 / 280 wrapped", { fill: TEAL_DARK, "font-size": 9.5, "font-weight": 800, "text-anchor": "middle", "data-step": 1 }));

  const addDotGrid = (startX, startY, matches, tone, step) => {
    for (let index = 0; index < 64; index += 1) {
      const x = startX + (index % 16) * 16;
      const y = startY + Math.floor(index / 16) * 16;
      layer.appendChild(svgElement("circle", {
        cx: x, cy: y, r: 4.5,
        fill: index < matches ? TEAL_DARK : tone,
        opacity: index < matches ? 0.82 : 0.72,
        "data-step": step,
      }));
    }
  };
  addDotGrid(92, 164, 27, RED_DARK, 0);
  addDotGrid(600, 164, 64, TEAL_DARK, 1);
  layer.appendChild(label(212, 146, "MISMATCHED KERNELS · 64 PAIRS", {
    fill: RED_DARK, "font-size": 9, "font-weight": 800, "text-anchor": "middle", "data-step": 0,
  }));
  layer.appendChild(label(720, 146, "MATCHING KERNELS · 512 TOKENS", {
    fill: TEAL_DARK, "font-size": 9, "font-weight": 800, "text-anchor": "middle", "data-step": 1,
  }));
  layer.appendChild(label(212, 244, "27 match · 37 differ · K3 2.94e−4", {
    fill: RED_DARK, "font-size": 10, "font-weight": 750, "text-anchor": "middle", "data-step": 0,
  }));
  layer.appendChild(label(720, 244, "64 representative dots shown · ratio 1.0 · K3 0.0", {
    fill: TEAL_DARK, "font-size": 10, "font-weight": 750, "text-anchor": "middle", "data-step": 1,
  }));
  layer.appendChild(label(480, 275, "distinct receipts and denominators · compare the switch, not the dot counts", {
    fill: MUTED, "font-size": 9.5, "text-anchor": "middle", "data-step": 1,
  }));
}

function drawQ35Performance() {
  const layer = layerOf("q35-performance-svg");
  if (!layer) return;
  const facts = window.K3_FACTS?.qwen35_gdn_cudagraph;
  if (!facts) return;
  const inference = facts.currentInferenceAb;
  const trainer = facts.currentTrainerAb;
  // Every row is drawn as a rate so a longer bar always means faster. The
  // forward/backward A/B is recorded in seconds per update; its reciprocal is
  // the same 8.95% reduction without flipping the direction of "good" midway
  // down the figure.
  const exactUpdatesPerS = 1 / trainer.exact_mean_forward_backward_s;
  const controlUpdatesPerS = 1 / trainer.control_mean_forward_backward_s;
  const rows = [
    {
      y: 54, exact: inference.exact_graph_output_tokens_per_s, control: inference.recurrent_graph_output_tokens_per_s,
      exactLabel: `${inference.exact_graph_output_tokens_per_s.toFixed(3)} exact`,
      controlLabel: `${inference.recurrent_graph_output_tokens_per_s.toFixed(3)} recurrent`,
      impact: `${Math.abs(inference.throughput_delta_pct).toFixed(2)}% lower throughput`, tone: RED_DARK,
    },
    {
      y: 238, exact: exactUpdatesPerS, control: controlUpdatesPerS,
      exactLabel: `${exactUpdatesPerS.toFixed(4)}/s exact · ${trainer.exact_mean_forward_backward_s.toFixed(3)} s`,
      controlLabel: `${controlUpdatesPerS.toFixed(4)}/s control · ${trainer.control_mean_forward_backward_s.toFixed(3)} s`,
      impact: `${trainer.forward_backward_throughput_reduction_pct.toFixed(2)}% lower throughput`, tone: ORANGE_DARK,
    },
    {
      y: 422, exact: trainer.exact_completion_tokens_per_s, control: trainer.control_completion_tokens_per_s,
      exactLabel: `${trainer.exact_completion_tokens_per_s.toFixed(3)} exact`,
      controlLabel: `${trainer.control_completion_tokens_per_s.toFixed(3)} control`,
      impact: `${trainer.throughput_reduction_pct.toFixed(2)}% lower throughput`, tone: TEAL_DARK,
    },
  ];
  rows.forEach((row, index) => {
    const max = Math.max(row.exact, row.control);
    const exactW = 560 * row.exact / max;
    const controlW = 560 * row.control / max;
    layer.appendChild(rect(240, row.y, controlW, 38, {
      fill: "rgba(68, 82, 79, 0.10)", stroke: LINE, "data-step": index,
    }));
    layer.appendChild(rect(240, row.y + 52, exactW, 38, {
      fill: `${row.tone}1A`, stroke: row.tone, "stroke-width": 1.4, "data-step": index,
    }));
    layer.appendChild(label(228, row.y + 25, row.controlLabel, {
      "text-anchor": "end", fill: SOFT, "font-size": 10.5, "data-step": index,
    }));
    layer.appendChild(label(228, row.y + 77, row.exactLabel, {
      "text-anchor": "end", fill: row.tone, "font-size": 10.5, "font-weight": 700, "data-step": index,
    }));
    layer.appendChild(label(816, row.y + 78, row.impact, {
      fill: row.tone, "font-size": 11, "font-weight": 750, "data-step": index,
    }));
  });
}

/* --------------------------------------------------------------------------- */

function initReadingProgress() {
  const bar = document.getElementById("reading-progress-bar");
  if (!bar) return;

  let scheduled = false;
  const update = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    bar.style.transform = `scaleX(${progress})`;
    scheduled = false;
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();
}

function initRevealMotion() {
  const items = [...document.querySelectorAll("[data-reveal]")];
  if (!items.length) return;
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -9% 0px", threshold: 0.08 },
  );
  items.forEach((item) => observer.observe(item));
}

/* Tracks the current article section in the sticky contents rail. Nested H4/H5
 * headings are intentionally absent from the rail, so they inherit the closest
 * preceding section or H3 entry. */
function initToc() {
  const nav = document.getElementById("toc");
  if (!nav) return;
  const entries = [...nav.querySelectorAll("a[href^='#']")]
    .map((link) => ({ link, target: document.querySelector(link.getAttribute("href")) }))
    .filter((entry) => entry.target);
  if (!entries.length) return;

  const entryById = new Map(entries.map((entry) => [entry.target.id, entry]));
  let nearestListedEntry = entries[0];
  const observedHeadings = [
    ...document.querySelectorAll(
      "article.post-content > section[id], article.post-content h3[id], article.post-content h4[id], article.post-content h5[id]",
    ),
  ].map((heading) => {
    nearestListedEntry = entryById.get(heading.id) || nearestListedEntry;
    return { heading, entry: nearestListedEntry };
  });

  let currentTarget = null;
  let scheduled = false;

  const keepActiveLinkVisible = (link) => {
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const topInset = 34;
    const bottomInset = 12;

    if (linkRect.top < navRect.top + topInset) {
      nav.scrollTop -= navRect.top + topInset - linkRect.top;
    } else if (linkRect.bottom > navRect.bottom - bottomInset) {
      nav.scrollTop += linkRect.bottom - (navRect.bottom - bottomInset);
    }
  };

  const setActive = (target) => {
    if (target === currentTarget) return;
    currentTarget = target;
    let activeLink = null;
    entries.forEach(({ link, target: candidate }) => {
      const active = candidate === target;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
      if (active) activeLink = link;
    });
    if (activeLink) keepActiveLinkVisible(activeLink);
  };

  const update = () => {
    // A section becomes current when its heading crosses this reading line.
    // Unlisted H4/H5 headings keep their nearest listed parent active.
    const readingLine = Math.min(220, Math.max(96, window.innerHeight * 0.22));
    let active = observedHeadings[0]?.entry || entries[0];

    observedHeadings.forEach(({ heading, entry }) => {
      if (heading.getBoundingClientRect().top <= readingLine) active = entry;
    });

    const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (atPageEnd) active = entries[entries.length - 1];
    if (active) setActive(active.target);
    scheduled = false;
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("hashchange", schedule);
  entries.forEach(({ link, target }) => {
    link.addEventListener("click", () => {
      setActive(target);
      window.requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    });
  });
  update();
}

function initRoadmap() {
  const chart = document.getElementById("roadmap-chart");
  const roadmap = window.K3_FACTS?.roadmap;
  if (!chart || !roadmap) return;
  while (chart.firstChild) chart.removeChild(chart.firstChild);
  chart.appendChild(svgElement("title", {}, "K3 and batch-one generation throughput by implementation"));

  const top = 84;
  const logBottom = 252;
  const bandTop = 292;
  const bandBottom = 330;
  const ink = INK_FAINT;
  const faint = LINE_FAINT;

  const aLeft = 56;
  const aRight = 300;
  chart.appendChild(svgElement("text", { x: aLeft, y: 34, fill: INK, "font-size": 15 }, "1 · K3 by implementation"));
  chart.appendChild(svgElement("text", { x: aLeft, y: 54, fill: ink, "font-size": 10 }, "live-gate K3 (log scale)"));
  [["1e-4", -4], ["1e-5", -5]].forEach(([text, exponent]) => {
    const y = logBottom - (exponent + 5) * ((logBottom - top) / 1);
    chart.appendChild(svgElement("line", { x1: aLeft, y1: y, x2: aRight, y2: y, stroke: faint, "stroke-width": 1 }));
    chart.appendChild(svgElement("text", { x: aLeft - 8, y: y + 3, "text-anchor": "end", fill: ink, "font-size": 9 }, text));
  });
  chart.appendChild(svgElement("rect", { x: aLeft, y: bandTop, width: aRight - aLeft, height: bandBottom - bandTop, fill: "rgba(36, 199, 181, 0.12)", stroke: TEAL, "stroke-width": 0.6, "stroke-dasharray": "4 4" }));
  chart.appendChild(svgElement("text", { x: aLeft - 8, y: (bandTop + bandBottom) / 2 + 3, "text-anchor": "end", fill: TEAL, "font-size": 10 }, "exact 0"));

  const zeroStations = roadmap.toZero;
  const zeroPoints = zeroStations.map((station, index) => {
    const x = aLeft + 24 + ((aRight - aLeft - 48) * index) / (zeroStations.length - 1);
    const y = station.k3 > 0 ? logBottom - (Math.log10(station.k3) + 5) * (logBottom - top) : (bandTop + bandBottom) / 2;
    return { x, y, station };
  });
  zeroPoints.forEach((point, index) => {
    if (index > 0) {
      const previous = zeroPoints[index - 1];
      chart.appendChild(svgElement("line", { x1: previous.x, y1: previous.y, x2: point.x, y2: point.y, stroke: ORANGE, "stroke-width": 1.6 }));
    }
    chart.appendChild(svgElement("circle", { cx: point.x, cy: point.y, r: 4.4, fill: point.station.k3 > 0 ? ORANGE : TEAL }));
    chart.appendChild(svgElement("text", { x: point.x, y: 356 + (index % 2) * 14, "text-anchor": "middle", fill: ink, "font-size": 9.5 }, point.station.label));
    const valueLabel = point.station.k3 > 0 ? point.station.k3.toExponential(2) : "0.0";
    chart.appendChild(svgElement("text", { x: point.x, y: point.y - 10, "text-anchor": "middle", fill: INK, "font-size": 9.5 }, valueLabel));
  });

  chart.appendChild(svgElement("line", { x1: 322, y1: 30, x2: 322, y2: 386, stroke: faint, "stroke-width": 1 }));

  const bLeft = 388;
  const bRight = 930;
  const speedTop = 70;
  const speedBottom = 330;
  const toY = (pct) => speedBottom - ((100 + pct - 60) * (speedBottom - speedTop)) / 44;
  chart.appendChild(svgElement("text", { x: bLeft, y: 34, fill: INK, "font-size": 15 }, "2 · batch-one throughput by implementation"));
  chart.appendChild(svgElement("text", { x: bLeft, y: 54, fill: ink, "font-size": 10 }, "batch-1 generation vs standard · we test every implementation directly"));
  [[-30, "70%"], [-20, "80%"], [-10, "90%"]].forEach(([pct, text]) => {
    const y = toY(pct);
    chart.appendChild(svgElement("line", { x1: bLeft, y1: y, x2: bRight, y2: y, stroke: faint, "stroke-width": 1 }));
    chart.appendChild(svgElement("text", { x: bLeft - 8, y: y + 3, "text-anchor": "end", fill: ink, "font-size": 9 }, text));
  });
  const stockY = toY(0);
  chart.appendChild(svgElement("line", { x1: bLeft, y1: stockY, x2: bRight, y2: stockY, stroke: INK_FAINT, "stroke-width": 1, "stroke-dasharray": "6 4" }));
  chart.appendChild(svgElement("text", { x: bLeft + 4, y: stockY - 7, fill: INK_FAINT, "font-size": 10 }, "standard serving"));

  const speedStations = roadmap.toSpeed;
  const speedPoints = speedStations.map((station, index) => ({
    x: bLeft + 26 + ((bRight - bLeft - 52) * index) / (speedStations.length - 1),
    y: toY(station.taxPct),
    station,
  }));
  speedPoints.forEach((point, index) => {
    if (index > 0) {
      const previous = speedPoints[index - 1];
      chart.appendChild(svgElement("line", { x1: previous.x, y1: previous.y, x2: point.x, y2: point.y, stroke: TEAL, "stroke-width": 1.8 }));
    }
    chart.appendChild(svgElement("circle", { cx: point.x, cy: point.y, r: 4.4, fill: TEAL }));
    chart.appendChild(svgElement("text", { x: point.x, y: point.y - 10, "text-anchor": "middle", fill: INK, "font-size": 9.5 }, `${point.station.taxPct}%`));
    chart.appendChild(svgElement("text", { x: point.x, y: 356 + (index % 2) * 14, "text-anchor": "middle", fill: ink, "font-size": 9.5 }, point.station.label));
  });
}

function activateTab(tab, tabs) {
  tabs.forEach((candidate) => {
    const selected = candidate === tab;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    const panelId = candidate.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.hidden = !selected;
    candidate.dispatchEvent(
      new CustomEvent("tabchange", { bubbles: true, detail: { tab: candidate, panel, selected } }),
    );
  });
}

function initAccessibleTabs() {
  document.querySelectorAll("[role='tablist']").forEach((tablist) => {
    const tabs = [...tablist.querySelectorAll(":scope > [role='tab'][aria-controls]")];
    if (!tabs.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activateTab(tab, tabs));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = tabs.indexOf(tab);
        let next = current;
        if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        activateTab(tabs[next], tabs);
        tabs[next].focus();
      });
    });
    activateTab(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0], tabs);
  });
}

/* --- 01 · the estimator ---------------------------------------------------- */

function drawK3Floor() {
  const layer = layerOf("k3-svg-floor");
  if (!layer) return;
  const values = [0.23, 0.47, 0.31, 0.62, 0.40, 0.55, 0.29, 0.68, 0.37, 0.50, 0.27, 0.59, 0.34, 0.45, 0.64, 0.39, 0.52, 0.30, 0.57, 0.42];
  const startX = 190;
  const cellW = 25;
  const rows = [
    { y: 86, color: SERVING_COLOR, label: "SGLang · records float32 bytes", step: 0 },
    { y: 176, color: TRAINING_COLOR, label: "XoRL · recomputes float32 bytes", step: 1 },
  ];
  rows.forEach((row) => {
    layer.appendChild(label(24, row.y + 20, row.label, {
      fill: row.color, "font-size": 10.5, "font-weight": 800, "data-step": row.step,
    }));
    values.forEach((value, index) => {
      const height = 13 + value * 28;
      layer.appendChild(svgElement("rect", {
        x: startX + index * cellW, y: row.y + 43 - height,
        width: 16, height, rx: 1, fill: row.color, opacity: 0.34 + value * 0.55,
        "data-step": row.step,
      }));
    });
  });
  values.forEach((_value, index) => {
    const x = startX + index * cellW + 8;
    layer.appendChild(svgElement("line", {
      x1: x, y1: 131, x2: x, y2: 176, stroke: TEAL_DARK,
      "stroke-width": 0.8, opacity: 0.42, "data-step": 2,
    }));
    layer.appendChild(svgElement("circle", { cx: x, cy: 153, r: 2.2, fill: TEAL_DARK, "data-step": 2 }));
  });
  layer.appendChild(label(690, 118, "representative token pairs", {
    fill: MUTED, "font-size": 8.5, "text-anchor": "middle", "data-step": 2,
  }));
  layer.appendChild(label(818, 150, "XOR = 0", {
    fill: TEAL_DARK, "font-size": 24, "font-family": "var(--serif)",
    "font-weight": 700, "text-anchor": "middle", "data-step": 3,
  }));
  layer.appendChild(label(818, 181, "across all 7,239 pairs", {
    fill: TEAL_DARK, "font-size": 10.5, "font-weight": 800,
    "text-anchor": "middle", "data-step": 3,
  }));
  layer.appendChild(label(480, 255, "generated tokens · fixed synchronized weights · direct byte comparison", {
    fill: MUTED, "font-size": 10, "text-anchor": "middle", "data-step": 3,
  }));
}

function drawK3Mean() {
  const layer = layerOf("k3-svg-mean");
  if (!layer) return;
  layer.appendChild(svgElement("circle", { cx: 94, cy: 102, r: 8, fill: SERVING_COLOR, "data-step": 0 }));
  layer.appendChild(svgElement("circle", { cx: 94, cy: 168, r: 8, fill: TRAINING_COLOR, "data-step": 0 }));
  layer.appendChild(label(116, 106, "sampler records behavior log p", { fill: SERVING_COLOR, "font-size": 10, "font-weight": 750, "data-step": 0 }));
  layer.appendChild(label(116, 172, "trainer log p", { fill: TRAINING_COLOR, "font-size": 10, "font-weight": 750, "data-step": 0 }));
  layer.appendChild(wire("M 224 102 C 264 106 268 126 300 132", { stroke: SERVING_COLOR, "stroke-width": 1.5, "data-draw": "", "data-step": 1 }));
  layer.appendChild(wire("M 224 168 C 264 164 268 144 300 138", { stroke: TRAINING_COLOR, "stroke-width": 1.5, "data-draw": "", "data-step": 1 }));
  layer.appendChild(svgElement("circle", { cx: 324, cy: 135, r: 27, fill: PAPER, stroke: RED_DARK, "stroke-width": 1.4, "data-step": 1 }));
  layer.appendChild(label(324, 140, "Δ", { fill: RED_DARK, "font-size": 18, "font-family": "var(--serif)", "font-weight": 700, "text-anchor": "middle", "data-step": 1 }));
  layer.appendChild(label(324, 186, "trainer − behavior", { fill: MUTED, "font-size": 9, "text-anchor": "middle", "data-step": 1 }));

  const graphLeft = 430;
  const graphBottom = 205;
  layer.appendChild(svgElement("line", { x1: graphLeft, y1: 78, x2: graphLeft, y2: graphBottom, stroke: LINE, "data-step": 2 }));
  layer.appendChild(svgElement("line", { x1: graphLeft, y1: graphBottom, x2: 680, y2: graphBottom, stroke: LINE, "data-step": 2 }));
  layer.appendChild(svgElement("path", {
    d: `M ${graphLeft + 12} 92 C ${graphLeft + 76} 190 ${graphLeft + 108} 205 ${graphLeft + 125} 205 C ${graphLeft + 148} 205 ${graphLeft + 188} 184 ${graphLeft + 238} 92`,
    fill: "none", stroke: TEAL_DARK, "stroke-width": 2, "data-step": 2,
  }));
  layer.appendChild(svgElement("circle", { cx: graphLeft + 125, cy: graphBottom, r: 5, fill: TEAL_DARK, "data-step": 2 }));
  layer.appendChild(label(graphLeft + 125, 66, "K3 = exp(Δ) − 1 − Δ", { fill: INK, "font-size": 10.5, "font-weight": 750, "text-anchor": "middle", "data-step": 2 }));
  layer.appendChild(label(graphLeft + 125, 229, "Δ = 0", { fill: TEAL_DARK, "font-size": 9, "font-weight": 750, "text-anchor": "middle", "data-step": 2 }));

  const tokenXs = [748, 774, 800, 826, 852, 878];
  tokenXs.forEach((x, index) => layer.appendChild(svgElement("circle", {
    cx: x, cy: 112 + (index % 3) * 22, r: 5, fill: TEAL_DARK, opacity: 0.48 + index * 0.07, "data-step": 3,
  })));
  layer.appendChild(wire("M 738 198 H 900", { stroke: TEAL_DARK, "stroke-width": 1.5, "data-draw": "", "data-step": 3 }));
  layer.appendChild(label(819, 225, "token mean = 0.0", { fill: TEAL_DARK, "font-size": 12, "font-weight": 800, "text-anchor": "middle", "data-step": 3 }));
  layer.appendChild(label(480, 272, "live monitor · direct float32-byte equality is checked separately", { fill: MUTED, "font-size": 10, "text-anchor": "middle", "data-step": 3 }));
}

/* --- 03 · figure 1, the rotation ------------------------------------------- */

// Each box carries its expression: the figure was drawing twelve empty rectangles.
const ROPE_NODES = [
  { id: "x1", x: 40, y: 68, w: 96, h: 40, label: "x\u2081" },
  { id: "x2", x: 40, y: 128, w: 96, h: 40, label: "x\u2082" },
  { id: "cos", x: 40, y: 228, w: 96, h: 40, label: "cos[p]" },
  { id: "sin", x: 40, y: 298, w: 96, h: 40, label: "sin[p]" },
  { id: "t1", x: 330, y: 58, w: 170, h: 40, label: "x\u2081 \u00b7 cos" },
  { id: "t2", x: 330, y: 118, w: 170, h: 40, label: "x\u2082 \u00b7 sin" },
  { id: "u1", x: 330, y: 198, w: 170, h: 40, label: "x\u2081 \u00b7 sin" },
  { id: "u2", x: 330, y: 268, w: 170, h: 40, label: "x\u2082 \u00b7 cos" },
  { id: "o1", x: 580, y: 83, w: 170, h: 40, label: "x\u2081cos \u2212 x\u2082sin" },
  { id: "o2", x: 580, y: 228, w: 170, h: 40, label: "x\u2082cos + x\u2081sin" },
  { id: "s1", x: 820, y: 83, w: 120, h: 40, label: "out\u2081" },
  { id: "s2", x: 820, y: 228, w: 120, h: 40, label: "out\u2082" },
];

const ROPE_EDGES = [
  [136, 88, 330, 78],
  [136, 248, 330, 78],
  [136, 148, 330, 138],
  [136, 318, 330, 138],
  [136, 88, 330, 218],
  [136, 318, 330, 218],
  [136, 148, 330, 288],
  [136, 248, 330, 288],
  [500, 78, 580, 98],
  [500, 138, 580, 110],
  [500, 218, 580, 243],
  [500, 288, 580, 255],
  [750, 103, 820, 103],
  [750, 248, 820, 248],
];

// source order of the eight _rtne_bf16 calls
const ROPE_ROUNDS = [
  { x: 176, y: 248, step: 0 },
  { x: 176, y: 318, step: 1 },
  { x: 516, y: 78, step: 2 },
  { x: 516, y: 138, step: 3 },
  { x: 766, y: 103, step: 4 },
  { x: 516, y: 218, step: 5 },
  { x: 516, y: 288, step: 6 },
  { x: 766, y: 248, step: 7 },
];

function drawRopeFlow(id, { folded }) {
  const layer = layerOf(id);
  if (!layer) return;

  layer.appendChild(svgElement("rect", {
    x: 20,
    y: 40,
    width: 920,
    height: 306,
    fill: "none",
    stroke: folded ? RED : TEAL_DARK,
    "stroke-width": 1,
    "stroke-dasharray": "6 5",
    "stroke-opacity": 0.55,
  }));

  ROPE_EDGES.forEach(([x1, y1, x2, y2]) => {
    layer.appendChild(svgElement("line", { x1, y1, x2, y2, stroke: LINE, "stroke-width": 1.1 }));
  });

  ROPE_NODES.forEach((node) => {
    const store = node.id === "s1" || node.id === "s2";
    layer.appendChild(rect(node.x, node.y, node.w, node.h, {
      fill: store ? (folded ? "#f7d4cf" : "#dff4ef") : PAPER,
      stroke: store ? (folded ? RED : TEAL_DARK) : LINE,
    }));
    fitTextInBox(layer, node, node.label, {
      "text-anchor": "middle",
      fill: store ? (folded ? RED_DARK : TEAL_DARK) : INK,
      "font-size": 11.5,
      "font-weight": 650,
    }, { padding: 8 });
  });

  ROPE_ROUNDS.forEach((round) => {
    const group = svgElement("g", { "data-step": round.step });
    group.appendChild(svgElement("circle", {
      cx: round.x,
      cy: round.y,
      r: 11,
      fill: folded ? "none" : "#fbe6d2",
      stroke: folded ? RED : ORANGE_DARK,
      "stroke-width": folded ? 1 : 1.4,
      "stroke-dasharray": folded ? "3 3" : "",
    }));
    if (folded) {
      group.appendChild(svgElement("text", {
        x: round.x,
        y: round.y + 3,
        "text-anchor": "middle",
        fill: RED_DARK,
        "font-size": 7,
        "font-weight": 700,
      }, "FP32"));
    } else {
      group.appendChild(svgElement("text", {
        x: round.x,
        y: round.y + 4,
        "text-anchor": "middle",
        fill: ORANGE_DARK,
        "font-size": 11,
        "font-weight": 700,
      }, "R"));
    }
    layer.appendChild(group);
  });
}

function drawRopeRtne() {
  const layer = layerOf("rope-svg-rtne");
  if (!layer) return;
  const left = 24;
  const cellWidth = 27.5;
  const top = 100;

  for (let index = 0; index < 32; index += 1) {
    const keep = index < 16;
    layer.appendChild(rect(left + index * cellWidth, top, cellWidth - 2, 34, {
      fill: keep ? "rgba(36, 199, 181, 0.28)" : "rgba(238, 143, 67, 0.24)",
      stroke: keep ? TEAL_DARK : ORANGE_DARK,
      "stroke-width": 0.7,
    }));
  }
  layer.appendChild(svgElement("line", { x1: left + 16 * cellWidth - 1, y1: top - 8, x2: left + 16 * cellWidth - 1, y2: top + 42, stroke: INK, "stroke-width": 1.4 }));

  const chips = [
    { x: 24, w: 216, step: 0 },
    { x: 254, w: 246, step: 1 },
    { x: 524, w: 166, step: 2 },
    { x: 714, w: 226, step: 3 },
  ];
  chips.forEach((chip, index) => {
    layer.appendChild(rect(chip.x, 196, chip.w, 44, {
      fill: index === 3 ? "#dff4ef" : PAPER,
      stroke: index === 3 ? TEAL_DARK : ORANGE_DARK,
      "data-step": chip.step,
    }));
    if (index < chips.length - 1) {
      const next = chips[index + 1];
      layer.appendChild(wire(`M ${chip.x + chip.w + 3} 218 L ${next.x - 3} 218`, {
        stroke: ORANGE_DARK,
        "stroke-width": 1.4,
        "data-draw": "",
        "data-step": chip.step,
      }));
    }
  });
  layer.appendChild(wire("M 24 318 L 936 318", { stroke: TEAL_DARK, "stroke-width": 1.6, "data-draw": "", "data-step": 3 }));
}

function drawNormTlsum() {
  const layer = layerOf("norm-svg-tlsum");
  if (!layer) return;
  const facts = window.K3_FACTS?.tlsum;
  const cases = facts?.cases || [];

  const strips = [
    { y: 152, spt: 4, step: 0, thread0: cases[0]?.thread0Elements || [0, 1, 2, 3, 512, 513, 514, 515] },
    { y: 242, spt: 8, step: 1, thread0: cases[1]?.thread0Elements || [0, 1, 2, 3, 4, 5, 6, 7] },
  ];
  const left = 226;
  const cellWidth = 38;

  strips.forEach((strip) => {
    const group = svgElement("g", { "data-step": strip.step });
    for (let index = 0; index < 16; index += 1) {
      const owner = Math.floor(index / strip.spt);
      const fill = owner === 0 ? TEAL : owner === 1 ? ORANGE : "#cfc7b8";
      group.appendChild(rect(left + index * cellWidth, strip.y, cellWidth - 3, 26, {
        fill,
        "fill-opacity": owner < 2 ? 0.85 : 0.4,
        stroke: "#a7a398",
        "stroke-width": 0.5,
      }));
      group.appendChild(svgElement("text", {
        x: left + index * cellWidth + (cellWidth - 3) / 2,
        y: strip.y + 17,
        "text-anchor": "middle",
        fill: INK,
        "font-size": 8.5,
      }, String(index)));
    }
    const tail = strip.thread0.filter((element) => element >= 16);
    if (tail.length) {
      group.appendChild(label(left + 16 * cellWidth + 4, strip.y + 17, "…", { fill: SOFT, "font-size": 13 }));
      group.appendChild(rect(left + 16 * cellWidth + 20, strip.y, 74, 26, {
        fill: TEAL,
        "fill-opacity": 0.85,
        stroke: "#a7a398",
        "stroke-width": 0.5,
      }));
      group.appendChild(svgElement("text", {
        x: left + 16 * cellWidth + 57,
        y: strip.y + 17,
        "text-anchor": "middle",
        fill: INK,
        "font-size": 9,
      }, `${tail[0]}–${tail.at(-1)}`));
    }
    group.appendChild(label(left, strip.y - 6, `thread 0 · ${strip.thread0.length} registers, summed in order`, { fill: SOFT }));
    layer.appendChild(group);
  });

  layer.appendChild(svgElement("line", { x1: 24, y1: 100, x2: 936, y2: 100, stroke: LINE, "stroke-width": 1 }));
  layer.appendChild(rect(24, 276, 260, 34, {
    fill: "rgba(228, 94, 82, 0.12)",
    stroke: RED,
    "data-step": 2,
  }));
  layer.appendChild(svgElement("text", { x: 36, y: 298, fill: RED_DARK, "font-size": 12, "data-step": 2 }, "up to 3 ulp apart"));
}

/* --- 03 · figure 4, the decode head ---------------------------------------- */

function drawHeadCuts() {
  const layer = layerOf("head-svg-cuts");
  if (!layer) return;
  const head = window.K3_FACTS?.head;
  const chunks = head ? head.v1Chunks : 16;
  const tiles = head ? head.tiles : 501;

  const left = 40;
  const width = 880;

  // the outer dispatch partition: chunked launches above, one full-vocabulary dispatch below
  const chunkWidth = width / chunks;
  const chunked = svgElement("g", { "data-step": 0 });
  for (let index = 0; index < chunks; index += 1) {
    chunked.appendChild(rect(left + index * chunkWidth, 96, chunkWidth - 3, 26, {
      fill: "rgba(238, 143, 67, 0.32)",
      stroke: ORANGE_DARK,
      "stroke-width": 0.7,
    }));
  }
  layer.appendChild(chunked);

  const collapse = svgElement("g", { "data-step": 1 });
  collapse.appendChild(wire(`M ${left + width / 2} 124 L ${left + width / 2} 138`, {
    stroke: TEAL_DARK,
    "stroke-width": 1.4,
    "data-draw": "",
  }));
  collapse.appendChild(svgElement("path", { d: `M ${left + width / 2} 144 l 6 -12 l -12 0 z`, fill: TEAL_DARK }));
  collapse.appendChild(rect(left, 146, width, 26, {
    fill: "rgba(36, 199, 181, 0.35)",
    stroke: TEAL_DARK,
    "stroke-width": 1.2,
  }));
  collapse.appendChild(svgElement("text", {
    x: left + width / 2,
    y: 164,
    "text-anchor": "middle",
    fill: TEAL_DARK,
    "font-size": 11,
  }, "1 full-vocabulary projection + statistics launch"));
  layer.appendChild(collapse);

  // the shared axis
  layer.appendChild(rect(left, 208, width, 20, { fill: "#e8e2d5", stroke: LINE }));
  layer.appendChild(label(left + 6, 222, "0", { fill: SOFT }));
  layer.appendChild(label(left + width - 6, 222, `${(head ? head.vocab : 128256).toLocaleString()}`, { "text-anchor": "end", fill: SOFT }));

  // the stats cut: one tile per 256 columns, then the pinned merge
  const visibleTiles = Math.min(64, tiles);
  const tileWidth = width / visibleTiles;
  const comb = svgElement("g", { "data-step": 2 });
  for (let index = 0; index < visibleTiles; index += 1) {
    comb.appendChild(svgElement("line", {
      x1: left + index * tileWidth,
      y1: 292,
      x2: left + index * tileWidth,
      y2: 318,
      stroke: TEAL_DARK,
      "stroke-width": 0.6,
    }));
  }
  comb.appendChild(rect(left, 292, width, 26, { fill: "rgba(36, 199, 181, 0.12)", stroke: TEAL_DARK, "stroke-width": 0.8 }));
  comb.appendChild(label(left + width - 6, 286, `${tiles.toLocaleString()} × (m, l)`, { "text-anchor": "end", fill: TEAL_DARK }));
  layer.appendChild(comb);

  const merge = svgElement("g", { "data-step": 3 });
  merge.appendChild(label(left, 344, `${tiles} records + 11 identity pads → 512 leaves`, {
    fill: TEAL_DARK, "font-size": 9.5, "font-weight": 750,
  }));
  let nodes = Array.from({ length: 16 }, (_value, index) => ({
    x: 470 + index * 27,
    y: 336,
  }));
  nodes.forEach((node, index) => {
    merge.appendChild(svgElement("circle", {
      cx: node.x, cy: node.y, r: 3.2,
      fill: index === 15 ? PAPER : TEAL_DARK,
      stroke: TEAL_DARK, "stroke-width": 0.8,
    }));
  });
  [358, 378, 398, 418].forEach((nextY) => {
    const next = [];
    for (let index = 0; index < nodes.length; index += 2) {
      const targetX = (nodes[index].x + nodes[index + 1].x) / 2;
      merge.appendChild(wire(`M ${nodes[index].x} ${nodes[index].y + 4} L ${targetX} ${nextY - 4}`, {
        stroke: TEAL_DARK, "stroke-width": 0.8,
      }));
      merge.appendChild(wire(`M ${nodes[index + 1].x} ${nodes[index + 1].y + 4} L ${targetX} ${nextY - 4}`, {
        stroke: TEAL_DARK, "stroke-width": 0.8,
      }));
      merge.appendChild(svgElement("circle", {
        cx: targetX, cy: nextY, r: nextY === 418 ? 6 : 3.5,
        fill: nextY === 418 ? TEAL_DARK : PAPER,
        stroke: TEAL_DARK, "stroke-width": 0.9,
      }));
      next.push({ x: targetX, y: nextY });
    }
    nodes = next;
  });
  merge.appendChild(label(nodes[0].x + 14, 422, "LSE", {
    "text-anchor": "start", fill: TEAL_DARK, "font-size": 8.5, "font-weight": 800,
  }));
  layer.appendChild(merge);
}

function drawHeadMoved() {
  const layer = layerOf("head-svg-moved");
  if (!layer) return;
  const head = window.K3_FACTS?.head;
  const tiles = head ? head.tiles : 501;
  const left = 24;
  const width = 912;

  const comb = (y, count, color, step) => {
    const group = svgElement("g", { "data-step": step });
    const visibleTicks = Math.max(16, Math.round((count / (tiles * 2)) * 64));
    const spacing = width / visibleTicks;
    for (let index = 0; index < visibleTicks; index += 1) {
      group.appendChild(svgElement("line", {
        x1: left + index * spacing,
        y1: y,
        x2: left + index * spacing,
        y2: y + 30,
        stroke: color,
        "stroke-width": 0.6,
      }));
    }
    group.appendChild(rect(left, y, width, 30, { fill: "none", stroke: color, "stroke-width": 1 }));
    return group;
  };

  layer.appendChild(comb(44, tiles, TEAL_DARK, 0));
  layer.appendChild(comb(184, tiles * 2, RED_DARK, 1));

  const sample = [0, 1, 2, 3];
  sample.forEach((index) => {
    const x = 24 + index * 230;
    layer.appendChild(rect(x, 90, 210, 34, { fill: "rgba(36, 199, 181, 0.14)", stroke: TEAL_DARK, "stroke-width": 0.8, "data-step": 0 }));
    layer.appendChild(svgElement("text", { x: x + 12, y: 112, fill: TEAL_DARK, "font-size": 11, "data-step": 0 }, `(m, l) over columns ${index * 256}–${index * 256 + 255}`));
    layer.appendChild(rect(x, 230, 210, 34, { fill: "rgba(228, 94, 82, 0.12)", stroke: RED_DARK, "stroke-width": 0.8, "data-step": 2 }));
    layer.appendChild(svgElement("text", { x: x + 12, y: 252, fill: RED_DARK, "font-size": 11, "data-step": 2 }, `(m, l) over columns ${index * 128}–${index * 128 + 127}`));
  });

  layer.appendChild(wire("M 480 130 L 480 176", { stroke: RED_DARK, "stroke-width": 1.6, "data-draw": "", "data-step": 1 }));
  layer.appendChild(svgElement("path", { d: "M 480 182 l 6 -12 l -12 0 z", fill: RED_DARK, "data-step": 1 }));
}

function drawHeadDrift() {
  const layer = layerOf("head-svg-drift");
  if (!layer) return;
  const drift = window.K3_FACTS?.head?.drift;
  if (!drift) return;

  const left = 90;
  const right = 900;
  const top = 76;
  const bottom = 208;
  const toX = (step) => left + (step / drift.steps) * (right - left);
  const toY = (value) => bottom - ((Math.log10(value) + 8) / 3) * (bottom - top);

  ["1e-8", "1e-7", "1e-6", "1e-5"].forEach((text, index) => {
    const y = bottom - (index / 3) * (bottom - top);
    layer.appendChild(svgElement("line", { x1: left, y1: y, x2: right, y2: y, stroke: LINE, "stroke-width": 0.7, "stroke-dasharray": "3 5" }));
    layer.appendChild(label(left - 8, y + 3, text, { "text-anchor": "end", fill: SOFT }));
  });
  layer.appendChild(svgElement("line", { x1: left, y1: bottom, x2: right, y2: bottom, stroke: LINE, "stroke-width": 1 }));
  layer.appendChild(label(left, 226, "step 0", { fill: MUTED }));
  layer.appendChild(label(right, 226, `step ${drift.steps}`, { "text-anchor": "end", fill: MUTED }));

  layer.appendChild(wire(`M ${left} ${toY(drift.flatArmK3)} L ${right} ${toY(drift.flatArmK3)}`, {
    stroke: TEAL_DARK,
    "stroke-width": 2,
    "data-draw": "",
    "data-step": 0,
  }));
  layer.appendChild(wire(`M ${toX(0)} ${toY(drift.startK3)} L ${toX(drift.steps)} ${toY(drift.endK3)}`, {
    stroke: RED_DARK,
    "stroke-width": 2,
    "stroke-dasharray": "6 4",
    "data-step": 1,
  }));
  [[0, drift.startK3], [drift.steps, drift.endK3]].forEach(([step, value], index) => {
    layer.appendChild(svgElement("circle", { cx: toX(step), cy: toY(value), r: 5, fill: RED, stroke: RED_DARK, "data-step": 1 }));
    layer.appendChild(svgElement("text", {
      x: toX(step) + (index ? -10 : 10),
      y: toY(value) - 12,
      "text-anchor": index ? "end" : "start",
      fill: RED_DARK,
      "font-size": 11,
      "data-step": 1,
    }, value.toExponential(1)));
  });
}

/* ---------------------------------------------------------------------------
 * Wordle run comparison chart. Data arrives via K3_FACTS.wordleRuns
 * (generated from snapshots/wordle_grpo_runs_20260811.json).
 *
 * One implementation serves every run comparison in the article. A caller picks
 * which arms to plot, what to call them and what colour to give them; the axes,
 * cursor and held-out markers are shared so the figures read against each other.
 */

function drawRunsComparisonChart(config) {
  const svg = document.getElementById(config.svgId);
  const facts = window.K3_FACTS && window.K3_FACTS.wordleRuns;
  if (!svg || !facts || !Array.isArray(facts.runs)) return;
  const layer = svg.querySelector("[data-js-layer]");
  const showSolve = document.getElementById(config.solveToggleId);
  const showK3 = document.getElementById(config.k3ToggleId);
  if (!layer || !showSolve || !showK3) return;

  const STEPS = 128;
  const top = 26;
  const bottom = 432;
  const left = 66;
  const solveMax = config.solveMax || 0.85;
  /* K3 is read on a log axis. A linear one pins everything below a thousandth
   * to the baseline, which is where the runs that matter live: router replay
   * holds 0.00027 and would draw on top of a run holding exactly 0. The runs
   * across these charts span 0.00026 to 0.046, four decades with the zero rail.
   * Exact zero has no place on a log axis, so it keeps its own rail below the
   * floor, separated by a break. */
  const k3Max = config.k3Max || 0.1;
  const k3Min = config.k3Min || 0.0001;
  const K3_ZERO_ROOM = 22;
  const k3ZeroY = bottom - 2;
  const k3Bottom = bottom - K3_ZERO_ROOM;
  const state = { cursor: null, hidden: new Set(config.defaultHidden || []) };

  const runs = config.series
    .map((entry) => {
      const run = facts.runs.find((candidate) => candidate.alias === entry.alias);
      if (!run || !Array.isArray(run.solve) || !Array.isArray(run.k3)) return null;
      return {
        key: entry.alias,
        alias: entry.label,
        color: entry.color,
        /* A series colour tuned for 2px strokes is usually too light to read as
         * type. A series that wants its readout in its own hue carries a
         * darkened ink variant; everything else keeps the neutral ink. */
        textColor: entry.textColor || null,
        solve: run.solve,
        k3: run.k3,
        finalEval: run.finalEval,
      };
    })
    .filter(Boolean);
  if (!runs.length) return;
  const shown = () => runs.filter((run) => !state.hidden.has(run.key));

  const percent = (value, digits = 1) => `${(100 * value).toFixed(digits)}%`;
  const k3TickLabel = (tick) => (tick === 0
    ? "0"
    : tick.toFixed(Math.max(0, -Math.round(Math.log10(tick)))));

  function layout() {
    const right = 888;
    const x = (step) => left + ((step - 1) / (STEPS - 1)) * (right - left);
    const ySolve = (value) => bottom - (value / solveMax) * (bottom - top);
    const logSpan = Math.log10(k3Max) - Math.log10(k3Min);
    const yK3 = (value) => {
      if (!(value > 0)) return k3ZeroY;
      const clamped = Math.min(k3Max, Math.max(k3Min, value));
      return k3Bottom - ((Math.log10(clamped) - Math.log10(k3Min)) / logSpan) * (k3Bottom - top);
    };
    return { x, ySolve, yK3, right, evalX: x(STEPS) };
  }

  function polyline(points, attributes) {
    return svgElement("polyline", {
      points: points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" "),
      fill: "none",
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
      ...attributes,
    });
  }

  function drawAxes(geometry) {
    const axes = svgElement("g");
    const k3Ticks = [0, 0.0001, 0.001, 0.01, 0.1]
      .filter((tick) => tick === 0 || (tick >= k3Min && tick <= k3Max));
    const gridTicks = showSolve.checked ? [0, 0.2, 0.4, 0.6, 0.8] : k3Ticks;
    gridTicks.forEach((tick) => {
      const y = showSolve.checked ? geometry.ySolve(tick) : geometry.yK3(tick);
      axes.appendChild(svgElement("line", { x1: left, y1: y, x2: geometry.right, y2: y, stroke: LINE_FAINT, "stroke-width": 1 }));
      if (showSolve.checked) {
        axes.appendChild(svgElement("text", { x: left - 8, y: y + 4, "text-anchor": "end", fill: SOFT, "font-size": 12 }, percent(tick, 0)));
      }
    });
    [1, 32, 64, 96, 128].forEach((step) => {
      const px = geometry.x(step);
      axes.appendChild(svgElement("line", { x1: px, y1: bottom, x2: px, y2: bottom + 5, stroke: SOFT, "stroke-width": 1 }));
      axes.appendChild(svgElement("text", { x: px, y: bottom + 20, "text-anchor": "middle", fill: SOFT, "font-size": 12 }, String(step)));
    });
    axes.appendChild(svgElement("line", { x1: left, y1: bottom, x2: geometry.right, y2: bottom, stroke: SOFT, "stroke-width": 1.2 }));
    axes.appendChild(svgElement("text", { x: left, y: bottom + 38, fill: SOFT, "font-size": 12 }, "training step"));
    if (showSolve.checked) {
      axes.appendChild(svgElement("text", { x: left - 8, y: top - 8, "text-anchor": "end", fill: SOFT, "font-size": 12 }, "solve"));
    }
    if (showK3.checked) {
      k3Ticks.forEach((tick) => {
        const y = geometry.yK3(tick);
        axes.appendChild(svgElement("text", { x: geometry.right + 8, y: y + 4, fill: SOFT, "font-size": 12 }, k3TickLabel(tick)));
      });
      /* The exact-zero rail is not a decade, so the axis breaks above it. */
      const breakY = (k3Bottom + k3ZeroY) / 2;
      [breakY - 3, breakY + 3].forEach((slashY) => {
        axes.appendChild(svgElement("line", {
          x1: geometry.right + 4, y1: slashY + 3, x2: geometry.right + 14, y2: slashY - 3,
          stroke: SOFT, "stroke-width": 1,
        }));
      });
      /* The title is long enough to run past the viewBox if it starts inside
       * the plot, so it hangs off the right margin instead. */
      axes.appendChild(svgElement("text", {
        x: 956, y: top - 8, "text-anchor": "end", fill: SOFT, "font-size": 12,
      }, "K3 (dashed, log)"));
    }
    return axes;
  }

  function drawSeries(geometry) {
    const group = svgElement("g");
    shown().forEach((run) => {
      if (showSolve.checked) {
        group.appendChild(polyline(run.solve.map((value, index) => [geometry.x(index + 1), geometry.ySolve(value)]), { stroke: run.color, "stroke-width": 2 }));
      }
      if (showK3.checked) {
        group.appendChild(polyline(run.k3.map((value, index) => [
          geometry.x(index + 1),
          value === 0 ? k3ZeroY : geometry.yK3(value),
        ]), { stroke: run.color, "stroke-width": 2, "stroke-dasharray": "5 4" }));
      }
    });
    return group;
  }

  /* Two runs can finish within a fraction of a point of each other, which puts
   * their error bars, diamonds and readouts on the same pixel: in the router
   * replay chart 658 of 850 and 656 of 850 are one pixel apart. The values stay
   * where they are. Markers in a collision dodge sideways so both error bars
   * stay legible, and the readouts spread into the same right-hand column,
   * each joined back to its diamond by a leader. */
  const EVAL_LABEL_GAP = 15;
  const EVAL_DODGE = 18;
  /* Cursor sentinel: the readout past the last training step. */
  const EVAL_CURSOR = "eval";
  const evalCursorAvailable = () => showSolve.checked
    && shown().some((run) => run.finalEval && Array.isArray(run.finalEval.wilson95Ci));

  function evalPlacements(geometry) {
    const places = shown()
      .filter((run) => run.finalEval && Array.isArray(run.finalEval.wilson95Ci))
      .map((run) => ({ run, py: geometry.ySolve(run.finalEval.solveRate) }))
      .sort((a, b) => a.py - b.py);

    const clusters = [];
    places.forEach((place) => {
      const open = clusters[clusters.length - 1];
      if (open && place.py - open[open.length - 1].py < EVAL_LABEL_GAP) open.push(place);
      else clusters.push([place]);
    });

    clusters.forEach((cluster) => {
      const span = (cluster.length - 1) * EVAL_LABEL_GAP;
      const middle = cluster.reduce((sum, place) => sum + place.py, 0) / cluster.length;
      const first = Math.max(top + 6, Math.min(bottom - 6 - span, middle - span / 2));
      cluster.forEach((place, index) => {
        place.labelY = cluster.length === 1 ? place.py : first + index * EVAL_LABEL_GAP;
        place.px = geometry.evalX - (cluster.length - 1 - index) * EVAL_DODGE;
      });
    });
    return places;
  }

  function drawFinalEval(geometry) {
    const group = svgElement("g");
    /* The log-axis title claims the right end of the header band, so the eval
     * key sits left of it to stay clear when both toggles are on. The opening
     * figure opts out: its run key above the chart is set at reading size, and
     * a second key inside the plot at 12px reads as a stray annotation. */
    if (config.evalKey !== false) {
      const keyX = 648;
      const keyY = top - 10;
      group.appendChild(svgElement("line", { x1: keyX, y1: keyY - 8, x2: keyX, y2: keyY + 8, stroke: SOFT, "stroke-width": 1.5 }));
      [keyY - 8, keyY + 8].forEach((capY) => {
        group.appendChild(svgElement("line", { x1: keyX - 5, y1: capY, x2: keyX + 5, y2: capY, stroke: SOFT, "stroke-width": 1.5 }));
      });
      group.appendChild(svgElement("rect", { x: keyX - 5, y: keyY - 5, width: 10, height: 10, transform: `rotate(45 ${keyX} ${keyY})`, fill: SOFT, stroke: PAPER, "stroke-width": 1.5 }));
      group.appendChild(svgElement("text", { x: keyX + 16, y: keyY + 4, fill: SOFT, "font-size": 12 }, "held-out eval"));
    }
    const labelX = geometry.evalX + 14;
    evalPlacements(geometry).forEach(({ run, px, py, labelY }) => {
      const [low, high] = run.finalEval.wilson95Ci;
      group.appendChild(svgElement("line", { x1: px, y1: geometry.ySolve(high), x2: px, y2: geometry.ySolve(low), stroke: run.color, "stroke-width": 2 }));
      [low, high].forEach((cap) => {
        const capY = geometry.ySolve(cap);
        group.appendChild(svgElement("line", { x1: px - 5, y1: capY, x2: px + 5, y2: capY, stroke: run.color, "stroke-width": 2 }));
      });
      group.appendChild(svgElement("rect", { x: px - 6, y: py - 6, width: 12, height: 12, transform: `rotate(45 ${px} ${py})`, fill: run.color, stroke: PAPER, "stroke-width": 2 }));
      /* The leader leaves from whichever corner faces the readout, so it
       * passes above or below its neighbour's diamond rather than through it. */
      if (labelY !== py) {
        group.appendChild(svgElement("line", {
          x1: px, y1: py + (labelY > py ? 7 : -7), x2: labelX - 4, y2: labelY,
          stroke: run.color, "stroke-width": 1, opacity: 0.55,
        }));
      }
      group.appendChild(svgElement("text", {
        x: labelX, y: labelY + 4, "text-anchor": "start",
        fill: run.textColor || INK_FAINT, "font-size": 11.5, "font-weight": 600,
      }, percent(run.finalEval.solveRate)));
    });
    return group;
  }

  function drawCursor(geometry) {
    const group = svgElement("g", { "pointer-events": "none" });
    if (state.cursor === null || (!showSolve.checked && !showK3.checked)) return group;
    const atEval = state.cursor === EVAL_CURSOR;
    if (atEval && !evalCursorAvailable()) return group;
    const step = state.cursor;
    const px = atEval ? geometry.evalX : geometry.x(step);
    group.appendChild(svgElement("line", { x1: px, y1: top, x2: px, y2: bottom, stroke: SOFT, "stroke-width": 1, "stroke-dasharray": "2 3" }));
    const lines = [];
    shown().forEach((run) => {
      if (atEval) {
        if (!run.finalEval || !Array.isArray(run.finalEval.wilson95Ci)) return;
        const { solveRate, solved, games, wilson95Ci: [low, high] } = run.finalEval;
        lines.push({
          color: run.color,
          text: `${run.alias} ${percent(solveRate)} · ${solved}/${games} · CI ${percent(low)}–${percent(high)}`,
        });
        return;
      }
      const solve = run.solve[step - 1];
      const k3 = run.k3[step - 1];
      if (showSolve.checked && solve !== undefined) {
        lines.push({ color: run.color, text: `${run.alias} solve ${percent(solve)}` });
      }
      if (showK3.checked && k3 !== undefined) {
        lines.push({ color: run.color, text: `${run.alias} K3 ${k3.toFixed(4)}` });
      }
    });
    const width = Math.max(250, ...lines.map((line) => 44 + line.text.length * 7.2));
    const height = 26 + lines.length * 18;
    const boxX = px + width + 16 > geometry.right ? px - width - 12 : px + 12;
    const boxY = top + 8;
    group.appendChild(svgElement("rect", { x: boxX, y: boxY, width, height, rx: 6, fill: PAPER, stroke: LINE, "stroke-width": 1 }));
    group.appendChild(svgElement("text", {
      x: boxX + 10, y: boxY + 18, fill: INK, "font-size": 12, "font-weight": 700,
    }, atEval ? "held-out eval" : `step ${step}`));
    lines.forEach((line, index) => {
      const lineY = boxY + 36 + index * 18;
      group.appendChild(svgElement("circle", { cx: boxX + 14, cy: lineY - 4, r: 4, fill: line.color }));
      group.appendChild(svgElement("text", { x: boxX + 24, y: lineY, fill: INK, "font-size": 12 }, line.text));
    });
    return group;
  }

  let geometry = layout();

  function render() {
    geometry = layout();
    layer.textContent = "";
    layer.appendChild(drawAxes(geometry));
    layer.appendChild(drawSeries(geometry));
    if (showSolve.checked) layer.appendChild(drawFinalEval(geometry));
    layer.appendChild(drawCursor(geometry));
  }

  /* The eval markers sit at and past the end of the training axis, so the last
   * step's worth of chart is where a reader reaching for the diamonds lands.
   * That zone reads out the held-out eval instead of step 128. It starts at the
   * leftmost marker, which the collision dodge can push left of the axis end. */
  function evalHoverLeft(geometry) {
    if (!evalCursorAvailable()) return Infinity;
    return Math.min(...evalPlacements(geometry).map((place) => place.px)) - 6;
  }

  function stepFromEvent(event) {
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * 960;
    if (px >= evalHoverLeft(geometry)) return EVAL_CURSOR;
    const step = Math.round(1 + ((px - left) / (geometry.right - left)) * (STEPS - 1));
    return Math.max(1, Math.min(STEPS, step));
  }

  svg.addEventListener("pointermove", (event) => {
    state.cursor = stepFromEvent(event);
    render();
  });
  svg.addEventListener("pointerleave", () => {
    state.cursor = null;
    render();
  });
  svg.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: "start", End: "end" };
    if (!(event.key in moves) && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") state.cursor = null;
    else if (moves[event.key] === "start") state.cursor = 1;
    else if (moves[event.key] === "end") state.cursor = evalCursorAvailable() ? EVAL_CURSOR : STEPS;
    else if (state.cursor === EVAL_CURSOR) state.cursor = moves[event.key] < 0 ? STEPS : EVAL_CURSOR;
    else {
      /* Stepping right off the last training step lands on the eval readout,
       * so the keyboard reaches everything the pointer can. */
      const next = (state.cursor || 1) + moves[event.key];
      state.cursor = next > STEPS && evalCursorAvailable()
        ? EVAL_CURSOR
        : Math.max(1, Math.min(STEPS, next));
    }
    render();
  });
  [showSolve, showK3].forEach((control) => control.addEventListener("change", () => {
    if (!showSolve.checked && !showK3.checked) control.checked = true;
    /* Hiding the solve series takes the eval markers with it. */
    if (state.cursor === EVAL_CURSOR && !evalCursorAvailable()) state.cursor = STEPS;
    render();
  }));

  wireLegendToggles(config.legendId, state, runs.map((run) => run.key), () => {
    if (state.cursor === EVAL_CURSOR && !evalCursorAvailable()) state.cursor = STEPS;
    render();
  }, Object.fromEntries(runs.filter((run) => run.textColor).map((run) => [run.key, run.textColor])));

  render();
}

/* ---------------------------------------------------------------------------
 * Interactive run legends, shared by every run chart. Legend entries carry a
 * run's alias in data-series and toggle it on click or Enter/Space; a key in
 * state.hidden starts toggled off. The last visible run refuses to hide so a
 * chart never goes empty. Each entry is named in its own run's ink, so the
 * chart's colour coding survives without hunting for the swatch.
 */

function wireLegendToggles(legendId, state, keys, afterToggle, inkByKey) {
  const list = legendId && document.getElementById(legendId);
  if (!list) return;
  list.querySelectorAll("li[data-series]").forEach((item) => {
    const key = item.getAttribute("data-series");
    if (!keys.includes(key)) return;
    if (inkByKey && inkByKey[key]) item.style.color = inkByKey[key];
    const sync = () => {
      item.classList.toggle("series-off", state.hidden.has(key));
      item.setAttribute("aria-pressed", state.hidden.has(key) ? "false" : "true");
    };
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    const toggle = () => {
      if (!state.hidden.has(key) && state.hidden.size >= keys.length - 1) return;
      if (state.hidden.has(key)) state.hidden.delete(key);
      else state.hidden.add(key);
      sync();
      afterToggle();
    };
    item.addEventListener("click", toggle);
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
    sync();
  });
}

/* ---------------------------------------------------------------------------
 * Tinker incident genealogy. Data arrives via K3_FACTS.tinkerBranches
 * (generated from snapshots/tinker_branch_incident_20260814.json).
 */

function drawTinkerBranchesChart() {
  const svg = document.getElementById("tinker-branches-svg");
  const facts = window.K3_FACTS && window.K3_FACTS.tinkerBranches;
  if (!svg || !facts) return;
  const layer = svg.querySelector("[data-js-layer]");
  if (!layer) return;

  /* Run 2 is the branch that survives, and it is the same run the opening
   * figure draws in black as "Baseline* (Tinker)", so it keeps that colour
   * here. The two that diverge take the warm pair, and Run 3 is dashed
   * because it traces Run 1 closely enough to hide underneath it. */
  const COLORS = { R1: RED, R1B: MUTED, A3: ORANGE };
  /* Ink variants for the legend: RED and ORANGE are too light to read as type. */
  const INKS = { R1: RED_INK, R1B: MUTED, A3: ORANGE_INK };
  const NAMES = { R1: "Tinker Run 1", R1B: "Tinker Run 2", A3: "Tinker Run 3" };
  const ORDER = ["R1", "R1B", "A3"];

  /* Panels keep a fixed height and the viewBox grows with however many are
   * showing, so hiding a series shortens the figure instead of stretching
   * the panels that remain. */
  const left = 66;
  const right = 888;
  const plotTop = 44;
  const panelHeight = 190;
  const panelGap = 74;
  const axisRoom = 62;

  const startStep = facts.window[0];
  const endStep = facts.window[1];
  const toX = (step) => left + ((step - startStep) / (endStep - startStep)) * (right - left);

  const PANELS = [
    {
      id: "solve",
      key: "solve_rate",
      title: "training solve rate",
      control: "tinker-show-solve",
      domain: [0, 0.7],
      ticks: [0, 0.2, 0.4, 0.6],
      tick: (value) => `${Math.round(value * 100)}%`,
      read: (value) => `${(100 * value).toFixed(1)}%`,
      label: "solve",
    },
    {
      id: "k3",
      key: "k3",
      title: "train-infer mismatch (K3)",
      control: "tinker-show-k3",
      domain: [0, 0.28],
      ticks: [0, 0.05, 0.1, 0.15, 0.2, 0.25],
      tick: (value) => value.toFixed(2),
      read: (value) => value.toFixed(4),
      label: "K3",
    },
    {
      id: "logprob",
      key: "trainer_mean_logprob",
      title: "mean selected-token logprob (trainer)",
      control: "tinker-show-logprob",
      domain: [-0.52, -0.18],
      ticks: [-0.5, -0.4, -0.3, -0.2],
      tick: (value) => `−${Math.abs(value).toFixed(2)}`,
      read: (value) => `−${Math.abs(value).toFixed(3)}`,
      label: "logprob",
    },
  ];

  const anchor = facts.sharedAnchor;
  const branches = ORDER.map((alias) => {
    const branch = facts.branches.find((candidate) => candidate.alias === alias);
    const series = branch.series;
    const points = [{
      step: anchor.step,
      solve_rate: anchor.solve_rate,
      k3: anchor.k3,
      trainer_mean_logprob: anchor.trainer_mean_logprob,
    }];
    series.steps.forEach((step, index) => {
      points.push({
        step,
        solve_rate: series.solve_rate[index],
        k3: series.k3[index],
        trainer_mean_logprob: series.trainer_mean_logprob[index],
      });
    });
    return {
      alias,
      color: COLORS[alias],
      name: NAMES[alias],
      points,
      byStep: new Map(points.map((point) => [point.step, point])),
      /* The snapshot carries the sampler's mean logprob only at the divergence
       * step, so it is a marker there rather than a fourth series. */
      samplerAtDivergence: branch.step62Signature
        ? branch.step62Signature.sampler_mean_logprob
        : null,
    };
  });

  const state = { cursor: null, hidden: new Set() };

  const polyline = (points, attributes) => svgElement("polyline", {
    points: points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
    fill: "none",
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    ...attributes,
  });

  const visiblePanels = () => PANELS.filter((panel) => {
    const control = document.getElementById(panel.control);
    return control && control.checked;
  });

  function layout() {
    const placed = visiblePanels().map((panel, index, all) => {
      const top = plotTop + index * (panelHeight + panelGap);
      const bottom = top + panelHeight;
      const [low, high] = panel.domain;
      return {
        ...panel,
        top,
        bottom,
        toY: (value) => bottom - ((value - low) / (high - low)) * panelHeight,
        isLast: index === all.length - 1,
      };
    });
    const height = placed.length ? placed[placed.length - 1].bottom + axisRoom : 560;
    svg.setAttribute("viewBox", `0 0 960 ${Math.round(height)}`);
    return placed;
  }

  function drawPanel(panel) {
    const group = svgElement("g");
    panel.ticks.forEach((tick) => {
      const y = panel.toY(tick);
      group.appendChild(svgElement("line", { x1: left, y1: y, x2: right, y2: y, stroke: LINE_FAINT, "stroke-width": 1 }));
      group.appendChild(svgElement("text", { x: left - 8, y: y + 4, "text-anchor": "end", fill: SOFT, "font-size": 12 }, panel.tick(tick)));
    });
    group.appendChild(svgElement("line", { x1: left, y1: panel.bottom, x2: right, y2: panel.bottom, stroke: SOFT, "stroke-width": 1.2 }));
    group.appendChild(svgElement("text", { x: left, y: panel.top - 11, fill: SOFT, "font-size": 12 }, panel.title));

    if (panel.isLast) {
      for (let step = startStep; step <= endStep; step += 2) {
        const x = toX(step);
        group.appendChild(svgElement("line", { x1: x, y1: panel.bottom, x2: x, y2: panel.bottom + 5, stroke: SOFT, "stroke-width": 1 }));
        group.appendChild(svgElement("text", { x, y: panel.bottom + 20, "text-anchor": "middle", fill: SOFT, "font-size": 12 }, String(step)));
      }
      group.appendChild(svgElement("text", { x: left, y: panel.bottom + 38, fill: SOFT, "font-size": 12 }, "training step"));
    }
    return group;
  }

  function drawDivergence(panels) {
    const group = svgElement("g");
    if (!panels.length) return group;
    const x = toX(facts.divergenceStep);
    group.appendChild(svgElement("line", {
      x1: x, y1: panels[0].top, x2: x, y2: panels[panels.length - 1].bottom,
      stroke: RED_DARK, "stroke-width": 1, "stroke-dasharray": "4 4",
    }));
    group.appendChild(svgElement("text", {
      x, y: 20, "text-anchor": "middle", fill: RED_DARK, "font-size": 12,
    }, `step ${facts.divergenceStep}`));
    return group;
  }

  const shownBranches = () => branches.filter((branch) => !state.hidden.has(branch.alias));

  function drawSeries(panels) {
    const group = svgElement("g");
    shownBranches().forEach((branch) => {
      panels.forEach((panel) => {
        group.appendChild(polyline(
          branch.points.map((point) => [toX(point.step), panel.toY(point[panel.key])]),
          {
            stroke: branch.color,
            "stroke-width": 2,
            ...(branch.alias === "A3" ? { "stroke-dasharray": "6 4" } : {}),
          },
        ));
        const last = branch.points[branch.points.length - 1];
        group.appendChild(svgElement("circle", {
          cx: toX(last.step), cy: panel.toY(last[panel.key]), r: 3.5,
          fill: branch.color, stroke: PAPER, "stroke-width": 1.5,
        }));
      });
    });
    return group;
  }

  /* The contrast the surrounding text turns on: at the divergence step the
   * trainer's mean logprob collapses for two runs while the sampler's stays
   * near -0.20 for all three. */
  function drawSampler(panels) {
    const group = svgElement("g");
    const panel = panels.find((candidate) => candidate.id === "logprob");
    if (!panel) return group;
    const x = toX(facts.divergenceStep);
    shownBranches().forEach((branch) => {
      if (branch.samplerAtDivergence === null) return;
      group.appendChild(svgElement("circle", {
        cx: x, cy: panel.toY(branch.samplerAtDivergence), r: 5,
        fill: "none", stroke: branch.color, "stroke-width": 1.5,
      }));
    });
    group.appendChild(svgElement("text", {
      x: x + 12, y: panel.toY(-0.2) - 14, fill: SOFT, "font-size": 12,
    }, `sampler at step ${facts.divergenceStep}`));
    return group;
  }

  function drawAnchor(panels) {
    const group = svgElement("g");
    panels.forEach((panel) => {
      group.appendChild(svgElement("circle", {
        cx: toX(anchor.step), cy: panel.toY(anchor[panel.key]), r: 4.5,
        fill: INK, stroke: PAPER, "stroke-width": 2,
      }));
    });
    return group;
  }

  function drawCursor(panels) {
    const group = svgElement("g", { "pointer-events": "none" });
    if (state.cursor === null || !panels.length) return group;
    const step = state.cursor;
    const x = toX(step);
    group.appendChild(svgElement("line", {
      x1: x, y1: panels[0].top, x2: x, y2: panels[panels.length - 1].bottom,
      stroke: SOFT, "stroke-width": 1, "stroke-dasharray": "2 3",
    }));

    const lines = [];
    shownBranches().forEach((branch) => {
      const point = branch.byStep.get(step);
      panels.forEach((panel) => {
        lines.push({
          color: branch.color,
          text: point
            ? `${branch.name} ${panel.label} ${panel.read(point[panel.key])}`
            : `${branch.name} ${panel.label} — stopped`,
        });
      });
    });

    const width = Math.max(250, ...lines.map((line) => 44 + line.text.length * 7.2));
    const height = 26 + lines.length * 18;
    const boxX = x + width + 16 > right ? x - width - 12 : x + 12;
    const boxY = panels[0].top + 8;
    group.appendChild(svgElement("rect", { x: boxX, y: boxY, width, height, rx: 6, fill: PAPER, stroke: LINE, "stroke-width": 1 }));
    group.appendChild(svgElement("text", { x: boxX + 10, y: boxY + 18, fill: INK, "font-size": 12, "font-weight": 700 }, `step ${step}`));
    lines.forEach((line, index) => {
      const lineY = boxY + 36 + index * 18;
      group.appendChild(svgElement("circle", { cx: boxX + 14, cy: lineY - 4, r: 4, fill: line.color }));
      group.appendChild(svgElement("text", { x: boxX + 24, y: lineY, fill: INK, "font-size": 12 }, line.text));
    });
    return group;
  }

  function render() {
    const panels = layout();
    layer.textContent = "";
    panels.forEach((panel) => layer.appendChild(drawPanel(panel)));
    layer.appendChild(drawDivergence(panels));
    layer.appendChild(drawSeries(panels));
    layer.appendChild(drawSampler(panels));
    layer.appendChild(drawAnchor(panels));
    layer.appendChild(drawCursor(panels));
  }

  function stepFromEvent(event) {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 960;
    const step = Math.round(startStep + ((x - left) / (right - left)) * (endStep - startStep));
    return Math.max(startStep, Math.min(endStep, step));
  }

  svg.addEventListener("pointermove", (event) => {
    state.cursor = stepFromEvent(event);
    render();
  });
  svg.addEventListener("pointerleave", () => {
    state.cursor = null;
    render();
  });
  svg.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: "start", End: "end" };
    if (!(event.key in moves) && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") state.cursor = null;
    else if (moves[event.key] === "start") state.cursor = startStep;
    else if (moves[event.key] === "end") state.cursor = endStep;
    else state.cursor = Math.max(startStep, Math.min(endStep, (state.cursor || startStep) + moves[event.key]));
    render();
  });

  PANELS.forEach((panel) => {
    const control = document.getElementById(panel.control);
    if (!control) return;
    control.addEventListener("change", () => {
      if (!visiblePanels().length) control.checked = true;
      render();
    });
  });

  wireLegendToggles("tinker-branches-legend", state, ORDER, render, INKS);

  render();
}

/* --------------------------------------------------------------------------- */

function drawAsyncSchedule() {
  const layer = layerOf("async-schedule-svg");
  if (!layer) return;

  const laneLeft = 168;
  const laneRight = 912;
  const syncXs = [416, 664];
  const samplerTones = ["#e5c19b", SERVING_COLOR, ORANGE_DARK];
  const trainerTones = ["#6ba1b6", TRAINING_COLOR, "#2b6076"];
  const versionAt = (x) => (x < syncXs[0] ? 0 : x < syncXs[1] ? 1 : 2);

  layer.appendChild(label(156, 44, "TIME", {
    fill: SOFT, "font-size": 11, "font-weight": 800, "letter-spacing": 0.8,
    "text-anchor": "end",
  }));
  layer.appendChild(wire(`M ${laneLeft} 40 H ${laneRight}`, {
    stroke: LINE, "stroke-width": 1.2,
  }));
  layer.appendChild(svgElement("path", {
    d: `M ${laneRight} 35 L ${laneRight + 10} 40 L ${laneRight} 45 Z`,
    fill: LINE,
  }));

  layer.appendChild(label(156, 122, "SAMPLER", {
    fill: SERVING_COLOR, "font-size": 12, "font-weight": 850, "text-anchor": "end",
  }));
  layer.appendChild(label(156, 250, "TRAINER", {
    fill: TRAINING_COLOR, "font-size": 12, "font-weight": 850, "text-anchor": "end",
  }));

  // One bar per trajectory. Tone tracks the weight version it decodes under,
  // so the sampler lane visibly trails the versions the trainer produces.
  const asyncBar = (rowY, x0, x1) => {
    const group = svgElement("g");
    group.appendChild(svgElement("rect", {
      x: x0, y: rowY, width: x1 - x0, height: 20, rx: 3,
      fill: samplerTones[versionAt(x0)], stroke: SERVING_COLOR, "stroke-width": 0.7,
    }));
    syncXs.forEach((syncX, index) => {
      if (x0 < syncX && x1 > syncX) {
        // Decode moves to the new weights at the sync, but the lower stripe
        // keeps the tone of the weights that wrote this trajectory's cache.
        group.appendChild(svgElement("rect", {
          x: syncX, y: rowY, width: x1 - syncX, height: 14,
          fill: samplerTones[index + 1],
        }));
      }
    });
    layer.appendChild(group);
  };
  [
    [[168, 352], [360, 566], [574, 780], [788, 912]],
    [[168, 438], [446, 658], [666, 912]],
    [[168, 280], [288, 512], [520, 736], [744, 912]],
    [[168, 396], [404, 628], [636, 880], [888, 912]],
  ].forEach((row, rowIndex) => {
    row.forEach(([x0, x1]) => asyncBar(84 + rowIndex * 26, x0, x1));
  });

  syncXs.forEach((syncX, index) => {
    layer.appendChild(svgElement("line", {
      x1: syncX, y1: 74, x2: syncX, y2: 272,
      stroke: INK_FAINT, "stroke-width": 1, "stroke-dasharray": "4 4",
    }));
    layer.appendChild(label(syncX + 7, 206, `SYNC → w${index === 0 ? "₁" : "₂"}`, {
      fill: INK_FAINT, "font-size": 9.5, "font-weight": 800,
    }));
  });

  [[168, 412, "FWD-BWD + OPT → w₁"], [420, 660, "→ w₂"], [668, 912, "→ w₃"]]
    .forEach(([x0, x1, copy], index) => {
      const block = svgElement("g");
      block.appendChild(svgElement("rect", {
        x: x0, y: 228, width: x1 - x0, height: 40, rx: 4, fill: trainerTones[index],
      }));
      block.appendChild(label((x0 + x1) / 2, 253, copy, {
        fill: "#fffdf7", "font-size": 10.5, "font-weight": 800, "text-anchor": "middle",
      }));
      layer.appendChild(block);
    });

  layer.appendChild(svgElement("rect", {
    x: 360, y: 84, width: 206, height: 20, rx: 3, fill: "none",
    stroke: RED_DARK, "stroke-width": 1.6,
  }));
  layer.appendChild(wire("M 462 82 V 74", {
    stroke: RED_DARK, "stroke-width": 1.1,
  }));
  layer.appendChild(label(462, 68, "DECODE STILL READS CACHE WRITTEN UNDER THE OLD WEIGHTS", {
    fill: RED_DARK, "font-size": 11, "font-weight": 850, "text-anchor": "middle",
  }));

}

function drawStreamingSchedule() {
  const layer = layerOf("streaming-schedule-svg");
  if (!layer) return;

  const laneLeft = 168;
  const laneRight = 912;
  const sampled = "#e5c19b";

  layer.appendChild(label(156, 52, "TIME", {
    fill: SOFT, "font-size": 11, "font-weight": 800, "letter-spacing": 0.8,
    "text-anchor": "end",
  }));
  layer.appendChild(wire(`M ${laneLeft} 48 H ${laneRight}`, {
    stroke: LINE, "stroke-width": 1.2,
  }));
  layer.appendChild(svgElement("path", {
    d: `M ${laneRight} 43 L ${laneRight + 10} 48 L ${laneRight} 53 Z`,
    fill: LINE,
  }));

  layer.appendChild(label(156, 132, "SAMPLER", {
    fill: SERVING_COLOR, "font-size": 12, "font-weight": 850, "text-anchor": "end",
  }));
  layer.appendChild(label(156, 262, "TRAINER", {
    fill: TRAINING_COLOR, "font-size": 12, "font-weight": 850, "text-anchor": "end",
  }));
  layer.appendChild(label(laneLeft, 76, "EVERY TRAJECTORY RUNS UNDER ONE WEIGHT VERSION", {
    fill: SERVING_COLOR, "font-size": 10.5, "font-weight": 800,
  }));

  const idleBlock = (x, y, width, height, text) => {
    const group = svgElement("g");
    group.appendChild(svgElement("rect", {
      x, y, width, height, rx: 4, fill: TRACK,
      stroke: LINE, "stroke-width": 1, "stroke-dasharray": "4 3",
    }));
    group.appendChild(label(x + width / 2, y + height / 2 + 4, text, {
      fill: SOFT, "font-size": 10, "font-weight": 800, "text-anchor": "middle",
    }));
    layer.appendChild(group);
  };

  // Groups are drawn longest-first so each completion handoff drops past the
  // shorter groups below it. Waiting times are geometric, so groups land
  // staggered and the trainer starts before the sampler is finished.
  [
    { top: 88, ends: [812, 512, 340], name: "g4", block: [816, 884] },
    { top: 122, ends: [668, 388, 458], name: "g3", block: [672, 796] },
    { top: 156, ends: [534, 434, 264], name: "g2", block: [538, 654] },
    { top: 190, ends: [396, 304, 360], name: "g1", block: [400, 520] },
  ].forEach((group) => {
    group.ends.forEach((end, barIndex) => {
      layer.appendChild(svgElement("rect", {
        x: laneLeft, y: group.top + barIndex * 9, width: end - laneLeft, height: 7,
        rx: 3.5, fill: sampled, stroke: "rgba(189, 109, 55, 0.45)",
        "stroke-width": 0.6,
      }));
    });
    const done = Math.max(...group.ends);
    layer.appendChild(svgElement("circle", {
      cx: done + 6, cy: group.top + 12, r: 4, fill: SERVING_COLOR,
    }));
    layer.appendChild(wire(
      `M ${done + 6} ${group.top + 17} C ${done + 6} ${group.top + 60} ${group.block[0] + 10} 200 ${group.block[0] + 10} 236`,
      { stroke: TRAINING_COLOR, "stroke-width": 1.3 },
    ));
    const width = group.block[1] - group.block[0];
    const block = svgElement("g");
    block.appendChild(svgElement("rect", {
      x: group.block[0], y: 240, width, height: 40, rx: 4, fill: TRAINING_COLOR,
    }));
    block.appendChild(label(group.block[0] + width / 2, 265,
      width > 100 ? `FWD-BWD ${group.name}` : group.name, {
        fill: "#fffdf7", "font-size": 10.5, "font-weight": 800, "text-anchor": "middle",
      }));
    layer.appendChild(block);
  });
  idleBlock(820, 88, 92, 129, "IDLE");
  idleBlock(168, 240, 228, 40, "IDLE UNTIL THE FIRST GROUP");

  layer.appendChild(svgElement("rect", {
    x: 888, y: 240, width: 24, height: 40, rx: 4, fill: "#2b6076",
  }));
  layer.appendChild(wire("M 900 284 V 296", {
    stroke: TRAINING_COLOR, "stroke-width": 1.1,
  }));
  layer.appendChild(label(912, 310, "ONE OPTIMIZER STEP + SYNC", {
    fill: TRAINING_COLOR, "font-size": 10.5, "font-weight": 850, "text-anchor": "end",
  }));
  layer.appendChild(label(468, 310, "SAME GRADIENT AS ONE BIG BATCH", {
    fill: TEAL_DARK, "font-size": 12, "font-weight": 850, "text-anchor": "middle",
  }));

  layer.appendChild(label(156, 344, "SERIAL", {
    fill: SOFT, "font-size": 10, "font-weight": 800, "text-anchor": "end",
  }));
  layer.appendChild(svgElement("rect", {
    x: 168, y: 336, width: 560, height: 11, rx: 5.5,
    fill: TRACK, stroke: LINE, "stroke-width": 0.8,
  }));
  layer.appendChild(label(156, 368, "STREAMING", {
    fill: TEAL_DARK, "font-size": 10, "font-weight": 850, "text-anchor": "end",
  }));
  layer.appendChild(svgElement("rect", {
    x: 168, y: 360, width: 302, height: 11, rx: 5.5,
    fill: "rgba(36, 199, 181, 0.3)", stroke: TEAL_DARK, "stroke-width": 1,
  }));
  layer.appendChild(label(482, 369, "SAVES 46% OF SERIAL WALL TIME", {
    fill: TEAL_DARK, "font-size": 11, "font-weight": 850,
  }));
}

function initFigures() {
  const kernelStories = drawKernelStories();
  drawContractMap();
  drawNormTlsum();
  drawRunsComparisonChart({
    svgId: "grpo-runs-svg",
    solveToggleId: "grpo-show-solve",
    k3ToggleId: "grpo-show-k3",
    evalKey: false,
    legendId: "grpo-legend",
    series: [
      { alias: "0-K3", label: "0 mismatch (XoRL)", color: TEAL, textColor: TEAL_INK },
      { alias: "RIVER-IS", label: "Baseline (River)", color: ORANGE, textColor: ORANGE_INK },
      { alias: "IS", label: "Baseline (XoRL)", color: ORANGE_DEEP, textColor: ORANGE_DEEP_INK },
      { alias: "TINKER", label: "Baseline* (Tinker)", color: MUTED, textColor: MUTED },
    ],
  });
  drawRunsComparisonChart({
    svgId: "pipeline-streaming-svg",
    solveToggleId: "pipeline-show-solve",
    k3ToggleId: "pipeline-show-k3",
    legendId: "pipeline-legend",
    /* The staleness K3 spikes past the default 0.1 axis top. */
    k3Max: 0.2,
    series: [
      { alias: "0-K3", label: "0 mismatch (XoRL)", color: TEAL, textColor: TEAL_INK },
      { alias: "ZK3-PIPELINE", label: "Pipeline + Streaming (XoRL)", color: TEAL_DARK, textColor: TEAL_DARK },
      { alias: "ASYNC-R3-CISPO", label: "Pipeline + Streaming + Router Recall (XoRL)", color: TRAINING_COLOR, textColor: TRAINING_INK },
    ],
  });
  drawRunsComparisonChart({
    svgId: "router-replay-svg",
    solveToggleId: "replay-show-solve",
    k3ToggleId: "replay-show-k3",
    legendId: "replay-legend",
    defaultHidden: ["0-K3"],
    series: [
      { alias: "0-K3", label: "0 mismatch (XoRL)", color: TEAL, textColor: TEAL_INK },
      { alias: "R3-FS", label: "Total Router Recall (XoRL)", color: TRAINING_COLOR, textColor: TRAINING_INK },
      { alias: "RIVER-R3-IS", label: "Replay IDs (River)", color: PURPLE, textColor: PURPLE_INK },
      { alias: "RIVER-IS", label: "Baseline (River)", color: LAVENDER, textColor: LAVENDER_INK },
      { alias: "IS", label: "Baseline (XoRL)", color: NAVY, textColor: NAVY },
    ],
  });
  drawRunsComparisonChart({
    svgId: "shared-outer-svg",
    solveToggleId: "shared-outer-show-solve",
    k3ToggleId: "shared-outer-show-k3",
    legendId: "shared-outer-legend",
    series: [
      { alias: "0-K3", label: "0 mismatch (XoRL)", color: TEAL, textColor: TEAL_INK },
      { alias: "SHARED-OUTER-ZK3", label: "0 mismatch, shared-outer (XoRL)", color: TRAINING_COLOR, textColor: TRAINING_INK },
      { alias: "TINKER", label: "Baseline (Tinker)", color: MUTED, textColor: MUTED },
    ],
  });
  drawRunsComparisonChart({
    svgId: "objectives-svg",
    solveToggleId: "objectives-show-solve",
    k3ToggleId: "objectives-show-k3",
    legendId: "objectives-legend",
    defaultHidden: ["0-K3"],
    series: [
      { alias: "0-K3", label: "0 mismatch", color: TEAL, textColor: TEAL_INK },
      { alias: "IS", label: "Unclipped IS", color: ORANGE, textColor: ORANGE_INK },
      { alias: "PPO", label: "PPO clipping", color: RED_DARK, textColor: RED_DARK },
      { alias: "CISPO", label: "CISPO", color: TEAL_DARK, textColor: TEAL_DARK },
      { alias: "TINKER", label: "Unclipped IS (Tinker)", color: PURPLE, textColor: PURPLE_INK },
      { alias: "TINKER-CISPO", label: "CISPO (Tinker)", color: LAVENDER, textColor: LAVENDER_INK },
    ],
  });
  drawTinkerBranchesChart();
  drawAsyncSchedule();
  drawStreamingSchedule();

  const sequence = (id, options) => {
    const svg = document.getElementById(id);
    return svg ? createSequence(svg, options) : null;
  };

  bindFigure("fig-rope-mismatch", { "rope-mismatch-svg": kernelStories.rope.mismatch });
  bindFigure("fig-norm-exact", { "norm-exact-svg": kernelStories.norm.exact });
  bindFigure("fig-gemm-exact", { "gemm-exact-svg": kernelStories.gemm.exact });
  bindFigure("fig-gdn-mismatch", { "gdn-mismatch-svg": kernelStories.gdn.mismatch });
  bindFigure("fig-gdn-recompute", { "gdn-recompute-svg": kernelStories.gdn.recompute });
  bindFigure("fig-gdn-cached", { "gdn-cached-svg": kernelStories.gdn.cached });
  bindFigure("fig-moe-combine-tree", {
    "moe-combine-tree-svg": kernelStories.moeCombine.tree,
  });

  bindFigure("fig-glm-selector-exact", {
    "glm-selector-exact-svg": kernelStories.glmSelector.exact,
  });

  bindFigure("fig-dsv4-mhc-exact", {
    "dsv4-mhc-exact-svg": kernelStories.dsv4Mhc.exact,
  });
  bindFigure("fig-dsv4-attention-exact", {
    "dsv4-attention-exact-svg": kernelStories.dsv4Attention.exact,
  });
  bindFigure("fig-dsv4-experts-exact", {
    "dsv4-experts-exact-svg": kernelStories.dsv4Experts.exact,
  });
  bindFigure("fig-contract-map", {
    "contract-map-svg": sequence("contract-map-svg", { stepMs: 1700 }),
  });
  const contractStage = document.querySelector("#fig-contract-map .fig-stage");
  if (contractStage && window.matchMedia("(max-width: 760px)").matches) {
    window.requestAnimationFrame(() => {
      contractStage.scrollLeft = contractStage.scrollWidth - contractStage.clientWidth;
    });
  }
  bindFigure("fig-norm-tlsum", {
    "norm-svg-tlsum": sequence("norm-svg-tlsum", { stepMs: 620 }),
  });
}

function initFrontierChart() {
  const facts = window.K3_FACTS;
  const chart = document.getElementById("frontier-chart");
  const select = document.getElementById("frontier-cell");
  const summary = document.getElementById("frontier-summary");
  const tabs = [...document.querySelectorAll("[data-frontier-group]")];
  if (!facts || !Array.isArray(facts.frontier) || !chart || !(select instanceof HTMLSelectElement) || !summary) return;

  const colors = { stock: INK_FAINT, restricted: ORANGE, contract: TEAL_DARK };
  const labels = { stock: "Standard serving", restricted: "Previous exact", contract: "Current exact" };
  let group = "decode";

  const format = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;
  const groupRows = () => facts.frontier.filter((row) => row.group === group);

  const render = () => {
    const row = facts.frontier.find((candidate) => candidate.id === select.value) || groupRows()[0];
    if (!row) return;
    while (chart.firstChild) chart.removeChild(chart.firstChild);

    chart.appendChild(svgElement("title", { id: "frontier-chart-title" }, `${row.label} throughput`));
    chart.appendChild(svgElement("desc", { id: "frontier-chart-desc" }, `${row.label}: standard ${row.stock}, previous exact ${row.restricted}, current exact ${row.contract} tokens per second.`));
    chart.appendChild(svgElement("text", { x: 20, y: 28, fill: INK_FAINT, "font-size": 12 }, `${row.label.toUpperCase()} · ${row.context}`));

    const values = [row.stock, row.restricted, row.contract];
    const maximum = Math.max(...values) * 1.08;
    const plotX = 158;
    const plotWidth = 590;
    const arms = ["stock", "restricted", "contract"];
    for (let tick = 0; tick <= 4; tick += 1) {
      const x = plotX + (plotWidth * tick) / 4;
      chart.appendChild(svgElement("line", { x1: x, y1: 65, x2: x, y2: 332, stroke: LINE_FAINT, "stroke-width": 1 }));
      chart.appendChild(svgElement("text", { x, y: 360, "text-anchor": "middle" }, format((maximum * tick) / 4)));
    }

    arms.forEach((arm, index) => {
      const value = row[arm];
      const y = 86 + index * 91;
      const width = (value / maximum) * plotWidth;
      chart.appendChild(svgElement("text", { x: 138, y: y + 28, "text-anchor": "end", fill: INK_FAINT }, labels[arm]));
      chart.appendChild(svgElement("rect", { x: plotX, y, width: plotWidth, height: 43, fill: TRACK, rx: 2 }));
      chart.appendChild(svgElement("rect", { x: plotX, y, width, height: 43, fill: colors[arm], rx: 2, class: "chart-bar" }));
      chart.appendChild(svgElement("text", { x: Math.min(plotX + width + 12, 785), y: y + 28, fill: arm === "contract" ? TEAL_DARK : SOFT }, format(value)));
    });
    chart.appendChild(svgElement("text", { x: 748, y: 382, "text-anchor": "end", fill: INK_FAINT, "font-size": 9 }, "TOKENS / SECOND"));

    summary.replaceChildren();
    const metrics = [
      ["Current exact vs standard", row.contractVsStockPct],
      ["Current vs previous exact", row.contractVsRestrictedPct],
    ];
    metrics.forEach(([text, value]) => {
      const wrapper = document.createElement("span");
      const small = document.createElement("small");
      const strong = document.createElement("strong");
      small.textContent = text;
      strong.textContent = signed(value);
      strong.style.color = value >= 0 ? "var(--teal-dark)" : value > -6 ? "var(--teal-dark)" : "var(--orange-dark)";
      wrapper.append(small, strong);
      summary.appendChild(wrapper);
    });
  };

  const populate = (preferredId = "") => {
    const rows = groupRows();
    select.replaceChildren();
    rows.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.id;
      option.textContent = row.label;
      select.appendChild(option);
    });
    if (preferredId && rows.some((row) => row.id === preferredId)) select.value = preferredId;
    render();
  };

  const activateGroup = (tab, focus = false) => {
    group = tab.dataset.frontierGroup;
    tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    populate();
    if (focus) tab.focus();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateGroup(tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = tabs.indexOf(tab);
      let next = current;
      if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      activateGroup(tabs[next], true);
    });
  });
  select.addEventListener("change", render);
  populate("decode-bs1");
}

function initDeepLinks() {
  const align = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    window.requestAnimationFrame(() => {
      const top = target.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    });
  };

  window.addEventListener("hashchange", align);
  if (document.readyState === "complete") align();
  else window.addEventListener("load", align, { once: true });
}

function initMobileToc() {
  const contents = document.getElementById("mobile-toc");
  if (!contents) return;
  contents.querySelectorAll("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      contents.open = false;
    });
  });
}

function initTermDefinitions() {
  const terms = [...document.querySelectorAll(".term-definition[data-definition]")];
  if (!terms.length) return;

  const popover = document.createElement("div");
  popover.className = "term-popover";
  popover.id = "term-definition-popover";
  popover.setAttribute("role", "tooltip");
  popover.hidden = true;
  document.body.appendChild(popover);

  let active = null;
  let pinned = false;

  const position = (term) => {
    const rect = term.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - popoverRect.width - 16,
      Math.max(16, rect.left + rect.width / 2 - popoverRect.width / 2),
    );
    const fitsBelow = rect.bottom + 10 + popoverRect.height < window.innerHeight;
    const top = fitsBelow ? rect.bottom + 10 : Math.max(16, rect.top - popoverRect.height - 10);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  const open = (term, shouldPin = false) => {
    if (active && active !== term) active.setAttribute("aria-expanded", "false");
    active = term;
    pinned = shouldPin;
    popover.textContent = term.dataset.definition;
    popover.hidden = false;
    term.setAttribute("aria-expanded", "true");
    position(term);
  };

  const close = () => {
    if (active) active.setAttribute("aria-expanded", "false");
    active = null;
    pinned = false;
    popover.hidden = true;
  };

  terms.forEach((term) => {
    term.setAttribute("aria-describedby", popover.id);
    term.setAttribute("aria-expanded", "false");
    term.addEventListener("mouseenter", () => open(term));
    term.addEventListener("mouseleave", () => {
      if (!pinned && active === term && document.activeElement !== term) close();
    });
    term.addEventListener("focus", () => open(term));
    term.addEventListener("blur", () => {
      if (!pinned && active === term) close();
    });
    term.addEventListener("click", (event) => {
      event.stopPropagation();
      if (active === term && pinned) close();
      else open(term, true);
    });
    term.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        term.focus();
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (active && !popover.contains(event.target)) close();
  });
  window.addEventListener("scroll", () => {
    if (active) position(active);
  }, { passive: true });
  window.addEventListener("resize", close);
}

function initExternalLinks() {
  document.querySelectorAll("a[href]").forEach((link) => {
    const destination = new URL(link.href, window.location.href);
    const isWebLink = destination.protocol === "http:" || destination.protocol === "https:";
    if (!isWebLink || destination.origin === window.location.origin) return;

    link.target = "_blank";
    link.relList.add("noopener", "noreferrer");
  });
}

function initMath() {
  const expressions = [...document.querySelectorAll("[data-tex]")];
  if (!expressions.length) return;
  if (!window.katex) {
    document.documentElement.classList.add("math-unavailable");
    return;
  }

  expressions.forEach((expression) => {
    try {
      window.katex.render(expression.dataset.tex, expression, {
        displayMode: expression.classList.contains("math-display"),
        output: "htmlAndMathml",
        strict: "error",
        throwOnError: true,
        trust: false,
      });
      expression.dataset.mathRendered = "true";
    } catch (error) {
      expression.classList.add("math-render-error");
      console.error("Unable to render equation", error);
    }
  });
}

initMath();
initReadingProgress();
initRevealMotion();
initToc();
initFigures();
initAccessibleTabs();
initMobileToc();
initDeepLinks();
initTermDefinitions();
initExternalLinks();
