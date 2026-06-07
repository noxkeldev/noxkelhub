async function sendAuth(type) {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, username, password })
    });

    const data = await res.json();
    if (data.success) {
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';
        console.log("Logged in!");
    } else {
        alert("Failed to authenticate!");
    }
}
// Add this at the bottom of your game.js
window.addEventListener('keydown', async (e) => {
    if (e.key === '/') {
        const cmd = prompt("Enter Admin Command:");
        if (cmd) {
            const res = await fetch('/admin-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
            const data = await res.json();
            alert(data.success ? "Command Executed!" : "Failed!");
        }
    }
});
