const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send("If you see this, the server is ALIVE!");
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running!');
});
