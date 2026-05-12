'use strict';

document.addEventListener('DOMContentLoaded', function() {
  initAmplifySection();
  initScrollReveal();
  initActiveNav();
});

function initAmplifySection() {
  var words = document.querySelectorAll('.amplify-word');
  if (!words.length) return;

  var currentIndex = 0;
  words[currentIndex].classList.add('active');

  setInterval(function() {
    words[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % words.length;
    words[currentIndex].classList.add('active');
  }, 3000);
}

function initScrollReveal() {
  var elements = document.querySelectorAll('.scroll-reveal');
  if (!elements.length) return;

  function checkVisibility() {
    var windowHeight = window.innerHeight;
    elements.forEach(function(element) {
      var elementTop = element.getBoundingClientRect().top;
      if (elementTop < windowHeight - 150) {
        element.classList.add('revealed');
      }
    });
  }

  checkVisibility();
  window.addEventListener('scroll', checkVisibility, { passive: true });
}

function initActiveNav() {
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.main-nav a[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  function syncActiveNav() {
    var scrollY = window.scrollY;
    var activeId = '';

    sections.forEach(function(section) {
      var top = section.offsetTop - 180;
      var bottom = top + section.offsetHeight;
      if (scrollY >= top && scrollY < bottom) {
        activeId = section.id;
      }
    });

    navLinks.forEach(function(link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + activeId);
    });
  }

  syncActiveNav();
  window.addEventListener('scroll', syncActiveNav, { passive: true });
}
