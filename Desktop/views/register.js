document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const statusMessage = document.getElementById('statusMessage');
  
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('password_confirm').value;
  
      if (password !== passwordConfirm) {
        statusMessage.textContent = "Les mots de passe ne correspondent pas.";
        statusMessage.className = "alert alert-danger";
        return;
      }
  
      statusMessage.textContent = "Inscription en cours (non implémenté)...";
      statusMessage.className = "alert alert-info";
  
      // TODO: Call window.api.register(...) and handle response
      setTimeout(() => {
          statusMessage.textContent = "Inscription réussie (simulation).";
          statusMessage.className = "alert alert-success";
      }, 1000);
    });
  });
