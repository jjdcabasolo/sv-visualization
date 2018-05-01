const express = require('express');
const app = express();
const path = require('path');

const sqlite = require('./public/js/sqlite');

app.use('/', express.static(path.join(__dirname, '/')));
app.use('/public', express.static(path.join(__dirname, '/public')));

app.get('/sv/results', function(req, res){
	sqlite.getSV(req.query.chr, req.query.type, req.query.start, req.query.end, res);		
});

// app.get('/sv/max', function(req, res){
// 	sqlite.maxSV(req.query.chr, req.query.type, req.query.start, req.query.end);		
// });

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.listen(8000, function () {
	console.log('Example app listening on port 8000!');
})