// Force unregister any service workers immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function() {
        // After unregistering, forcefully reload without cache
        window.location.reload(true);
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Clear any caches that might be causing loading issues
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      cacheNames.forEach(function(cacheName) {
        caches.delete(cacheName);
      });
    });
  }
  
  // Initialize page functionality
  initNavigation();
  initAmplifySection();
  initScrollReveal();
  initAccordion();
  initForms();
});

// Initialize navigation functionality
function initNavigation() {
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  // Mobile menu toggle
  if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('show');
      mobileMenuToggle.classList.toggle('active');
    });
  }
  
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Close mobile menu if open
      if (mainNav.classList.contains('show')) {
        mainNav.classList.remove('show');
        mobileMenuToggle.classList.remove('active');
      }
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80, // Account for fixed header
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Highlight active navigation item based on scroll position
  const sections = document.querySelectorAll('section[id]');
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const headerHeight = 80;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop - headerHeight - 100;
      const sectionBottom = sectionTop + section.offsetHeight;
      const sectionId = section.getAttribute('id');
      const navLink = document.querySelector(`.main-nav a[href="#${sectionId}"]`);
      
      if (scrollY >= sectionTop && scrollY < sectionBottom && navLink) {
        document.querySelectorAll('.main-nav a').forEach(link => {
          link.classList.remove('active');
        });
        navLink.classList.add('active');
      }
    });
  });
}

// Initialize the amplify animation in the AMP intro section
function initAmplifySection() {
  const words = document.querySelectorAll('.amplify-word');
  if (words.length === 0) return;
  
  let currentIndex = 0;
  
  // Initial state
  words[currentIndex].classList.add('active');
  
  // Set interval to rotate through words
  setInterval(() => {
    words[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % words.length;
    words[currentIndex].classList.add('active');
  }, 3000);
}

// Initialize scroll reveal animations
function initScrollReveal() {
  const elements = document.querySelectorAll('.scroll-reveal');
  
  const checkVisibility = () => {
    const windowHeight = window.innerHeight;
    
    elements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top;
      const elementVisible = 150;
      
      if (elementTop < windowHeight - elementVisible) {
        element.classList.add('revealed');
      }
    });
  };
  
  // Check on load
  checkVisibility();
  
  // Check on scroll
  window.addEventListener('scroll', checkVisibility);
}

// Initialize accordion functionality
function initAccordion() {
  const accordionButtons = document.querySelectorAll('.accordion-button');
  
  accordionButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Toggle active class on button
      button.classList.toggle('active');
      
      // Toggle show class on content
      const content = button.nextElementSibling;
      if (content.classList.contains('show')) {
        content.classList.remove('show');
      } else {
        content.classList.add('show');
      }
    });
  });
}

// Initialize form handling
function initForms() {
  const joinForm = document.getElementById('join-form');
  
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Show loading spinner
      const submitBtn = joinForm.querySelector('.submit-btn');
      const btnText = submitBtn.querySelector('.btn-text');
      const spinner = submitBtn.querySelector('.spinner');
      
      btnText.style.opacity = '0';
      spinner.classList.remove('hidden');
      
      // Collect form data
      const formData = {
        name: joinForm.name.value,
        email: joinForm.email.value,
        location: joinForm.location.value,
        why: joinForm.why.value,
        newsletter: joinForm.newsletter ? joinForm.newsletter.checked : false
      };
      
      console.log('Community Member Data:', formData);
      
      try {
        // Submit form data to API
        const response = await fetch('/api/join-community', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Success message
          showNotification('Success! You have joined our community.', 'success');
          joinForm.reset();
        } else {
          // Error message
          showNotification(`Error: ${data.message || 'Something went wrong'}`, 'error');
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        showNotification('Error submitting form. Please try again.', 'error');
      } finally {
        // Hide loading spinner
        btnText.style.opacity = '1';
        spinner.classList.add('hidden');
      }
    });
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Check if notification container exists, if not, create it
  let notificationContainer = document.querySelector('.notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'notification-close';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    notification.remove();
  });
  
  notification.appendChild(closeButton);
  notificationContainer.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Helper function to animate elements when they come into view
