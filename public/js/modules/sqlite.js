var sqlite3 = require('sqlite3').verbose();
var svDB, refDB;

var arrayOfSV = new Array();

module.exports.openDB = function(filename){
	svDB = new sqlite3.Database(filename, (err) => {
		if(err){
			return console.error(err.message);
		}
	});	
}

module.exports.getSV = function(chr, type, start, end, callback){
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

		console.log(query);

		svDB.each(query, function(err, rows) {
			if(err){
				console.log(err);
			}
			else{
				if(type === 'INS') rows['sequence'] = rows['type'];
				rows['type'] = type;
				arrayOfSV.push(rows);
			}
		});

		svDB.close(); 		

		var interval = setInterval(function(){
			if(arrayOfSV !== []){
				clearInterval(interval);
				callback(arrayOfSV);
				arrayOfSV = [];
			}
		}, 3000);
	});
}