document.addEventListener('DOMContentLoaded', () => {
  // Initialize all systems
  initCelestialSystem();
  initDynamicSidebar();
  initCourseInteractions();
  initSearch();
  initCategoryFilters();
  initPathwayNavigation();
  initKumulipoModal();
});

// ======================
// DYNAMIC SIDEBAR
// ======================

function initDynamicSidebar() {
  const sidebar = document.getElementById('amp-nav');
  const mainContent = document.getElementById('ikeverse-main');
  const toggleBtn = document.querySelector('.sidebar-toggle');
  
  // Check if sidebar should be collapsed by default (mobile view)
  let isCollapsed = window.innerWidth < 992;
  
  // Set initial state
  updateSidebarState();
  
  // Toggle sidebar when clicking the Tiki image
  toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isCollapsed = !isCollapsed;
      updateSidebarState();
      localStorage.setItem('sidebarCollapsed', isCollapsed);
  });
  
  function updateSidebarState() {
      if (isCollapsed) {
          sidebar.classList.add('collapsed');
          mainContent.classList.add('collapsed');
      } else {
          sidebar.classList.remove('collapsed');
          mainContent.classList.remove('collapsed');
      }
  }
  
  // Check for saved preference
  const savedState = localStorage.getItem('sidebarCollapsed');
  if (savedState !== null) {
      isCollapsed = savedState === 'true';
      updateSidebarState();
  }
  
  // Make responsive
  window.addEventListener('resize', () => {
      if (window.innerWidth < 992) {
          if (!isCollapsed) {
              isCollapsed = true;
              updateSidebarState();
          }
      } else {
          if (isCollapsed && savedState === 'false') {
              isCollapsed = false;
              updateSidebarState();
          }
      }
  });
}

// ======================
// CELESTIAL SYSTEM
// ======================

function initCelestialSystem() {
  createStarfield(300);
  initParallaxEffects();
  animateMoonPhase();
}

function createStarfield(count) {
  const container = document.getElementById('star-field');
  if (!container) return;
  
  for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.width = star.style.height = `${Math.random() * 3}px`;
      star.style.opacity = Math.random();
      star.style.animationDuration = `${Math.random() * 3 + 2}s`;
      container.appendChild(star);
  }
}

function initParallaxEffects() {
  window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      
      const moon = document.querySelector('.moon-phase-wrapper');
      if (moon) moon.style.transform = `translate(${x}px, ${y}px)`;
  });
}

function animateMoonPhase() {
  const moonSurface = document.querySelector('.moon-surface');
  if (!moonSurface) return;
  
  for (let i = 0; i < 15; i++) {
      const crater = document.createElement('div');
      crater.className = 'moon-crater';
      crater.style.width = `${Math.random() * 15 + 5}px`;
      crater.style.height = crater.style.width;
      crater.style.left = `${Math.random() * 80 + 10}%`;
      crater.style.top = `${Math.random() * 80 + 10}%`;
      moonSurface.appendChild(crater);
  }
}

// ======================
// COURSE INTERACTIONS
// ======================

function initCourseInteractions() {
  const courseCards = document.querySelectorAll('.module-card, .pathway-card');
  
  courseCards.forEach(card => {
      card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-8px)';
          card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3)';
      });
      
      card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.boxShadow = '';
      });
  });
}

// ======================
// SEARCH FUNCTIONALITY
// ======================

function initSearch() {
  const searchInput = document.getElementById('ike-search');
  const searchIcon = document.querySelector('.search-icon');
  
  if (!searchInput || !searchIcon) return;
  
  searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase();
      document.querySelectorAll('.pathway-card').forEach(card => {
          const title = card.querySelector('h3').textContent.toLowerCase();
          card.style.display = title.includes(term) ? 'flex' : 'none';
      });
  });
  
  searchIcon.addEventListener('click', () => {
      searchInput.focus();
  });
}

// ======================
// CATEGORY FILTERS
// ======================

function initCategoryFilters() {
  const filterButtons = document.querySelectorAll('.tribal-filter');
  
  filterButtons.forEach(button => {
      button.addEventListener('click', () => {
          filterButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          const category = button.textContent.trim();
          filterPathways(category);
      });
  });
}

function filterPathways(category) {
  document.querySelectorAll('.pathway-card').forEach(card => {
      card.style.display = (category === 'All Pathways' || 
          card.dataset.pathway === category.toLowerCase()) ? 'flex' : 'none';
  });
}

// ======================
// PATHWAY NAVIGATION
// ======================

function initPathwayNavigation() {
  window.viewPathway = (pathwayId) => {
      console.log(`Loading pathway: ${pathwayId}`);
      // In production, load pathway content here
      openKumulipoModal();
  };
}

// ======================
// KUMULIPO MODAL SYSTEM
// ======================

function initKumulipoModal() {
  const quizOptions = document.querySelectorAll('.quiz-option');
  
  quizOptions.forEach(option => {
      option.addEventListener('click', (e) => {
          const isCorrect = e.target.textContent.includes('Source of darkness');
          checkQuizAnswer(e.target, isCorrect);
      });
  });
  
  window.openKumulipoModal = () => {
      const modal = document.getElementById('kumulipo-modal');
      if (!modal) return;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
  };
  
  window.closeKumulipoModal = () => {
      const modal = document.getElementById('kumulipo-modal');
      if (!modal) return;
      modal.classList.remove('active');
      document.body.style.overflow = '';
  };
  
  window.navigateModule = (direction) => {
      console.log(`Module navigation: ${direction > 0 ? 'Next' : 'Previous'}`);
  };
}

function checkQuizAnswer(button, isCorrect) {
  const feedback = button.closest('.kumulipo-quiz').querySelector('.quiz-feedback');
  feedback.style.display = 'block';
  feedback.style.background = isCorrect ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)';
  document.querySelectorAll('.quiz-option').forEach(opt => {
      opt.style.pointerEvents = 'none';
  });
}