document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const statusMessage = document.getElementById('statusMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    statusMessage.textContent = "Connexion en cours...";
    statusMessage.className = "alert alert-info";

    try {
      const response = await window.api.login(email, password);
      
      if (response.success) {
        statusMessage.textContent = "Connexion réussie !";
        statusMessage.className = "alert alert-success";
        // Redirection vers le dashboard local
        // window.location.href = 'dashboard.html'; 
      } else {
        statusMessage.textContent = response.message || "Erreur de connexion.";
        statusMessage.className = "alert alert-danger";
      }
    } catch (error) {
      statusMessage.textContent = "Erreur inattendue.";
      statusMessage.className = "alert alert-danger";
      console.error(error);
    }
  });
});
