import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';


const app = express();
app.use(bodyParser.json());


// forward to cpp node (assumes cpp node exposes HTTP endpoint)
app.post('/blockchain/event', async (req, res) => {
const event = req.body;
// optional: validate event shape
try {
const r = await fetch(process.env.CPP_NODE_HTTP + '/events', {
method: 'POST',
body: JSON.stringify(event),
headers: { 'Content-Type': 'application/json' }
});
const json = await r.json();
return res.status(200).json(json);
} catch (err) {
console.error(err);
return res.status(500).json({ success: false, error: err.message });
}
});


app.listen(3001, () => console.log('Node bridge running on :3001'));