(() => {
  const payload = window.SATOSHI_TIMELINE_DATA || { events: [] };
  const allEvents = payload.events.map((event) => ({ ...event, dateObj: new Date(event.date) }));
  const colors = {
    "Email": "Email",
    "bitcoin.org/smf Forums": "Forum",
    "Whitepaper": "Whitepaper",
    "Cryptography Mailing List": "Cryptography",
    "SourceForge / Bitcoin list": "SourceForge",
    "P2P Foundation": "P2P",
    "Other": "Other"
  };

  const TIMELINE_START = new Date(2008, 0, 1).getTime();
  const TIMELINE_END = new Date(2014, 11, 31, 23, 59, 59).getTime();
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 10000;
  const BASE_TIMELINE_WIDTH = 1800;

  const state = {
    query: "",
    categories: new Set(),
    maxYear: 2014,
    zoomScale: 1,
    focusId: null,
    lastFiltered: []
  };

  const $ = (sel) => document.querySelector(sel);
  const list = $("#timelineList");
  const resultCount = $("#resultCount");
  const dialog = $("#quoteDialog");
  const dialogBody = $("#dialogBody");
  const axis = $("#axis");
  const zoomLabel = $("#zoomLabel");

  function categoryCounts(events) {
    return events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {});
  }

  function renderStats() {
    const counts = categoryCounts(allEvents);
    const first = allEvents[0]?.short_date || "";
    const last = allEvents[allEvents.length - 1]?.short_date || "";
    const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
    $("#stats").innerHTML = [
      [allEvents.length.toLocaleString(), "timeline entries"],
      [`${first} → ${last}`, "date range"],
      [Object.keys(counts).length, "source groups"],
      [top ? `${top[1]} ${top[0]}` : "", "largest group"]
    ].map(([value,label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("");
  }

  function renderFilters() {
    const counts = categoryCounts(allEvents);
    const filters = $("#filters");
    filters.innerHTML = Object.keys(counts).sort().map((cat) => {
      return `<button class="chip" type="button" data-category="${escapeAttr(cat)}" aria-pressed="false">${escapeHtml(cat)} · ${counts[cat]}</button>`;
    }).join("");
    filters.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-category]");
      if (!btn) return;
      const cat = btn.dataset.category;
      if (state.categories.has(cat)) state.categories.delete(cat); else state.categories.add(cat);
      btn.setAttribute("aria-pressed", state.categories.has(cat) ? "true" : "false");
      state.focusId = null;
      render();
    });
  }

  function filterEvents() {
    const q = state.query.toLowerCase().trim();
    return allEvents.filter((event) => {
      if (event.year > state.maxYear) return false;
      if (state.categories.size && !state.categories.has(event.category)) return false;
      if (!q) return true;
      return [event.title, event.source, event.category, event.excerpt, event.quote, event.short_date, event.date_display].join(" ").toLowerCase().includes(q);
    });
  }

  function timelineWidth() {
    return Math.max(BASE_TIMELINE_WIDTH, Math.round(BASE_TIMELINE_WIDTH * state.zoomScale), axis.clientWidth || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function xForTime(time, width) {
    return 50 + ((time - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * (width - 100);
  }

  function timeForX(x, width) {
    const progress = clamp((x - 50) / Math.max(1, width - 100), 0, 1);
    return TIMELINE_START + progress * (TIMELINE_END - TIMELINE_START);
  }

  function tickSpec() {
    const z = state.zoomScale;
    if (z < 2) return { unit: "year", step: 1, detail: "year" };
    if (z < 6) return { unit: "month", step: 6, detail: "month" };
    if (z < 16) return { unit: "month", step: 3, detail: "month" };
    if (z < 40) return { unit: "month", step: 1, detail: "month" };
    if (z < 120) return { unit: "day", step: 7, detail: "week" };
    if (z < 350) return { unit: "day", step: 1, detail: "day" };
    if (z < 700) return { unit: "hour", step: 12, detail: "hour" };
    if (z < 1500) return { unit: "hour", step: 6, detail: "hour" };
    if (z < 3000) return { unit: "hour", step: 1, detail: "hour" };
    if (z < 6500) return { unit: "minute", step: 15, detail: "minute" };
    return { unit: "minute", step: 5, detail: "minute" };
  }

  function visibleTimeWindow(width) {
    // At high zoom levels, rendering only the visible tick labels keeps the
    // static page quick even at 10000× zoom. A small buffer avoids blank edges
    // while the user scrolls horizontally.
    const buffer = Math.max(axis.clientWidth || 0, 800);
    const left = clamp(axis.scrollLeft - buffer, 0, width);
    const right = clamp(axis.scrollLeft + (axis.clientWidth || 0) + buffer, 0, width);
    return [timeForX(left, width), timeForX(right, width)];
  }

  function tickDates(width) {
    const dates = [];
    const spec = tickSpec();
    const highDetail = state.zoomScale >= 90;
    const [startTime, endTime] = highDetail ? visibleTimeWindow(width) : [TIMELINE_START, TIMELINE_END];
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (spec.unit === "year") {
      for (let year = 2008; year <= 2014; year += spec.step) dates.push(new Date(year, 0, 1));
    } else if (spec.unit === "month") {
      let d = new Date(start.getFullYear(), Math.floor(start.getMonth() / spec.step) * spec.step, 1);
      d.setMonth(d.getMonth() - spec.step);
      while (d <= end) {
        if (d.getTime() >= TIMELINE_START && d.getTime() <= TIMELINE_END) dates.push(new Date(d));
        d.setMonth(d.getMonth() + spec.step);
      }
    } else if (spec.unit === "day") {
      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      d.setDate(d.getDate() - spec.step);
      while (d <= end) {
        if (d.getTime() >= TIMELINE_START && d.getTime() <= TIMELINE_END) dates.push(new Date(d));
        d.setDate(d.getDate() + spec.step);
      }
    } else if (spec.unit === "hour") {
      let d = new Date(start);
      d.setMinutes(0, 0, 0);
      d.setHours(Math.floor(d.getHours() / spec.step) * spec.step - spec.step);
      while (d <= end) {
        if (d.getTime() >= TIMELINE_START && d.getTime() <= TIMELINE_END) dates.push(new Date(d));
        d.setHours(d.getHours() + spec.step);
      }
    } else {
      let d = new Date(start);
      d.setSeconds(0, 0);
      d.setMinutes(Math.floor(d.getMinutes() / spec.step) * spec.step - spec.step);
      while (d <= end) {
        if (d.getTime() >= TIMELINE_START && d.getTime() <= TIMELINE_END) dates.push(new Date(d));
        d.setMinutes(d.getMinutes() + spec.step);
      }
    }
    return dates;
  }

  function tickLabel(date) {
    const spec = tickSpec();
    if (spec.detail === "year") return String(date.getFullYear());
    if (spec.detail === "month") {
      if (date.getMonth() === 0) return String(date.getFullYear());
      return date.toLocaleDateString(undefined, { month: "short" });
    }
    if (spec.detail === "week") return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (spec.detail === "day") return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (spec.detail === "minute" && date.getHours() === 0 && date.getMinutes() === 0) {
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " 00:00";
    }
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function tickClass(date) {
    const spec = tickSpec();
    const major = date.getMonth() === 0 && date.getDate() === 1 && date.getHours() === 0 && date.getMinutes() === 0;
    return `year-tick ${major ? "year-tick--major" : ""} year-tick--${spec.detail}`.trim();
  }

  function formatEventDateTime(event) {
    if (event.date_display && event.date_display.length < 95) return event.date_display;
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short"
      }).format(event.dateObj);
    } catch {
      return event.short_date || event.date;
    }
  }

  function nearestEventId(events, targetTime) {
    if (!events.length) return null;
    let best = events[0];
    let bestDistance = Math.abs(events[0].dateObj.getTime() - targetTime);
    for (const event of events) {
      const distance = Math.abs(event.dateObj.getTime() - targetTime);
      if (distance < bestDistance) {
        best = event;
        bestDistance = distance;
      }
    }
    return best.id;
  }

  function focusCluster(events, focusEvent) {
    if (!focusEvent) return new Map();
    const focusTime = focusEvent.dateObj.getTime();
    return new Map(
      events
        .map((event) => ({ event, distance: Math.abs(event.dateObj.getTime() - focusTime) }))
        .sort((a,b) => a.distance - b.distance)
        .slice(0, state.zoomScale >= 3000 ? 64 : state.zoomScale >= 1000 ? 44 : state.zoomScale >= 180 ? 28 : state.zoomScale >= 10 ? 12 : 5)
        .map((item, index) => [item.event.id, index])
    );
  }

  function renderTimelineGraphic(events) {
    const width = timelineWidth();
    const lane = {"Whitepaper": 92, "Email": 156, "Cryptography Mailing List": 220, "SourceForge / Bitcoin list": 284, "P2P Foundation": 348, "bitcoin.org/smf Forums": 432, "Other": 512};
    const focusEvent = events.find((event) => event.id === state.focusId) || null;
    const cluster = focusCluster(events, focusEvent);

    const ticks = tickDates(width).map((date) => {
      const left = xForTime(date.getTime(), width);
      return `<div class="${tickClass(date)}" style="left:${left}px">${escapeHtml(tickLabel(date))}</div>`;
    }).join("");

    const labelCutoff = state.zoomScale >= 6;
    const dots = events.map((event) => {
      const cls = colors[event.category] || "Other";
      const focused = event.id === state.focusId;
      const clusterIndex = cluster.has(event.id) ? cluster.get(event.id) : null;
      const clusterClass = clusterIndex === 0 ? " dot--focus" : clusterIndex !== null ? ` dot--near dot--near-${Math.min(clusterIndex, 4)}` : "";
      const left = xForTime(event.dateObj.getTime(), width);
      const top = lane[event.category] || 300;
      const visibleLeft = axis.scrollLeft - 180;
      const visibleRight = axis.scrollLeft + (axis.clientWidth || 0) + 180;
      const isVisibleAtDeepZoom = state.zoomScale >= 180 && left >= visibleLeft && left <= visibleRight;
      const showLabel = labelCutoff && (clusterIndex !== null || isVisibleAtDeepZoom);
      const dateLabel = state.zoomScale >= 350 ? formatEventDateTime(event) : event.short_date;
      const label = showLabel
        ? `<span class="dot-label ${focused ? "dot-label--focus" : ""}" style="--label-y:${top < 360 ? 24 : -62}px"><b>${escapeHtml(dateLabel)}</b><small>${escapeHtml(event.title).slice(0, 96)}</small></span>`
        : "";
      return `<button class="dot ${cls}${clusterClass}" title="${escapeAttr(event.short_date + ' — ' + event.title)}" data-id="${escapeAttr(event.id)}" style="left:${left}px;top:${top}px" aria-label="Open ${escapeAttr(event.title)}">${label}</button>`;
    }).join("");

    let focusCard = "";
    if (focusEvent) {
      const focusLeft = xForTime(focusEvent.dateObj.getTime(), width);
      focusCard = `<button class="zoom-focus-card" data-id="${escapeAttr(focusEvent.id)}" style="left:${focusLeft}px" type="button" aria-label="Open focused timeline entry">
        <span class="zoom-focus-card__date">${escapeHtml(formatEventDateTime(focusEvent))}</span>
        <strong>${escapeHtml(focusEvent.title)}</strong>
        <span>${escapeHtml(focusEvent.category)} · ${escapeHtml(focusEvent.source || `PDF page ${focusEvent.page}`)}</span>
      </button>`;
    }

    const laneGuides = Object.entries(lane).map(([label, top]) => `<div class="lane-guide" style="top:${top}px"><span>${escapeHtml(label)}</span></div>`).join("");
    axis.innerHTML = `<div class="axis-inner" style="width:${width}px"><div class="axis-line"></div>${laneGuides}${ticks}${dots}${focusCard}</div>`;
    zoomLabel.textContent = `${state.zoomScale.toFixed(state.zoomScale >= 10 ? 0 : 1)}×`;
  }

  function renderCards(events) {
    let currentYear = null;
    const html = events.map((event) => {
      const divider = event.year !== currentYear ? (currentYear = event.year, `<li class="year-divider">${event.year}</li>`) : "";
      return divider + `<li class="card" data-id="${escapeAttr(event.id)}" data-category="${escapeAttr(event.category)}" tabindex="0">
        <div class="card-meta"><span>${escapeHtml(event.short_date)}</span><span class="badge">${escapeHtml(event.category)}</span><span>page ${event.page}</span></div>
        <h3>${escapeHtml(event.title)}</h3>
        <blockquote>${escapeHtml(event.excerpt || "[No extractable preview]")}</blockquote>
      </li>`;
    }).join("");
    list.innerHTML = html || `<li class="card"><h3>No matching events</h3><blockquote>Try clearing the search field, increasing the year range, or removing source filters.</blockquote></li>`;
  }

  function render() {
    const events = filterEvents();
    state.lastFiltered = events;
    if (state.focusId && !events.some((event) => event.id === state.focusId)) state.focusId = null;
    resultCount.textContent = `${events.length.toLocaleString()} of ${allEvents.length.toLocaleString()} entries shown`;
    renderTimelineGraphic(events);
    renderCards(events);
  }

  function zoomTimeline(multiplier, anchorX = axis.clientWidth / 2) {
    const events = state.lastFiltered.length ? state.lastFiltered : filterEvents();
    const oldWidth = timelineWidth();
    const anchorTime = timeForX(axis.scrollLeft + anchorX, oldWidth);
    const nextScale = clamp(state.zoomScale * multiplier, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextScale - state.zoomScale) < 0.001) return;
    state.zoomScale = nextScale;
    state.focusId = nearestEventId(events, anchorTime);
    renderTimelineGraphic(events);
    const newWidth = timelineWidth();
    const nextScrollLeft = clamp(xForTime(anchorTime, newWidth) - anchorX, 0, newWidth - axis.clientWidth);
    axis.scrollLeft = nextScrollLeft;
    if (state.zoomScale >= 90) {
      // Refresh visible day/hour tick marks after the scroll anchor is restored.
      renderTimelineGraphic(events);
      axis.scrollLeft = nextScrollLeft;
    }
  }

  function openEvent(id) {
    const event = allEvents.find((item) => item.id === id);
    if (!event) return;
    dialogBody.innerHTML = `<article class="dialog-content">
      <p class="eyebrow">Entry ${event.seq}</p>
      <h2>${escapeHtml(event.title)}</h2>
      <div class="dialog-meta"><span>${escapeHtml(event.short_date)}</span><span>${escapeHtml(event.category)}</span><span>${escapeHtml(event.source)}</span><span>PDF page ${event.page}</span></div>
      <div class="quote-full">${escapeHtml(event.quote)}</div>
      <div class="dialog-actions">
        <button class="dialog-copy" type="button" data-copy="quote">Copy quote</button>
        ${event.url ? `<a class="dialog-copy" href="${escapeAttr(event.url)}" target="_blank" rel="noopener">Open linked source</a>` : ""}
      </div>
    </article>`;
    dialog.showModal();
  }

  function escapeHtml(str="") {
    return String(str).replace(/[&<>"]/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));
  }
  function escapeAttr(str="") { return escapeHtml(str).replace(/'/g, "&#39;"); }

  document.addEventListener("click", (event) => {
    const card = event.target.closest(".card[data-id]");
    if (card) openEvent(card.dataset.id);
    const dot = event.target.closest(".dot[data-id], .zoom-focus-card[data-id]");
    if (dot) openEvent(dot.dataset.id);
    const copy = event.target.closest("[data-copy='quote']");
    if (copy) {
      const text = dialog.querySelector(".quote-full")?.textContent || "";
      navigator.clipboard?.writeText(text);
      copy.textContent = "Copied";
      setTimeout(() => copy.textContent = "Copy quote", 1100);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const card = event.target.closest(".card[data-id]");
      if (card) openEvent(card.dataset.id);
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "0") {
      event.preventDefault();
      state.zoomScale = 1;
      state.focusId = null;
      renderTimelineGraphic(state.lastFiltered.length ? state.lastFiltered : filterEvents());
      axis.scrollLeft = 0;
    }
  });

  axis.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = axis.getBoundingClientRect();
    const pointerX = clamp(event.clientX - rect.left, 0, rect.width);
    const multiplier = Math.exp(-event.deltaY * 0.0042);
    zoomTimeline(multiplier, pointerX);
  }, { passive: false });

  axis.addEventListener("mousemove", (event) => {
    if (state.zoomScale < 4 || event.buttons) return;
    const rect = axis.getBoundingClientRect();
    const pointerX = clamp(event.clientX - rect.left, 0, rect.width);
    const pointerTime = timeForX(axis.scrollLeft + pointerX, timelineWidth());
    const nextFocus = nearestEventId(state.lastFiltered, pointerTime);
    if (nextFocus && nextFocus !== state.focusId) {
      state.focusId = nextFocus;
      renderTimelineGraphic(state.lastFiltered);
      axis.scrollLeft = clamp(xForTime(pointerTime, timelineWidth()) - pointerX, 0, timelineWidth() - axis.clientWidth);
    }
  });

  let scrollRaf = null;
  axis.addEventListener("scroll", () => {
    if (state.zoomScale < 90) return;
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      const currentScroll = axis.scrollLeft;
      renderTimelineGraphic(state.lastFiltered.length ? state.lastFiltered : filterEvents());
      axis.scrollLeft = currentScroll;
    });
  });

  $("#search").addEventListener("input", (event) => { state.query = event.target.value; state.focusId = null; render(); });
  $("#yearRange").addEventListener("input", (event) => { state.maxYear = Number(event.target.value); $("#yearLabel").textContent = state.maxYear; state.focusId = null; render(); });
  $("#zoomIn").addEventListener("click", () => zoomTimeline(3));
  $("#zoomOut").addEventListener("click", () => zoomTimeline(1 / 3));
  $("#resetView").addEventListener("click", () => {
    state.query = ""; state.categories.clear(); state.maxYear = 2014; state.zoomScale = 1; state.focusId = null;
    $("#search").value = ""; $("#yearRange").value = "2014"; $("#yearLabel").textContent = "2014";
    document.querySelectorAll(".chip").forEach(chip => chip.setAttribute("aria-pressed", "false"));
    axis.scrollLeft = 0;
    render();
  });
  $("#exportJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "satoshi-timeline-data.json"; a.click();
    URL.revokeObjectURL(url);
  });

  renderStats(); renderFilters(); $("#yearLabel").textContent = state.maxYear; render();
})();
