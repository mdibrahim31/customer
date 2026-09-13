const express = require('express');
const cors = require('cors');
const app = express();

// CORS enable kora jate je kono frontend theke request ashte pare
app.use(cors());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.json({ message: "Success! Render backend theke data asche." });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
