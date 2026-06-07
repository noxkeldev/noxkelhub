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
