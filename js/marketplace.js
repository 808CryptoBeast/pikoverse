document.addEventListener('DOMContentLoaded', function() {
  // Check if user is admin
  const isAdmin = localStorage.getItem('admin') === 'true';
  if (isAdmin) {
    document.querySelector('.admin-controls').style.display = 'block';
  }

  // Product data with correct image paths
  let products = [
    {
      id: 1,
      name: 'AMP RYB T-Shirt',
      category: 'shirts',
      price: 24.99,
      description: 'Vibrant red, yellow, and blue design representing the Aloha spirit',
      image: 'assets/AMP-RYB.jpg',
      stock: 50,
      dateAdded: new Date('2023-01-15')
    },
    {
      id: 2,
      name: 'Rabbit Island Hat',
      category: 'hats',
      price: 19.99,
      description: 'Stylish hat featuring the iconic Rabbit Island landscape',
      image: 'assets/AMP-Rabbit-Island.jpg',
      stock: 30,
      dateAdded: new Date('2023-03-10')
    },
    {
      id: 3,
      name: 'Tiki Sticker Pack',
      category: 'stickers',
      price: 8.99,
      description: 'Set of Hawaiian tiki stickers perfect for laptops and water bottles',
      image: 'assets/AMPTTiki.jpg',
      stock: 100,
      dateAdded: new Date()
    }
  ];

  // DOM Elements
  const productsGrid = document.querySelector('.products-grid');
  const categoryBtns = document.querySelectorAll('.category-btn');
  const addProductBtn = document.getElementById('add-product-btn');
  const productModal = document.getElementById('product-modal');
  const checkoutModal = document.getElementById('checkout-modal');
  const productForm = document.getElementById('product-form');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const checkoutSummary = document.getElementById('checkout-summary');
  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  // Display products
  function displayProducts(filterCategory = 'all') {
    productsGrid.innerHTML = '';
    
    const filteredProducts = filterCategory === 'all' 
      ? products 
      : products.filter(product => product.category === filterCategory);
    
    filteredProducts.forEach(product => {
      const isNew = isProductNew(product.dateAdded);
      const productCard = createProductCard(product, isNew);
      productsGrid.appendChild(productCard);
    });
    
    addEventListeners();
  }

  function isProductNew(dateAdded) {
    if (!dateAdded) return false;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    return (new Date() - new Date(dateAdded)) < thirtyDaysInMs;
  }

  function createProductCard(product, isNew) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image-container">
        <img src="${product.image}" alt="${product.name}" class="product-image">
        ${isNew ? '<span class="product-badge">New</span>' : ''}
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <div class="product-price-container">
          <span class="product-price">$${product.price.toFixed(2)}</span>
          <span class="product-stock">${product.stock} in stock</span>
        </div>
        <p class="product-description">${product.description}</p>
        <div class="product-actions">
          <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
          <button class="wishlist-btn" aria-label="Add to wishlist">♥</button>
          ${isAdmin ? `
            <button class="edit-btn" data-id="${product.id}">✏️</button>
            <button class="delete-btn" data-id="${product.id}">🗑️</button>
          ` : ''}
        </div>
      </div>
    `;
    return card;
  }

  function addEventListeners() {
    // Add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', addToCart);
    });

    // Wishlist buttons
    document.querySelectorAll('.wishlist-btn').forEach(btn => {
      btn.addEventListener('click', toggleWishlist);
    });
    
    // Admin buttons
    if (isAdmin) {
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', editProduct);
      });
      
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', deleteProduct);
      });
    }
  }

  // Toggle wishlist function
  function toggleWishlist(e) {
    const btn = e.target;
    btn.classList.toggle('active');
  }

  // Category filter
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      displayProducts(btn.dataset.category);
    });
  });

  // Add to cart function
  function addToCart(e) {
    const productId = parseInt(e.target.dataset.id);
    const product = products.find(p => p.id === productId);
    
    if (product.stock < 1) {
      alert('This item is out of stock');
      return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert(`Only ${product.stock} available in stock`);
        return;
      }
      existingItem.quantity += 1;
    } else {
      cart.push({
        ...product,
        quantity: 1
      });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    showCheckoutModal();
  }

  // Show checkout modal
  function showCheckoutModal() {
    let total = 0;
    const shippingCost = 5.99;
    
    checkoutSummary.innerHTML = `
      <div class="order-summary">
        <h4>Your Order</h4>
        <div class="order-items">
          ${cart.length === 0 ? '<p>Your cart is empty</p>' : ''}
    `;
    
    cart.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      checkoutSummary.querySelector('.order-items').innerHTML += `
        <div class="cart-item">
          <p>${item.name} x ${item.quantity} - $${itemTotal.toFixed(2)}</p>
        </div>
      `;
    });
    
    checkoutSummary.innerHTML += `
        </div>
        <div class="order-total">
          <p>Subtotal: <span class="subtotal-amount">$${total.toFixed(2)}</span></p>
          <p>Shipping: <span class="shipping-amount">$${shippingCost.toFixed(2)}</span></p>
          <p class="total-amount">Total: <span>$${(total + shippingCost).toFixed(2)}</span></p>
        </div>
      </div>
    `;
    
    checkoutModal.style.display = 'block';
  }

  // Product management functions
  function openProductModal(product = null) {
    const form = document.getElementById('product-form');
    const title = document.getElementById('modal-title');
    
    if (product) {
      // Edit mode
      title.textContent = 'Edit Product';
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-category').value = product.category;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-description').value = product.description;
      document.getElementById('product-image').value = product.image;
      document.getElementById('product-stock').value = product.stock;
    } else {
      // Add mode
      title.textContent = 'Add New Product';
      form.reset();
      document.getElementById('product-id').value = '';
    }
    
    productModal.style.display = 'block';
  }

  function editProduct(e) {
    const productId = parseInt(e.target.dataset.id);
    const product = products.find(p => p.id === productId);
    openProductModal(product);
  }

  function deleteProduct(e) {
    if (confirm('Are you sure you want to delete this product?')) {
      const productId = parseInt(e.target.dataset.id);
      products = products.filter(p => p.id !== productId);
      displayProducts(document.querySelector('.category-btn.active').dataset.category);
    }
  }

  // Form submission
  productForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const productData = {
      id: document.getElementById('product-id').value || Date.now(),
      name: document.getElementById('product-name').value,
      category: document.getElementById('product-category').value,
      price: parseFloat(document.getElementById('product-price').value),
      description: document.getElementById('product-description').value,
      image: document.getElementById('product-image').value,
      stock: parseInt(document.getElementById('product-stock').value),
      dateAdded: document.getElementById('product-id').value ? 
        products.find(p => p.id === parseInt(document.getElementById('product-id').value)).dateAdded : 
        new Date()
    };
    
    if (document.getElementById('product-id').value) {
      // Update existing product
      const index = products.findIndex(p => p.id === parseInt(productData.id));
      products[index] = productData;
    } else {
      // Add new product
      products.push(productData);
    }
    
    productModal.style.display = 'none';
    displayProducts(document.querySelector('.category-btn.active').dataset.category);
  });

  // Modal controls
  addProductBtn.addEventListener('click', () => openProductModal());
  
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      productModal.style.display = 'none';
      checkoutModal.style.display = 'none';
    });
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === productModal || e.target === checkoutModal) {
      productModal.style.display = 'none';
      checkoutModal.style.display = 'none';
    }
  });

  // Payment buttons
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (cart.length === 0) {
        alert('Your cart is empty');
        return;
      }
      
      const method = this.classList.contains('venmo') ? 'Venmo' :
                     this.classList.contains('paypal') ? 'PayPal' : 'Cash App';
      const total = calculateTotal();
      
      // In a real app, this would connect to the payment processor's API
      alert(`Redirecting to ${method} to complete your payment of $${total}`);
      
      // Process payment (simulated)
      processPayment(method, total);
    });
  });

  function calculateTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 5.99;
    return (subtotal + shipping).toFixed(2);
  }

  function processPayment(method, amount) {
    // Simulate payment processing
    setTimeout(() => {
      // Update stock quantities
      cart.forEach(cartItem => {
        const product = products.find(p => p.id === cartItem.id);
        if (product) {
          product.stock -= cartItem.quantity;
        }
      });
      
      // Clear cart
      cart = [];
      localStorage.setItem('cart', JSON.stringify(cart));
      
      // Close modal and refresh display
      checkoutModal.style.display = 'none';
      displayProducts(document.querySelector('.category-btn.active').dataset.category);
      
      // Show confirmation
      alert(`Payment of $${amount} via ${method} completed successfully!`);
    }, 1000);
  }

  // Initialize
  displayProducts();
});