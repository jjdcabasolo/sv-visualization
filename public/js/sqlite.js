var sqlite3 = require('sqlite3').verbose();
var svDB, refDB;

var arrayOfSV = new Array();

// module.exports.openRefGenomeDB = function(){
// 	refDB = new sqlite3.Database('./ref/raw/ref.db', (err) => {
// 		if(err){
// 			return console.error(err.message);
// 		}
// 		console.log('Connected to ref.db SQlite database.');
// 	});	
// }

// module.exports.closeRefDB = function(){
// 	refDB.close(); 
// }

var openDB = function(chr, type, start, end, res){
	svDB = new sqlite3.Database('./db/sv/processed/sv.db', (err) => {
		if(err){
			return console.error(err.message);
		}
	});	
}

module.exports.getSV = function(chr, type, start, end, res){
	openDB();

	svDB.serialize(function() {
		var query = 'SELECT * FROM ';

		// table
		switch(type){
			case 'DEL':
				query = query + 'deletions ';
				break;
			case 'INV':
				query = query + 'inversions ';
				break;
			case 'DUP':
				query = query + 'duplications ';
				break;
			case 'INS':
				query = query + 'insertions ';
				break;
			default:
				query = query + 'unknown ';
				break;
		}

		query = query + 'WHERE ';

		// chr number
		query = query + 'chr == ';
		query = query + '"' + chr + '"';
		query = query + ' AND ';
		
		// start
		query = query + 'start >= ';
		query = query + start;
		query = query + ' AND ';

		// end
		query = query + 'end <= ';
		query = query + end;

		// console.log(query);

		svDB.each(query, function(err, rows) {
			if(err){
				console.log(err);
			}
			else{
				arrayOfSV.push(rows);
			}
		});

		svDB.close(); 		

		var callback = setInterval(function(){
			if(arrayOfSV !== []){
				clearInterval(callback);
				res.send(arrayOfSV);
				arrayOfSV = [];
			}
		}, 10);
	});
}
