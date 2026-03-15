/* =====================================================
   netmods/index.js — Network “mods” loader
   Loads optional overlays that hook into network.js via:
   window event:  'nalulf-network-map'
   ===================================================== */

// If your overlay file lives in this SAME folder:
import './network_nodes.js';


// If you kept network_nodes.js next to main.js instead, use this instead:
// import '../network_nodes.js';