function animateOnScroll() {
  const elements = document.querySelectorAll('.fade-in, .scale-in, .slide-in-left, .slide-in-right');
  
  const isInViewport = (element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
      rect.bottom >= 0
    );
  };
  
  const handleScroll = () => {
    elements.forEach(element => {
      if (isInViewport(element)) {
        element.classList.add('visible');
      }
    });
  };
  
  // Check on load
  handleScroll();
  
  // Check on scroll
  window.addEventListener('scroll', handleScroll);
}

// Testimonials slider navigation
function initTestimonialsSlider() {
  const slider = document.querySelector('.testimonials-slider');
  if (!slider) return;
  
  const testimonials = slider.querySelectorAll('.testimonial');
  if (testimonials.length <= 1) return;
  
  // Create navigation dots
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'slider-dots';
  
  testimonials.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.className = 'slider-dot';
    if (index === 0) dot.classList.add('active');
    
    dot.addEventListener('click', () => {
      // Calculate scroll position
      const scrollPosition = index * testimonials[0].offsetWidth;
      slider.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
      
      // Update active dot
      document.querySelectorAll('.slider-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
    
    dotsContainer.appendChild(dot);
  });
  
  // Append dots container after slider
  slider.parentNode.insertBefore(dotsContainer, slider.nextSibling);
  
  // Update dots on scroll
  slider.addEventListener('scroll', () => {
    const scrollPosition = slider.scrollLeft;
    const testimonialWidth = testimonials[0].offsetWidth;
    const activeIndex = Math.round(scrollPosition / testimonialWidth);
    
    document.querySelectorAll('.slider-dot').forEach((dot, index) => {
      if (index === activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  });
}

// Initialize everything when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  animateOnScroll();
  initTestimonialsSlider();
});

// Interactive Roadmap JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Create overlay for popouts
    const overlay = document.createElement('div');
    overlay.className = 'popout-overlay';
    document.body.appendChild(overlay);

    // Phase data with detailed information
    const phaseData = {
        foundation: {
            title: 'Building the Foundation',
            status: 'In Progress - 80% Complete',
            progress: 80,
            icon: '🏗️',
            details: {
                overview: 'Establishing the core infrastructure and technical foundation for the IkeVerse platform.',
                keyFeatures: [
                    'Blockchain Integration & Smart Contracts',
                    'Decentralized Storage Architecture',
                    'Core Platform Development',
                    'Security Framework Implementation',
                    'Initial Community Tools'
                ],
                currentWork: [
                    'Finalizing smart contract audits',
                    'Optimizing storage protocols',
                    'Beta testing core features',
                    'Community feedback integration'
                ],
                timeline: 'Q1 2025 - Nearly Complete'
            }
        },
        preservation: {
            title: 'Cultural Preservation Tools',
            status: 'Planned',
            progress: 0,
            icon: '🏛️',
            details: {
                overview: 'Advanced tools for digitizing, storing, and preserving cultural artifacts and knowledge.',
                keyFeatures: [
                    'AI-Powered Artifact Analysis',
                    'Immutable Cultural Records',
                    'Multi-format Digital Preservation',
                    'Community Verification Systems',
                    'Cultural Metadata Standards'
                ],
                plannedWork: [
                    'Research partnerships with museums',
                    'Develop AI analysis algorithms',
                    'Create preservation workflows',
                    'Build community verification tools'
                ],
                timeline: 'Q2-Q3 2025'
            }
        },
        learning: {
            title: 'Learning Ecosystem',
            status: 'Planned',
            progress: 0,
            icon: '📚',
            details: {
                overview: 'Comprehensive educational platform connecting traditional knowledge with modern learning.',
                keyFeatures: [
                    'Interactive Cultural Lessons',
                    'Elder-to-Youth Knowledge Transfer',
                    'Gamified Learning Experiences',
                    'Peer-to-Peer Teaching Tools',
                    'Progress Tracking & Certification'
                ],
                plannedWork: [
                    'Design adaptive learning algorithms',
                    'Create content management system',
                    'Develop gamification mechanics',
                    'Build mentor-student matching'
                ],
                timeline: 'Q3-Q4 2025'
            }
        },
        governance: {
            title: 'Community Governance',
            status: 'Future Phase',
            progress: 0,
            icon: '🗳️',
            details: {
                overview: 'Democratic governance system allowing community members to guide platform evolution.',
                keyFeatures: [
                    'Decentralized Voting Mechanisms',
                    'Proposal & Discussion Forums',
                    'Transparent Decision Making',
                    'Community-Driven Roadmap',
                    'Cultural Council Representation'
                ],
                plannedWork: [
                    'Design governance token economics',
                    'Create voting smart contracts',
                    'Build proposal management system',
                    'Establish cultural council framework'
                ],
                timeline: '2026'
            }
        }
    };

    // Add click hint to phase items
    const phaseItems = document.querySelectorAll('.phase-item');
    phaseItems.forEach(item => {
        const hint = document.createElement('div');
        hint.className = 'click-hint';
        hint.textContent = 'Click for details →';
        item.appendChild(hint);
    });

    // Create popout function
    function createPopout(phaseKey, data) {
        const popout = document.createElement('div');
        popout.className = 'phase-popout';
        popout.innerHTML = `
            <div class="popout-header">
                <h3 class="popout-title">${data.title}</h3>
                <button class="popout-close">&times;</button>
            </div>
            <div class="popout-content">
                <div style="text-align: center; font-size: 4rem; margin-bottom: 20px;">
                    ${data.icon}
                </div>
                
                ${data.progress > 0 ? `
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${data.progress}%"></div>
                    </div>
                    <div class="progress-text">${data.progress}% Complete</div>
                ` : ''}
                
                <h5>Overview</h5>
                <p>${data.details.overview}</p>
                
                <h5>Key Features</h5>
                <ul>
                    ${data.details.keyFeatures.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
                
                ${data.details.currentWork ? `
                    <h5>Current Work</h5>
                    <ul>
                        ${data.details.currentWork.map(work => `<li>${work}</li>`).join('')}
                    </ul>
                ` : ''}
                
                ${data.details.plannedWork ? `
                    <h5>Planned Development</h5>
                    <ul>
                        ${data.details.plannedWork.map(work => `<li>${work}</li>`).join('')}
                    </ul>
                ` : ''}
                
                <h5>Timeline</h5>
                <p><strong>${data.details.timeline}</strong></p>
            </div>
        `;
        
        document.body.appendChild(popout);
        return popout;
    }

    // Add click handlers to phase items
    phaseItems.forEach((item, index) => {
        const phaseKeys = ['foundation', 'preservation', 'learning', 'governance'];
        const phaseKey = phaseKeys[index];
        
        if (phaseData[phaseKey]) {
            item.addEventListener('click', function() {
                const popout = createPopout(phaseKey, phaseData[phaseKey]);
                
                // Show overlay and popout
                overlay.classList.add('active');
                setTimeout(() => {
                    popout.classList.add('active');
                }, 100);
                
                // Close button handler
                const closeBtn = popout.querySelector('.popout-close');
                closeBtn.addEventListener('click', closePopout);
                
                // Close on overlay click
                overlay.addEventListener('click', closePopout);
                
                function closePopout() {
                    popout.classList.remove('active');
                    overlay.classList.remove('active');
                    setTimeout(() => {
                        document.body.removeChild(popout);
                    }, 400);
                }
                
                // Prevent closing when clicking inside popout
                popout.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
            });
        }
    });

    // Update foundation phase with progress bar
    const foundationItem = document.querySelector('.phase-progress');
    if (foundationItem) {
        const statusElement = foundationItem.querySelector('.phase-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <span>⚡</span>
                In Progress - 80% Complete
            `;
        }
        
        // Add progress bar to foundation phase
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
            <div class="progress-bar" style="width: 80%"></div>
        `;
        
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = '80% Complete';
        
        const contentElement = foundationItem.querySelector('.phase-content');
        if (contentElement) {
            contentElement.appendChild(progressContainer);
            contentElement.appendChild(progressText);
        }
    }

    // Add smooth scrolling and keyboard support
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const activePopout = document.querySelector('.phase-popout.active');
            if (activePopout) {
                activePopout.querySelector('.popout-close').click();
            }
        }
    });
});