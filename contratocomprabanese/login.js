// A função de hash está correta, não precisa mudar.
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    // --- CORREÇÃO AQUI ---
    // 1. Crie um Array com os e-mails válidos
    const emailsCorretos = [
        "equipe@andressa.com",
        "equipe@alessandra.com",
        "equipe@junior.com",
        "equipe@michelle.com",
        "equipe@fenix.com"
    ];
    
    // A senha está correta (o hash para "123456")
    const senhaHashCorreta = "ab386d81ec1c55c539bb1afddb409a4f3ce159ecb9170debacad67c0484b7364";

    // Gera o hash da senha inserida pelo usuário
    const senhaHashDigitada = await hashPassword(password);
    
    // 2. Verifique se o e-mail digitado ESTÁ NO ARRAY (.includes())
    if (emailsCorretos.includes(email) && senhaHashDigitada === senhaHashCorreta) {
        localStorage.setItem('isAuthenticated', 'true');
        
        // 3. Redireciona para a página correta 
        window.location.href = 'termo.html'; 
    
    } else {
        errorMessage.textContent = "E-mail ou senha incorretos.";
        errorMessage.classList.remove('hidden');
    }
});