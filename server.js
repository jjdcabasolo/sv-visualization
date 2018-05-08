const express = require('express');
const app = express();
const path = require('path');

const sqlite = require('./public/js/modules/sqlite');
const fastareader = require('./public/js/modules/fastareader');

app.use('/', express.static(path.join(__dirname, '/')));
app.use('/db', express.static(path.join(__dirname, '/db')));
app.use('/public', express.static(path.join(__dirname, '/public')));

app.get('/sv/view', function(req, res){
	function callback(data){
		res.status(200).send(data);
	}
	sqlite.openDB('./db/sv/processed/view.db');
	sqlite.getSV(req.query.chr, req.query.type, req.query.start, req.query.end, callback);		
});

app.get('/sv/table', function(req, res){
	function callback(data){
		res.status(200).send(data);
	}
	sqlite.openDB('./db/sv/processed/sv.db');
	sqlite.getSV(req.query.chr, req.query.type, req.query.start, req.query.end, callback);		
});

app.get('/ref/substring', function(req, res){
	function callback(data){
		res.status(200).send(data);
	}
	fastareader.getSubstring(req.query.chr, req.query.start, req.query.length, true, callback);		
});

app.get('/ref/chr/length', function(req, res){
	function callback(data){
		res.status(200).send(data);
	}
	fastareader.getChrLength(req.query.chr, callback);		
});

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.listen(8000, function () {
	console.log('sv-visualization running at localhost:8000.');
})