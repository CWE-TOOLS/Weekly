/* ============================================================
   Project Portal — User Manual
   Builds the shared sidebar + prev/next nav on every page.
   Each page sets <body data-page="slug">. No build step required.
   ============================================================ */
(function () {
  // Ordered list of every page in the manual.
  // `num` (when present) mirrors the tab's position in the app's left sidebar.
  var PAGES = [
    { slug: "index",            file: "index.html",            title: "Overview & Navigation", group: "Start Here" },
    { slug: "project-list",     file: "project-list.html",     title: "The Project List",      group: "Start Here" },

    { slug: "project-info",     file: "project-info.html",     title: "Project Info",      group: "Project Tabs", num: 1 },
    { slug: "job-memos",        file: "job-memos.html",        title: "Job Memos",         group: "Project Tabs", num: 2 },
    { slug: "casting-inventory",file: "casting-inventory.html",title: "Casting Inventory", group: "Project Tabs", num: 3 },
    { slug: "tracking",         file: "tracking.html",         title: "Tracking",          group: "Project Tabs", num: 4 },
    { slug: "casting-layout",   file: "casting-layout.html",   title: "Casting Layout",    group: "Project Tabs", num: 5 },
    { slug: "shipping",         file: "shipping.html",         title: "Shipping",          group: "Project Tabs", num: 6 },
    { slug: "optimizer-hours",  file: "optimizer-hours.html",  title: "Optimizer Hours",   group: "Project Tabs", num: 7 },
    { slug: "staging",          file: "staging.html",          title: "Staging",           group: "Project Tabs", num: 8 },
    { slug: "color-log",        file: "color-log.html",        title: "Color Log",         group: "Project Tabs", num: 9 },
    { slug: "batch-tickets",    file: "batch-tickets.html",    title: "Batch Tickets",     group: "Project Tabs", num: 10 },
    { slug: "classroom-notes",  file: "classroom-notes.html",  title: "Classroom (CR) Notes", group: "Project Tabs", num: 11 },
    { slug: "actual-labor",     file: "actual-labor.html",     title: "Actual Labor",      group: "Project Tabs", num: 12 },

    { slug: "phases",           file: "phases.html",           title: "Phases",            group: "Reference" },
    { slug: "statuses",         file: "statuses.html",         title: "Statuses & Workflow", group: "Reference" },
    { slug: "printing",         file: "printing.html",         title: "Printing & Labels", group: "Reference" },
    { slug: "recent-memos",     file: "recent-memos.html",     title: "Recent Memos Feed", group: "Reference" }
  ];

  var GROUP_ORDER = ["Start Here", "Project Tabs", "Reference"];

  function current() {
    return (document.body && document.body.getAttribute("data-page")) || "index";
  }

  function buildSidebar() {
    var cur = current();
    var aside = document.createElement("aside");
    aside.className = "m-sidebar";

    var brand = document.createElement("div");
    brand.className = "m-brand";
    brand.innerHTML =
      '<a class="m-brand-logo" href="index.html">' +
        '<span class="mark">CWE</span>' +
        '<span>Project Portal</span>' +
      '</a>' +
      '<span class="m-brand-sub">User Manual</span>';
    aside.appendChild(brand);

    var nav = document.createElement("nav");
    nav.className = "m-nav";
    nav.setAttribute("aria-label", "Manual sections");

    GROUP_ORDER.forEach(function (group) {
      var inGroup = PAGES.filter(function (p) { return p.group === group; });
      if (!inGroup.length) return;
      var g = document.createElement("div");
      g.className = "m-nav-group";
      var t = document.createElement("div");
      t.className = "m-nav-group-title";
      t.textContent = group;
      g.appendChild(t);
      inGroup.forEach(function (p) {
        var a = document.createElement("a");
        a.href = p.file;
        if (p.slug === cur) a.className = "active";
        var label = "";
        if (p.num) label += '<span class="num">' + p.num + "</span>";
        label += "<span>" + p.title + "</span>";
        a.innerHTML = label;
        g.appendChild(a);
      });
      nav.appendChild(g);
    });

    aside.appendChild(nav);
    return aside;
  }

  function buildPageNav() {
    var cur = current();
    var idx = -1;
    for (var i = 0; i < PAGES.length; i++) { if (PAGES[i].slug === cur) { idx = i; break; } }
    if (idx === -1) return null;

    var wrap = document.createElement("nav");
    wrap.className = "m-pagenav";
    wrap.setAttribute("aria-label", "Page navigation");

    var prev = PAGES[idx - 1];
    var next = PAGES[idx + 1];

    var prevEl = document.createElement("a");
    prevEl.className = "prev" + (prev ? "" : " disabled");
    if (prev) {
      prevEl.href = prev.file;
      prevEl.innerHTML = '<div class="dir">&larr; Previous</div><div class="ttl">' + prev.title + "</div>";
    }
    wrap.appendChild(prevEl);

    var nextEl = document.createElement("a");
    nextEl.className = "next" + (next ? "" : " disabled");
    if (next) {
      nextEl.href = next.file;
      nextEl.innerHTML = '<div class="dir">Next &rarr;</div><div class="ttl">' + next.title + "</div>";
    }
    wrap.appendChild(nextEl);

    return wrap;
  }

  function init() {
    var shell = document.querySelector(".m-shell");
    if (!shell) return;
    // Inject sidebar as the first child.
    shell.insertBefore(buildSidebar(), shell.firstChild);
    // Append prev/next nav inside the content area.
    var content = document.querySelector(".m-content");
    if (content) {
      var pn = buildPageNav();
      if (pn) content.appendChild(pn);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
