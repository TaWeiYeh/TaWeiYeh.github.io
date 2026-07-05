(function () {
  "use strict";

  var THEME_KEY = "theme";

  function initTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
    }
    var toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      var isLight = current
        ? current === "light"
        : window.matchMedia("(prefers-color-scheme: light)").matches;
      var next = isLight ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function initNav() {
    var nav = document.querySelector(".nav");
    if (!nav) return;
    var toggle = nav.querySelector(".nav-toggle");
    var links = nav.querySelectorAll(".nav-links a");

    window.addEventListener("scroll", function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 40);
    });

    if (toggle) {
      toggle.addEventListener("click", function () {
        nav.classList.toggle("is-open");
      });
    }

    links.forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
      });
    });

    var sections = Array.prototype.slice
      .call(links)
      .map(function (link) {
        var hash = link.getAttribute("href");
        return hash && hash.indexOf("#") === 0 ? document.querySelector(hash) : null;
      });

    if (sections.some(Boolean)) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var index = sections.indexOf(entry.target);
            if (index === -1) return;
            links.forEach(function (l) {
              l.classList.remove("active");
            });
            links[index].classList.add("active");
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      sections.forEach(function (section) {
        if (section) observer.observe(section);
      });
    }
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initTypewriter() {
    var el = document.querySelector("[data-typewriter]");
    if (!el) return;
    var words = (el.getAttribute("data-words") || "")
      .split(",")
      .map(function (w) {
        return w.trim();
      })
      .filter(Boolean);
    if (!words.length) return;

    var wordIndex = 0;
    var charIndex = 0;
    var deleting = false;
    var textNode = document.createElement("span");
    el.textContent = "";
    el.appendChild(textNode);
    var cursor = document.createElement("span");
    cursor.className = "cursor";
    el.appendChild(cursor);

    function tick() {
      var word = words[wordIndex];
      if (!deleting) {
        charIndex++;
        textNode.textContent = word.slice(0, charIndex);
        if (charIndex === word.length) {
          deleting = true;
          setTimeout(tick, 1400);
          return;
        }
      } else {
        charIndex--;
        textNode.textContent = word.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
        }
      }
      setTimeout(tick, deleting ? 45 : 90);
    }

    tick();
  }

  function initCountUp() {
    var items = document.querySelectorAll("[data-count]");
    if (!items.length) return;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          var target = parseInt(entry.target.getAttribute("data-count"), 10);
          if (isNaN(target)) return;
          var start = 0;
          var duration = 1200;
          var startTime = null;

          function step(timestamp) {
            if (startTime === null) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            entry.target.textContent = Math.floor(progress * (target - start) + start);
            if (progress < 1) requestAnimationFrame(step);
            else entry.target.textContent = target;
          }

          requestAnimationFrame(step);
        });
      },
      { threshold: 0.4 }
    );
    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initLightbox() {
    var lightbox = document.querySelector(".lightbox");
    if (!lightbox) return;
    var img = lightbox.querySelector("img");
    var closeBtn = lightbox.querySelector(".lightbox-close");

    document.querySelectorAll("[data-lightbox]").forEach(function (trigger) {
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        img.src = trigger.getAttribute("href") || trigger.getAttribute("data-lightbox");
        img.alt = trigger.getAttribute("data-caption") || "";
        lightbox.classList.add("is-open");
      });
    });

    function close() {
      lightbox.classList.remove("is-open");
      img.src = "";
    }

    closeBtn.addEventListener("click", close);
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
  }

  function initBackToTop() {
    var btn = document.querySelector(".back-to-top");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("is-visible", window.scrollY > 400);
    });
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initNav();
    initReveal();
    initTypewriter();
    initCountUp();
    initLightbox();
    initBackToTop();
  });
})();
