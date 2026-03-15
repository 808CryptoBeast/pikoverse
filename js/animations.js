document.addEventListener('DOMContentLoaded', () => {
  // Initialize animations
  initFadeAnimations();
  initHoverAnimations();
  initLoadingSpinners();
});

// Function to initialize fade animations
function initFadeAnimations() {
  // Add fade-in class to elements that should animate in
  const sections = document.querySelectorAll('section');
  
  sections.forEach(section => {
    // Add animation classes to section headings
    const heading = section.querySelector('h2');
    if (heading) {
      heading.classList.add('fade-in');
      heading.classList.add('scroll-reveal');
    }
    
    // Add animation classes to section content
    const contentElements = section.querySelectorAll('p:not(.fade-in), .amp-card, .meaning-card, .practice-card, .resource-card');
    contentElements.forEach((element, index) => {
      element.classList.add('fade-in');
      element.classList.add('scroll-reveal');
      element.style.transitionDelay = `${index * 0.1}s`;
    });
  });
  
  // Add slide-in animations to testimonials
  const testimonials = document.querySelectorAll('.testimonial');
  testimonials.forEach((testimonial, index) => {
    if (index % 2 === 0) {
      testimonial.classList.add('slide-in-left');
    } else {
      testimonial.classList.add('slide-in-right');
    }
    testimonial.classList.add('scroll-reveal');
  });
  
  // Initialize the reveal on scroll
  const revealElements = document.querySelectorAll('.scroll-reveal');
  
  function checkReveal() {
    const windowHeight = window.innerHeight;
    const revealPoint = 150;
    
    revealElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      
      if (elementTop < windowHeight - revealPoint) {
        element.classList.add('revealed');
      }
    });
  }
  
  // Check on load
  checkReveal();
  
  // Check on scroll
  window.addEventListener('scroll', checkReveal);
}

// Function to initialize hover animations
function initHoverAnimations() {
  // Add hover effects to cards
  const cards = document.querySelectorAll('.amp-card, .meaning-card, .practice-card, .resource-card');
  cards.forEach(card => {
    card.classList.add('hover-lift');
  });
  
  // Add hover effects to buttons
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    button.classList.add('hover-scale');
  });
}

// Function to initialize loading spinners
function initLoadingSpinners() {
  // Initialize all spinners on the page
  document.querySelectorAll('.loading-spinner').forEach(spinner => {
    const variant = spinner.getAttribute('data-variant') || 'tribal';
    const size = spinner.getAttribute('data-size') || 'md';
    
    spinner.classList.add(variant, size);
  });
  
  // Set up tribal spinner for form submission
  const submitBtnSpinner = document.querySelector('.submit-btn .spinner');
  if (submitBtnSpinner) {
    createTribalSpinner('md', submitBtnSpinner);
  }
  
  // Set up loading overlay spinner
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    const spinnerContainer = loadingOverlay.querySelector('.loading-spinner');
    if (spinnerContainer) {
      spinnerContainer.classList.add('tribal', 'lg');
    }
  }
}

// Function to create a tribal spinner
function createTribalSpinner(size = 'medium', container) {
  if (!container) return;
  
  const spinner = document.createElement('div');
  spinner.className = `tribal-spinner ${size}`;
  
  container.appendChild(spinner);
  
  return spinner;
}

// Export functions for use in other scripts
window.createTribalSpinner = createTribalSpinner;