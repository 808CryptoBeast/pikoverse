document.addEventListener('DOMContentLoaded', function() {
  // Cloud popout functionality
  const setupCloudPopouts = () => {
    document.querySelectorAll('.knowledge-card').forEach((card, index) => {
      const popout = card.querySelector('.subcategories-popout');
      
      card.addEventListener('mouseenter', () => {
        positionPopout(card, popout, index);
        animatePopoutIn(popout, index);
      });
      
      card.addEventListener('mouseleave', () => {
        animatePopoutOut(popout);
      });
    });

    // Handle window resize
    window.addEventListener('resize', debounce(() => {
      document.querySelectorAll('.knowledge-card').forEach(card => {
        const popout = card.querySelector('.subcategories-popout');
        if (popout.style.opacity === '1') {
          positionPopout(card, popout, 0);
        }
      });
    }, 100));
  };

  // Position popout based on available space
  const positionPopout = (card, popout, index) => {
    const cardRect = card.getBoundingClientRect();
    const popoutHeight = popout.offsetHeight;
    const viewportHeight = window.innerHeight;
    
    if (cardRect.top < popoutHeight + 40) {
      // Position below if not enough space above
      popout.style.top = 'calc(100% + 20px)';
      popout.style.transformOrigin = 'center top';
      popout.querySelector('::after').style.display = 'none';
    } else {
      // Default position above
      popout.style.top = '-20px';
      popout.style.transformOrigin = 'center bottom';
      popout.querySelector('::after').style.display = 'block';
    }
    
    // Add slight delay for staggered animations
    popout.style.animationDelay = `${index * 0.05}s`;
  };

  // Animation functions
  const animatePopoutIn = (popout, index) => {
    popout.style.animation = 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    popout.style.animationDelay = `${index * 0.05}s`;
  };

  const animatePopoutOut = (popout) => {
    popout.style.animation = 'popOut 0.3s ease-out forwards';
  };

  // Debounce helper for resize events
  const debounce = (func, wait) => {
    let timeout;
    return function() {
      const context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  };

  // Initialize
  setupCloudPopouts();
});