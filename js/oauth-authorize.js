(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var redirectUri = params.get('redirect_uri');
  var state = params.get('state') || '';

  function generateCode() {
    if (window.crypto && window.crypto.randomUUID) {
      return 'rs_code_' + window.crypto.randomUUID().replace(/-/g, '');
    }
    return 'rs_code_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  function doRedirect() {
    if (!redirectUri) {
      var countdownEl = document.getElementById('countdown');
      if (countdownEl) {
        countdownEl.textContent = 'Missing redirect_uri parameter in request.';
        countdownEl.style.color = '#ef4444';
      }
      return;
    }
    var code = generateCode();
    var sep = redirectUri.indexOf('?') === -1 ? '?' : '&';
    var dest = redirectUri + sep + 'code=' + encodeURIComponent(code);
    if (state) {
      dest += '&state=' + encodeURIComponent(state);
    }
    window.location.href = dest;
  }

  var authBtn = document.getElementById('authBtn');
  if (authBtn) {
    authBtn.addEventListener('click', function(e) {
      e.preventDefault();
      doRedirect();
    });
  }

  var remaining = 2;
  var timerEl = document.getElementById('timer');
  var interval = setInterval(function() {
    remaining--;
    if (timerEl) {
      timerEl.textContent = remaining;
    }
    if (remaining <= 0) {
      clearInterval(interval);
      doRedirect();
    }
  }, 1000);
})();
